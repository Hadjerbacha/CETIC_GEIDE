const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Get all users (for selection)
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, nom, email FROM users');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all groups
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM groups');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create group
router.post('/', async (req, res) => {
  const { nom, description, user_ids } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO groups (nom, description, user_ids) VALUES ($1, $2, $3) RETURNING *',
      [nom, description, user_ids]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update group
router.put('/:id', async (req, res) => {
  const id = req.params.id;
  const { nom, description, user_ids } = req.body;
  try {
    const result = await pool.query(
      'UPDATE groups SET nom = $1, description = $2, user_ids = $3 WHERE id = $4 RETURNING *',
      [nom, description, user_ids, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete group
router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query('DELETE FROM groups WHERE id = $1', [id]);
    res.json({ message: 'Group deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
