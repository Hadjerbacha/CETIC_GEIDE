const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

// Configuration de la base de données
const pool = new Pool({
    user: process.env.PG_USER || 'postgres',
    host: process.env.PG_HOST || 'localhost',
    database: process.env.PG_DATABASE || 'ged',
    password: process.env.PG_PASSWORD || 'hadjer',
    port: process.env.PG_PORT || 5432,
  });

// Middleware d'authentification
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Enregistrer une nouvelle activité
const logActivity = async (userId, actionType, entityType, entityId, details, ipAddress) => {
  const query = `
    INSERT INTO user_activities 
    (user_id, action_type, entity_type, entity_id, details, ip_address)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *`;
  
  const values = [userId, actionType, entityType, entityId, details, ipAddress];
  
  try {
    await pool.query(query, values);
  } catch (err) {
    console.error('Error logging activity:', err);
  }
};

// Récupérer les activités de l'utilisateur connecté
router.get('/me', authenticateToken, async (req, res) => {
  const { actionType, entityType, dateFrom, dateTo } = req.query;
  const userId = req.user.id;

  try {
    let query = `
      SELECT * FROM user_activities 
      WHERE user_id = $1`;
    
    const values = [userId];
    let paramCount = 2;

    if (actionType) {
      query += ` AND action_type = $${paramCount}`;
      values.push(actionType);
      paramCount++;
    }

    if (entityType) {
      query += ` AND entity_type = $${paramCount}`;
      values.push(entityType);
      paramCount++;
    }

    if (dateFrom) {
      query += ` AND created_at >= $${paramCount}`;
      values.push(dateFrom);
      paramCount++;
    }

    if (dateTo) {
      query += ` AND created_at <= $${paramCount}`;
      values.push(dateTo);
      paramCount++;
    }

    query += ` ORDER BY created_at DESC`;

    const { rows } = await pool.query(query, values);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la récupération des activités' });
  }
});

// Récupérer toutes les activités (admin seulement)
router.get('/', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès non autorisé' });
  }

  const { actionType, entityType, userId, dateFrom, dateTo } = req.query;

  try {
    let query = `SELECT * FROM user_activities`;
    const values = [];
    let paramCount = 1;
    let whereAdded = false;

    const addCondition = (condition, value) => {
      if (value) {
        query += whereAdded ? ' AND' : ' WHERE';
        query += ` ${condition} = $${paramCount}`;
        values.push(value);
        paramCount++;
        whereAdded = true;
      }
    };

    addCondition('action_type', actionType);
    addCondition('entity_type', entityType);
    addCondition('user_id', userId);

    if (dateFrom) {
      query += whereAdded ? ' AND' : ' WHERE';
      query += ` created_at >= $${paramCount}`;
      values.push(dateFrom);
      paramCount++;
      whereAdded = true;
    }

    if (dateTo) {
      query += whereAdded ? ' AND' : ' WHERE';
      query += ` created_at <= $${paramCount}`;
      values.push(dateTo);
      paramCount++;
      whereAdded = true;
    }

    query += ` ORDER BY created_at DESC`;

    const { rows } = await pool.query(query, values);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la récupération des activités' });
  }
});

// Middleware pour logger les activités automatiquement
router.activityLogger = (req, res, next) => {
  res.on('finish', async () => {
    try {
      const token = req.headers['authorization']?.split(' ')[1];
      if (!token) return;

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
      const userId = decoded.id;

      // Détecter le type d'action en fonction de la méthode HTTP
      const actionTypes = {
        'POST': 'create',
        'GET': 'view',
        'PUT': 'update',
        'DELETE': 'delete'
      };

      const actionType = actionTypes[req.method] || 'other';

      // Extraire le type d'entité à partir du chemin
      const entityMatch = req.path.match(/\/(\w+)(?:\/\d+)?$/);
      const entityType = entityMatch ? entityMatch[1] : null;

      // Extraire l'ID de l'entité si disponible
      const entityIdMatch = req.path.match(/\/(\d+)$/);
      const entityId = entityIdMatch ? parseInt(entityIdMatch[1]) : null;

      await logActivity(
        userId,
        actionType,
        entityType,
        entityId,
        { method: req.method, path: req.path, statusCode: res.statusCode },
        req.ip
      );
    } catch (err) {
      console.error('Error in activity logger:', err);
    }
  });
  next();
};

module.exports = { router, logActivity };