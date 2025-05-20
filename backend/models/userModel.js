const pool = require("../config/db");

const findUserByEmail = async (email) => {
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  return result.rows[0];
};

module.exports = { findUserByEmail };

// Créer un utilisateur
const createUser = async ({ name, prenom, email, password, role }) => {
  const result = await pool.query(
    `INSERT INTO users (name, prenom, email, password, role)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [name,prenom, email, password, role]
  );
  return result.rows[0];
};

// Fonction pour récupérer tous les utilisateurs
const getUsers = async () => {
  try {
    const result = await pool.query("SELECT * FROM users");
    return result.rows;
  } catch (err) {
    console.error('Error in database query:', err); // Log l'erreur liée à la base de données
    throw new Error('Database query failed'); // Rejette l'erreur pour qu'elle soit captée par le contrôleur
  }
};


// Modifier un utilisateur
const updateUser = async (id, { name, prenom, email, role }) => {
  const result = await pool.query(
    `UPDATE users SET name = $1, prenom = $2, email = $3, role = $4 WHERE id = $5 RETURNING *`,
    [name, prenom, email, role, id]
  );
  return result.rows[0];
};

// Supprimer un utilisateur
const deleteUser = async (id) => {
  const result = await pool.query(
    `DELETE FROM users WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0];
};

const createSession = async (userId, loginTime, logoutTime, duration) => {
  const result = await pool.query(
    `INSERT INTO sessions (user_id, login_time, logout_time, duration)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [userId, loginTime, logoutTime, duration]
  );
  return result.rows[0];
};

const getUserSessions = async (userId) => {
  const result = await pool.query(
    `SELECT * FROM sessions WHERE user_id = $1 ORDER BY login_time DESC`,
    [userId]
  );
  return result.rows;
};

// Dans userModel.js
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

const getActiveSession = async (userId) => {
  const result = await pool.query(
    `SELECT * FROM sessions 
     WHERE user_id = $1 AND logout_time IS NULL
     ORDER BY login_time DESC LIMIT 1`,
    [userId]
  );
  return result.rows[0];
};

// Dans userModel.js
const getUserWorkStats = async () => {
  const result = await pool.query(`
    SELECT 
      u.id,
      u.name,
      u.prenom,
      u.role,
      COALESCE(SUM(s.duration), 0) as total_duration,
      COUNT(s.id) as session_count
    FROM users u
    LEFT JOIN sessions s ON u.id = s.user_id
    GROUP BY u.id
    ORDER BY total_duration ASC
  `);
  return result.rows;
};

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
  getUserWorkStats
};
