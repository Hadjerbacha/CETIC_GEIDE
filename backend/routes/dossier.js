const express = require('express');
const { Pool } = require('pg');
const { auth } = require('../middleware/auth');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// Configuration du stockage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Dossier où enregistrer les fichiers
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// PostgreSQL Pool configuration
const pool = new Pool({
  user: process.env.PG_USER || 'postgres',
  host: process.env.PG_HOST || 'localhost',
  database: process.env.PG_DATABASE || 'ged',
  password: process.env.PG_PASSWORD || 'hadjer',
  port: process.env.PG_PORT || 5432,
});

// Initialisation des tables pour les dossiers
async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS folders (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL,
        date TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('Table folders prête');
  } catch (err) {
    console.error("Erreur lors de l'initialisation:", err.stack);
  }
}

router.post('/', upload.any(), async (req, res) => {
  const { name, parent_id, userId, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Nom du dossier requis' });
  }

  if (!userId) {
    return res.status(401).json({ error: 'Utilisateur non spécifié' });
  }

  try {
    // 1. Création du dossier avec description
    const folderResult = await pool.query(
      `INSERT INTO folders (name, parent_id, user_id, description) VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, parent_id || null, userId, description || null]
    );

    const folder = folderResult.rows[0];

    // 2. Insertion des documents uploadés dans le dossier
    if (req.files && req.files.length > 0) {
      const insertDocPromises = req.files.map(file => {
        return pool.query(
          `INSERT INTO documents (name, file_path, folder_id, owner_id, date, version)
           VALUES ($1, $2, $3, $4, NOW(), 1)`,
          [file.originalname, file.path, folder.id, userId]
        );
      });

      await Promise.all(insertDocPromises);
    }

    // 3. Réponse avec l'ID du dossier créé
    res.status(201).json({ folderId: folder.id });

  } catch (err) {
    console.error('Erreur lors de la création du dossier et des documents :', err.stack);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

router.get('/folders/:parentId', async (req, res) => {
  // Conversion sécurisée avec vérification
  const parentId = req.params.parentId === 'null' || req.params.parentId === 'undefined' 
    ? null 
    : parseInt(req.params.parentId, 10);

  // Validation du résultat
  if (parentId === null || isNaN(parentId)) {
    return res.status(400).json({ 
      error: 'ID parent invalide',
      received: req.params.parentId,
      expected: 'Nombre entier ou "null"'
    });
  }

  try {
    const query = parentId === null
      ? 'SELECT * FROM folders WHERE parent_id IS NULL'
      : 'SELECT * FROM folders WHERE parent_id = $1';
    
    const params = parentId === null ? [] : [parentId];
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Erreur DB:', {
      message: error.message,
      stack: error.stack,
      query: { parentId }
    });
    res.status(500).json({ 
      error: 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


router.post('/', upload.array('files'), async (req, res) => {
  try {
    const { folder_name, folder_description, created_by } = req.body;
    const files = req.files;

    const folderResult = await pool.query(
      `INSERT INTO folders (name, user_id, date)
       VALUES ($1, $2, NOW()) RETURNING id`,
      [folder_name, created_by]
    );
    const folderId = folderResult.rows[0].id;

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

// Récupérer tous les dossiers d'un utilisateur
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM folders WHERE user_id = $1 ORDER BY date DESC`,
      [req.user.id]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Erreur lors de la récupération des dossiers:', err.stack);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// Récupérer un dossier spécifique
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM folders WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dossier non trouvé' });
    }
    
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Erreur lors de la récupération du dossier:', err.stack);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// Récupérer les sous-dossiers
router.get('/:id/children', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM folders WHERE parent_id = $1 AND user_id = $2 ORDER BY date DESC`,
      [req.params.id, req.user.id]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Erreur récupération sous-dossiers:', err.stack);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// Récupérer les documents d'un dossier
router.get('/:id/documents', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM documents WHERE folder_id = $1 ORDER BY date DESC`,
      [req.params.id]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Erreur récupération documents:', err.stack);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// Créer un nouveau dossier
router.post('/', auth, async (req, res) => {
  const { name, parent_id, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Nom du dossier requis' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO folders (name, parent_id, user_id, description) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, parent_id || null, req.user.id, description || null]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erreur création dossier:', err.stack);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});


// GET : Rechercher un dossier par nom
router.get('/folders/search', auth, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Paramètre de recherche manquant' });

  try {
    const result = await pool.query(
      `SELECT * FROM folders WHERE user_id = $1 AND LOWER(name) LIKE LOWER($2)`,
      [req.user.id, `%${q}%`]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Erreur lors de la recherche:', err.stack);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// DELETE : Supprimer un dossier (et sous-dossiers automatiquement)
router.delete('/folders/:id', auth, async (req, res) => {
  const folderId = req.params.id;

  try {
    await pool.query('DELETE FROM folders WHERE id = $1 AND user_id = $2', [folderId, req.user.id]);
    res.status(200).json({ message: 'Dossier supprimé avec succès' });
  } catch (err) {
    console.error('Erreur lors de la suppression du dossier:', err.stack);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// Gardez la fonction pour déterminer le template
const getTemplateByFolderName = (folderName) => {
  const lowerName = folderName.toLowerCase();
  
  if (lowerName.includes('facture') || lowerName.includes('facturation')) {
    return 'facture';
  } else if (lowerName.includes('contrat') || lowerName.includes('convention')) {
    return 'contrat';
  } else if (lowerName.includes('conge') || lowerName.includes('absence')) {
    return 'conge';
  }
  return null;
};

// Modifiez la route pour créer le workflow sur demande
router.post('/:folderId/create-workflow', auth, async (req, res) => {
  const folderId = parseInt(req.params.folderId, 10);
  const userId = req.user.id;

  try {
    // 1. Vérifier que le dossier existe et récupérer son nom
    const folderRes = await pool.query('SELECT * FROM folders WHERE id = $1 AND user_id = $2', [folderId, userId]);
    if (folderRes.rowCount === 0) {
      return res.status(404).json({ error: 'Dossier non trouvé' });
    }

    const folder = folderRes.rows[0];
    const templateId = getTemplateByFolderName(folder.name);

    if (!templateId) {
      return res.status(400).json({ error: 'Aucun template correspondant au nom du dossier' });
    }

    // 2. Récupérer le template
    const templates = {
      facture: {
        name: 'Workflow Facture',
        description: 'Traitement des factures',
        steps: [
          { title: 'Vérification comptable', description: 'Vérification des montants', type: 'validation' },
          { title: 'Approbation paiement', description: 'Validation paiement', type: 'validation' },
          { title: 'Enregistrement', description: 'Enregistrement comptable', type: 'operation' }
        ]
      },
      contrat: {
        name: 'Workflow Contrat',
        description: 'Gestion des contrats',
        steps: [
          { title: 'Vérification légale', description: 'Validation par le service juridique', type: 'validation' },
          { title: 'Signature', description: 'Signature par les parties', type: 'operation' },
          { title: 'Archivage', description: 'Enregistrement du contrat', type: 'operation' }
        ]
      },
      conge: {
        name: 'Workflow Congé',
        description: 'Gestion des demandes de congé',
        steps: [
          { title: 'Vérification droits', description: 'Vérification par les RH', type: 'validation' },
          { title: 'Validation manager', description: 'Approbation par le manager', type: 'validation' },
          { title: 'Notification RH', description: 'Notification finale', type: 'operation' }
        ]
      }
    };

    const template = templates[templateId];

    // 3. Créer le workflow
    const workflowRes = await pool.query(
      `INSERT INTO workflow (name, description, created_by, folder_id, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [template.name, template.description, userId, folderId, 'pending']
    );
    const workflow = workflowRes.rows[0];

    // 4. Créer les tâches
    for (const step of template.steps) {
      await pool.query(
        `INSERT INTO tasks (title, description, type, workflow_id, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [step.title, step.description, step.type, workflow.id, 'pending']
      );
    }

    // 5. Lier le workflow au dossier
    await pool.query(
      `UPDATE folders SET workflow_id = $1 WHERE id = $2`,
      [workflow.id, folderId]
    );

    res.status(201).json({ 
      message: 'Workflow créé avec succès',
      workflowId: workflow.id
    });

  } catch (err) {
    console.error('Erreur création workflow:', err.stack);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
// Initialisation des tables
initializeDatabase();

module.exports = router;
