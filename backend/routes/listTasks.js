const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // connexion PostgreSQL
const authenticateToken = require('../middleware/authMiddleware'); // Middleware JWT

// Créer une nouvelle sous-tâche
router.post('/', authenticateToken, async (req, res) => {
  const { task_id, description, is_done } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO list_tasks (task_id, description, is_done) VALUES ($1, $2, $3) RETURNING *',
      [task_id, description, is_done || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la création de la sous-tâche.' });
  }
});

// Obtenir les sous-tâches d’une tâche
router.get('/:task_id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM list_tasks WHERE task_id = $1 ORDER BY id ASC',
      [req.params.task_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des sous-tâches.' });
  }
});

// Mettre à jour une sous-tâche (status ou texte)
router.put('/:id', authenticateToken, async (req, res) => {
  const { description, is_done } = req.body;
  try {
    const result = await pool.query(
      'UPDATE list_tasks SET description = $1, is_done = $2 WHERE id = $3 RETURNING *',
      [description, is_done, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour.' });
  }
});

// Supprimer une sous-tâche
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM list_tasks WHERE id = $1', [req.params.id]);
    res.json({ message: 'Sous-tâche supprimée.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la suppression.' });
  }
});

module.exports = router;
