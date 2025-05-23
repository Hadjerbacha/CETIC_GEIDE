const express = require('express');
const router = express.Router();
const { ChatController } = require('./chatbot');

// Routes pour le chat
router.post('/conversations', ChatController.startConversation);
router.post('/messages', ChatController.sendMessage);
router.get('/users/:userId/conversations', ChatController.getConversations);
router.get('/conversations/:conversationId/messages', ChatController.getMessages);
router.get('/users/search', ChatController.searchUsers);

module.exports = router;