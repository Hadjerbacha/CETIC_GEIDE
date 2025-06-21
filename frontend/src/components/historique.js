// src/pages/ActivityLog.js
import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Table, 
  Card, 
  Form, 
  Spinner, 
  Alert, 
  Badge,
  Button,
  Row,
  Col,
  Dropdown
} from 'react-bootstrap';
import axios from 'axios';
import Navbar from './Navbar';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import { jwtDecode } from 'jwt-decode';
import { 
  FiLogIn, 
  FiLogOut,
  FiUserPlus,
  FiUserMinus,
  FiEdit,
  FiFileText,
  FiUpload,
  FiDownload,
  FiTrash2,
  FiEdit2
} from 'react-icons/fi';
import '../style/activity.css';

const ACTION_ICONS = {
  login: <FiLogIn size={18} className="text-primary" />,
  logout: <FiLogOut size={18} className="text-secondary" />,
  user_login: <FiLogIn size={18} className="text-primary" />,
  user_logout: <FiLogOut size={18} className="text-secondary" />,
  user_create: <FiUserPlus size={18} className="text-success" />,
  user_update: <FiEdit size={18} className="text-warning" />,
  user_delete: <FiUserMinus size={18} className="text-danger" />,
  upload: <FiUpload size={18} className="text-info" />,
  download: <FiDownload size={18} className="text-primary" />,
  delete: <FiTrash2 size={18} className="text-danger" />,
  update: <FiEdit2 size={18} className="text-warning" />,
  create_workflow: <FiFileText size={18} className="text-success" />,
  default: <FiFileText size={18} className="text-info" />
};

const ACTION_LABELS = {
  login: 'Connexion',
  logout: 'Déconnexion',
  user_login: 'Connexion',
  user_logout: 'Déconnexion',
  user_create: 'Création utilisateur',
  user_update: 'Modification utilisateur',
  user_delete: 'Suppression utilisateur',
  upload: 'Ajout document',
  download: 'Téléchargement document',
  delete: 'Suppression document',
  update: 'Modification document',
  create_workflow: 'Création workflow',
  default: 'Action système'
};

const ActivityLog = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    actionType: '',
    viewType: 'all' // 'all', 'sessions', 'activities'
  });
  const [expandedRows, setExpandedRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const decoded = jwtDecode(token);
      setCurrentUser(decoded);
    }
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Paramètres pour les requêtes
      const params = {};
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      if (filters.actionType) params.actionType = filters.actionType;
      if (selectedUser) params.userId = selectedUser;

      // Charger les utilisateurs (pour le filtre admin)
      if (currentUser?.role === 'admin') {
        const usersRes = await axios.get('http://localhost:5000/api/auth/users', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setUsers(usersRes.data);
      }

      // Charger toutes les activités
      const activitiesRes = await axios.get('http://localhost:5000/api/activity-logs', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params
      });
      setActivities(activitiesRes.data);

    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors du chargement des données');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) fetchAllData();
  }, [currentUser, filters, selectedUser]);

  const handleResetFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      actionType: '',
      viewType: 'all'
    });
    setSelectedUser(null);
  };

  const toggleRowExpand = (id) => {
    if (expandedRows.includes(id)) {
      setExpandedRows(expandedRows.filter(rowId => rowId !== id));
    } else {
      setExpandedRows([...expandedRows, id]);
    }
  };

  const renderActionIcon = (actionType) => {
    return ACTION_ICONS[actionType] || ACTION_ICONS.default;
  };

  const renderActionBadge = (actionType) => {
    return (
      <Badge bg={getBadgeVariant(actionType)} className="text-capitalize">
        {ACTION_LABELS[actionType] || ACTION_LABELS.default}
      </Badge>
    );
  };

  const getBadgeVariant = (actionType) => {
    switch(actionType) {
      case 'login':
      case 'user_login': 
        return 'primary';
      case 'logout':
      case 'user_logout': 
        return 'secondary';
      case 'user_create': 
        return 'success';
      case 'user_update': 
      case 'update':
        return 'warning';
      case 'user_delete': 
      case 'delete':
        return 'danger';
      case 'upload':
      case 'download':
        return 'info';
      case 'create_workflow':
        return 'success';
      default: 
        return 'info';
    }
  };

  const formatDateSafe = (dateString) => {
    try {
      return dateString ? format(new Date(dateString), 'PPpp', { locale: fr }) : 'N/A';
    } catch {
      return 'Date invalide';
    }
  };

  const renderDetails = (activity) => {
    return (
      <div className="p-3">
        <h6>Détails de l'activité :</h6>
        <div className="details-container">
          <div className="detail-item">
            <strong>Type:</strong> {activity.entity_type}
          </div>
          <div className="detail-item">
            <strong>Détails:</strong> 
            <pre className="mt-2 p-2 bg-light rounded">
              {JSON.stringify(activity.details, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    );
  };

  // Filtrer les données selon les critères
  const filteredData = activities
    .filter(item => {
      // Filtre par type d'action
      if (filters.actionType && item.action_type !== filters.actionType) {
        return false;
      }
      
      // Filtre par date
      if (filters.dateFrom && new Date(item.timestamp) < new Date(filters.dateFrom)) {
        return false;
      }
      if (filters.dateTo && new Date(item.timestamp) > new Date(filters.dateTo + 'T23:59:59')) {
        return false;
      }
      
      // Filtre par utilisateur (géré côté serveur via params.userId)
      
      // Filtre par type de vue
      if (filters.viewType === 'sessions') {
        return item.action_type === 'login' || item.action_type === 'logout';
      } else if (filters.viewType === 'activities') {
        return item.action_type !== 'login' && item.action_type !== 'logout';
      }
      
      return true;
    })
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return (
    <>
      <Navbar />
      <Container fluid className="activity-log-container my-4">
        <Card className="shadow-sm">
          <Card.Header className="py-3">
            <Row className="align-items-center">
              <Col md={12}>
                <h4 className="mb-0">
                  <i className="bi bi-clock-history me-2"></i>
                  Journal d'Activité
                </h4>
              </Col>
            </Row>
          </Card.Header>
          
          <Card.Body className="p-0">
            <div className="filter-section p-3 border-bottom">
              <Row>
                
                <Col md={3}>
                  <Form.Group controlId="actionType">
                    <Form.Label>Type d'action</Form.Label>
                    <Form.Select
                      value={filters.actionType}
                      onChange={(e) => setFilters({...filters, actionType: e.target.value})}
                    >
                      <option value="">Toutes les actions</option>
                      {Object.entries(ACTION_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                
                <Col md={3}>
                  <Form.Group controlId="dateFrom">
                    <Form.Label>Date</Form.Label>
                    <Form.Control
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                      max={filters.dateTo || undefined}
                    />
                  </Form.Group>
                </Col>
              
              {currentUser?.role === 'admin' && (
                  <Col md={6}>
                    <Form.Group controlId="userFilter">
                      <Form.Label>Filtrer par utilisateur</Form.Label>
                      <Dropdown>
                        <Dropdown.Toggle variant="outline-secondary" className="w-100 text-start">
                          {selectedUser 
                            ? users.find(u => u.id === selectedUser)?.name || 'Utilisateur inconnu'
                            : 'Tous les utilisateurs'}
                        </Dropdown.Toggle>
                        <Dropdown.Menu className="w-100">
                          <Dropdown.Item onClick={() => setSelectedUser(null)}>
                            Tous les utilisateurs
                          </Dropdown.Item>
                          {users.map(user => (
                            <Dropdown.Item 
                              key={user.id} 
                              onClick={() => setSelectedUser(user.id)}
                              active={selectedUser === user.id}
                            >
                              {user.prenom} {user.name} ({user.role})
                            </Dropdown.Item>
                          ))}
                        </Dropdown.Menu>
                      </Dropdown>
                    </Form.Group>
                  </Col>
                
              )}
              </Row>
            </div>

            {error && (
              <Alert variant="danger" className="m-3">
                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                {error}
              </Alert>
            )}
            
            {loading ? (
              <div className="text-center my-5 py-5">
                <Spinner animation="border" variant="primary" />
                <p className="mt-2">Chargement des données...</p>
              </div>
            ) : filteredData.length === 0 ? (
              <Alert variant="info" className="m-3">
                <i className="bi bi-info-circle-fill me-2"></i>
                Aucune donnée trouvée pour les critères sélectionnés
              </Alert>
            ) : (
              <div className="table-responsive">
                <Table hover className="mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Action</th>
                      {currentUser?.role === 'admin' && <th>Utilisateur</th>}
                      <th>Type</th>
                      <th>Date/Heure</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((item) => (
                      <React.Fragment key={item.id}>
                        <tr 
                          className={expandedRows.includes(item.id) ? 'table-active' : ''}
                          onClick={() => toggleRowExpand(item.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>
                            <div className="d-flex align-items-center">
                              <span className="me-2">
                                {renderActionIcon(item.action_type)}
                              </span>
                              {renderActionBadge(item.action_type)}
                            </div>
                          </td>
                          
                          {currentUser?.role === 'admin' && (
                            <td>
                              {item.user_prenom} {item.user_name}
                              {item.user_role && (
                                <Badge bg="light" text="dark" className="ms-2">
                                  {item.user_role}
                                </Badge>
                              )}
                            </td>
                          )}
                          
                          <td>{item.entity_type}</td>
                          <td>{formatDateSafe(item.timestamp)}</td>
                          
                          <td className="text-end">
                            <Button 
                              variant="link" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRowExpand(item.id);
                              }}
                            >
                              <i className={`bi bi-chevron-${expandedRows.includes(item.id) ? 'up' : 'down'}`}></i>
                            </Button>
                          </td>
                        </tr>
                        
                        {expandedRows.includes(item.id) && (
                          <tr>
                            <td colSpan={currentUser?.role === 'admin' ? 5 : 4} className="bg-light">
                              {renderDetails(item)}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
          
          {filteredData.length > 0 && !loading && (
            <Card.Footer className="py-2 text-muted">
              <small>
                Affichage de {filteredData.length} élément{filteredData.length > 1 ? 's' : ''}
              </small>
            </Card.Footer>
          )}
        </Card>
      </Container>
    </>
  );
};

export default ActivityLog;