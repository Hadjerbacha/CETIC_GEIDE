// routes/activityLogs.js
const express = require('express');
const router = express.Router();
const { getActivityLogs } = require('./historique');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, async (req, res) => {
  try {
    // Pour les admins: pas de filtre user_id par défaut
    // Pour les autres: seulement leurs activités
    const userId = req.user.role === 'admin' ? null : req.user.id;
    
    const logs = await getActivityLogs(userId, req.query);
    res.json(logs);
  } catch (err) {
    console.error('Error getting activity logs:', err);
    res.status(500).json({ error: 'Error getting activity logs' });
  }
});

module.exports = router;