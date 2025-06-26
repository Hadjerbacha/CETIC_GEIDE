// routes/activityLogs.js
const express = require('express');
const router = express.Router();
const { getActivityLogs } = require('./historique');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, async (req, res) => {
  try {
    let userId;
    
    // Si un userId est spécifié dans les query params ET que l'utilisateur est admin
    if (req.query.userId && req.user.role === 'admin') {
      userId = req.query.userId;
    } 
    // Sinon, si ce n'est pas un admin, on filtre par son propre userId
    else if (req.user.role !== 'admin') {
      userId = req.user.id;
    }
    // Sinon (admin sans userId spécifié), pas de filtre
    
    const logs = await getActivityLogs(userId, req.query);
    res.json(logs);
  } catch (err) {
    console.error('Error getting activity logs:', err);
    res.status(500).json({ error: 'Error getting activity logs' });
  }
});

module.exports = router;