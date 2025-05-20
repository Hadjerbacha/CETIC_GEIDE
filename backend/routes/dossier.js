const express = require('express');
const { Pool } = require('pg');
const { auth } = require('../middleware/auth');
const router = express.Router();

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

// POST : Créer un dossier
router.post('/folders', auth, async (req, res) => {
  const { name, parent_id } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Nom du dossier requis' });
  }

  try {
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


// Initialisation des tables
initializeDatabase();

module.exports = router;
