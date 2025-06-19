// controllers/historique.js
const pool = require("../config/db");
const { format } = require('date-fns');

// Fonction pour enregistrer une activité
const logActivity = async (userId, actionType, entityType, entityId, details = {}) => {
  try {
    console.log('Tentative d\'enregistrement d\'activité:', { 
      userId, 
      actionType, 
      entityType, 
      entityId, 
      details 
    });
    
    const query = `
      INSERT INTO activity_logs 
        (user_id, action_type, entity_type, entity_id, details, timestamp)
      VALUES 
        ($1, $2, $3, $4, $5, NOW())
      RETURNING *;
    `;
    
    const values = [
      userId,
      actionType,
      entityType,
      entityId,
      JSON.stringify(details)
    ];

    const result = await pool.query(query, values);
    console.log('Activité enregistrée avec succès:', result.rows[0]);
    return result.rows[0];
  } catch (err) {
    console.error('Erreur lors de l\'enregistrement de l\'activité:', err);
    throw err;
  }
};

// Fonction pour récupérer les activités d'un utilisateur
const getUserActivities = async (userId, filters = {}) => {
  try {
    let query = `
      SELECT 
        al.*,
        u.name as user_name,
        u.prenom as user_prenom
      FROM activity_logs al
      JOIN users u ON al.user_id = u.id
      WHERE al.user_id = $1
    `;
    
    const params = [userId];
    let paramIndex = 2;

    // Ajout des filtres
    if (filters.dateFrom) {
      query += ` AND al.timestamp >= $${paramIndex}`;
      params.push(filters.dateFrom);
      paramIndex++;
    }

    if (filters.dateTo) {
      query += ` AND al.timestamp <= $${paramIndex}`;
      params.push(filters.dateTo + ' 23:59:59');
      paramIndex++;
    }

    if (filters.actionType) {
      query += ` AND al.action_type = $${paramIndex}`;
      params.push(filters.actionType);
      paramIndex++;
    }

    query += ` ORDER BY al.timestamp DESC`;

    const { rows } = await pool.query(query, params);
    return rows;
  } catch (err) {
    console.error('Erreur lors de la récupération des activités:', err);
    throw err;
  }
};

// Fonction pour récupérer tous les logs avec filtres
const getActivityLogs = async (userId = null, filters = {}) => {
  try {
    let query = `
      SELECT 
        al.*,
        u.name as user_name,
        u.prenom as user_prenom,
        u.role as user_role
      FROM activity_logs al
      JOIN users u ON al.user_id = u.id
    `;
    
    const params = [];
    let paramIndex = 1;

    // Filtre par utilisateur si spécifié (pour admin)
    if (userId) {
      query += ` WHERE al.user_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    // Ajout des filtres
    if (filters.dateFrom) {
      query += userId ? ' AND' : ' WHERE';
      query += ` al.timestamp >= $${paramIndex}`;
      params.push(filters.dateFrom);
      paramIndex++;
    }

    if (filters.dateTo) {
      query += ` AND al.timestamp <= $${paramIndex}`;
      params.push(filters.dateTo + ' 23:59:59');
      paramIndex++;
    }

    if (filters.actionType) {
      query += ` AND al.action_type = $${paramIndex}`;
      params.push(filters.actionType);
      paramIndex++;
    }

    query += ` ORDER BY al.timestamp DESC`;

    const { rows } = await pool.query(query, params);
    return rows;
  } catch (err) {
    console.error('Erreur lors de la récupération des logs:', err);
    throw err;
  }
};

module.exports = {
  logActivity,
  getUserActivities,
  getActivityLogs
};