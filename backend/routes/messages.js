const pool = require('../config/db');
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
const axios = require('axios');
const NLP_SERVICE_URL = 'http://localhost:5001/classify';
const NLP_TIMEOUT = 3000; // 3 secondes timeout



// Envoyer un message à un utilisateur ou un groupe
router.post('/', auth, async (req, res) => {
  const sender_id = req.user.userId;
  const { recipient_id, group_id, content } = req.body;
  console.log("📩 Données reçues :", { sender_id, recipient_id, group_id, content });

  if (!sender_id || !content || (!recipient_id && !group_id)) {
    return res.status(400).json({ error: 'Champs manquants' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO messages (sender_id, recipient_id, group_id, content, sent_at)
       VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
      [sender_id, recipient_id || null, group_id || null, content]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Erreur lors de l’envoi du message :', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


module.exports = router;
