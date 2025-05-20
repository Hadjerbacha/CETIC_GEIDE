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

// PostgreSQL Pool configuration
const pool = new Pool({
  user: process.env.PG_USER || 'postgres',
  host: process.env.PG_HOST || 'localhost',
  database: process.env.PG_DATABASE || 'ged',
  password: process.env.PG_PASSWORD || 'hadjer',
  port: process.env.PG_PORT || 5432,
});

// 📥 Ajouter une nouvelle collection
router.post('/', async (req, res) => {
  const { name, description } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO collections (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erreur lors de l’ajout de la collection');
  }
});

// 📄 Obtenir toutes les collections
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM collections ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erreur lors de la récupération des collections');
  }
});

// 🗑️ Supprimer une collection par ID
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM collections WHERE id = $1', [id]);
    res.sendStatus(204);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erreur lors de la suppression de la collection');
  }
});

module.exports = router;
