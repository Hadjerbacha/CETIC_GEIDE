import React, { useState, useEffect } from 'react';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import Navbar from './Navbar';
import Select from 'react-select';
import 'react-toastify/dist/ReactToastify.css';
import { jwtDecode } from 'jwt-decode';
import { toast } from 'react-toastify';
import { Card, Button, Form, Container, Row, Col, ListGroup, Badge, Spinner, Tab, Tabs } from 'react-bootstrap';

const MessageriePage = () => {
  const token = localStorage.getItem('token');
  const [messages, setMessages] = useState({ received: [], sent: [] });
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [messageContent, setMessageContent] = useState('');
  const [activeTab, setActiveTab] = useState('inbox');
  const [userId, setUserId] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const [loading, setLoading] = useState({
    messages: false,
    users: false,
    groups: false,
    sending: false
  });

  // Décoder le token pour obtenir l'ID utilisateur
  useEffect(() => {
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUserId(decoded.id);
      } catch (e) {
        console.error('Token invalide:', e);
        toast.error("Session invalide, veuillez vous reconnecter");
      }
    }
  }, [token]);

  // Charger les données initiales
  useEffect(() => {
    if (userId) {
      fetchAllData();
    }
  }, [userId, token]);

  // Récupérer les notifications non lues
  useEffect(() => {
    if (userId) {
      axios.get(`http://localhost:5000/api/notifications/${userId}`)
        .then(res => {
          const count = res.data.filter(n => !n.is_read).length;
          setUnreadCount(count);
        })
        .catch(err => console.error("Erreur notifications :", err));
    }
  }, [userId]);

  const fetchAllData = async () => {
    try {
      setLoading(prev => ({ ...prev, messages: true, users: true, groups: true }));
      await Promise.all([fetchMessages(), fetchUsers(), fetchGroups()]);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(prev => ({ ...prev, messages: false, users: false, groups: false }));
    }
  };

  const fetchMessages = async () => {
    try {
      setLoading(prev => ({...prev, messages: true}));
      const res = await axios.get('http://localhost:5000/api/messages', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages({
        received: res.data.received || [],
        sent: res.data.sent || []
      });
    } catch (err) {
      console.error("Erreur:", err);
      toast.error("Erreur lors du chargement des messages");
    } finally {
      setLoading(prev => ({...prev, messages: false}));
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(prev => ({...prev, users: true}));
      const res = await axios.get('http://localhost:5000/api/auth/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(res.data.users || []);
    } catch (err) {
      console.error("Erreur lors du fetch des utilisateurs :", err);
      toast.error("Erreur lors du chargement des utilisateurs");
    } finally {
      setLoading(prev => ({...prev, users: false}));
    }
  };

  const fetchGroups = async () => {
    try {
      setLoading(prev => ({...prev, groups: true}));
      const res = await axios.get('http://localhost:5000/api/groups', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setGroups(res.data.groups || []);
    } catch (err) {
      console.error("Erreur lors du fetch des groupes :", err);
      toast.error("Erreur lors du chargement des groupes");
    } finally {
      setLoading(prev => ({...prev, groups: false}));
    }
  };

  const handleSendMessage = async () => {
    if (!messageContent || !selectedRecipient) {
      toast.warning("Veuillez sélectionner un destinataire et écrire un message");
      return;
    }

    setLoading(prev => ({ ...prev, sending: true }));
    const body = {
      content: messageContent,
      sender_id: userId,
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
    ? groups.map(g => ({
        label: g.name,
        value: g.id,
        type: 'group'
      }))
    : users.filter(u => u.id !== userId).map(u => ({
        label: `${u.prenom} ${u.name} (${u.role})`,
        value: u.id,
        type: 'user'
      }));

  const currentMessages = activeTab === 'sent' 
    ? messages.sent 
    : messages.received;

  const markAsRead = async (messageId) => {
    try {
      await axios.put(`http://localhost:5000/api/messages/${messageId}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchMessages();
    } catch (err) {
      console.error("Erreur marquage comme lu:", err);
    }
  };

  return (
    <>
      <Navbar unreadCount={unreadCount} />
      <Container fluid className="messagerie-container py-4">
        <Row>
          <Col md={12}>
            <h2 className="mb-4 border-bottom pb-2 d-flex align-items-center">
              <i className="bi bi-chat-left-text me-2"></i>
              Messagerie
            </h2>
          </Col>
        </Row>

        <Row>
          <Col md={3} className="pe-0">
            <Card className="h-100">
              <Card.Body className="d-flex flex-column p-0">
                <Tabs
                  activeKey={activeTab}
                  onSelect={(k) => setActiveTab(k)}
                  className="mb-3 px-3 pt-3"
                  fill
                >
                  <Tab eventKey="inbox" title={
                    <span>
                      Boîte de réception
                      {unreadCount > 0 && (
                        <Badge pill bg="danger" className="ms-2">
                          {unreadCount}
                        </Badge>
                      )}
                    </span>
                  } />
                  <Tab eventKey="sent" title="Messages envoyés" />
                </Tabs>

                <div className="p-3 border-top">
                  <Form.Check
                    type="switch"
                    id="group-mode-switch"
                    label="Envoyer à un groupe"
                    checked={isGroupMode}
                    onChange={() => {
                      setIsGroupMode(!isGroupMode);
                      setSelectedRecipient(null);
                    }}
                    className="mb-3"
                  />
                  
                  {loading.users || loading.groups ? (
                    <div className="text-center py-2">
                      <Spinner animation="border" size="sm" />
                    </div>
                  ) : (
                    <Select
                      placeholder={isGroupMode ? "Choisir un groupe..." : "Choisir un contact..."}
                      options={recipientOptions}
                      value={selectedRecipient}
                      onChange={setSelectedRecipient}
                      className="basic-multi-select"
                      classNamePrefix="select"
                      isClearable
                      noOptionsMessage={() => "Aucune option disponible"}
                      isLoading={loading.users || loading.groups}
                    />
                  )}
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col md={9}>
            <Card className="h-100">
              <Card.Body className="d-flex flex-column p-0">
                <div className="message-list flex-grow-1 overflow-auto p-3" style={{ maxHeight: '60vh' }}>
                  {loading.messages ? (
                    <div className="text-center py-5">
                      <Spinner animation="border" />
                      <p className="mt-2">Chargement des messages...</p>
                    </div>
                  ) : currentMessages.length === 0 ? (
                    <div className="text-center text-muted py-5">
                      <h5>Aucun message</h5>
                      <p>{activeTab === 'inbox' ? "Vous n'avez reçu aucun message" : "Vous n'avez envoyé aucun message"}</p>
                    </div>
                  ) : (
                    <ListGroup variant="flush">
                      {currentMessages.map((msg) => (
                        <ListGroup.Item 
                          key={msg.id} 
                          className={`message-item ${!msg.is_read && activeTab === 'inbox' ? 'unread' : ''}`}
                          onClick={() => !msg.is_read && markAsRead(msg.id)}
                        >
                          <div className="d-flex justify-content-between align-items-start">
                            <div className="flex-grow-1">
                              <strong className="d-block">
                                {activeTab === 'sent'
                                  ? `À: ${msg.recipient_prenom || ''} ${msg.recipient_name || ''} ${msg.group_name ? `(${msg.group_name})` : ''}`
                                  : `De: ${msg.sender_prenom} ${msg.sender_name}`}
                              </strong>
                              <div className="message-content mt-2">{msg.content}</div>
                            </div>
                            <div className="text-end ms-2">
                              <small className="text-muted d-block">
                                {new Date(msg.sent_at).toLocaleString()}
                              </small>
                              {msg.group_id && (
                                <Badge bg="info" className="mt-1">Groupe</Badge>
                              )}
                              {!msg.is_read && activeTab === 'inbox' && (
                                <Badge bg="success" className="ms-1">Nouveau</Badge>
                              )}
                            </div>
                          </div>
                        </ListGroup.Item>
                      ))}
                    </ListGroup>
                  )}
                </div>

                <div className="message-composer border-top p-3">
                  <Form.Group>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={messageContent}
                      onChange={(e) => setMessageContent(e.target.value)}
                      placeholder={`Écrire un message ${isGroupMode ? 'au groupe' : ''}...`}
                      className="mb-3"
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
                        ) : (
                          <>
                            <i className="bi bi-send me-2"></i>
                            Envoyer
                          </>
                        )}
                      </Button>
                    </div>
                  </Form.Group>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>

      <style>{`
        .message-item.unread {
          background-color: #f8f9fa;
          border-left: 3px solid #0d6efd;
        }
        .message-item:hover {
          background-color: #f1f1f1;
          cursor: pointer;
        }
        .message-content {
          white-space: pre-wrap;
        }
      `}</style>
    </>
  );
};

export default MessageriePage;