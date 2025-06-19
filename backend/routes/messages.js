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
const { logActivity } = require('./historique');


// Envoyer un message à un utilisateur ou un groupe
router.post('/', auth, async (req, res) => {
   const { recipient_id, group_id, content } = req.body;
  const sender_id = req.user.id;
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
    // Log de l'action
    await logActivity(
      sender_id,
      'message_send',
      recipient_id ? 'private_message' : 'group_message',
      result.rows[0].id,
      {
        recipient_id,
        group_id,
        content_length: content.length
      }
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Erreur lors de l’envoi du message :', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }


});

router.post('/messages', auth, async (req, res) => {
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
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const [received, sent] = await Promise.all([
      pool.query(`
        SELECT m.*, u.prenom as sender_prenom, u.name as sender_name 
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.recipient_id = $1
      `, [userId]),
      
      pool.query(`
        SELECT m.*, u.prenom as recipient_prenom, u.name as recipient_name 
        FROM messages m
        JOIN users u ON m.recipient_id = u.id
        WHERE m.sender_id = $1
      `, [userId])
    ]);
    
    res.status(200).json({
      received: received.rows,
      sent: sent.rows
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ error: error.message });
  }
});

// routes/messages.js
router.get('/conversations', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Récupère toutes les conversations (groupes et contacts)
    const conversations = await pool.query(`
      (SELECT 
        u.id as contact_id,
        u.prenom as contact_prenom,
        u.name as contact_name,
        MAX(m.sent_at) as last_message_date
      FROM messages m
      JOIN users u ON (m.sender_id = u.id OR m.recipient_id = u.id) AND u.id != $1
      WHERE m.sender_id = $1 OR m.recipient_id = $1
      GROUP BY u.id)
      
      UNION
      
      (SELECT 
        g.id as contact_id,
        g.name as contact_prenom,
        'Groupe' as contact_name,
        MAX(m.sent_at) as last_message_date
      FROM messages m
      JOIN groups g ON m.group_id = g.id
      WHERE m.sender_id = $1 OR m.recipient_id = $1 OR m.group_id IS NOT NULL
      GROUP BY g.id)
      
      ORDER BY last_message_date DESC
    `, [userId]);

    res.json(conversations.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/conversation/:id', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const contactId = req.params.id;

    // Vérifie si c'est une conversation de groupe
    const isGroup = req.query.type === 'group';

    const messages = await pool.query(
      isGroup 
        ? `SELECT m.*, u.prenom as sender_prenom 
           FROM messages m
           JOIN users u ON m.sender_id = u.id
           WHERE m.group_id = $1
           ORDER BY m.sent_at ASC`
        : `SELECT m.*, u.prenom as sender_prenom 
           FROM messages m
           JOIN users u ON m.sender_id = u.id
           WHERE (m.sender_id = $1 AND m.recipient_id = $2)
              OR (m.sender_id = $2 AND m.recipient_id = $1)
           ORDER BY m.sent_at ASC`,
      isGroup ? [contactId] : [userId, contactId]
    );

    res.json(messages.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
module.exports = router;
