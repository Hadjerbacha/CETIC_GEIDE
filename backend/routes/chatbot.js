// chatbot.js
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

// Configuration de la base de données
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'ged',
  password: 'hadjer',
  port: 5432,
});

// Modèle pour gérer les conversations et messages
const ChatModel = {
  // Créer une nouvelle conversation entre utilisateurs
 // Modifiez la fonction sendMessage dans le modèle
sendMessage: async (conversationId, senderId, content) => {
  try {
    const result = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, content, sent_at) 
       VALUES ($1, $2, $3, NOW()) RETURNING *`,
      [conversationId, senderId, content]
    );
    return result.rows[0];
  } catch (err) {
    console.error('Erreur envoi message:', err);
    throw err;
  }
},

// Modifiez la fonction createConversation
createConversation: async (participants) => {
  try {
    const result = await pool.query(
      `INSERT INTO conversations (participants, created_at) 
       VALUES ($1::integer[], NOW()) RETURNING *`,
      [participants.map(id => parseInt(id))]
    );
    return result.rows[0];
  } catch (err) {
    console.error('Erreur création conversation:', err);
    throw err;
  }
},

// Modifiez getUserConversations
getUserConversations: async (userId) => {
  try {
    const numericUserId = parseInt(userId);
    const result = await pool.query(
      `SELECT c.id, c.participants, c.created_at, 
              u.name as participant_name, u.prenom as participant_prenom
       FROM conversations c
       JOIN users u ON u.id = ANY(c.participants)
       WHERE $1 = ANY(c.participants) AND u.id != $1`,
      [numericUserId]
    );
    return result.rows;
  } catch (err) {
    console.error('Erreur récupération conversations:', err);
    throw err;
  }
},

  // Récupérer les messages d'une conversation
  getConversationMessages: async (conversationId) => {
    try {
      const result = await pool.query(
        `SELECT m.id, m.sender_id, m.content, m.sent_at, 
                u.name as sender_name, u.prenom as sender_prenom
         FROM messages m
         JOIN users u ON m.sender_id = u.id
         WHERE m.conversation_id = $1
         ORDER BY m.sent_at ASC`,
        [conversationId]
      );
      return result.rows;
    } catch (err) {
      console.error('Erreur récupération messages:', err);
      throw err;
    }
  },

  // Rechercher des utilisateurs pour démarrer une nouvelle conversation
  searchUsers: async (searchTerm, excludeUserId) => {
    try {
      const result = await pool.query(
        `SELECT id, name, prenom, email, role 
         FROM users 
         WHERE (name ILIKE $1 OR prenom ILIKE $1 OR email ILIKE $1)
         AND id != $2
         LIMIT 10`,
        [`%${searchTerm}%`, excludeUserId]
      );
      return result.rows;
    } catch (err) {
      console.error('Erreur recherche utilisateurs:', err);
      throw err;
    }
  }
};

// Contrôleur pour gérer les opérations du chatbot
const ChatController = {
  // Démarrer une nouvelle conversation
  startConversation: async (req, res) => {
    try {
      const { participants } = req.body;
      if (!participants || participants.length < 2) {
        return res.status(400).json({ error: 'Au moins 2 participants requis' });
      }

      const conversation = await ChatModel.createConversation(participants);
      res.status(201).json(conversation);
    } catch (err) {
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // Envoyer un message
  sendMessage: async (req, res) => {
    try {
      const { conversationId, senderId, content } = req.body;
      if (!conversationId || !senderId || !content) {
        return res.status(400).json({ error: 'Données manquantes' });
      }

      const message = await ChatModel.sendMessage(conversationId, senderId, content);
      res.status(201).json(message);
    } catch (err) {
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // Récupérer les conversations d'un utilisateur
  getConversations: async (req, res) => {
    try {
      const { userId } = req.params;
      const conversations = await ChatModel.getUserConversations(userId);
      res.json(conversations);
    } catch (err) {
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // Récupérer les messages d'une conversation
  getMessages: async (req, res) => {
    try {
      const { conversationId } = req.params;
      const messages = await ChatModel.getConversationMessages(conversationId);
      res.json(messages);
    } catch (err) {
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // Rechercher des utilisateurs
  searchUsers: async (req, res) => {
    try {
      const { searchTerm, excludeUserId } = req.query;
      if (!searchTerm || !excludeUserId) {
        return res.status(400).json({ error: 'Paramètres manquants' });
      }

      const users = await ChatModel.searchUsers(searchTerm, excludeUserId);
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
};

module.exports = {
  ChatController,
  ChatModel
};