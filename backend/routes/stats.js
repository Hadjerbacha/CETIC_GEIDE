const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Route : Statistiques globales
router.get('/stats', async (req, res) => {
  try {
    const users = await pool.query('SELECT COUNT(*) FROM users');
    const documents = await pool.query('SELECT COUNT(*) FROM documents');
    const tasks = await pool.query('SELECT COUNT(*) FROM tasks');
    const workflows = await pool.query('SELECT COUNT(*) FROM workflow');
    const notifications = await pool.query('SELECT COUNT(*) FROM notifications');

    res.json({
      totalUsers: parseInt(users.rows[0].count),
      totalDocuments: parseInt(documents.rows[0].count),
      totalTasks: parseInt(tasks.rows[0].count),
      totalWorkflows: parseInt(workflows.rows[0].count),
      totalNotifications: parseInt(notifications.rows[0].count),
    });
  } catch (error) {
    console.error('Erreur lors de /stats :', error.stack);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques.' });
  }
});

// Route : Tâches par statut
router.get('/stats/tasks/status', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT status AS name, COUNT(*)::int AS value
      FROM tasks
      GROUP BY status
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Erreur /stats/tasks/status :', error.stack);
    res.status(500).json({ error: 'Erreur lors de la récupération des stats tâches.' });
  }
});

// Route : Notifications par type
router.get('/stats/notifications/type', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT type AS name, COUNT(*)::int AS value
      FROM notifications
      GROUP BY type
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Erreur /stats/notifications/type :', error.stack);
    res.status(500).json({ error: 'Erreur lors de la récupération des stats notifications.' });
  }
});

module.exports = router;
