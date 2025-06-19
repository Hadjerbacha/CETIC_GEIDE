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
  const defaultCategories = ["contrat", "facture", "demande_conge", "cv", "autre"];

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
        SELECT d.*, dc.*
        FROM documents d
        JOIN demande_conges dc ON d.id = dc.document_id
      `;

      if (filters.numdemande) {
        values.push(`%${filters.numdemande}%`);
        whereClauses.push(`dc.numdemande ILIKE $${values.length}`);
      }
      if (filters.dateconge) {
        values.push(filters.dateconge);
        whereClauses.push(`dc.dateconge = $${values.length}`);
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
    numero_facture,
    montant,
    date_facture,
    nom_candidat,
    metier,
    date_cv,
    numdemande,
    dateconge,
  } = req.query;

  try {
    let baseQuery = `
      SELECT DISTINCT d.*, dc.is_saved, dc.collection_name,
        f.numero_facture, f.montant, f.date_facture,
        cv.nom_candidat, cv.metier, cv.date_cv,
        cv.nom_candidat AS nom_candidat,
        cv.metier AS metier,
        cv.date_cv AS date_cv,
        dcg.num_demande, dcg.date_debut AS dateconge
      FROM documents d
      LEFT JOIN document_collections dc ON dc.document_id = d.id
      LEFT JOIN factures f ON f.document_id = d.id
      LEFT JOIN cv ON cv.document_id = d.id
      LEFT JOIN demande_conge dcg ON dcg.document_id = d.id
      ${!isAdmin ? 'LEFT JOIN document_permissions dp ON dp.document_id = d.id' : ''}
      WHERE true
    `;

    const params = [];
    let paramIndex = 1;

    if (!isAdmin) {
      baseQuery += `
       AND (
  d.visibility = 'public'
  OR (dp.user_id = $1 AND dp.access_type IN ('custom', 'read', 'owner'))
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

    // Filtres spécifiques pour CV
    if (selectedCategory === 'cv') {
      if (nom_candidat) {
        baseQuery += ` AND LOWER(cv.nom_candidat) ILIKE $${paramIndex}`;
        params.push(`%${nom_candidat.toLowerCase()}%`);
        paramIndex++;
      }
      if (metier) {
        baseQuery += ` AND LOWER(cv.metier) ILIKE $${paramIndex}`;
        params.push(`%${metier.toLowerCase()}%`);
        paramIndex++;
      }
      if (date_cv) {
        baseQuery += ` AND cv.date_cv = $${paramIndex}`;
        params.push(date_cv);
        paramIndex++;
      }
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
        baseQuery += ` AND f.date_facture = $${paramIndex}`;
        params.push(date_facture);
        paramIndex++;
      }
    }

    // Filtres spécifiques Demande Congé
    if (selectedCategory === 'demande_conge') {
      if (numdemande) {
        baseQuery += ` AND dcg.num_demande ILIKE $${paramIndex}`;
        params.push(`%${numdemande}%`);
        paramIndex++;
      }
      if (dateconge) {
        baseQuery += ` AND dcg.date_debut = $${paramIndex}`;
        params.push(dateconge);
        paramIndex++;
      }
    }

    baseQuery += ` ORDER BY d.date DESC`;

    const result = await pool.query(baseQuery, params);

    // 🔁 Organisation des résultats avec regroupement des métadonnées
    const documents = result.rows.map((doc) => {
      const {
        numero_facture, montant, date_facture,
        nom_candidat, metier, date_cv,
        numdemande, dateconge,
        ...baseDoc
      } = doc;

      let metadata = {};

      if (doc.category === 'facture') {
        metadata = { numero_facture, montant, date_facture };
      } else if (doc.category === 'cv') {
        metadata = { nom_candidat, metier, date_cv };
      } else if (doc.category === 'demande_conge') {
        metadata = { numdemande, dateconge };
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
      // Tous les documents archivés complétés (toutes les versions)
      result = await pool.query(`
        SELECT d.*
        FROM documents d
        WHERE d.is_completed = true
        AND d.is_archived = true
        ORDER BY d.name, d.version DESC
      `);
    } else {
      // Uniquement les documents archivés visibles par l'utilisateur
      result = await pool.query(`
        SELECT d.*
        FROM documents d
        JOIN document_permissions dp ON dp.document_id = d.id
        WHERE dp.user_id = $1
        AND dp.can_read = true
        AND d.is_completed = true
        AND d.is_archived = true
        ORDER BY d.name, d.version DESC
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
      'UPDATE documents SET is_archived = true WHERE id = $1',
      [id]
    );
    res.status(200).json({ message: 'Document archivé avec succès.' });
  } catch (error) {
    console.error('Erreur lors de l’archivage :', error);
    res.status(500).json({ error: 'Erreur serveur lors de l’archivage.' });
  }
});

// routes/documents.js
router.put('/:id/affiche', auth, async (req, res) => {
  const docId = req.params.id;
  const isArchived = req.body.is_archived; // doit être true ou false

  try {
    const result = await pool.query(
      'UPDATE documents SET is_archived = $1 WHERE id = $2 RETURNING *',
      [isArchived, docId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Document introuvable' });
    }

    res.json({ message: isArchived ? 'Document archivé' : 'Document désarchivé', document: result.rows[0] });
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

//complete upload
router.put('/:id', auth, async (req, res) => {
  const documentId = parseInt(req.params.id, 10);
  const userId = req.user.id;
  const {
    name,
    summary = '',
    tags = [],
    priority = 'moyenne',
    collection_name = '',
    metadata = {},
    diff_version = '',
    is_completed = false,
    ...extraFields
  } = req.body;

  try {
    // 1. Validation
    if (!name) {
      return res.status(400).json({ error: 'Le nom du document est requis.' });
    }

    // 2. Récupération du document original
    const { rows: [originalDoc] } = await pool.query(
      'SELECT id, name, category, version FROM documents WHERE id = $1',
      [documentId]
    );

    if (!originalDoc) {
      return res.status(404).json({ error: 'Document introuvable' });
    }

    // 3. Vérification des permissions
    const { rows: [permission] } = await pool.query(
      'SELECT can_modify FROM document_permissions WHERE user_id = $1 AND document_id = $2',
      [userId, documentId]
    );

    if (!permission?.can_modify && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Permission de modification refusée' });
    }

    // 4. Détection de nouvelle version
    const isNewVersion = originalDoc.name !== name && is_completed;
    let newVersion = originalDoc.version;

    if (isNewVersion) {
      const { rows: [{ max_version }] } = await pool.query(
        'SELECT MAX(version) as max_version FROM documents WHERE name = $1 AND id != $2',
        [name, documentId]
      );
      newVersion = (max_version || 0) + 1;
    }

    // 5. Mise à jour du document (sans updated_at)
    const { rows: [updatedDoc] } = await pool.query(
      `UPDATE documents SET
        name = $1,
        summary = $2,
        tags = $3,
        priority = $4,
        metadata = $5,
        diff_version = $6,
        is_completed = $7,
        version = $8
       WHERE id = $9
       RETURNING *`,
      [
        name,
        summary,
        tags,
        priority,
        metadata,
        diff_version,
        is_completed,
        newVersion,
        documentId
      ]
    );

    // 6. Gestion des métadonnées spécifiques (exemple pour facture)
    if (originalDoc.category === 'facture') {
      await pool.query(
        `INSERT INTO factures (
          document_id, numero_facture, nom_entreprise, produit, montant, date_facture
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (document_id) DO UPDATE SET
          numero_facture = $2,
          nom_entreprise = $3,
          produit = $4,
          montant = $5,
          date_facture = $6`,
        [
          documentId,
          extraFields.num_facture || '',
          extraFields.nom_entreprise || '',
          extraFields.produit || '',
          extraFields.montant || 0,
          extraFields.date_facture || null
        ]
      );
    }

    // 7. Gestion des collections
    if (collection_name) {
      const { rows: [collection] } = await pool.query(
        `INSERT INTO collections (name, user_id)
         VALUES ($1, $2)
         ON CONFLICT (name, user_id) DO UPDATE SET name = $1
         RETURNING id`,
        [collection_name, userId]
      );

      await pool.query(
        `INSERT INTO document_collections (document_id, collection_id)
         VALUES ($1, $2)
         ON CONFLICT (document_id, collection_id) DO NOTHING`,
        [documentId, collection.id]
      );
    }

    res.status(200).json({
      ...updatedDoc,
      is_new_version: isNewVersion
    });

  } catch (err) {
    console.error('❌ Erreur:', err.stack);
    res.status(500).json({ 
      error: 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});
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
        const contratRes = await pool.query('SELECT * FROM contrats WHERE document_id = $1', [documentId]);
        meta = contratRes.rows[0] || {};
        break;
      // ... autres cas ...
    }

    res.json(meta);

  } catch (err) {
    console.error('Erreur récupération métadonnées:', err);
    res.status(500).json({ error: 'Erreur serveur' });
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

  try {
    console.log("📩 Reçu pour partage :", {
      visibility, id_share, id_group, can_modify, can_delete, can_share
    });

    // 1. Mettre à jour la visibilité dans la table documents
    await pool.query(`
      UPDATE documents
      SET visibility = $1, id_share = $2, id_group = $3
      WHERE id = $4
    `, [visibility, id_share, id_group, documentId]);

    // 2. Gérer les permissions pour les utilisateurs partagés
    if (visibility === 'custom' && id_share.length > 0) {
      // Supprimer toutes les permissions custom existantes
      await pool.query(`
        DELETE FROM document_permissions 
        WHERE document_id = $1 AND access_type = 'custom'
      `, [documentId]);

      // Ajouter les nouvelles permissions
      const insertValues = id_share.map(targetId => 
        `(${targetId}, ${documentId}, 'custom', true, ${can_modify}, ${can_delete}, ${can_share})`
      ).join(',');

      await pool.query(`
        INSERT INTO document_permissions 
        (user_id, document_id, access_type, can_read, can_modify, can_delete, can_share)
        VALUES ${insertValues}
      `);
    }

    // 3. Gérer les permissions pour les groupes
    if (visibility === 'custom' && id_group.length > 0) {
      // Supprimer toutes les permissions de groupe existantes
      await pool.query(`
        DELETE FROM document_permissions 
        WHERE document_id = $1 AND access_type = 'group'
      `, [documentId]);

      // Ajouter les permissions pour les membres des groupes
      const { rows: members } = await pool.query(`
        SELECT DISTINCT user_id FROM user_groups WHERE group_id = ANY($1)
      `, [id_group]);

      if (members.length > 0) {
        const groupInsertValues = members.map(member => 
          `(${member.user_id}, ${documentId}, 'group', true, false, false, false)`
        ).join(',');

        await pool.query(`
          INSERT INTO document_permissions 
          (user_id, document_id, access_type, can_read, can_modify, can_delete, can_share)
          VALUES ${groupInsertValues}
        `);
      }
    }

    res.status(200).json({ message: "Partage mis à jour avec succès." });

  } catch (err) {
    console.error("❌ Erreur dans partage :", err);
    res.status(500).json({ error: "Erreur lors du partage", details: err.message });
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
      const message = `Demande d'archivage pour le document "${document.name}"` ;

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