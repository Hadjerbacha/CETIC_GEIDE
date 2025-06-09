const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Envoyer un message
router.post('/', async (req, res) => {
  const sender_id = req.user.userId; // ou depuis le JWT décodé
  const {recipient_id, content } = req.body;
  console.log("📩 Données reçues :", { sender_id, recipient_id, content });

  if (!sender_id || !recipient_id || !content) {
    return res.status(400).json({ error: 'Champs manquants' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO messages (sender_id, recipient_id, content, sent_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [sender_id, recipient_id, content]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Erreur lors de l’envoi du message :', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
