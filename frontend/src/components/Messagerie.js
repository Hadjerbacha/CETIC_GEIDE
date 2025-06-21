import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import Navbar from './Navbar';
import Select from 'react-select';
import 'react-toastify/dist/ReactToastify.css';
import { jwtDecode } from 'jwt-decode';
import { toast } from 'react-toastify';
import { 
  Card, 
  Button, 
  Form, 
  Container, 
  Row, 
  Col, 
  ListGroup, 
  Badge, 
  Spinner,
  Tab,
  Tabs
} from 'react-bootstrap';

const API_BASE_URL = 'http://localhost:5000/api';

const MessageriePage = () => {
  const token = localStorage.getItem('token');
  
  const GROUPS_API = 'http://localhost:5000/api/groups';
  const [selectedGroup, setSelectedGroup] = useState(null); // Groupe sélectionné
  const [allGroups, setAllGroups] = useState([]);
  const [messages, setMessages] = useState({ received: [], sent: [] });
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [messageContent, setMessageContent] = useState('');
  const [activeTab, setActiveTab] = useState('inbox');
  const [userId, setUserId] = useState(null);
  
  const [loading, setLoading] = useState({
    messages: false,
    users: false,
    groups: false,
    sending: false
  });

  const fetchGroups = async () => {
      try {
        const res = await axios.get(GROUPS_API);
        setAllGroups(res.data); // Remplir la liste des groupes
      } catch (err) {
        console.error('Erreur récupération groupes:', err);
      }
    };
  // Décodage du token pour obtenir l'ID utilisateur
  useEffect(() => {
    if (token) {
      try {
        const { id } = jwtDecode(token);
        setUserId(id);
      } catch (e) {
        console.error('Token invalide:', e);
        toast.error('Session invalide, veuillez vous reconnecter');
      }
    }
  }, [token]);

    useEffect(() => {
      fetchUsers();
      fetchGroups();
    }, [token]);

  // Options pour les destinataires (groupes ou utilisateurs)
  const recipientOptions = useCallback(() => {
    return isGroupMode
      ? groups.map(g => ({ label: g.name, value: g.id, type: 'group' }))
      : users.map(u => ({ 
          label: `${u.prenom} ${u.name} (${u.role})`, 
          value: u.id, 
          type: 'user' 
        }));
  }, [isGroupMode, groups, users]);

  // Messages filtrés selon l'onglet actif
  const currentMessages = useCallback(() => {
    return activeTab === 'sent' ? messages.sent : messages.received;
  }, [activeTab, messages]);

  // Récupération des données initiales
  const fetchAllData = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, messages: true, users: true, groups: true }));
      await Promise.all([fetchMessages(), fetchUsers(), fetchGroups()]);
    } catch (error) {
      console.error("Erreur lors du chargement des données:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(prev => ({ ...prev, messages: false, users: false, groups: false }));
    }
  }, [token]);

  // Récupération des messages
  const fetchMessages = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages({
        received: res.data.received || [],
        sent: res.data.sent || []
      });
    } catch (err) {
      console.error("Erreur lors de la récupération des messages:", err);
      toast.error("Erreur lors du chargement des messages");
    }
  }, [token]);

  // Récupération des utilisateurs
  const fetchUsers = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/auth/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(Array.isArray(res.data) ? res.data : res.data.users || []);
    } catch (err) {
      console.error("Erreur lors de la récupération des utilisateurs:", err);
    }
  }, [token]);


  // Envoi d'un nouveau message
  const handleSendMessage = async () => {
    if (!messageContent || !selectedRecipient) {
      toast.warning('Veuillez sélectionner un destinataire et écrire un message');
      return;
    }

    setLoading(prev => ({ ...prev, sending: true }));
    
    const messageData = {
      content: messageContent,
      sender_id: userId,
      ...(isGroupMode
        ? { group_id: selectedRecipient.value }
        : { recipient_id: selectedRecipient.value }),
    };

    try {
      await axios.post(`${API_BASE_URL}/messages`, messageData, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      setMessageContent('');
      await fetchMessages();
      toast.success("Message envoyé avec succès!");
    } catch (err) {
      console.error("Erreur lors de l'envoi du message:", err);
      toast.error(err.response?.data?.message || "Erreur lors de l'envoi du message");
    } finally {
      setLoading(prev => ({ ...prev, sending: false }));
    }
  };

  // Effet pour charger les données au montage
  useEffect(() => {
    if (token) {
      fetchAllData();
    }
  }, [token, fetchAllData]);

  return (
    <>
      <Navbar />
      <Container fluid className="messagerie-container py-4">
        <Row className="mb-4">
          <Col>
            <h2 className="text-primary">Messagerie</h2>
            <p className="text-muted">
              {activeTab === 'inbox' 
                ? 'Consultez vos messages reçus' 
                : 'Consultez vos messages envoyés'}
            </p>
          </Col>
        </Row>

        <Row className="g-0">
          {/* Sidebar */}
          <Col md={3} className="pe-3">
            <Card className="h-100 shadow-sm">
              <Card.Body className="d-flex flex-column">
                {/* Onglets de navigation */}
                <Tabs
                  activeKey={activeTab}
                  onSelect={(k) => setActiveTab(k)}
                  className="mb-3"
                  fill
                >
                  <Tab eventKey="inbox" title="Reçus" />
                  <Tab eventKey="sent" title="Envoyés" />
                </Tabs>

                {/* Sélection du destinataire */}
                <div className="mb-3">
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
                              value={
                                selectedGroup
                                  ? {
                                    value: selectedGroup,
                                    label: allGroups.find(group => group.id === selectedGroup)?.nom,
                                  }
                                  : null
                              }
                              options={allGroups.map(group => ({
                                value: group.id,
                                label: group.nom,
                              }))}
                              onChange={(selectedOption) => {
                                setSelectedGroup(selectedOption ? selectedOption.value : null);
                              }}
                              placeholder="Sélectionner un groupe..."
                              classNamePrefix="select"
                            />
                  )}
                </div>
              </Card.Body>
            </Card>
          </Col>

          {/* Zone principale */}
          <Col md={9}>
            <Card className="h-100 shadow-sm">
              {/* Liste des messages */}
              <Card.Body className="overflow-auto" style={{ maxHeight: '60vh' }}>
                {loading.messages ? (
                  <div className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-2 text-muted">Chargement des messages...</p>
                  </div>
                ) : currentMessages().length === 0 ? (
                  <div className="text-center text-muted py-5">
                    <i className="bi bi-envelope-open fs-1"></i>
                    <h5 className="mt-3">Aucun message</h5>
                    <p>
                      {activeTab === 'inbox' 
                        ? "Vous n'avez reçu aucun message" 
                        : "Vous n'avez envoyé aucun message"}
                    </p>
                  </div>
                ) : (
                  <ListGroup variant="flush">
                    {currentMessages().map((msg) => (
                      <ListGroup.Item 
                        key={msg.id}
                        className={`py-3 ${!msg.is_read && activeTab === 'inbox' ? 'bg-light' : ''}`}
                      >
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div>
                            <strong className="d-block">
                              {activeTab === 'sent'
                                ? `À: ${msg.recipient_prenom} ${msg.recipient_name}`
                                : `De: ${msg.sender_prenom} ${msg.sender_name}`}
                            </strong>
                            {msg.group_id && (
                              <Badge bg="info" className="me-2">Groupe</Badge>
                            )}
                          </div>
                          <small className="text-muted">
                            {new Date(msg.sent_at).toLocaleString()}
                          </small>
                        </div>
                        <div className="message-content ps-2 border-start border-primary">
                          {msg.content}
                        </div>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                )}
              </Card.Body>

              {/* Zone de composition */}
              <Card.Footer className="bg-white border-top">
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
                      className="px-4"
                    >
                      {loading.sending ? (
                        <>
                          <Spinner animation="border" size="sm" className="me-2" />
                          Envoi en cours...
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
              </Card.Footer>
            </Card>
          </Col>
        </Row>
      </Container>
    </>
  );
};

export default MessageriePage;