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
const classifyText = async (text) => {
  const defaultCategories = ["contrat", "facture", "rapport", "cv"];

  const truncatedText = text.substring(0, 5000);

  try {
    const response = await axios.post(
      'http://127.0.0.1:5001/classify',
      {
        text: truncatedText,
        categories: defaultCategories
      },
      {
        timeout: 10000, // max 10 secondes
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    return response.data?.category || null;

  } catch (error) {
    console.error('Erreur NLP (ou timeout dépassé) :', error.message);

    // 🔁 Fallback simple basé sur des mots-clés
    const lowerText = text.toLowerCase();

    if (lowerText.includes('contrat') || lowerText.includes('agreement') || lowerText.includes('signature')) {
      return 'contrat';
    }
    if (lowerText.includes('facture') || lowerText.includes('invoice') || lowerText.includes('paiement')) {
      return 'facture';
    }
    if (lowerText.includes('rapport') || lowerText.includes('report') || lowerText.includes('analyse')) {
      return 'rapport';
    }
    if (lowerText.includes('cv') || lowerText.includes('curriculum') || lowerText.includes('expérience') || lowerText.includes('compétence')) {
      return 'cv';
    }

    return 'autre'; // Fallback final si rien ne correspond
  }
};

;
router.get('/:id/my-permissions', auth, async (req, res) => {
  const documentId = req.params.id;
  const userId = req.user.id;

  try {
    const result = await pool.query(`
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

    if (result.rowCount === 0) {
      return res.status(403).json({ error: "Aucune permission trouvée pour ce document." });
    }

    res.status(200).json(result.rows[0]);
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


router.get('/', auth, async (req, res) => {
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin'; // Adapte si nécessaire

  try {
    let result;

    if (isAdmin) {
      // Admin : accès à tous les documents
      result = await pool.query(`
        SELECT DISTINCT d.*, dc.is_saved, dc.collection_name
        FROM documents d
        LEFT JOIN document_collections dc ON dc.document_id = d.id
        ORDER BY d.date DESC;
      `);
    } else {
      // Utilisateur normal : documents accessibles via permissions
      result = await pool.query(
        `
        SELECT DISTINCT d.*, dc.is_saved, dc.collection_name
        FROM documents d
        JOIN document_permissions dp ON dp.document_id = d.id
        LEFT JOIN document_collections dc ON dc.document_id = d.id
        WHERE 
          dp.access_type = 'public'
          OR (dp.user_id = $1 AND dp.access_type = 'custom')
          OR (dp.user_id = $1 AND dp.access_type = 'read')
        ORDER BY d.date DESC;
        `,
        [userId]
      );
    }

    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Erreur:', err.stack);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
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
  const mimeType = mime.lookup(req.file.originalname);

  const canModify = can_modify === 'true' || can_modify === true;
  const canDelete = can_delete === 'true' || can_delete === true;
  const rawCanShare = req.body.can_share === 'true' || req.body.can_share === true;

  try {
    let extractedText = '';

    if (mimeType === 'application/pdf') {
      const dataBuffer = fs.readFileSync(fullPath);
      const data = await pdfParse(dataBuffer);
      extractedText = data.text;
    } else if (mimeType?.startsWith('image/')) {
      const result = await Tesseract.recognize(fullPath, 'eng');
      extractedText = result.data.text;
    } else if (mimeType?.startsWith('video/')) {
      try {
        extractedText = await extractFrameAndOcr(fullPath);
        if (!extractedText.trim()) {
          extractedText = '[Vidéo sans texte détecté]';
        }
      } catch (err) {
        console.warn('⚠️ OCR sur vidéo échoué:', err);
        extractedText = '[Vidéo non analysée]';
      }
    } else {
      extractedText = '[Fichier non analysable]';
    }

    const finalCategory = await classifyText(extractedText);

    const existing = await pool.query(
      'SELECT * FROM documents WHERE name = $1 ORDER BY version DESC LIMIT 1',
      [name]
    );

    let version = 1;
    let original_id = null;
    if (existing.rowCount > 0) {
      const latestDoc = existing.rows[0];
      version = latestDoc.version + 1;
      original_id = latestDoc.original_id || latestDoc.id;
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

    // ⚠️ Ajoute "metadata" JSON vide pour compatibilité future
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
      {} // metadata vide à l'étape 1
    ]);

    const documentId = result.rows[0].id;

    await pool.query(`
      INSERT INTO document_permissions 
      (user_id, document_id, access_type, can_read, can_modify, can_delete, can_share)
      VALUES ($1, $2, 'owner', true, true, true, true)
    `, [req.user.id, documentId]);

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
    let result;

    if (isAdmin) {
      result = await pool.query(`
        SELECT DISTINCT ON (name) d.*
        FROM documents d
        ORDER BY name, version DESC
      `);
    } else {
      result = await pool.query(`
        SELECT DISTINCT ON (d.name) d.*
        FROM documents d
        JOIN document_permissions dp ON dp.document_id = d.id
        WHERE
          dp.user_id = $1
          AND dp.can_read = true
        ORDER BY d.name, d.version DESC
      `, [userId]);
    }

    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Erreur récupération dernières versions :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/latest', auth, async (req, res) => {
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  try {
    let result;

    if (isAdmin) {
      result = await pool.query(`
        SELECT DISTINCT ON (name) d.*
        FROM documents d
        ORDER BY name, version DESC
      `);
    } else {
      result = await pool.query(`
        SELECT DISTINCT ON (d.name) d.*
        FROM documents d
        JOIN document_permissions dp ON dp.document_id = d.id
        WHERE
          dp.user_id = $1
          AND dp.can_read = true
        ORDER BY d.name, d.version DESC
      `, [userId]);
    }

    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Erreur récupération dernières versions :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/documents/search', async (req, res) => {
  const { query, category, startDate, endDate } = req.query;
  try {
    const values = [];
    let baseQuery = `
      SELECT * FROM documents 
      WHERE 1=1
    `;

    if (query) {
      baseQuery += ` AND (LOWER(name) LIKE $${values.length + 1} OR LOWER(text_content) LIKE $${values.length + 1})`;
      values.push(`%${query.toLowerCase()}%`);
    }

    if (category) {
      baseQuery += ` AND LOWER(category) = $${values.length + 1}`;
      values.push(category.toLowerCase());
    }

    if (startDate) {
      baseQuery += ` AND date >= $${values.length + 1}`;
      values.push(startDate);
    }

    if (endDate) {
      baseQuery += ` AND date <= $${values.length + 1}`;
      values.push(endDate);
    }

    baseQuery += ` ORDER BY date DESC`;

    const { rows } = await pool.query(baseQuery, values);
    res.status(200).json(rows);
  } catch (err) {
    console.error('Erreur recherche documents:', err);
    res.status(500).json({ error: 'Erreur lors de la recherche' });
  }
});
router.put('/:id', auth, async (req, res) => {
  const documentId = parseInt(req.params.id, 10);
  const {
    name,
    summary = '',
    tags = [],
    prio = 'moyenne',
    collection_name = '',
    metadata = {},
    ...extraFields // contient les champs dynamiques spécifiques
  } = req.body;

  try {
    if (!name) {
      return res.status(400).json({ error: 'Le nom du document est requis.' });
    }

    // 1. Mise à jour de la table documents
    await pool.query(`
      UPDATE documents 
      SET 
        name = $1,
        summary = $2,
        tags = $3,
        priority = $4,
        metadata = $5
      WHERE id = $6
    `, [name, summary, tags, prio, metadata, documentId]);

    // 2. Ajout/MAJ dans la table spécialisée
    const catRes = await pool.query(`SELECT category FROM documents WHERE id = $1`, [documentId]);
    const category = catRes.rows[0]?.category;

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
    req.body.num_facture || '',
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



      case 'demande_conge':
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

      default:
        break;
    }

    // 3. Gestion des collections (optionnelle)
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

    // 4. Renvoi du document mis à jour
    const updated = await pool.query('SELECT * FROM documents WHERE id = $1', [documentId]);
    res.status(200).json(updated.rows[0]);

  } catch (err) {
    console.error('❌ Erreur update document :', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});
router.get('/:id/details', auth, async (req, res) => {
  const documentId = req.params.id;

  try {
    const docRes = await pool.query('SELECT * FROM documents WHERE id = $1', [documentId]);

    if (docRes.rowCount === 0) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }

    const doc = docRes.rows[0];
    let meta = {};

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

      default:
        meta = {};
    }

    res.json({
      document: doc,
      details: meta
    });

  } catch (err) {
    console.error('Erreur récupération détails document :', err.stack);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});



router.post('/:id/share', auth, async (req, res) => {
  const documentId = req.params.id;
  const { visibility, id_group, id_share } = req.body;

  try {
    const query = `
      UPDATE documents 
      SET visibility = $1, id_group = $2, id_share = $3
      WHERE id = $4
    `;
    await pool.query(query, [visibility, id_group || null, id_share || null, documentId]);

    res.status(200).json({ message: 'Partage mis à jour avec succès.' });
  } catch (error) {
    console.error('Erreur lors du partage du document :', error);
    res.status(500).json({ error: 'Erreur lors du partage du document.' });
    console.error('Erreur:', err.stack);
    if (req.file) fs.unlink(req.file.path, () => { });
    res.status(500).json({ error: 'Erreur lors de l\'ajout', details: err.message });
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
    const versions = await pool.query(`
      SELECT dv.*, d.name AS original_name
      FROM document_versions dv
      JOIN documents d ON d.id = dv.document_id
      WHERE dv.document_id = $1
      ORDER BY dv.version DESC
    `, [id]);

    res.status(200).json(versions.rows);

  } catch (err) {
    console.error('Erreur récupération des versions :', err.stack);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
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