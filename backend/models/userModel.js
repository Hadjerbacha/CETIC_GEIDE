const pool = require("../config/db");

// Fonction pour trouver un utilisateur par email
const findUserByEmail = async (email) => {
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  return result.rows[0];
};

// Fonction pour créer un utilisateur
const createUser = async ({ name, prenom, email, password, role }) => {
  const result = await pool.query(
    `INSERT INTO users (name, prenom, email, password, role, is_active)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [name, prenom, email, password, role, true]
  );
  return result.rows[0];
};

// Fonction pour récupérer tous les utilisateurs avec filtres
const getUsers = async (filters = {}) => {
  try {
    let query = "SELECT * FROM users WHERE 1=1";
    const params = [];
    let paramIndex = 1;

    if (filters.search) {
      query += ` AND (name ILIKE $${paramIndex} OR prenom ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters.role) {
      query += ` AND role = $${paramIndex}`;
      params.push(filters.role);
      paramIndex++;
    }

    if (filters.status) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(filters.status === 'active');
      paramIndex++;
    }

    const result = await pool.query(query, params);
    return result.rows;
  } catch (err) {
    console.error('Error in database query:', err);
    throw new Error('Database query failed');
  }
};

// Fonction pour mettre à jour un utilisateur
const updateUser = async (id, { name, prenom, email, role }) => {
  const result = await pool.query(
    `UPDATE users SET name = $1, prenom = $2, email = $3, role = $4 WHERE id = $5 RETURNING *`,
    [name, prenom, email, role, id]
  );
  return result.rows[0];
};

// Fonction pour supprimer un utilisateur (avec option de suppression permanente)
const deleteUser = async (id, permanent = false) => {
  if (!permanent) {
    // 1. D'abord vérifier que l'utilisateur existe
    const user = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (!user.rows[0]) return null;

    // 2. Supprimer toutes les dépendances (ajuster selon votre schéma)
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM user_groups WHERE user_id = $1', [id]);
    // ... autres tables liées

    // 3. Finalement supprimer l'utilisateur
    const result = await pool.query(
      `DELETE FROM users WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0];
  } else {
    // Logique existante de désactivation
    const result = await pool.query(
      `UPDATE users SET is_active = false WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0];
  }
};

// Fonction pour désactiver un utilisateur
const deactivateUser = async (id) => {
  const result = await pool.query(
    `UPDATE users SET is_active = false WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0];
};

// Fonction pour réactiver un utilisateur
const reactivateUser = async (id) => {
  const result = await pool.query(
    `UPDATE users SET is_active = true WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0];
};

// Fonction pour créer une session
const createSession = async (userId, loginTime, logoutTime, duration) => {
  const result = await pool.query(
    `INSERT INTO sessions (user_id, login_time, logout_time, duration)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [userId, loginTime, logoutTime, duration]
  );
  return result.rows[0];
};

// Fonction pour récupérer les sessions d'un utilisateur
const getUserSessions = async (userId) => {
  const result = await pool.query(
    `SELECT * FROM sessions WHERE user_id = $1 ORDER BY login_time DESC`,
    [userId]
  );
  return result.rows;
};

// Fonction pour mettre à jour le temps de déconnexion
const updateLogoutTime = async (userId, logoutTime) => {
  const result = await pool.query(
    `UPDATE sessions 
     SET logout_time = $1, duration = EXTRACT(EPOCH FROM ($1 - login_time))
     WHERE user_id = $2 AND logout_time IS NULL
     RETURNING *`,
    [logoutTime, userId]
  );
  return result.rows[0];
};

// Fonction pour récupérer la session active
const getActiveSession = async (userId) => {
  const result = await pool.query(
    `SELECT * FROM sessions 
     WHERE user_id = $1 AND logout_time IS NULL
     ORDER BY login_time DESC LIMIT 1`,
    [userId]
  );
  return result.rows[0];
};

// Fonction pour récupérer les statistiques de travail des utilisateurs
const getUserWorkStats = async () => {
  const result = await pool.query(`
    SELECT 
      u.id,
      u.name,
      u.prenom,
      u.role,
      u.is_active,
      COALESCE(SUM(s.duration), 0) as total_duration,
      COUNT(s.id) as session_count
    FROM users u
    LEFT JOIN sessions s ON u.id = s.user_id
    WHERE u.is_active = true
    GROUP BY u.id
    ORDER BY total_duration ASC
  `);
  return result.rows;
};

// Export de toutes les fonctions
module.exports = {
  findUserByEmail,
  createUser,
  getUsers,
  updateUser,
  deleteUser,
  createSession,
  getUserSessions,
  updateLogoutTime,
  getActiveSession,
  getUserWorkStats,
  deactivateUser,
  reactivateUser
};