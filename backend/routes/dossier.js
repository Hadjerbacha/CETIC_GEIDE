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
  const { name, parent_id, userId } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Nom du dossier requis' });
  }

  if (!userId) {
    return res.status(401).json({ error: 'Utilisateur non spécifié' });
  }

  try {
    // 1. Création du dossier
    const folderResult = await pool.query(
      `INSERT INTO folders (name, parent_id, user_id) VALUES ($1, $2, $3) RETURNING *`,
      [name, parent_id || null, userId]
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



// Express backend
router.get('/folders/:id/documents', auth, async (req, res) => {
  const folderId = req.params.id;
  try {
    const result = await pool.query('SELECT * FROM documents WHERE folder_id = $1', [folderId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des documents:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.get('/folders/:parentId', async (req, res) => {
  const parentId = parseInt(req.params.parentId);
  try {
    const folders = await pool.query(
      'SELECT * FROM folders WHERE parent_id = $1',
      [parentId]
    );
    res.json(folders.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send('Erreur serveur');
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


// GET : Récupérer les dossiers (option parent_id)
router.get('/folders', auth, async (req, res) => {
  const parentId = req.query.parent_id || null;

  try {
    const result = await pool.query(
      `SELECT * FROM folders WHERE user_id = $1 AND parent_id IS NOT DISTINCT FROM $2 ORDER BY date DESC`,
      [req.user.id, parentId]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Erreur lors de la récupération des dossiers:', err.stack);
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

router.get('/folders/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT * FROM folders WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Dossier non trouvé" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erreur lors de la récupération du dossier:', err.stack);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// GET : Sous-dossiers d’un dossier parent
router.get('/folders/:id/children', auth, async (req, res) => {
  const parentId = req.params.id;

  try {
    const result = await pool.query(
      'SELECT * FROM folders WHERE parent_id = $1 AND user_id = $2',
      [parentId, req.user.id]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Erreur récupération sous-dossiers :', err.stack);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});



// Initialisation des tables
initializeDatabase();

module.exports = router;
