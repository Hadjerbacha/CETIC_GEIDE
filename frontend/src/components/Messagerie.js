import React, { useState, useEffect } from 'react';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import Navbar from './Navbar';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import 'react-toastify/dist/ReactToastify.css';
import { jwtDecode } from 'jwt-decode';
import { toast } from 'react-toastify';
import { Card, Button, Form, Container, Row, Col, ListGroup, Badge, Spinner } from 'react-bootstrap';

const MessageriePage = ({ token }) => {
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [messageContent, setMessageContent] = useState('');
  const [activeTab, setActiveTab] = useState('inbox');
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState({
    messages: false,
    users: false,
    groups: false,
    sending: false
  });

  useEffect(() => {
    fetchAllData();
  }, [token]);

  const fetchAllData = async () => {
    try {
      setLoading(prev => ({ ...prev, messages: true, users: true, groups: true }));
      await Promise.all([fetchMessages(), fetchUsers(), fetchGroups()]);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(prev => ({ ...prev, messages: false, users: false, groups: false }));
    }
  };

  const fetchMessages = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/messages', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Erreur lors du fetch des messages :", err);
      toast.error("Erreur lors du chargement des messages");
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/auth/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(Array.isArray(res.data) ? res.data : res.data.users || []);
    } catch (err) {
      console.error("Erreur lors du fetch des utilisateurs :", err);
      toast.error("Erreur lors du chargement des utilisateurs");
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/groups', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setGroups(Array.isArray(res.data) ? res.data : res.data.groups || []);
    } catch (err) {
      console.error("Erreur lors du fetch des groupes :", err);
      toast.error("Erreur lors du chargement des groupes");
    }
  };

  const handleSendMessage = async () => {
    if (!messageContent || !selectedRecipient) return;

    setLoading(prev => ({ ...prev, sending: true }));
    const body = {
        content: messageContent,
        sender_id: currentUserId,
        ...(isGroupMode
          ? { group_id: selectedRecipient.value }
          : { recipient_id: selectedRecipient.value }),
      };
      
    try {
      await axios.post('http://localhost:5000/api/messages', body, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      setMessageContent('');
      await fetchMessages();
      toast.success("Message envoyé avec succès!");
    } catch (err) {
      console.error("Erreur d'envoi :", err);
      toast.error(err.response?.data?.message || "Erreur lors de l'envoi du message");
    } finally {
      setLoading(prev => ({ ...prev, sending: false }));
    }
  };

  const recipientOptions = isGroupMode
    ? groups.map((g) => ({ 
        label: g.name, 
        value: g.id,
        type: 'group' 
      }))
    : users.map((u) => ({ 
        label: `${u.prenom} ${u.name} (${u.role})`, 
        value: u.id,
        type: 'user' 
      }));

  const decodedToken = token ? jwtDecode(token) : null;
  const currentUserId = decodedToken?.userId;

  const filteredMessages = activeTab === 'sent'
    ? messages.filter(msg => msg.sender_id === currentUserId)
    : messages.filter(msg => msg.sender_id !== currentUserId);
    

  return (
    <>
      <Navbar />
      <Container fluid className="messagerie-container">
        <Row>
          <Col md={12}>
            <h2 className="mb-4 border-bottom pb-2">Messagerie</h2>
          </Col>
        </Row>

        <Row>
          <Col md={3} className="pe-0">
            <div className="d-flex flex-column h-100 border-end">
              <div className="p-3 border-bottom">
                <Button 
                  variant={activeTab === 'inbox' ? 'primary' : 'outline-primary'} 
                  className="w-100 mb-2" 
                  onClick={() => setActiveTab('inbox')}
                >
                  Boîte de réception
                </Button>
                <Button 
                  variant={activeTab === 'sent' ? 'primary' : 'outline-primary'} 
                  className="w-100" 
                  onClick={() => setActiveTab('sent')}
                >
                  Messages envoyés
                </Button>
              </div>

              <div className="p-3 border-bottom">
                <Form.Check
                  type="switch"
                  id="group-mode-switch"
                  label="Envoyer à un groupe"
                  checked={isGroupMode}
                  onChange={() => {
                    setIsGroupMode(!isGroupMode);
                    setSelectedRecipient(null);
                  }}
                />
                <div className="mt-2">
                  {loading.users || loading.groups ? (
                    <div className="text-center py-2">
                      <Spinner animation="border" size="sm" />
                    </div>
                  ) : (
                    <Select
                      placeholder={isGroupMode ? "Choisir un groupe" : "Choisir un contact"}
                      options={recipientOptions}
                      value={selectedRecipient}
                      onChange={setSelectedRecipient}
                      className="basic-multi-select"
                      classNamePrefix="select"
                      isClearable
                      noOptionsMessage={() => "Aucune option disponible"}
                    />
                  )}
                </div>
              </div>
            </div>
          </Col>

          <Col md={9}>
            <div className="d-flex flex-column h-100">
              <div className="message-list flex-grow-1 overflow-auto p-3">
                {loading.messages ? (
                  <div className="text-center py-5">
                    <Spinner animation="border" />
                    <p className="mt-2">Chargement des messages...</p>
                  </div>
                ) : filteredMessages.length === 0 ? (
                  <div className="text-center text-muted py-5">
                    <h5>Aucun message</h5>
                    <p>{activeTab === 'inbox' ? "Vous n'avez reçu aucun message" : "Vous n'avez envoyé aucun message"}</p>
                  </div>
                ) : (
                  <ListGroup variant="flush">
                    {filteredMessages.map((msg, index) => {
                      const sender = users.find(u => u.id === msg.sender_id);
                      const group = msg.group_id ? groups.find(g => g.id === msg.group_id) : null;
                      
                      return (
                        <ListGroup.Item 
                          key={index} 
                          className={`message-item ${msg.sender_id === currentUserId ? 'sent' : 'received'}`}
                        >
                          <div className="d-flex justify-content-between align-items-start mb-1">
                            <strong>
                              {msg.sender_id === currentUserId ? 
                                'Moi' : 
                                (sender ? `${sender.prenom} ${sender.name}` : `Utilisateur ${msg.sender_id}`)}
                            </strong>
                            <small className="text-muted">
                              {new Date(msg.sent_at).toLocaleString()}
                            </small>
                          </div>
                          <div className="message-content">
                            {msg.content}
                          </div>
                          {group && (
                            <Badge bg="secondary" className="mt-1">
                              Groupe: {group.name}
                            </Badge>
                          )}
                        </ListGroup.Item>
                      );
                    })}
                  </ListGroup>
                )}
              </div>

              <div className="message-composer border-top p-3">
                <Form.Group className="mb-3">
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    placeholder={`Écrire un message ${isGroupMode ? 'au groupe' : ''}...`}
                    className="mb-2"
                    disabled={!selectedRecipient}
                  />
                  <div className="d-flex justify-content-end">
                    <Button 
                      variant="primary" 
                      onClick={handleSendMessage}
                      disabled={!messageContent || !selectedRecipient || loading.sending}
                    >
                      {loading.sending ? (
                        <>
                          <Spinner animation="border" size="sm" className="me-2" />
                          Envoi...
                        </>
                      ) : 'Envoyer'}
                    </Button>
                  </div>
                </Form.Group>
              </div>
            </div>
          </Col>
        </Row>
      </Container>
    </>
  );
};

export default MessageriePage;