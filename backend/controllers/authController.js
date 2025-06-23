const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { getUsers, findUserByEmail, createUser, updateUser, deleteUser, createSession, getUserSessions, getActiveSession, updateLogoutTime, getUserWorkStats, deactivateUser, reactivateUser} = require("../models/userModel");
require("dotenv").config();
const pool = require("../config/db");
const { logActivity } = require('../routes/historique');

const getUsersController = async (req, res) => {
  try {
    const { search, role, status } = req.query;
    let query = 'SELECT * FROM users WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (name ILIKE $1 OR prenom ILIKE $1 OR email ILIKE $1)';
      params.push(`%${search}%`);
    }

    if (role) {
      query += ` AND role = $${params.length + 1}`;
      params.push(role);
    }

    if (status) {
      query += ` AND is_active = $${params.length + 1}`;
      params.push(status === 'active');
    }

    const { rows: users } = await pool.query(query, params);
    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server Error' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await findUserByEmail(email);
    if (!user)
      return res.status(400).json({ message: "Email ou mot de passe invalide" });

    if (!user.is_active)
      return res.status(403).json({ message: "Ce compte est désactivé" });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword)
      return res.status(400).json({ message: "Email ou mot de passe invalide" });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: "300d",
    });
    
    const loginTime = new Date();
    await createSession(user.id, loginTime, null, null);
    
    await logActivity(
      user.id,
      'user_login',
      'user',
      user.id,
      {
        login_time: loginTime,
        ip_address: req.ip
      }
    );
    
    const { password: _, ...userData } = user;
    res.status(200).json({ token, user: userData });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

const register = async (req, res) => {
  const { name, prenom, email, password, role = "employe" } = req.body;
  console.log("Reçu :", req.body);
  try {
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: "Cet email est déjà utilisé." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await createUser({
      name,
      prenom,
      email,
      password: hashedPassword,
      role,
      is_active: true
    });

    await logActivity(
      req.user?.id || 'system',
      'user_create',
      'user',
      newUser.id,
      {
        email,
        role,
        created_by: req.user?.id || 'system'
      }
    );
    res.status(201).json({ message: "Inscription réussie", user: newUser });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

const updateUserController = async (req, res) => {
  const { id } = req.params;
  const { name, prenom, email, role } = req.body;

  try {
    const oldUser = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    const updated = await updateUser(id, { name, prenom, email, role });
    
    await logActivity(
      req.user.id,
      'user_update',
      'user',
      id,
      {
        changes: {
          name: { from: oldUser.rows[0]?.name, to: name },
          email: { from: oldUser.rows[0]?.email, to: email },
          role: { from: oldUser.rows[0]?.role, to: role }
        },
        updated_by: req.user.id
      }
    );
    
    res.status(200).json({ message: "Utilisateur mis à jour", user: updated });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

const deleteUserController = async (req, res) => {
  const { id } = req.params;
  const { permanent } = req.query;

  try {
    if (permanent === 'true') {
      const userToDelete = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      const deleted = await deleteUser(id);
      
      if (!deleted) return res.status(404).json({ message: "Utilisateur introuvable" });
      
      await logActivity(
        req.user.id,
        'user_delete',
        'user',
        id,
        {
          deleted_user: {
            name: userToDelete.rows[0]?.name,
            email: userToDelete.rows[0]?.email,
            role: userToDelete.rows[0]?.role
          },
          deleted_by: req.user.id
        }
      );
      
      return res.status(200).json({ message: "Utilisateur supprimé définitivement", user: deleted });
    } else {
      const deactivated = await deactivateUser(id);
      
      await logActivity(
        req.user.id,
        'user_deactivate',
        'user',
        id,
        {
          deactivated_by: req.user.id,
          deactivated_at: new Date()
        }
      );
      
      return res.status(200).json({ message: "Utilisateur désactivé", user: deactivated });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

const toggleUserStatus = async (req, res) => {
  const { id } = req.params;
  const { action } = req.body; // 'activate' or 'deactivate'

  try {
    // Vérifiez d'abord si l'utilisateur est authentifié
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Non autorisé" });
    }

    let result;
    if (action === 'activate') {
      result = await reactivateUser(id);
      await logActivity(
        req.user.id,
        'user_reactivate',
        'user',
        id,
        {
          reactivated_by: req.user.id,
          reactivated_at: new Date()
        }
      );
    } else {
      result = await deactivateUser(id);
      await logActivity(
        req.user.id,
        'user_deactivate',
        'user',
        id,
        {
          deactivated_by: req.user.id,
          deactivated_at: new Date()
        }
      );
    }

    res.status(200).json({ 
      message: action === 'activate' ? "Utilisateur réactivé" : "Utilisateur désactivé",
      user: result 
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

const logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Non autorisé" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const logoutTime = new Date();

    const session = await getActiveSession(decoded.id);
    if (session) {
      await updateLogoutTime(decoded.id, logoutTime);
      
      await logActivity(
        decoded.id,
        'user_logout',
        'user',
        decoded.id,
        {
          logout_time: logoutTime,
          session_duration: (logoutTime - new Date(session.login_time)) / 1000
        }
      );
    }

    res.status(200).json({ message: "Déconnexion réussie" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

const getUserSessionsController = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Non autorisé" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { dateFrom, dateTo } = req.query;
    
    let query = `SELECT * FROM sessions WHERE user_id = $1`;
    const queryParams = [decoded.id];
    
    if (dateFrom) {
      query += ` AND login_time >= $${queryParams.length + 1}`;
      queryParams.push(dateFrom);
    }
    
    if (dateTo) {
      query += ` AND login_time <= $${queryParams.length + 1}`;
      queryParams.push(dateTo + ' 23:59:59');
    }
    
    query += ` ORDER BY login_time DESC`;
    
    const { rows: sessions } = await pool.query(query, queryParams);
    
    res.json(sessions);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

const assignTasksAutomatically = async (workflowId, tasks) => {
  try {
    const usersStats = await getUserWorkStats();
    const availableUsers = usersStats
      .filter(user => user.role === 'employe' && user.is_active)
      .sort((a, b) => a.total_duration - b.total_duration);

    if (availableUsers.length === 0) {
      throw new Error("Aucun utilisateur disponible pour l'assignation");
    }

    const assignments = [];
    let userIndex = 0;

    for (const task of tasks) {
      if (task.title.toLowerCase().includes('validation')) {
        const director = usersStats.find(u => u.role === 'directeur' && u.is_active);
        if (director) {
          assignments.push({
            taskId: task.id,
            assignedTo: director.id
          });
        }
      } else {
        const user = availableUsers[userIndex % availableUsers.length];
        assignments.push({
          taskId: task.id,
          assignedTo: user.id
        });
        userIndex++;
      }
    }

    for (const assignment of assignments) {
      await pool.query(
        `UPDATE tasks SET assigned_to = $1 WHERE id = $2`,
        [JSON.stringify([assignment.assignedTo]), assignment.taskId]
      );
    }

    return assignments;
  } catch (err) {
    console.error("Erreur dans l'assignation automatique:", err);
    throw err;
  }
};

module.exports = {
  getUsersController,
  login,
  register,
  updateUserController,
  deleteUserController,
  logout,
  getUserSessionsController,
  assignTasksAutomatically,
  toggleUserStatus
};