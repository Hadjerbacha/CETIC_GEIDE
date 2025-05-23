import React, { useState, useEffect, useRef } from 'react';
import { Button, Modal, Form, InputGroup, Spinner, ListGroup, Badge } from 'react-bootstrap';
import axios from 'axios';
import { FaPaperPlane, FaRobot, FaUser, FaTimes, FaComment } from 'react-icons/fa';
import '../style/chatbot.css';
import { jwtDecode } from 'jwt-decode';

const Chatbot = () => {
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const messagesEndRef = useRef(null);
 const tempId = Date.now();
  // Récupérer le token et décoder l'ID utilisateur au montage
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setCurrentUserId(decoded.id);
      } catch (error) {
        console.error('Error decoding token:', error);
      }
    }
  }, []);

  // Configuration Axios avec le token
  const getAxiosConfig = () => {
    const token = localStorage.getItem('token');
    return {
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
  };

  // Charger les conversations quand l'utilisateur ou l'état du chat change
  useEffect(() => {
    if (currentUserId && showChat) {
      loadConversations();
    }
  }, [currentUserId, showChat]);

  // Faire défiler vers le bas à chaque nouveau message
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    if (!currentUserId) return;
    
    setLoading(true);
    try {
      const response = await axios.get(
        `http://localhost:5000/api/chat/users/${currentUserId}/conversations`,
        getAxiosConfig()
      );
      setConversations(response.data);
      if (response.data.length > 0 && !activeConversation) {
        setActiveConversation(response.data[0].id);
        loadMessages(response.data[0].id);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId) => {
    setLoading(true);
    try {
      const response = await axios.get(
        `http://localhost:5000/api/chat/conversations/${conversationId}/messages`,
        getAxiosConfig()
      );
      setMessages(response.data);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !activeConversation || !currentUserId) return;

    const messageToSend = {
      conversation_id: activeConversation,
      sender_id: currentUserId,
      content: newMessage
    };

    try {
      // Optimistic update
      const tempId = Date.now();
      setMessages(prev => [...prev, {
        id: tempId,
        sender_id: currentUserId,
        content: newMessage,
        sent_at: new Date().toISOString(),
        sender_name: 'Vous',
        sender_prenom: ''
      }]);
      setNewMessage('');

      // Envoi réel
      const response = await axios.post(
        'http://localhost:5000/api/chat/messages',
        messageToSend,
        getAxiosConfig()
      );
      
      // Remplacement du message temporaire
      setMessages(prev => prev.map(msg => msg.id === tempId ? response.data : msg));
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
    }
  };

  const handleSearchUsers = async () => {
    if (!searchTerm.trim() || !currentUserId) {
      console.error("Search term and user ID are required");
      return;
    }
    
    try {
      const response = await axios.get(
        `http://localhost:5000/api/chat/users/search`,
        {
          ...getAxiosConfig(),
          params: {
            searchTerm: searchTerm,
            excludeUserId: currentUserId
          }
        }
      );
      setSearchResults(response.data);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const handleStartNewConversation = async (userId) => {
    if (!currentUserId) return;
    
    try {
      const response = await axios.post(
        'http://localhost:5000/api/chat/conversations',
        {
          participants: [currentUserId, userId]
        },
        getAxiosConfig()
      );
      setConversations(prev => [response.data, ...prev]);
      setActiveConversation(response.data.id);
      setMessages([]);
      setSearchResults([]);
      setSearchTerm('');
    } catch (error) {
      console.error('Error starting conversation:', error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Styles pour le chatbot
  const chatButtonStyle = {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    borderRadius: '50%',
    width: '60px',
    height: '60px',
    fontSize: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
    zIndex: 1000,
    animation: 'pulse 2s infinite'
  };

  const modalStyle = {
    position: 'fixed',
    bottom: '80px',
    right: '20px',
    width: '350px',
    maxWidth: '90%',
    height: '500px',
    margin: 0,
    transform: 'none',
    left: 'auto',
    top: 'auto'
  };

  return (
    <>
      <Button 
        variant="primary" 
        style={chatButtonStyle}
        onClick={() => setShowChat(!showChat)}
      >
        {showChat ? <FaTimes /> : <FaComment />}
      </Button>

      <Modal 
        show={showChat} 
        onHide={() => setShowChat(false)}
        dialogClassName="chatbot-modal"
        style={modalStyle}
        backdrop={false}
      >
        <Modal.Header closeButton className="bg-primary text-white">
          <Modal.Title>Messagerie</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0 d-flex flex-column">
          {/* Liste des conversations */}
          <div className="border-bottom p-2">
            <InputGroup>
              <Form.Control
                placeholder="Rechercher un collègue..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearchUsers()}
              />
              <Button variant="outline-secondary" onClick={handleSearchUsers}>
                Rechercher
              </Button>
            </InputGroup>
          </div>

          {searchResults.length > 0 && (
            <div className="border-bottom p-2">
              <h6>Résultats de recherche :</h6>
              <ListGroup>
                {searchResults.map(user => (
                  <ListGroup.Item 
                    key={user.id} 
                    action 
                    onClick={() => handleStartNewConversation(user.id)}
                  >
                    {user.prenom} {user.name} ({user.role})
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </div>
          )}

          {/* Liste des conversations existantes */}
          <div className="border-bottom p-2" style={{ maxHeight: '150px', overflowY: 'auto' }}>
            <h6>Conversations :</h6>
            {loading && conversations.length === 0 ? (
              <Spinner animation="border" size="sm" />
            ) : (
              <ListGroup>
                {conversations.map(conv => (
                  <ListGroup.Item 
                    key={conv.id} 
                    action 
                    active={activeConversation === conv.id}
                    onClick={() => {
                      setActiveConversation(conv.id);
                      loadMessages(conv.id);
                    }}
                  >
                    {conv.participants.filter(p => p.id !== currentUserId).map(p => (
                      <span key={p.id}>{p.prenom} {p.name}</span>
                    ))}
                    <Badge bg="secondary" className="ms-2">
                      {conv.unread_count || ''}
                    </Badge>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}
          </div>

          {/* Messages de la conversation */}
          <div className="flex-grow-1 p-3" style={{ overflowY: 'auto', height: '200px' }}>
            {loading && messages.length === 0 ? (
              <div className="text-center mt-3">
                <Spinner animation="border" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-muted text-center mt-3">
                Aucun message dans cette conversation
              </div>
            ) : (
              messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`mb-3 d-flex ${msg.sender_id === currentUserId ? 'justify-content-end' : 'justify-content-start'}`}
                >
                  <div 
                    className={`p-2 rounded max-w-75 ${msg.sender_id === currentUserId ? 'bg-primary text-white' : 'bg-light'}`}
                  >
                    <div className="d-flex align-items-center mb-1">
                      {msg.sender_id === currentUserId ? (
                        <FaUser className="me-2" />
                      ) : (
                        <FaRobot className="me-2" />
                      )}
                      <strong>
                        {msg.sender_id === currentUserId ? 'Vous' : `${msg.sender_prenom} ${msg.sender_name}`}
                      </strong>
                      <small className="text-muted ms-2">
                        {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </small>
                    </div>
                    <div>{msg.content}</div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Zone d'envoi de message */}
          <div className="border-top p-2">
            <InputGroup>
              <Form.Control
                as="textarea"
                rows={2}
                placeholder="Tapez votre message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <Button 
                variant="primary" 
                onClick={handleSendMessage}
                disabled={!newMessage.trim()}
              >
                <FaPaperPlane />
              </Button>
            </InputGroup>
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
};

export default Chatbot;