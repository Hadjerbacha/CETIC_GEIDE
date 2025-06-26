const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
const { auth } = require('../middleware/auth');
const router = express.Router();
const axios = require('axios');
const { transcribeAudio } = require('../whisperTranscribe');
const NLP_SERVICE_URL = 'http://localhost:5001/classify';
const NLP_TIMEOUT = 3000; // 3 secondes timeout
const { logActivity } = require("./historique");

// PostgreSQL Pool configuration
const pool = new Pool({
  user: process.env.PG_USER || 'postgres',
  host: process.env.PG_HOST || 'localhost',
  database: process.env.PG_DATABASE || 'ged',
  password: process.env.PG_PASSWORD || 'hadjer',
  port: process.env.PG_PORT || 5432,
});

// Création du dossier de stockage des fichiers
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuration de multer pour l'upload de fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100 Mo
});

// Fonction de classification des documents (par exemple, CV ou Facture)


// Modifiez la fonction classifyText
// Modifiez la fonction classifyText pour gérer les médias
const classifyText = async (text, filePath) => {
  // Extraire l'extension du fichier
  const fileExtension = filePath.split('.').pop().toLowerCase();

  // Catégorisation basée sur l'extension
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
  const videoExtensions = ['mp4', 'avi', 'mkv', 'mov', 'webm', 'flv'];

  if (imageExtensions.includes(fileExtension)) {
    return 'photo';
  }
  if (videoExtensions.includes(fileExtension)) {
    return 'video';
  }

  // Si ce n'est pas un média, utiliser le NLP pour classification
  const defaultCategories = ["contrat", "facture", "demande_conge", "cv", "rapport", "autre"];

  try {
    const response = await axios.post(
      'http://127.0.0.1:5001/classify',
      {
        text: text.substring(0, 5000),
        categories: defaultCategories
      },
      {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    return response.data?.category || 'autre';
  } catch (error) {
    console.error('Erreur NLP (ou timeout dépassé) :', error.message);

    // Fallback basé sur des mots-clés
    const lowerText = text.toLowerCase();

    if (lowerText.includes('contrat') || lowerText.includes('agreement') || lowerText.includes('signature')) {
      return 'contrat';
    }
    if (lowerText.includes('facture') || lowerText.includes('invoice') || lowerText.includes('paiement')) {
      return 'facture';
    }
    if (lowerText.includes('demande') || lowerText.includes('conge') || lowerText.includes('jours')) {
      return 'demande_conge';
    }
    if (lowerText.includes('cv') || lowerText.includes('curriculum') || lowerText.includes('expérience') || lowerText.includes('compétence')) {
      return 'cv';
    }

    return 'autre';
  }
};
router.get('/:id/my-permissions', auth, async (req, res) => {
  const documentId = parseInt(req.params.id);
  const userId = req.user.id;

  try {
    // Étape 1 : vérifier les permissions explicites dans document_permissions
    const { rows: permRows } = await pool.query(`
      SELECT can_read, can_modify, can_delete, can_share, access_type
      FROM document_permissions
      WHERE document_id = $1 AND user_id = $2
      ORDER BY 
        CASE access_type
          WHEN 'owner' THEN 1
          WHEN 'custom' THEN 2
          WHEN 'public' THEN 3
          WHEN 'read' THEN 4
          ELSE 5
        END
      LIMIT 1;
    `, [documentId, userId]);

    if (permRows.length > 0) {
      return res.status(200).json(permRows[0]);
    }

    // Étape 2 : récupérer document
    const { rows: docRows } = await pool.query(`
      SELECT visibility, owner_id, id_share, id_group
      FROM documents
      WHERE id = $1
    `, [documentId]);

    if (docRows.length === 0) {
      return res.status(404).json({ error: "Document non trouvé." });
    }

    const document = docRows[0];

    // Étape 3 : si public → lecture seule
    if (document.visibility === 'public') {
      return res.status(200).json({
        can_read: true,
        can_modify: false,
        can_delete: false,
        can_share: false,
        access_type: 'public'
      });
    }

    // Étape 4 : si user est dans id_share
    if (document.id_share && document.id_share.includes(userId)) {
      return res.status(200).json({
        can_read: true,
        can_modify: false,
        can_delete: false,
        can_share: false,
        access_type: 'custom'
      });
    }

    // Étape 5 : si user appartient à un groupe de id_group
    if (document.id_group && document.id_group.length > 0) {
      const { rows: groupRows } = await pool.query(
        `SELECT 1 FROM user_groups WHERE user_id = $1 AND group_id = ANY($2) LIMIT 1`,
        [userId, document.id_group]
      );

      if (groupRows.length > 0) {
        return res.status(200).json({
          can_read: true,
          can_modify: false,
          can_delete: false,
          can_share: false,
          access_type: 'group'
        });
      }
    }

    // Sinon : pas de droit
    return res.status(403).json({ error: "Aucune permission trouvée pour ce document." });

  } catch (err) {
    console.error('Erreur récupération des permissions:', err.stack);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});


// Initialisation des tables de la base de données
async function initializeDatabase() {
  try {
    // Table pour les documents
    await pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        category TEXT,
        text_content TEXT,
        summary TEXT,               -- 🆕 Description
        tags TEXT[],                -- 🆕 Tableau de mots-clés
        owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        visibility VARCHAR(20) DEFAULT 'private',
        version INTEGER DEFAULT 1,
        original_id INTEGER,
        ocr_text TEXT,
        date TIMESTAMP DEFAULT NOW()
      );
    `);

    // Table pour les versions de documents
    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_versions (
        id SERIAL PRIMARY KEY,
        document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        name TEXT,
        file_path TEXT,
        category TEXT,
        text_content TEXT,
        summary TEXT,
        tags TEXT[],
        owner_id INTEGER,
        visibility VARCHAR(20),
        ocr_text TEXT,
        date TIMESTAMP DEFAULT NOW()
      );
    `);


    // Table pour les collections
    await pool.query(`
      CREATE TABLE IF NOT EXISTS collections (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        date TIMESTAMP DEFAULT NOW()
      );
    `);

    // Table de liaison entre documents et collections
    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_collections (
        document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
        collection_id INTEGER REFERENCES collections(id) ON DELETE CASCADE,
        is_saved BOOLEAN DEFAULT FALSE,
        collection_name TEXT,
        PRIMARY KEY (document_id, collection_id)
      );
    `);

    // Table pour les permissions des documents
    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_permissions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
        access_type VARCHAR(20) DEFAULT 'read'
      );
    `);

    // Table des factures
    await pool.query(`
  CREATE TABLE IF NOT EXISTS factures (
    id SERIAL PRIMARY KEY,
    document_id INTEGER UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    numero_facture TEXT,
    montant NUMERIC,
    date_facture DATE
  );
`);

    // Table des CV
    await pool.query(`
  CREATE TABLE IF NOT EXISTS cv (
    id SERIAL PRIMARY KEY,
    document_id INTEGER UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    nom_candidat TEXT,
    experience TEXT,
    domaine TEXT
  );
`);

    // Table des demandes de congés
    await pool.query(`
  CREATE TABLE IF NOT EXISTS demande_conges (
    id SERIAL PRIMARY KEY,
    document_id INTEGER UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    numDemande TEXT,
    dateConge DATE
  );
`);


    console.log('✅ Tables documents, versions, collections, document_collections et document_permissions prêtes');
  } catch (err) {
    console.error('❌ Erreur lors de l\'initialisation des tables :', err.stack);
  }
}

router.get('/search', async (req, res) => {
  const client = await pool.connect();
  try {
    const { category, ...filters } = req.query;

    if (!category) {
      return res.status(400).json({ error: 'Catégorie requise' });
    }

    let query = '';
    let values = [];
    let whereClauses = [];
    let tableAlias = 'd';

    if (category === 'cv') {
      query = `
        SELECT d.*, cv.*
        FROM documents d
        JOIN cv ON d.id = cv.document_id
      `;

      if (filters.nom_candidat) {
        values.push(`%${filters.nom_candidat}%`);
        whereClauses.push(`cv.nom_candidat ILIKE $${values.length}`);
      }
      if (filters.metier) {
        values.push(`%${filters.metier}%`);
        whereClauses.push(`cv.metier ILIKE $${values.length}`);
      }
      if (filters.date_cv) {
        values.push(filters.date_cv);
        whereClauses.push(`cv.date_cv = $${values.length}`);
      }
    }

    else if (category === 'facture') {
      query = `
        SELECT d.*, f.*
        FROM documents d
        JOIN factures f ON d.id = f.document_id
      `;

      if (filters.numero_facture) {
        values.push(`%${filters.numero_facture}%`);
        whereClauses.push(`f.numero_facture ILIKE $${values.length}`);
      }
      if (filters.montant) {
        values.push(filters.montant);
        whereClauses.push(`f.montant = $${values.length}`);
      }
      if (filters.date_facture) {
        values.push(filters.date_facture);
        whereClauses.push(`f.date_facture = $${values.length}`);
      }
    }

    else if (category === 'demande_conge') {
      query = `
    SELECT 
      d.*, 
      dc.id as demande_id,
      dc.num_demande,
      dc.date_debut,
      dc.date_fin,
      dc.motif
    FROM documents d
    JOIN demande_conges dc ON d.id = dc.document_id
  `;

      // Filtres pour demande_conge
      if (filters.numdemande) {
        values.push(`%${filters.numdemande}%`);
        whereClauses.push(`dc.num_demande ILIKE $${values.length}`);
      }

      if (filters.date_debut) {
        values.push(filters.date_debut);
        whereClauses.push(`dc.date_debut >= $${values.length}`);
      }

      if (filters.date_fin) {
        values.push(filters.date_fin);
        whereClauses.push(`dc.date_fin <= $${values.length}`);
      }

      if (filters.motif) {
        values.push(`%${filters.motif}%`);
        whereClauses.push(`dc.motif ILIKE $${values.length}`);
      }
    }
    else {
      return res.status(400).json({ error: 'Catégorie non supportée' });
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ` + whereClauses.join(' AND ');
    }

    query += ` ORDER BY d.created_at DESC`;

    const result = await client.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur recherche avancée :', err);
    res.status(500).json({ error: 'Erreur lors de la recherche avancée' });
  } finally {
    client.release();
  }
});

router.get('/', auth, async (req, res) => {
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  const {
    filterType,
    startDate,
    endDate,
    searchQuery = '',
    selectedCategory = '',
    description = '',
    summary = '',
    // Filtres facture
    numero_facture,
    montant,
    date_facture,
    nom_entreprise,
    produit,
    // Filtres CV
    nom_candidat,
    metier,
    date_cv,
    // Filtres demande congé
    num_demande,
    date_debut,
    date_fin,
    motif,
    // Filtres contrat
    numero_contrat,
    type_contrat,
    partie_prenante,
    date_signature,
    date_echeance,
    montant_contrat,
    statut
  } = req.query;

  try {
   // Modifiez la requête principale pour formater toutes les dates
let baseQuery = `
  SELECT DISTINCT d.*, dc.is_saved, dc.collection_name,
    f.numero_facture, f.montant, 
    TO_CHAR(f.date_facture, 'YYYY-MM-DD') as date_facture, 
    f.nom_entreprise, f.produit, 
    cv.nom_candidat, cv.metier, 
    TO_CHAR(cv.date_cv, 'YYYY-MM-DD') as date_cv,
    dcong.num_demande, 
    TO_CHAR(dcong.date_debut, 'YYYY-MM-DD') as date_debut, 
    TO_CHAR(dcong.date_fin, 'YYYY-MM-DD') as date_fin, 
    dcong.motif,
    c.numero_contrat, c.type_contrat, c.partie_prenante, 
    TO_CHAR(c.date_signature, 'YYYY-MM-DD') as date_signature, 
    TO_CHAR(c.date_echeance, 'YYYY-MM-DD') as date_echeance, 
    c.montant as montant_contrat, c.statut
  FROM documents d
  LEFT JOIN document_collections dc ON dc.document_id = d.id
  LEFT JOIN factures f ON f.document_id = d.id
  LEFT JOIN cv ON cv.document_id = d.id
  LEFT JOIN demande_conges dcong ON dcong.document_id = d.id
  LEFT JOIN contrats c ON c.document_id = d.id
  ${!isAdmin ? 'LEFT JOIN document_permissions dp ON dp.document_id = d.id' : ''}
  WHERE true
`;

    const params = [];
    let paramIndex = 1;

    if (!isAdmin) {
      baseQuery += `
        AND (
          d.visibility = 'public'
          OR (dp.user_id = $${paramIndex} AND dp.access_type IN ('custom', 'read', 'owner'))
        )
      `;
      params.push(userId);
      paramIndex++;
    }

    baseQuery += ` AND d.is_completed = true`;

    if (filterType && filterType !== 'Tous les documents') {
      baseQuery += ` AND LOWER(SPLIT_PART(d.file_path, '.', -1)) = $${paramIndex}`;
      params.push(filterType.toLowerCase());
      paramIndex++;
    }

    if (startDate) {
      baseQuery += ` AND d.date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      baseQuery += ` AND d.date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (selectedCategory) {
      baseQuery += ` AND LOWER(d.category) = $${paramIndex}`;
      params.push(selectedCategory.toLowerCase());
      paramIndex++;
    }

    if (searchQuery) {
      baseQuery += ` AND (
        LOWER(d.name) LIKE $${paramIndex}
        OR LOWER(d.text_content) LIKE $${paramIndex}
        OR LOWER(d.summary) LIKE $${paramIndex}
        OR LOWER(d.description) LIKE $${paramIndex}
        OR LOWER(d.folder) LIKE $${paramIndex}
        OR LOWER(d.author) LIKE $${paramIndex}
        OR EXISTS (
          SELECT 1 FROM unnest(d.tags) AS tag WHERE LOWER(tag) LIKE $${paramIndex}
        )
      )`;
      params.push(`%${searchQuery.toLowerCase()}%`);
      paramIndex++;
    }
    // AJOUTEZ ces nouveaux blocs :
    // Filtre par description
    if (description) {
      baseQuery += ` AND LOWER(d.description) LIKE $${paramIndex}`;
      params.push(`%${description.toLowerCase()}%`);
      paramIndex++;
    }

    // Filtre par summary
    if (summary) {
      baseQuery += ` AND LOWER(d.summary) LIKE $${paramIndex}`;
      params.push(`%${summary.toLowerCase()}%`);
      paramIndex++;
    }

    // Filtres spécifiques pour CV
    if (selectedCategory.toLowerCase() === 'cv') {
      // Changez LEFT JOIN en INNER JOIN pour ne garder que les documents avec CV
      baseQuery = baseQuery.replace('LEFT JOIN cv ON cv.document_id = d.id', 'INNER JOIN cv ON cv.document_id = d.id');

      // Ajoutez le filtre de catégorie (en supposant que le champ s'appelle 'category')
      baseQuery += ` AND LOWER(d.category) = $${paramIndex}`;
      params.push('cv');
      paramIndex++;

      if (num_cv) {
        baseQuery += ` AND cv.num_cv ILIKE $${paramIndex}`;
        params.push(`%${num_cv}%`);
        paramIndex++;
      }

      if (nom_candidat) {
        baseQuery += ` AND cv.nom_candidat ILIKE $${paramIndex}`;
        params.push(`%${nom_candidat}%`);
        paramIndex++;
      }

      if (metier) {
        baseQuery += ` AND cv.metier ILIKE $${paramIndex}`;
        params.push(`%${metier}%`);
        paramIndex++;
      }

      // Pour les autres champs
      if (domaine) {
        baseQuery += ` AND cv.domaine ILIKE $${paramIndex}`;
        params.push(`%${domaine}%`);
        paramIndex++;
      }
    }

    // Ajoutez ces filtres supplémentaires si besoin
    if (req.query.domaine) {
      baseQuery += ` AND cv.domaine ILIKE $${paramIndex}`;
      params.push(`%${req.query.domaine}%`);
      paramIndex++;
    }

    if (req.query.experience) {
      baseQuery += ` AND cv.experience ILIKE $${paramIndex}`;
      params.push(`%${req.query.experience}%`);
      paramIndex++;
    }


    // Filtres spécifiques Facture
    if (selectedCategory === 'facture') {
      if (numero_facture) {
        baseQuery += ` AND f.numero_facture ILIKE $${paramIndex}`;
        params.push(`%${numero_facture}%`);
        paramIndex++;
      }
      if (montant) {
        baseQuery += ` AND f.montant = $${paramIndex}`;
        params.push(montant);
        paramIndex++;
      }
      if (date_facture) {
       baseQuery += ` AND DATE_TRUNC('day', f.date_facture) = DATE_TRUNC('day', $${paramIndex}::timestamp)`;
        params.push(date_facture);
        paramIndex++;
      }
      if (nom_entreprise) {
        baseQuery += ` AND f.nom_entreprise ILIKE $${paramIndex}`;
        params.push(`%${nom_entreprise}%`);
        paramIndex++;
      }
      if (produit) {
        baseQuery += ` AND f.produit ILIKE $${paramIndex}`;
        params.push(`%${produit}%`);
        paramIndex++;
      }
    }

    // Filtres spécifiques Demande Congé
    if (selectedCategory === 'demande_conge') {
      if (num_demande) {
        baseQuery += ` AND dcong.num_demande ILIKE $${paramIndex}`;
        params.push(`%${num_demande}%`);
        paramIndex++;
      }
      if (date_debut) {
       baseQuery += ` AND DATE_TRUNC('day', dcong.date_debut) >= DATE_TRUNC('day', $${paramIndex}::timestamp)`;
        params.push(date_debut);
        paramIndex++;
      }
      if (date_fin) {
       baseQuery += ` AND DATE_TRUNC('day', dcong.date_fin) <= DATE_TRUNC('day', $${paramIndex}::timestamp)`;
        params.push(date_fin);
        paramIndex++;
      }
      if (motif) {
        baseQuery += ` AND dcong.motif ILIKE $${paramIndex}`;
        params.push(`%${motif}%`);
        paramIndex++;
      }
    }

    if (category === 'rapport') {
      const rapportFilters = ['type_rapport', 'auteur', 'date_rapport', 'periode_couverte', 'destinataire'];
      rapportFilters.forEach(filter => {
        if (filters[filter]) {
          if (filter === 'date_rapport') {
            baseQuery += ` AND r.date_rapport = $${paramIndex}`;
            params.push(filters[filter]);
          } else {
            baseQuery += ` AND LOWER(r.${filter}) LIKE $${paramIndex}`;
            params.push(`%${filters[filter].toLowerCase()}%`);
          }
          paramIndex++;
        }
      });
    }
    // Filtres spécifiques Contrat
    if (selectedCategory === 'contrat') {
      if (numero_contrat) {
       baseQuery += ` AND DATE_TRUNC('day', c.date_signature) = DATE_TRUNC('day', $${paramIndex}::timestamp)`;
        params.push(`%${numero_contrat}%`);
        paramIndex++;
      }
      if (type_contrat) {
        baseQuery += ` AND LOWER(c.type_contrat) = $${paramIndex}`;
        params.push(type_contrat.toLowerCase());
        paramIndex++;
      }
      if (partie_prenante) {
        baseQuery += ` AND c.partie_prenante ILIKE $${paramIndex}`;
        params.push(`%${partie_prenante}%`);
        paramIndex++;
      }
      if (date_signature) {
        baseQuery += ` AND c.date_signature = $${paramIndex}`;
        params.push(date_signature);
        paramIndex++;
      }
      if (date_echeance) {
      baseQuery += ` AND DATE_TRUNC('day', c.date_echeance) = DATE_TRUNC('day', $${paramIndex}::timestamp)`;
        params.push(date_echeance);
        paramIndex++;
      }
      if (montant_contrat) {
        baseQuery += ` AND c.montant = $${paramIndex}`;
        params.push(montant_contrat);
        paramIndex++;
      }
      if (statut) {
        baseQuery += ` AND LOWER(c.statut) = $${paramIndex}`;
        params.push(statut.toLowerCase());
        paramIndex++;
      }
    }

    
    baseQuery += ` ORDER BY d.date DESC`;

    const result = await pool.query(baseQuery, params);

    // Organisation des résultats
    const documents = result.rows.map((doc) => {
      const {
        numero_facture, montant, date_facture, nom_entreprise, produit,
        nom_candidat, metier, date_cv,
        num_demande, date_debut, date_fin, motif,
        numero_contrat, type_contrat, partie_prenante,
        date_signature, date_echeance, montant_contrat, statut,
        ...baseDoc
      } = doc;

      let metadata = {};

      if (doc.category === 'facture') {
        metadata = { numero_facture, montant, date_facture, nom_entreprise, produit };
      } else if (doc.category === 'cv') {
        metadata = { nom_candidat, metier, date_cv };
      } else if (doc.category === 'demande_conge') {
        metadata = { num_demande, date_debut, date_fin, motif };
      } else if (doc.category === 'contrat') {
        metadata = {
          numero_contrat,
          type_contrat,
          partie_prenante,
          date_signature,
          date_echeance,
          montant: montant_contrat,
          statut
        };
      }

      return {
        ...baseDoc,
        metadata,
      };
    });

    res.status(200).json(documents);
  } catch (err) {
    console.error('Erreur dans /documents :', err.stack);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// Nouveau endpoint pour last-completed
// GET /api/documents/last-completed
router.get('/last-completed', async (req, res) => {
  try {
    const { name, exclude_id } = req.query;

    const query = `
      SELECT * FROM documents 
      WHERE name = $1 
      AND is_completed = true
      ${exclude_id ? 'AND id != $2' : ''}
      ORDER BY version DESC 
      LIMIT 1
    `;

    const params = exclude_id ? [name, exclude_id] : [name];

    const result = await pool.query(query, params);

    res.json({ document: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.get('/check-name', async (req, res) => {
  const { name, currentDocId } = req.query; // Ajoutez currentDocId pour exclure le document actuel

  if (!name) return res.status(400).json({ error: 'Nom manquant' });

  try {
    let query;
    let params = [name];

    if (currentDocId) {
      query = 'SELECT * FROM documents WHERE name = $1 AND id != $2 ORDER BY version DESC LIMIT 1';
      params.push(currentDocId);
    } else {
      query = 'SELECT * FROM documents WHERE name = $1 ORDER BY version DESC LIMIT 1';
    }

    const doc = await pool.query(query, params);

    if (doc.rows.length > 0) {
      return res.json({
        exists: true,
        document: doc.rows[0],
        canAddVersion: true // Vous pourriez ajouter cette info si nécessaire
      });
    } else {
      return res.json({ exists: false });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


router.post('/', auth, upload.single('file'), async (req, res) => {
  let {
    name,
    access = req.body.access || req.body.visibility || 'private',
    summary = '',
    tags = '',
    prio,
    id_share,
    id_group,
    folder_id,
    can_modify = false,
    can_delete = false
  } = req.body;

  // Cast folder_id en entier, ou null si absent/invalide
  folder_id = Number(folder_id);
  if (isNaN(folder_id)) folder_id = null;

  if (!req.file) {
    return res.status(400).json({ error: 'Fichier non téléchargé' });
  }

  if (!name || name.trim() === '') {
    name = req.file.originalname || `document-${Date.now()}`;
  }

  const fullPath = req.file.path;
  const file_path = `/uploads/${req.file.filename}`;
  const mimeType = mime.lookup(req.file.originalname) || ''; // ← FIX ici

  const canModify = can_modify === 'true' || can_modify === true;
  const canDelete = can_delete === 'true' || can_delete === true;
  const rawCanShare = req.body.can_share === 'true' || req.body.can_share === true;

  try {
    let extractedText = '';

    if (mimeType.startsWith('application/pdf')) {
      const dataBuffer = fs.readFileSync(fullPath);
      const data = await pdfParse(dataBuffer);
      extractedText = data.text;
    } else if (mimeType.startsWith('image/')) {
      const result = await Tesseract.recognize(fullPath, 'eng');
      extractedText = result.data.text;
    } else if (mimeType.startsWith('video/')) {
      try {
        extractedText = await transcribeAudio(fullPath);
        if (!extractedText.trim()) {
          extractedText = '[Vidéo sans transcription détectée]';
        }
      } catch (err) {
        console.warn('⚠️ Transcription Whisper échouée:', err);
        extractedText = '[Vidéo non transcrite]';
      }
    }


    const finalCategory = await classifyText(extractedText, req.file.originalname);

    const existing = await pool.query(
      'SELECT * FROM documents WHERE name = $1 ORDER BY version DESC NULLS LAST LIMIT 1',
      [name]
    );

    let version = null;
    let original_id = null;

    if (existing.rowCount > 0) {
      const latestDoc = existing.rows[0];

      if (latestDoc.is_completed) {
        version = latestDoc.version ? latestDoc.version + 1 : 1;
        original_id = latestDoc.original_id || latestDoc.id;
      } else {
        version = null;
        original_id = null;
      }
    } else {
      version = 1;
    }

    const sanitizeVisibility = (val) => {
      if (!val) return 'private';
      if (Array.isArray(val)) return val[0];
      if (typeof val === 'string') {
        try {
          const parsed = JSON.parse(val);
          return Array.isArray(parsed) ? parsed[0] : val;
        } catch {
          return val;
        }
      }
      return 'private';
    };
    const visibility = sanitizeVisibility(access);

    const parseTags = (tags) => {
      try {
        if (typeof tags === 'string' && tags.trim().startsWith('[')) {
          return JSON.parse(tags).map(t => t.trim()).filter(Boolean);
        } else if (typeof tags === 'string') {
          return tags.split(',').map(t => t.trim()).filter(Boolean);
        } else if (Array.isArray(tags)) {
          return tags.map(t => String(t).trim()).filter(Boolean);
        }
      } catch {
        return [];
      }
    };
    const parsedTags = parseTags(tags);

    const allowedPriorities = ['basse', 'moyenne', 'haute'];
    const priority = allowedPriorities.includes((prio || '').toLowerCase()) ? prio.toLowerCase() : 'moyenne';

    const parseIntArray = (value) => {
      try {
        const arr = typeof value === 'string' ? JSON.parse(value) : value;
        return Array.isArray(arr) ? arr.map(Number).filter(n => !isNaN(n)) : [];
      } catch {
        return [];
      }
    };
    id_share = parseIntArray(id_share);
    id_group = parseIntArray(id_group);

    const result = await pool.query(`
      INSERT INTO documents 
        (name, file_path, category, text_content, summary, tags, owner_id,
         visibility, version, original_id, ocr_text, priority, id_share, id_group, folder_id, metadata)
      VALUES 
        ($1, $2, $3, $4, $5, $6::text[], $7,
         $8, $9, $10, $11, $12, $13::int[], $14::int[], $15, $16)
      RETURNING *;
    `, [
      name,
      file_path,
      finalCategory,
      extractedText,
      summary,
      parsedTags,
      req.user.id,
      visibility,
      version,
      original_id,
      extractedText,
      priority,
      id_share,
      id_group,
      folder_id,
      {} // metadata vide
    ]);

    const documentId = result.rows[0].id;

    // Autorisation propriétaire
    await pool.query(`
      INSERT INTO document_permissions 
      (user_id, document_id, access_type, can_read, can_modify, can_delete, can_share)
      VALUES ($1, $2, 'owner', true, true, true, true)
    `, [req.user.id, documentId]);

    // Accès public
    if (visibility === 'public') {
      const allUsers = await pool.query('SELECT id FROM users');
      await Promise.all(allUsers.rows.map(user =>
        pool.query(
          `INSERT INTO document_permissions 
           (user_id, document_id, access_type, can_read, can_modify, can_delete, can_share)
           VALUES ($1, $2, 'public', true, $3, $4, $5)`,
          [user.id, documentId, canModify, canDelete, rawCanShare]
        )
      ));
    }

    // Accès personnalisés
    if (visibility === 'custom' && Array.isArray(id_share)) {
      await Promise.all(
        id_share.map(userId =>
          pool.query(
            `INSERT INTO document_permissions 
             (user_id, document_id, access_type, can_read, can_modify, can_delete, can_share)
             VALUES ($1, $2, 'custom', true, $3, $4, $5)`,
            [userId, documentId, canModify, canDelete, rawCanShare]
          )
        )
      );
    }

    res.status(201).json({
      id: documentId,
      category: finalCategory,
      message: 'Document créé (étape 1)',
    });

    await logActivity(req.user.id, 'upload', 'document', documentId, {
      fileName: name,
      fileType: mimeType,
      category: finalCategory
    });

  } catch (err) {
    console.error('❌ Erreur upload étape 1 :', err.stack);
    if (req.file) fs.unlink(req.file.path, () => { });
    res.status(500).json({ error: 'Erreur upload étape 1', details: err.message });
  }
});

router.get('/latest', auth, async (req, res) => {
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  try {
    let query = `
      SELECT DISTINCT ON (d.name) d.*,
        f.id as facture_id, f.numero_facture, f.montant, f.date_facture, f.nom_entreprise, f.produit,
        cv.id as cv_id, cv.nom_candidat, cv.experience, cv.domaine, cv.num_cv, cv.metier, cv.lieu, cv.date_cv,
        dc.id as demande_conge_id, dc.num_demande, dc.date_debut, dc.date_fin, dc.motif,
        co.id as contrat_id, co.numero_contrat, co.type_contrat, co.partie_prenante, 
        co.date_signature, co.date_echeance, co.montant as montant_contrat, co.statut,
        r.id as rapport_id, r.type_rapport, r.auteur, r.date_rapport, r.periode_couverte, r.destinataire
      FROM documents d
      LEFT JOIN factures f ON f.document_id = d.id
      LEFT JOIN cv cv ON cv.document_id = d.id
      LEFT JOIN demande_conge dc ON dc.document_id = d.id
      LEFT JOIN contrats co ON co.document_id = d.id
      LEFT JOIN rapports r ON r.document_id = d.id
      WHERE d.is_completed = true
      AND d.is_archived = false
    `;

    if (!isAdmin) {
      query += `
        AND (
          d.visibility = 'public'
          OR EXISTS (
            SELECT 1 FROM document_permissions dp 
            WHERE dp.document_id = d.id AND dp.user_id = $1 AND dp.can_read = true
          )
          OR ($1 = ANY(d.id_share))
          OR EXISTS (
            SELECT 1 FROM user_groups ug
            WHERE ug.user_id = $1 AND ug.group_id = ANY(d.id_group)
          )
        )
      `;
    }

    query += ` ORDER BY d.name, d.version DESC`;

    const result = await pool.query(query, isAdmin ? [] : [userId]);

    // Normalisation des données
    const normalizedRows = result.rows.map(row => ({
      ...row,
      summary: row.summary || '',
      category: row.category || 'autre',
      // Fusion des métadonnées spécifiques
      ...(row.contrat_id ? {
        numero_contrat: row.numero_contrat,
        type_contrat: row.type_contrat,
        partie_prenante: row.partie_prenante,
        date_signature: row.date_signature,
        date_echeance: row.date_echeance,
        montant_contrat: row.montant_contrat,
        statut_contrat: row.statut
      } : {}),
      ...(row.cv_id && {  // <-- Ajoutez cette section pour les CV
        nom_candidat: row.nom_candidat,
        metier: row.metier,
        experience: row.experience,
        domaine: row.domaine,
        num_cv: row.num_cv,
        lieu: row.lieu,
        date_cv: row.date_cv
      }),
      ...(row.rapport_id ? {
        type_rapport: row.type_rapport,
        auteur: row.auteur,
        date_rapport: row.date_rapport,
        periode_couverte: row.periode_couverte,
        destinataire: row.destinataire
      } : {})
    }));

    res.status(200).json(normalizedRows);
  } catch (err) {
    console.error('Erreur récupération dernières versions :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/incomplete', auth, async (req, res) => {
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  try {
    let query = `
      SELECT DISTINCT ON (d.name) d.*,
        f.id as facture_id, f.numero_facture, f.montant, f.date_facture, f.nom_entreprise, f.produit,
        cv.id as cv_id, cv.nom_candidat, cv.experience, cv.domaine, cv.num_cv, cv.metier, cv.lieu, cv.date_cv,
        dc.id as demande_conge_id, dc.num_demande, dc.date_debut, dc.date_fin, dc.motif,
        co.id as contrat_id, co.numero_contrat, co.type_contrat, co.partie_prenante, 
        co.date_signature, co.date_echeance, co.montant as montant_contrat, co.statut,
        r.id as rapport_id, r.type_rapport, r.auteur, r.date_rapport, r.periode_couverte, r.destinataire
      FROM documents d
      LEFT JOIN factures f ON f.document_id = d.id
      LEFT JOIN cv cv ON cv.document_id = d.id
      LEFT JOIN demande_conge dc ON dc.document_id = d.id
      LEFT JOIN contrats co ON co.document_id = d.id
      LEFT JOIN rapports r ON r.document_id = d.id
      WHERE d.is_completed = false
      AND d.is_archived = false
    `;

    if (!isAdmin) {
      query += `
        AND (
          d.visibility = 'public'
          OR EXISTS (
            SELECT 1 FROM document_permissions dp 
            WHERE dp.document_id = d.id AND dp.user_id = $1 AND dp.can_read = true
          )
          OR ($1 = ANY(d.id_share))
          OR EXISTS (
            SELECT 1 FROM user_groups ug
            WHERE ug.user_id = $1 AND ug.group_id = ANY(d.id_group)
          )
        )
      `;
    }

    query += ` ORDER BY d.name, d.version DESC`;

    const result = await pool.query(query, isAdmin ? [] : [userId]);

    // Normalisation des données
    const normalizedRows = result.rows.map(row => ({
      ...row,
      summary: row.summary || '',
      category: row.category || 'autre',
      // Fusion des métadonnées spécifiques
      ...(row.contrat_id ? {
        numero_contrat: row.numero_contrat,
        type_contrat: row.type_contrat,
        partie_prenante: row.partie_prenante,
        date_signature: row.date_signature,
        date_echeance: row.date_echeance,
        montant_contrat: row.montant_contrat,
        statut_contrat: row.statut
      } : {}),
      ...(row.rapport_id ? {
        type_rapport: row.type_rapport,
        auteur: row.auteur,
        date_rapport: row.date_rapport,
        periode_couverte: row.periode_couverte,
        destinataire: row.destinataire
      } : {})
    }));

    res.status(200).json(normalizedRows);
  } catch (err) {
    console.error('Erreur récupération dernières versions :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
router.get('/archive', auth, async (req, res) => {
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  try {
    let result;

    if (isAdmin) {
      // Tous les documents archivés complétés avec date_archive
      result = await pool.query(`
        SELECT d.*, 
               TO_CHAR(d.date_archive, 'DD/MM/YYYY HH24:MI') as formatted_date_archive
        FROM documents d
        WHERE d.is_completed = true
        AND d.is_archived = true
        ORDER BY d.date_archive DESC, d.name, d.version DESC
      `);
    } else {
      // Documents archivés visibles par l'utilisateur avec date_archive
      result = await pool.query(`
        SELECT d.*,
               TO_CHAR(d.date_archive, 'DD/MM/YYYY HH24:MI') as formatted_date_archive
        FROM documents d
        JOIN document_permissions dp ON dp.document_id = d.id
        WHERE dp.user_id = $1
        AND dp.can_read = true
        AND d.is_completed = true
        AND d.is_archived = true
        ORDER BY d.date_archive DESC, d.name, d.version DESC
      `, [userId]);
    }

    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Erreur récupération archives :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Archive un document (admin uniquement)
router.put('/:id/archive', auth, async (req, res) => {
  const { id } = req.params;
  const userRole = req.user.role;

  if (userRole !== 'admin') {
    return res.status(403).json({ message: 'Accès interdit. Seul un administrateur peut archiver.' });
  }

  try {
    await pool.query(
      'UPDATE documents SET is_archived = true, date_archive = NOW() WHERE id = $1 RETURNING *',
      [id]
    );

    const updatedDoc = await pool.query(
      'SELECT *, TO_CHAR(date_archive, \'DD/MM/YYYY HH24:MI\') as formatted_date_archive FROM documents WHERE id = $1',
      [id]
    );

    res.status(200).json({
      message: 'Document archivé avec succès.',
      document: updatedDoc.rows[0]
    });

    // Ajoutez ceci
    await logActivity(req.user.id, 'archive', 'document', id, {
      action: 'archive'
    });

  } catch (error) {
    console.error('Erreur lors de l’archivage :', error);
    res.status(500).json({ error: 'Erreur serveur lors de l’archivage.' });
  }
});
// routes/documents.js
router.put('/:id/affiche', auth, async (req, res) => {
  const docId = req.params.id;
  const isArchived = req.body.is_archived;
  const userRole = req.user.role;

  if (isArchived && userRole !== 'admin') {
    return res.status(403).json({ message: 'Seul un administrateur peut archiver.' });
  }

  try {
    const query = isArchived
      ? 'UPDATE documents SET is_archived = true, date_archive = NOW() WHERE id = $1 RETURNING *'
      : 'UPDATE documents SET is_archived = false, date_archive = NULL WHERE id = $1 RETURNING *';

    const result = await pool.query(query, [docId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Document introuvable' });
    }

    // Récupérer le document avec la date formatée
    const updatedDoc = await pool.query(
      'SELECT *, TO_CHAR(date_archive, \'DD/MM/YYYY HH24:MI\') as formatted_date_archive FROM documents WHERE id = $1',
      [docId]
    );
    await logActivity(req.user.id, isArchived ? 'archive' : 'unarchive', 'document', docId, {
      action: isArchived ? 'archive' : 'unarchive'
    });
    res.json({
      message: isArchived ? 'Document archivé' : 'Document désarchivé',
      document: updatedDoc.rows[0]
    });
  } catch (err) {
    console.error('Erreur SQL :', err);
    res.status(500).json({ message: 'Erreur lors de la mise à jour de l’archivage' });
  }
});

router.get('/archived', auth, async (req, res) => {
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  try {
    let result;

    if (isAdmin) {
      result = await pool.query(`
        SELECT * FROM documents
        WHERE is_archived = true
        ORDER BY date DESC
      `);
    } else {
      result = await pool.query(`
        SELECT d.*
        FROM documents d
        JOIN document_permissions dp ON dp.document_id = d.id
        WHERE dp.user_id = $1
        AND dp.can_read = true
        AND d.is_archived = true
        ORDER BY d.date DESC
      `, [userId]);
    }

    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Erreur récupération des documents archivés :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Fonction pour copier les permissions d'un document à un autre
const copyDocumentPermissions = async (sourceDocId, targetDocId) => {
  try {
    // 1. Récupérer toutes les permissions du document source
    const permissionsRes = await pool.query(
      `SELECT user_id, can_read, can_modify, can_delete 
       FROM document_permissions 
       WHERE document_id = $1`,
      [sourceDocId]
    );

    // 2. Copier chaque permission vers le nouveau document
    for (const perm of permissionsRes.rows) {
      await pool.query(
        `INSERT INTO document_permissions 
         (document_id, user_id, can_read, can_modify, can_delete) 
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (document_id, user_id) DO UPDATE SET
           can_read = EXCLUDED.can_read,
           can_modify = EXCLUDED.can_modify,
           can_delete = EXCLUDED.can_delete`,
        [
          targetDocId,
          perm.user_id,
          perm.can_read,
          perm.can_modify,
          perm.can_delete
        ]
      );
    }
  } catch (err) {
    console.error('Erreur lors de la copie des permissions:', err);
    throw err;
  }
};

//complete upload
router.put('/:id', auth, async (req, res) => {
  const documentId = parseInt(req.params.id, 10);
  const {
    name,
    summary = '',
    tags = [],
    prio = 'moyenne',
    collection_name = '',
    metadata = {},
    ...extraFields
  } = req.body;

  try {
    if (!name) {
      return res.status(400).json({ error: 'Le nom du document est requis.' });
    }

    // 1. Récupération de la catégorie
    const catRes = await pool.query(`SELECT category FROM documents WHERE id = $1`, [documentId]);
    const category = catRes.rows[0]?.category;

    // 2. Déduction de is_completed selon la catégorie
    let is_completed = req.body.is_completed ?? false;

    if (category === 'facture') {
      const {
        numero_facture = '',
        nom_entreprise = '',
        produit = '',
        montant = 0,
        date_facture = null
      } = req.body;

      is_completed = Boolean(numero_facture && nom_entreprise && produit && montant && date_facture);
    }

    if (category === 'cv') {
      const {
        num_cv = '',
        nom_candidat = '',
        metier = '',
        lieu = '',
        experience = '',
        domaine = ''
      } = req.body;

      is_completed = Boolean(num_cv && nom_candidat && metier && lieu && experience && domaine);
    }

    if (category === 'demande_conge') {

      await pool.query(`
    INSERT INTO demande_conges (
      document_id, 
      num_demande, 
      date_debut, 
      date_fin, 
      motif
    )
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (document_id) DO UPDATE 
    SET 
      num_demande = EXCLUDED.num_demande,
      date_debut = EXCLUDED.date_debut,
      date_fin = EXCLUDED.date_fin,
      motif = EXCLUDED.motif
  `, [
        documentId,
        req.body.num_demande || '',
        req.body.date_debut || null,
        req.body.date_fin || null,
        req.body.motif || ''
      ]);
    }

    if (category === 'contrat') {
      const {
        numero_contrat = '',
        type_contrat = '',
        partie_prenante = '',
        date_signature = null,
        date_echeance = null,
        montant = 0,
        statut = ''
      } = req.body;

      is_completed = Boolean(
        numero_contrat &&
        type_contrat &&
        partie_prenante &&
        date_signature
      );
    }

    if (category === 'rapport') {
      const {
        type_rapport = '',
        auteur = '',
        date_rapport = null,
        periode_couverte = '',
        destinataire = ''
      } = req.body;

      is_completed = Boolean(
        type_rapport &&
        auteur &&
        date_rapport
      );
    }

    // 3. Mise à jour de la table documents
    await pool.query(`
      UPDATE documents 
      SET 
        name = $1,
        summary = $2,
        tags = $3,
        priority = $4,
        metadata = $5,
        is_completed = $6
      WHERE id = $7
    `, [name, summary, tags, prio, metadata, is_completed, documentId]);

    // 4. Si le document vient juste d’être complété, on lui attribue une version
    // 4. Si le document vient juste d'être complété, on lui attribue une version
    if (is_completed) {
      const versionRes = await pool.query(`
    SELECT MAX(version) as max_version 
    FROM documents 
    WHERE name = $1 AND version IS NOT NULL AND id != $2
  `, [name, documentId]);

      const lastVersion = versionRes.rows[0].max_version || 0;
      const currentVersion = lastVersion + 1;

      await pool.query(`
    UPDATE documents SET version = $1 WHERE id = $2 and is_completed=true
  `, [currentVersion, documentId]);

      // Envoyer une notification seulement si c'est une nouvelle version (pas la première)
      if (lastVersion > 0) {
        // Trouver le document de la version précédente
        const prevVersionRes = await pool.query(
          `SELECT id FROM documents 
       WHERE name = $1 AND version = $2 
       ORDER BY created_at DESC LIMIT 1`,
          [name, lastVersion]
        );

        const prevVersionId = prevVersionRes.rows[0]?.id;

        // Copier les permissions depuis la version précédente
        if (prevVersionId) {
          await copyDocumentPermissions(prevVersionId, documentId);
        }

        // Récupérer les utilisateurs ayant accès à ce document
        const usersRes = await pool.query(
          `SELECT user_id FROM document_permissions WHERE document_id = $1 AND can_read = true`,
          [documentId]
        );

        const userIds = usersRes.rows.map(row => row.user_id);

        if (userIds.length > 0) {
          await sendNotification(documentId, name, currentVersion, userIds);
        }
      }
    }


    // 5. Ajout/MAJ dans la table spécialisée
    switch (category) {
      case 'facture':
        await pool.query(`
          INSERT INTO factures (document_id, numero_facture, nom_entreprise, produit, montant, date_facture)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (document_id) DO UPDATE 
          SET numero_facture = $2,
              nom_entreprise = $3,
              produit = $4,
              montant = $5,
              date_facture = $6;
        `, [
          documentId,
          req.body.numero_facture || '',
          req.body.nom_entreprise || '',
          req.body.produit || '',
          req.body.montant || 0,
          req.body.date_facture || null
        ]);
        break;

      case 'cv':
        await pool.query(`
          INSERT INTO cv (document_id, num_cv, nom_candidat, metier, lieu, experience, domaine)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (document_id) DO UPDATE SET
            num_cv = $2,
            nom_candidat = $3,
            metier = $4,
            lieu = $5,
            experience = $6,
            domaine = $7
        `, [
          documentId,
          req.body.num_cv || '',
          req.body.nom_candidat || '',
          req.body.metier || '',
          req.body.lieu || '',
          req.body.experience || '',
          req.body.domaine || ''
        ]);
        break;

      case 'demande_conge':
        await pool.query(`
    INSERT INTO demande_conge ( 
      document_id, 
      num_demande, 
      date_debut, 
      date_fin, 
      motif
    )
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (document_id) DO UPDATE 
    SET 
      num_demande = $2,
      date_debut = $3,
      date_fin = $4,
      motif = $5
  `, [
          documentId,
          req.body.num_demande || '',
          req.body.date_debut || null,
          req.body.date_fin || null,
          req.body.motif || ''
        ]);
        break;
        await pool.query(`
          INSERT INTO demande_conges (document_id, numDemande, dateConge)
          VALUES ($1, $2, $3)
          ON CONFLICT (document_id) DO UPDATE 
          SET numDemande = $2, dateConge = $3;
        `, [
          documentId,
          extraFields.numDemande || '',
          extraFields.dateConge || null
        ]);
        break;

      case 'contrat':
        await pool.query(`
          INSERT INTO contrats (
            document_id, 
            numero_contrat, 
            type_contrat, 
            partie_prenante, 
            date_signature, 
            date_echeance, 
            montant, 
            statut
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (document_id) DO UPDATE 
          SET 
            numero_contrat = $2,
            type_contrat = $3,
            partie_prenante = $4,
            date_signature = $5,
            date_echeance = $6,
            montant = $7,
            statut = $8
        `, [
          documentId,
          req.body.numero_contrat || '',
          req.body.type_contrat || '',
          req.body.partie_prenante || '',
          req.body.date_signature || null,
          req.body.date_echeance || null,
          req.body.montant || 0,
          req.body.statut || ''
        ]);
        break;

      case 'rapport':
        await pool.query(`
          INSERT INTO rapports (
            document_id, 
            type_rapport, 
            auteur, 
            date_rapport, 
            periode_couverte, 
            destinataire
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (document_id) DO UPDATE 
          SET 
            type_rapport = $2,
            auteur = $3,
            date_rapport = $4,
            periode_couverte = $5,
            destinataire = $6
        `, [
          documentId,
          req.body.type_rapport || '',
          req.body.auteur || '',
          req.body.date_rapport || null,
          req.body.periode_couverte || '',
          req.body.destinataire || ''
        ]);
        break;

      default:
        break;
    }

    // 6. Gestion des collections (optionnelle)
    if (collection_name) {
      const resCollection = await pool.query(
        `SELECT id FROM collections WHERE name = $1 AND user_id = $2`,
        [collection_name, req.user.id]
      );

      let collectionId = resCollection.rows[0]?.id;
      if (!collectionId) {
        const insert = await pool.query(
          `INSERT INTO collections (name, user_id) VALUES ($1, $2) RETURNING id`,
          [collection_name, req.user.id]
        );
        collectionId = insert.rows[0].id;
      }



      await pool.query(`
        INSERT INTO document_collections (document_id, collection_id, is_saved, collection_name)
        VALUES ($1, $2, true, $3)
        ON CONFLICT (document_id, collection_id) DO UPDATE 
        SET is_saved = true, collection_name = $3
      `, [documentId, collectionId, collection_name]);
    }

    // 7. Renvoi du document mis à jour
    const updated = await pool.query('SELECT * FROM documents WHERE id = $1', [documentId]);
    res.status(200).json(updated.rows[0]);

  } catch (err) {
    console.error('❌ Erreur update document :', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// Fonction pour envoyer des notifications
const sendNotification = async (documentId, documentName, version, userIds) => {
  try {
    // 1. Récupérer les informations de l'utilisateur admin
    const adminRes = await pool.query('SELECT id FROM users WHERE role = $1', ['admin']);
    const adminId = adminRes.rows[0]?.id;

    // 2. Ajouter l'admin à la liste des destinataires si pas déjà présent
    if (adminId && !userIds.includes(adminId)) {
      userIds.push(adminId);
    }

    // 3. Envoyer une notification à chaque utilisateur
    for (const userId of userIds) {
      await pool.query(
        `INSERT INTO notifications 
         (user_id, document_id, message, is_read, created_at) 
         VALUES ($1, $2, $3, false,(NOW() AT TIME ZONE 'Africa/Algiers'))`,
        [
          userId,
          documentId,
          `Une nouvelle version (v${version}) du document "${documentName}" est disponible.`
        ]
      );
    }
  } catch (err) {
    console.error('Erreur lors de l\'envoi des notifications:', err);
  }
};
// Renommez la route pour correspondre à ce que le frontend appelle
router.get('/:id/metadata', auth, async (req, res) => {
  const documentId = req.params.id;

  try {
    const docRes = await pool.query('SELECT category FROM documents WHERE id = $1', [documentId]);

    if (docRes.rowCount === 0) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }

    const category = docRes.rows[0].category;
    let meta = {};

  switch (category) {
 case 'contrat':
  const contratRes = await pool.query(
    `SELECT numero_contrat, type_contrat, partie_prenante, 
     TO_CHAR(date_signature, 'YYYY-MM-DD') as date_signature, 
     TO_CHAR(date_echeance, 'YYYY-MM-DD') as date_echeance, 
     montant, statut 
     FROM contrats WHERE document_id = $1`, 
    [documentId]
  );
  meta = contratRes.rows[0] || {};
    // Formatage des dates pour le frontend
    if (meta.date_signature) meta.date_signature = new Date(meta.date_signature).toISOString().split('T')[0];
    if (meta.date_echeance) meta.date_echeance = new Date(meta.date_echeance).toISOString().split('T')[0];
    break;

  case 'facture':
   const factureRes = await pool.query(
    `SELECT numero_facture, montant, nom_entreprise, 
     TO_CHAR(date_facture, 'YYYY-MM-DD') as date_facture, 
     produit 
     FROM factures WHERE document_id = $1`, 
    [documentId]
  );
  meta = factureRes.rows[0] || {};
    // Formatage des dates pour le frontend
    if (meta.date_facture) meta.date_facture = new Date(meta.date_facture).toISOString().split('T')[0];
    break;

  case 'cv':
    const cvRes = await pool.query(
    `SELECT nom_candidat, experience, domaine, num_cv, metier, lieu,
     TO_CHAR(date_cv, 'YYYY-MM-DD') as date_cv 
     FROM cv WHERE document_id = $1`, 
    [documentId]
  );
  meta = cvRes.rows[0] || {};
    break;

  case 'demande_conge':
   const demandeRes = await pool.query(
    `SELECT num_demande, 
     TO_CHAR(date_debut, 'YYYY-MM-DD') as date_debut, 
     TO_CHAR(date_fin, 'YYYY-MM-DD') as date_fin, 
     motif 
     FROM demande_conges 
     WHERE document_id = $1`, 
    [documentId]
  );
  meta = demandeRes.rows[0] || {};
    // Formatage des dates pour le frontend
    if (meta.date_debut) meta.date_debut = new Date(meta.date_debut).toISOString().split('T')[0];
    if (meta.date_fin) meta.date_fin = new Date(meta.date_fin).toISOString().split('T')[0];
    break;

  case 'rapport':
   const rapportRes = await pool.query(
    `SELECT type_rapport, auteur, 
     TO_CHAR(date_rapport, 'YYYY-MM-DD') as date_rapport, 
     periode_couverte, destinataire 
     FROM rapports WHERE document_id = $1`, 
    [documentId]
  );
  meta = rapportRes.rows[0] || {};
    // Formatage des dates pour le frontend
    if (meta.date_rapport) meta.date_rapport = new Date(meta.date_rapport).toISOString().split('T')[0];
    break;

  default:
    meta = {};
}

    res.json(meta);

  } catch (err) {
    console.error('Erreur récupération métadonnées:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

router.get('/:id/details', auth, async (req, res) => {
  const documentId = req.params.id;

  try {
    // Récupération du document de base
    const docRes = await pool.query(`
      SELECT d.*, 
             EXTRACT(EPOCH FROM (NOW() - d.date)) as age_seconds,
             pg_size_pretty(d.size) as size_formatted
      FROM documents d 
      WHERE id = $1
    `, [documentId]);

    if (docRes.rowCount === 0) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }

    const doc = docRes.rows[0];
    let meta = {};
    let technicalInfo = {};

    // Récupération des métadonnées spécifiques
    switch (doc.category) {
      case 'cv':
        const cv = await pool.query('SELECT * FROM cv WHERE document_id = $1', [documentId]);
        meta = cv.rows[0] || {};
        break;

      case 'facture':
        const facture = await pool.query('SELECT * FROM factures WHERE document_id = $1', [documentId]);
        meta = facture.rows[0] || {};
        break;

      case 'demande_conge':
        const conge = await pool.query('SELECT * FROM demande_conges WHERE document_id = $1', [documentId]);
        meta = conge.rows[0] || {};
        break;

      case 'contrat':
        const contrat = await pool.query(`
          SELECT numero_contrat, type_contrat, partie_prenante, 
                 date_signature, date_echeance, montant, statut
          FROM contrats 
          WHERE document_id = $1
        `, [documentId]);
        meta = contrat.rows[0] || {};
        break;

      case 'rapport':
        const rapport = await pool.query(`
          SELECT type_rapport, auteur, date_rapport, periode_couverte, destinataire
          FROM rapports 
          WHERE document_id = $1
        `, [documentId]);
        meta = rapport.rows[0] || {};
        break;

      default:
        meta = {};
    }

    // Informations techniques pour les médias
    const fileExt = doc.name.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'mp4', 'mov', 'avi', 'webm'].includes(fileExt)) {
      try {
        const techRes = await pool.query(`
          SELECT width, height, duration 
          FROM media_metadata 
          WHERE document_id = $1
        `, [documentId]);

        technicalInfo = techRes.rows[0] || {};
      } catch (err) {
      }
    }

    res.json({
      document: {
        ...doc,
        // Formatage des dates pour le frontend
        date: new Date(doc.date).toISOString(),
        date_signature: meta.date_signature ? new Date(meta.date_signature).toISOString() : null,
        date_echeance: meta.date_echeance ? new Date(meta.date_echeance).toISOString() : null
      },
      details: meta,
      technicalInfo
    });

  } catch (err) {
    console.error('Erreur récupération détails document :', err.stack);
    res.status(500).json({
      error: 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});
router.post('/:id/share', auth, async (req, res) => {
  const documentId = parseInt(req.params.id);
  const userId = req.user.id;

  const {
    visibility,
    id_share = [],
    id_group = [],
    can_modify = false,
    can_delete = false,
    can_share = false
  } = req.body;

  if (!['public', 'private', 'custom'].includes(visibility)) {
    return res.status(400).json({ error: "Type de visibilité invalide" });
  }

  try {
    // 1. Récupération des informations
    const { rows: [document] } = await pool.query(
      'SELECT id, name, owner_id FROM documents WHERE id = $1',
      [documentId]
    );

    const { rows: [sharer] } = await pool.query(
      'SELECT name, prenom FROM users WHERE id = $1',
      [userId]
    );

    if (!document) {
      return res.status(404).json({ error: "Document non trouvé" });
    }

    const sharerName = `${sharer.prenom} ${sharer.name}`;
    const shareDate = new Date().toLocaleString('fr-FR');
    const isOwner = userId === document.owner_id;

    // 2. Transaction
    await pool.query('BEGIN');

    // 3. Mise à jour du document
    await pool.query(
      'UPDATE documents SET visibility = $1, id_share = $2, id_group = $3 WHERE id = $4',
      [visibility, id_share, id_group, documentId]
    );

    // 4. Gestion des permissions
    if (visibility === 'private') {
      // Ne rien faire pour private
    } else {
      if (visibility === 'public') {
        // Pour public, donner seulement can_read si non-propriétaire
        const { rows: allUsers } = await pool.query(
          'SELECT id FROM users WHERE id != $1',
          [document.owner_id]
        );

        if (allUsers.length > 0) {
          await pool.query(
            `INSERT INTO document_permissions 
                         (user_id, document_id, access_type, can_read, can_modify, can_delete, can_share)
                         SELECT id, $1, 'public', true, $2, $3, $4 FROM users WHERE id != $5
                         ON CONFLICT (user_id, document_id) 
                         DO UPDATE SET
                             access_type = 'public',
                             can_read = true,
                             can_modify = CASE WHEN $6 THEN EXCLUDED.can_modify ELSE false END,
                             can_delete = CASE WHEN $6 THEN EXCLUDED.can_delete ELSE false END,
                             can_share = CASE WHEN $6 THEN EXCLUDED.can_share ELSE false END`,
            [documentId,
              isOwner ? can_modify : false,
              isOwner ? can_delete : false,
              isOwner ? can_share : false,
              document.owner_id,
              isOwner]
          );
        }
      } else if (visibility === 'custom') {
        // Pour custom, appliquer les règles spécifiques
        if (id_share.length > 0) {
          await pool.query(
            `INSERT INTO document_permissions 
                         (user_id, document_id, access_type, can_read, can_modify, can_delete, can_share)
                         SELECT unnest($1::int[]), $2, 'shared', true, $3, $4, $5
                         ON CONFLICT (user_id, document_id) 
                         DO UPDATE SET
                             access_type = 'shared',
                             can_read = true,
                             can_modify = CASE WHEN $6 THEN $3 ELSE false END,
                             can_delete = CASE WHEN $6 THEN $4 ELSE false END,
                             can_share = CASE WHEN $6 THEN $5 ELSE false END`,
            [id_share,
              documentId,
              isOwner ? can_modify : false,
              isOwner ? can_delete : false,
              isOwner ? can_share : false,
              isOwner]
          );
        }

        if (id_group.length > 0) {
          await pool.query(
            `INSERT INTO document_permissions 
                         (user_id, document_id, access_type, can_read, can_modify, can_delete, can_share)
                         SELECT gm.user_id, $1, 'group', true, $2, $3, $4
                         FROM group_members gm
                         WHERE gm.group_id = ANY($5::int[])
                         ON CONFLICT (user_id, document_id) 
                         DO UPDATE SET
                             access_type = 'group',
                             can_read = true,
                             can_modify = CASE WHEN $6 THEN $2 ELSE false END,
                             can_delete = CASE WHEN $6 THEN $3 ELSE false END,
                             can_share = CASE WHEN $6 THEN $4 ELSE false END`,
            [documentId,
              isOwner ? can_modify : false,
              isOwner ? can_delete : false,
              isOwner ? can_share : false,
              id_group,
              isOwner]
          );
        }
      }
    }

    // 5. Gestion des notifications
    const notificationsToInsert = [];

    if (visibility === 'public') {
      const { rows: allUsers } = await pool.query(
        'SELECT id FROM users WHERE id != $1',
        [userId]
      );

      allUsers.forEach(user => {
        notificationsToInsert.push([
          user.id,
          'Nouveau document public disponible',
          `Le document "${document.name}" a été rendu public par ${sharerName} le ${shareDate}`,
          'document_shared',
          documentId,
          false,
          new Date(),
          userId,
          null, null, null
        ]);
      });
    } else if (visibility === 'custom') {
      const usersToNotify = new Set();

      // Notifier les utilisateurs directement partagés
      for (const targetId of id_share) {
        if (targetId !== userId) {
          usersToNotify.add(targetId);
        }
      }

      // Notifier les membres des groupes (sauf ceux déjà notifiés individuellement)
      if (id_group.length > 0) {
        const { rows: groupMembers } = await pool.query(
          'SELECT DISTINCT user_id FROM group_members WHERE group_id = ANY($1) AND user_id != $2',
          [id_group, userId]
        );

        groupMembers.forEach(member => {
          if (!usersToNotify.has(member.user_id)) {
            usersToNotify.add(member.user_id);
          }
        });
      }

      // Créer les notifications
      Array.from(usersToNotify).forEach(userId => {
        notificationsToInsert.push([
          userId,
          id_share.includes(userId)
            ? 'Document partagé avec vous'
            : 'Document partagé avec votre groupe',
          id_share.includes(userId)
            ? `${sharerName} vous a partagé le document "${document.name}" le ${shareDate}`
            : `${sharerName} a partagé le document "${document.name}" avec votre groupe le ${shareDate}`,
          'document_shared',
          documentId,
          false,
          new Date(),
          userId,
          null, null, null
        ]);
      });
    }

    // Insertion des notifications
    if (notificationsToInsert.length > 0) {
      await pool.query(
        `INSERT INTO notifications 
                 (user_id, title, message, type, document_id, is_read, created_at, sender_id, related_task_id, decision, related_id)
                 SELECT * FROM UNNEST(
                     $1::int[], $2::varchar[], $3::text[], $4::varchar[], 
                     $5::int[], $6::boolean[], $7::timestamp[], $8::int[],
                     $9::int[], $10::boolean[], $11::int[]
                 )`,
        [
          notificationsToInsert.map(n => n[0]),
          notificationsToInsert.map(n => n[1]),
          notificationsToInsert.map(n => n[2]),
          notificationsToInsert.map(n => n[3]),
          notificationsToInsert.map(n => n[4]),
          notificationsToInsert.map(n => n[5]),
          notificationsToInsert.map(n => n[6]),
          notificationsToInsert.map(n => n[7]),
          notificationsToInsert.map(n => n[8]),
          notificationsToInsert.map(n => n[9]),
          notificationsToInsert.map(n => n[10])
        ]
      );
    }

    // Journalisation
    await logActivity(userId, 'share', 'document', documentId, {
      visibility: visibility,
      shared_with_users: visibility === 'public' ? 'all_users' : id_share,
      shared_with_groups: id_group,
      permissions: {
        can_modify: isOwner ? can_modify : false,
        can_delete: isOwner ? can_delete : false,
        can_share: isOwner ? can_share : false
      },
      notifications_sent: notificationsToInsert.length,
      shared_by_owner: isOwner
    });

    await pool.query('COMMIT');

    res.status(200).json({
      success: true,
      message: `Document ${visibility === 'public' ? 'rendu public' : 'partagé'} avec succès`,
      permissions_updated: true,
      users_affected: visibility === 'public' ? 'all_users' : id_share.length,
      is_owner: isOwner,
      granted_permissions: {
        can_read: true,
        can_modify: isOwner ? can_modify : false,
        can_delete: isOwner ? can_delete : false,
        can_share: isOwner ? can_share : false
      }
    });

  } catch (error) {
    await pool.query('ROLLBACK');
    console.error("Erreur lors du partage:", error);
    res.status(500).json({
      success: false,
      error: "Échec de l'opération de partage",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// routes/documents.js

router.post('/archive-requests', auth, async (req, res) => {
  const { documentId } = req.body;
  const requesterId = req.user.id;
  const requesterName = req.user.prenom && req.user.name
    ? `${req.user.prenom} ${req.user.name}`
    : 'Utilisateur inconnu';
  const currentDate = new Date().toLocaleString('fr-FR');

  if (!documentId) {
    return res.status(400).json({
      success: false,
      error: "L'ID du document est requis",
      received: req.body
    });
  }

  try {
    const docQuery = await pool.query(
      `SELECT d.id, d.name, d.file_path, d.is_archived 
       FROM documents d
       WHERE d.id = $1`,
      [documentId]
    );

    if (!docQuery.rows.length) {
      return res.status(404).json({
        success: false,
        error: `Document ${documentId} non trouvé`
      });
    }

    const document = docQuery.rows[0];

    if (document.is_archived) {
      return res.status(400).json({
        success: false,
        error: "Le document est déjà archivé",
        document: {
          id: document.id,
          name: document.name
        }
      });
    }

    const newRequest = await pool.query(
      `INSERT INTO archive_requests 
       (document_id, requester_id)
       VALUES ($1, $2)
       RETURNING *`,
      [documentId, requesterId]
    );

    const admins = await pool.query(
      `SELECT id FROM users WHERE role = 'admin'`
    );

    const notificationPromises = admins.rows.map(admin => {
      const message = `Demande d'archivage pour le document "${document.name}"`;

      return pool.query(
        `INSERT INTO notifications
         (user_id, title, message, type, document_id, sender_id, related_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          admin.id,
          'Nouvelle demande d\'archivage',
          message,
          'archive_request',
          document.id,
          requesterId,
          newRequest.rows[0].id
        ]
      );
    });

    await Promise.all(notificationPromises);
    // Ajoutez ceci après la création de la demande
    await logActivity(req.user.id, 'archive_request', 'document', documentId, {
      request_id: newRequest.rows[0].id,
      status: 'pending'
    });
    return res.status(201).json({
      success: true,
      data: {
        request: newRequest.rows[0],
        document: {
          id: document.id,
          name: document.name,
          url: `/documents/${document.id}`
        },
        notifications_sent: admins.rows.length
      }
    });

  } catch (error) {
    console.error('Erreur base de données:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur lors de la création de la demande',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});
// documentsRoutes.js
router.put('/:requestId/decision', auth, async (req, res) => {
  const { requestId } = req.params; // Utilisez requestId au lieu de documentId
  const { decision } = req.body;
  const processedBy = req.user.id;

  try {
    // 1. Vérifier que la demande existe
    const request = await pool.query(
      `SELECT ar.*, d.id as document_id, d.name as document_name,
              u.prenom, u.name as requester_name
       FROM archive_requests ar
       JOIN documents d ON ar.document_id = d.id
       JOIN users u ON ar.requester_id = u.id
       WHERE ar.id = $1 AND ar.status = 'pending'`,
      [requestId] // Recherche par requestId
    );

    if (request.rows.length === 0) {
      return res.status(404).json({
        error: 'Demande non trouvée ou déjà traitée',
        requestId
      });
    }

    const documentId = request.rows[0].document_id;
    const requesterId = request.rows[0].requester_id;

    // 2. Mettre à jour la demande
    await pool.query(
      `UPDATE archive_requests
       SET status = $1,
           processed_by = $2,
           processed_at = NOW()
       WHERE id = $3`,
      [decision ? 'approved' : 'rejected', processedBy, requestId]
    );

    // 3. Si approbation, archiver le document
    if (decision) {
      await pool.query(
        `UPDATE documents
         SET is_archived = true,
             archived_at = NOW()
         WHERE id = $1`,
        [documentId]
      );
    }

    res.status(200).json({
      success: true,
      requestId,
      documentId,
      isArchived: decision
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});
// Route pour approuver/rejeter une demande d'archivage (admin seulement)
router.put('/archive-requests/:id/process', auth, async (req, res) => {
  const { id } = req.params;
  const { action } = req.body; // 'approve' ou 'reject'
  const adminId = req.user.id;

  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Accès refusé' });
  }

  try {
    // Récupérer la demande
    const request = await pool.query(
      'SELECT * FROM archive_requests WHERE id = $1 AND status = $2',
      [id, 'pending']
    );

    if (request.rowCount === 0) {
      return res.status(404).json({ message: 'Demande non trouvée ou déjà traitée' });
    }

    if (action === 'approve') {
      // Archiver le document
      await pool.query(
        'UPDATE documents SET is_archived = true WHERE id = $1',
        [request.rows[0].document_id]
      );

      // Mettre à jour la demande
      await pool.query(
        `UPDATE archive_requests 
         SET status = 'approved', processed_at = NOW(), processed_by = $1
         WHERE id = $2`,
        [adminId, id]
      );

      // Notifier le demandeur
      await pool.query(
        `INSERT INTO notifications 
         (user_id, type, message, related_id)
         VALUES ($1, 'archive_approved', $2, $3)`,
        [
          request.rows[0].requester_id,
          `Votre demande d'archivage a été approuvée`,
          request.rows[0].document_id
        ]
      );
      await logActivity(req.user.id, 'archive_approve', 'document', request.rows[0].document_id, {
        request_id: id
      });
      res.json({ message: 'Document archivé avec succès' });

    } else if (action === 'reject') {
      // Rejeter la demande
      await pool.query(
        `UPDATE archive_requests 
         SET status = 'rejected', processed_at = NOW(), processed_by = $1
         WHERE id = $2`,
        [adminId, id]
      );

      // Notifier le demandeur
      await pool.query(
        `INSERT INTO notifications 
         (user_id, type, message, related_id)
         VALUES ($1, 'archive_rejected', $2, $3)`,
        [
          request.rows[0].requester_id,
          `Votre demande d'archivage a été rejetée`,
          request.rows[0].document_id
        ]
      );
      await logActivity(req.user.id, 'archive_reject', 'document', request.rows[0].document_id, {
        request_id: id
      });
      res.json({ message: 'Demande rejetée' });
    } else {
      res.status(400).json({ message: 'Action invalide' });
    }

  } catch (error) {
    console.error('Erreur traitement demande:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const usersResult = await pool.query('SELECT COUNT(*) FROM users');
    const documentsResult = await pool.query('SELECT COUNT(*) FROM documents');
    const tasksResult = await pool.query('SELECT COUNT(*) FROM tasks');
    const workflowsResult = await pool.query('SELECT COUNT(*) FROM workflow');
    const notificationsResult = await pool.query('SELECT COUNT(*) FROM notifications');

    res.json({
      totalUsers: parseInt(usersResult.rows[0].count, 10),
      totalDocuments: parseInt(documentsResult.rows[0].count, 10),
      totalTasks: parseInt(tasksResult.rows[0].count, 10),
      totalWorkflows: parseInt(workflowsResult.rows[0].count, 10),
      totalNotifications: parseInt(notificationsResult.rows[0].count, 10),
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques :', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
router.get('/:id/versions', auth, async (req, res) => {
  const id = parseInt(req.params.id, 10);

  try {
    // 1. Récupérer le document original
    const { rows: [doc] } = await pool.query(
      'SELECT name FROM documents WHERE id = $1',
      [id]
    );
    if (!doc) return res.status(404).json({ error: 'Document introuvable' });

    // 2. Récupérer toutes les versions avec toutes les infos nécessaires
    const { rows: versions } = await pool.query(`
      SELECT 
        id, name, version, date, category, file_path
      FROM documents
      WHERE name = $1 AND is_completed =true 
      ORDER BY version DESC
    `, [doc.name]);

    res.status(200).json(versions);

  } catch (err) {
    console.error('❌ Erreur:', err);
    res.status(500).json({
      error: 'Erreur serveur',
      details: err.message
    });
  }
});

// GET : récupérer un document spécifique par ID
router.get('/', auth, async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query(`
      SELECT d.*, dp.can_read, dp.can_modify, dp.can_delete, dp.can_share,
             dp.access_type,
             dc.is_saved, dc.collection_name
      FROM documents d
      JOIN LATERAL (
        SELECT * FROM document_permissions
        WHERE document_id = d.id AND user_id = $1
        ORDER BY 
          CASE access_type
            WHEN 'owner' THEN 1
            WHEN 'custom' THEN 2
            WHEN 'public' THEN 3
            WHEN 'read' THEN 4
            ELSE 5
          END
        LIMIT 1
      ) AS dp ON true
      LEFT JOIN document_collections dc ON dc.document_id = d.id
      WHERE d.is_archived = false
      ORDER BY d.date DESC;
    `, [userId]);

    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Erreur chargement documents:', err.stack);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

//doc detail
router.get('/:id', auth, async (req, res) => {
  const documentId = req.params.id;

  try {
    const result = await pool.query(
      `SELECT * FROM documents WHERE id = $1`,
      [documentId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Erreur chargement document par ID :', err.stack);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});



router.post('/folders', auth, async (req, res) => {
  const { name, parent_id } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Nom du dossier requis' });
  }

  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Utilisateur non authentifié' });
  }

  try {
    console.log('Utilisateur connecté:', req.user); // Pour debug

    const result = await pool.query(
      `INSERT INTO folders (name, parent_id, user_id) VALUES ($1, $2, $3) RETURNING *`,
      [name, parent_id || null, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erreur lors de la création du dossier:', err.stack);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});
router.post('/', upload.array('files'), async (req, res) => {
  try {
    const { folder_name, folder_description, created_by } = req.body;
    const files = req.files;

    // 1. Insérer le dossier
    const folderResult = await pool.query(
      `INSERT INTO folders (name, description, created_by, created_at)
       VALUES ($1, $2, $3, NOW()) RETURNING id`,
      [folder_name, folder_description, created_by]
    );
    const folderId = folderResult.rows[0].id;

    // 2. Insérer les fichiers dans la table documents
    for (const file of files) {
      await pool.query(
        `INSERT INTO documents (name, file_path, folder_id, user_id, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [file.originalname, file.path, folderId, created_by]
      );
    }

    res.status(201).json({ message: 'Dossier importé avec succès', folderId });
  } catch (error) {
    console.error('Erreur lors de l’import du dossier :', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE : supprimer un document de la base de données et du disque
router.delete('/:id', auth, async (req, res) => {
  const { id } = req.params;

  try {
    // Vérifier si le document existe et récupérer son chemin
    const documentResult = await pool.query('SELECT file_path FROM documents WHERE id = $1', [id]);

    if (documentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }

    const filePath = path.join(__dirname, '..', documentResult.rows[0].file_path);

    // Supprimer le fichier du système de fichiers
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Supprimer les permissions associées au document
    await pool.query('DELETE FROM document_permissions WHERE document_id = $1', [id]);

    // Supprimer les associations avec les collections
    await pool.query('DELETE FROM document_collections WHERE document_id = $1', [id]);

    // Supprimer le document de la table documents
    await pool.query('DELETE FROM documents WHERE id = $1', [id]);

    res.status(200).json({ message: 'Document supprimé avec succès' });

    // Ajoutez ceci AVANT la suppression
    await logActivity(req.user.id, 'delete', 'document', id, {
      file_name: document.name,
      file_type: document.file_path.split('.').pop()
    });

  } catch (err) {
    console.error('Erreur lors de la suppression du document:', err.stack);
    res.status(500).json({ error: 'Erreur lors de la suppression', details: err.message });
  }
});


router.patch('/:id/visibility', auth, async (req, res) => {
  const documentId = req.params.id;
  const { visibility } = req.body;

  try {
    await pool.query(
      'UPDATE documents SET visibility = $1 WHERE id = $2',
      [visibility, documentId]
    );
    res.status(200).json({ message: 'Visibility mise à jour avec succès ! 🚀' });
  } catch (err) {
    console.error('Erreur:', err.stack);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});


router.post('/', async (req, res) => {
  const { text } = req.body;

  if (!text) return res.status(400).json({ error: "Texte manquant." });

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Tu es un assistant qui résume les documents de manière concise en français.",
          },
          {
            role: "user",
            content: `Voici un texte à résumer :\n${text}`,
          },
        ],
        max_tokens: 300,
        temperature: 0.7,
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
      }
    );

    const summary = response.data.choices[0].message.content;
    res.json({ summary });

  } catch (error) {
    console.error("Erreur OpenAI:", error.response?.data || error.message);
    res.status(500).json({ error: "Erreur lors de la génération du résumé." });
  }
});

router.put('/:id/access', async (req, res) => {
  const { id } = req.params;
  const { access } = req.body;

  try {
    // Étape 1 : récupérer le nom du document donné
    const docResult = await pool.query('SELECT name FROM documents WHERE id = $1', [id]);
    if (docResult.rowCount === 0) {
      return res.status(404).json({ message: 'Document non trouvé' });
    }

    const docName = docResult.rows[0].name;

    // Étape 2 : mettre à jour tous les documents qui ont le même nom
    const updateResult = await pool.query(
      'UPDATE documents SET access = $1 WHERE name = $2 RETURNING *',
      [access, docName]
    );

    res.status(200).json({
      message: `Accès mis à jour pour tous les documents nommés "${docName}"`,
      documents: updateResult.rows,
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'accès :', error);

    res.status(500).json({ error: 'Erreur serveur' });
  }
});



// POST /api/categories
router.post('/categories', auth, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Nom de catégorie requis" });

  try {
    const result = await pool.query(
      'INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING *',
      [name]
    );
    res.status(201).json(result.rows[0] || { message: "Catégorie déjà existante" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Partage avec un utilisateur
router.post('/folders/:id/share/user', auth, async (req, res) => {
  try {
    const { userId, permissions } = req.body;
    const folder = await Folder.findByPk(req.params.id);

    if (!folder) {
      return res.status(404).json({ error: 'Dossier non trouvé' });
    }

    const permission = await FolderPermission.create({
      folder_id: req.params.id,
      user_id: userId,
      ...permissions
    });

    res.status(201).json(permission);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Partage avec un groupe
router.post('/folders/:id/share/group', auth, async (req, res) => {
  try {
    const { groupId, permissions } = req.body;
    const folder = await Folder.findByPk(req.params.id);

    if (!folder) {
      return res.status(404).json({ error: 'Dossier non trouvé' });
    }

    const permission = await FolderPermission.create({
      folder_id: req.params.id,
      group_id: groupId,
      ...permissions
    });

    res.status(201).json(permission);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Récupérer les permissions d'un dossier
router.get('/folders/:id/permissions', auth, async (req, res) => {
  try {
    const permissions = await FolderPermission.findAll({
      where: { folder_id: req.params.id },
      include: [
        { model: User, attributes: ['id', 'name', 'email'] },
        { model: Group, attributes: ['id', 'nom'] }
      ]
    });

    res.json(permissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/documents/check-duplicate
router.post('/check-duplicate', async (req, res) => {
  const { text_content } = req.body;
  if (!text_content) return res.status(400).json({ error: 'Texte manquant' });

  try {
    const result = await pool.query(
      'SELECT name FROM documents WHERE text_content = $1 LIMIT 1',
      [text_content]
    );

    if (result.rows.length > 0) {
      return res.json({ exists: true, documentName: result.rows[0].name });
    } else {
      return res.json({ exists: false });
    }
  } catch (err) {
    console.error('Erreur lors de la vérification du doublon:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
// Initialisation des tables
initializeDatabase();

module.exports = router;