const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

// Connexion à la base PostgreSQL
const pool = new Pool({
  user: process.env.PG_USER || 'postgres',
  host: process.env.PG_HOST || 'localhost',
  database: process.env.PG_DATABASE || 'ged',
  password: process.env.PG_PASSWORD || 'hadjer',
  port: process.env.PG_PORT || 5432,
});

// Middleware JWT (optionnel, à activer si besoin de protection)
function verifyToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(403).json({ message: 'Token manquant' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token invalide' });
  }
}

// ➕ Ajouter une nouvelle notification
router.post('/', async (req, res) => {
  const {
    user_id,
    sender_id,
    message,
    type,
    related_task_id,
    document_id,
    decision,
    is_read
  } = req.body;

  // Validation de base
  if (!user_id || !sender_id || !message) {
    return res.status(400).json({
      message: 'user_id, sender_id et message sont obligatoires'
    });
  }

  const parsedUserId = parseInt(user_id, 10);
  const parsedSenderId = parseInt(sender_id, 10);
  const parsedRelatedTaskId = related_task_id ? parseInt(related_task_id, 10) : null;
  const parsedDocumentId = document_id ? parseInt(document_id, 10) : null;
  const parsedDecision = typeof decision === 'boolean' ? decision : null;
  const parsedIsRead = typeof is_read === 'boolean' ? is_read : false;

  if (isNaN(parsedUserId) || isNaN(parsedSenderId)) {
    return res.status(400).json({
      message: 'user_id et sender_id doivent être des entiers valides'
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO notifications 
        (user_id, sender_id, message, type, related_task_id, document_id, is_read, decision)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        parsedUserId,
        parsedSenderId,
        message,
        type || 'info',
        parsedRelatedTaskId,
        parsedDocumentId,
        parsedIsRead,
        parsedDecision
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Erreur lors de l'ajout de la notification :", err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});


// 📬 Récupérer les notifications simples d’un utilisateur
router.get('/:user_id', async (req, res) => {
  const parsedUserId = parseInt(req.params.user_id, 10);
  if (isNaN(parsedUserId)) {
    return res.status(400).json({ message: 'user_id doit être un entier valide' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
      [parsedUserId]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Erreur lors de la récupération des notifications', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// 📃 Récupérer les notifications enrichies
router.get('/detailed/:user_id', async (req, res) => {
  const parsedUserId = parseInt(req.params.user_id, 10);
  if (isNaN(parsedUserId)) {
    return res.status(400).json({ message: 'user_id doit être un entier valide' });
  }

  try {
    const result = await pool.query(`
      SELECT 
        n.*,
        u.name AS sender_first_name,
        u.prenom AS sender_last_name,
        d.name AS document_name
      FROM notifications n
      LEFT JOIN users u ON n.sender_id = u.id
      LEFT JOIN documents d ON n.document_id = d.id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC
    `, [parsedUserId]);

    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Erreur lors de la récupération des notifications enrichies', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ✅ Marquer une notification comme lue
router.put('/read/:id', async (req, res) => {
  const notificationId = parseInt(req.params.id, 10);
  if (isNaN(notificationId)) {
    return res.status(400).json({ message: 'ID de notification invalide' });
  }

  try {
    const result = await pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 RETURNING *',
      [notificationId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Notification non trouvée' });
    }

    res.status(200).json({ message: 'Notification marquée comme lue' });
  } catch (err) {
    console.error('Erreur lors de la mise à jour de la notification', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
