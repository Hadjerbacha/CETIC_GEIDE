const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { logActivity } = require('./historique');
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
    // Log de la création du groupe
    await logActivity(
      req.user?.id || 'system',
      'group_create',
      'group',
      result.rows[0].id,
      {
        name: nom,
        member_count: user_ids?.length || 0
      }
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
    // Récupérer le groupe avant modification pour le log
    const oldGroup = await pool.query('SELECT * FROM groups WHERE id = $1', [id]);
    
    const result = await pool.query(
      'UPDATE groups SET nom = $1, description = $2, user_ids = $3 WHERE id = $4 RETURNING *',
      [nom, description, user_ids, id]
    );
    
    // Log de la modification du groupe
    await logActivity(
      req.user?.id || 'system',
      'group_update',
      'group',
      id,
      {
        old_name: oldGroup.rows[0]?.nom,
        new_name: nom,
        member_changes: {
          old_count: oldGroup.rows[0]?.user_ids?.length || 0,
          new_count: user_ids?.length || 0
        }
      }
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
    // Récupérer le groupe avant suppression pour le log
    const group = await pool.query('SELECT * FROM groups WHERE id = $1', [id]);
    
    await pool.query('DELETE FROM groups WHERE id = $1', [id]);
    
    // Log de la suppression du groupe
    await logActivity(
      req.user?.id || 'system',
      'group_delete',
      'group',
      id,
      {
        name: group.rows[0]?.nom,
        member_count: group.rows[0]?.user_ids?.length || 0
      }
    );
    
    res.json({ message: 'Group deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
