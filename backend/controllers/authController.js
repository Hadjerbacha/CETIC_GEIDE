const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { getUsers, findUserByEmail, createUser, updateUser, deleteUser, createSession, getUserSessions, getActiveSession, updateLogoutTime, getUserWorkStats} = require("../models/userModel");
require("dotenv").config();
const pool = require("../config/db"); // Ajoutez cette ligne en haut du fichier
const { logActivity } = require('../routes/historique');
// Fonction pour récupérer tous les utilisateurs
// Exemple de contrôleur pour récupérer des utilisateurs
const getUsersController = async (req, res) => {
  try {
    const users = await getUsers(); // Suppose que tu appelles une fonction pour obtenir les utilisateurs
    res.json(users); // Renvoie les utilisateurs en JSON
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server Error' }); // Si erreur, renvoie une réponse d'erreur
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await findUserByEmail(email);
    if (!user)
      return res.status(400).json({ message: "Email ou mot de passe invalide" });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword)
      return res.status(400).json({ message: "Email ou mot de passe invalide" });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: "300d",
    });
     // Enregistrer la session
    const loginTime = new Date();
    await createSession(user.id, loginTime, null, null);
// Log de la connexion
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
    });
// Log de la création d'utilisateur
    await logActivity(
      req.user?.id || 'system', // Si création par un admin ou système
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

// Mettre à jour un utilisateur
const updateUserController = async (req, res) => {
  const { id } = req.params;
  const { name, prenom, email, role } = req.body;

  try {
    const updated = await updateUser(id, { name, prenom, email, role });
    // Log de la modification
    await logActivity(
      req.user.id, // L'admin qui fait la modification
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

// Supprimer un utilisateur
const deleteUserController = async (req, res) => {
  const { id } = req.params;

  try {
    const deleted = await deleteUser(id);
    if (!deleted) return res.status(404).json({ message: "Utilisateur introuvable" });
    // Log de la suppression
    await logActivity(
      req.user.id, // L'admin qui fait la suppression
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
    res.status(200).json({ message: "Utilisateur supprimé", user: deleted });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// Dans authController.js
const logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Non autorisé" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const logoutTime = new Date();

    // Mettre à jour la session existante
     const session = await getActiveSession(decoded.id);
    if (session) {
      await updateLogoutTime(decoded.id, logoutTime);
      
      // Log de la déconnexion
      await logActivity(
        decoded.id,
        'user_logout',
        'user',
        decoded.id,
        {
          logout_time: logoutTime,
          session_duration: (logoutTime - new Date(session.login_time)) / 1000 // en secondes
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
    
    // Récupérer les paramètres de filtre
    const { dateFrom, dateTo } = req.query;
    
    let query = `
      SELECT * FROM sessions 
      WHERE user_id = $1
    `;
    
    const queryParams = [decoded.id];
    
    // Ajouter les conditions de filtre si elles existent
    if (dateFrom) {
      query += ` AND login_time >= $${queryParams.length + 1}`;
      queryParams.push(dateFrom);
    }
    
    if (dateTo) {
      query += ` AND login_time <= $${queryParams.length + 1}`;
      queryParams.push(dateTo + ' 23:59:59'); // Inclure toute la journée
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
    // 1. Récupérer les stats des utilisateurs
    const usersStats = await getUserWorkStats();
    
    // 2. Filtrer par rôle et trier par durée de travail
    const availableUsers = usersStats
      .filter(user => user.role === 'employe') // Seulement les employés pour les tâches normales
      .sort((a, b) => a.total_duration - b.total_duration); // Moins chargés en premier

    if (availableUsers.length === 0) {
      throw new Error("Aucun utilisateur disponible pour l'assignation");
    }

    // 3. Assigner les tâches
    const assignments = [];
    let userIndex = 0;

    for (const task of tasks) {
      // Pour les tâches de validation, trouver un directeur
      if (task.title.toLowerCase().includes('validation')) {
        const director = usersStats.find(u => u.role === 'directeur');
        if (director) {
          assignments.push({
            taskId: task.id,
            assignedTo: director.id
          });
        }
      } else {
        // Assignation round-robin aux employés
        const user = availableUsers[userIndex % availableUsers.length];
        assignments.push({
          taskId: task.id,
          assignedTo: user.id
        });
        userIndex++;
      }
    }

    // 4. Sauvegarder les assignations
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
  assignTasksAutomatically
};
