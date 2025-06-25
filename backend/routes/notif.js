const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const { logActivity } = require('./historique');
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
// Log de la création de notification
    await logActivity(
      sender_id,
      'notification_send',
      'notification',
      result.rows[0].id,
      {
        recipient_id: user_id,
        notification_type: type
      }
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Erreur lors de l'ajout de la notification :", err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});
router.put('/:id/decision', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { decision } = req.body; // true = acceptée, false = refusée
  const userId = req.user.id; // ID de l'utilisateur qui prend la décision

  try {
    // 1. Récupérer la notification de demande originale
    const originalNotifQuery = await pool.query(
      `SELECT * FROM notifications 
       WHERE id = $1 AND type = 'request'`,
      [id]
    );

    if (originalNotifQuery.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: "Notification de demande introuvable ou déjà traitée" 
      });
    }

    const originalNotif = originalNotifQuery.rows[0];

    // 2. Mettre à jour la décision dans la notification originale
    await pool.query(
      `UPDATE notifications 
       SET decision = $1, is_read = true 
       WHERE id = $2`,
      [decision, id]
    );

    // 3. Créer une notification de réponse pour l'expéditeur
    const message = decision
      ? `Votre demande d'accès aux versions du document #${originalNotif.document_id} a été approuvée.`
      : `Votre demande d'accès aux versions du document #${originalNotif.document_id} a été refusée.`;

    const newNotif = await pool.query(
      `INSERT INTO notifications 
       (user_id, sender_id, message, type, document_id, decision, is_read, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) 
       RETURNING *`,
      [
        originalNotif.sender_id,
        userId,
        message,
        'info',
        originalNotif.document_id,
        decision,
        false
      ]
    );

      await pool.query(
      `UPDATE documents 
       SET access = $1 
       WHERE id = $2`,
      [decision ?true :false, originalNotif.document_id]
    );

    // Log de l'activité
    await logActivity(
      userId,
      'notification_decision',
      'notification',
      id,
      {
        decision: decision,
        recipient_id: originalNotif.sender_id,
        document_id: originalNotif.document_id
      }
    );

    res.json({
      success: true,
      message: `Demande ${decision ? 'acceptée' : 'refusée'} avec succès`,
      notification: newNotif.rows[0]
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du traitement de la décision'
    });
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
if (result.rowCount > 0) {
      // Log de la lecture
      await logActivity(
        result.rows[0].user_id,
        'notification_read',
        'notification',
        notificationId
      );
    }
    res.status(200).json({ message: 'Notification marquée comme lue' });
  } catch (err) {
    console.error('Erreur lors de la mise à jour de la notification', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
