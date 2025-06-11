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
  Col
} from 'react-bootstrap';
import axios from 'axios';
import Navbar from './Navbar';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import { jwtDecode } from 'jwt-decode';
import { FiLogIn, FiLogOut } from 'react-icons/fi';
import '../style/activity.css';

const ActivityLog = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState(null);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: ''
  });
  const [expandedRows, setExpandedRows] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const decoded = jwtDecode(token);
      setUserId(decoded.id);
    }
  }, []);

 const fetchActivities = async () => {
  try {
    setLoading(true);
    const params = {};
    
    // Ajouter les paramètres de filtre si ils existent
    if (filters.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters.dateTo) params.dateTo = filters.dateTo;

    const { data } = await axios.get(`http://localhost:5000/api/auth/sessions`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      params: params // Envoyer les paramètres de filtre
    });
    
    // Transformer les données de session en activités
    const transformedActivities = data.map(session => ({
      id: session.id,
      action_type: session.logout_time ? 'logout' : 'login',
      type: 'Session utilisateur',
      login_time: session.login_time,
      logout_time: session.logout_time,
      duration: session.duration ? `${Math.round(session.duration/60)} minutes` : 'En cours',
      details: session.logout_time 
        ? `Session terminée (${Math.round(session.duration/60)} minutes)` 
        : 'Session active'
    }));

    setActivities(transformedActivities);
    setError(null);
  } catch (err) {
    setError(err.response?.data?.error || 'Erreur lors du chargement des activités');
    setActivities([]);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    if (userId) fetchActivities();
  }, [userId, filters]);

  const handleResetFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: ''
    });
  };

  const toggleRowExpand = (id) => {
    if (expandedRows.includes(id)) {
      setExpandedRows(expandedRows.filter(rowId => rowId !== id));
    } else {
      setExpandedRows([...expandedRows, id]);
    }
  };

  const renderActionIcon = (actionType) => {
    return actionType === 'login' 
      ? <FiLogIn size={18} className="text-primary" /> 
      : <FiLogOut size={18} className="text-secondary" />;
  };

  const renderActionBadge = (actionType) => {
    return (
      <Badge bg={actionType === 'login' ? 'primary' : 'secondary'} className="text-capitalize">
        {actionType === 'login' ? 'Connexion' : 'Déconnexion'}
      </Badge>
    );
  };

  const formatDateSafe = (dateString) => {
    try {
      return dateString ? format(new Date(dateString), 'PPpp', { locale: fr }) : 'N/A';
    } catch {
      return 'Date invalide';
    }
  };

  return (
    <>
      <Navbar />
      <Container fluid className="activity-log-container my-4">
        <Card className="shadow-sm">
          <Card.Header className="py-3">
            <Row className="align-items-center">
              <Col md={6}>
                <h4 className="mb-0">
                  <i className="bi bi-clock-history me-2"></i>
                  Journal des Connexions
                </h4>
              </Col>
              <Col md={6} className="text-md-end">
                <Button 
                  variant="outline-secondary" 
                  size="sm" 
                  onClick={handleResetFilters}
                  className="me-2"
                >
                  Réinitialiser
                </Button>
              </Col>
            </Row>
          </Card.Header>
          
          <Card.Body className="p-0">
            <div className="filter-section p-3 border-bottom">
              <Row>
                <Col md={4}>
                  <Form.Group controlId="dateFrom">
                    <Form.Label>Du</Form.Label>
                    <Form.Control
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group controlId="dateTo">
                    <Form.Label>Au</Form.Label>
                    <Form.Control
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                    />
                  </Form.Group>
                </Col>
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
                <p className="mt-2">Chargement des activités...</p>
              </div>
            ) : activities.length === 0 ? (
              <Alert variant="info" className="m-3">
                <i className="bi bi-info-circle-fill me-2"></i>
                Aucune activité trouvée pour les critères sélectionnés
              </Alert>
            ) : (
              <div className="table-responsive">
                <Table hover className="mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Action</th>
                      <th>Type</th>
                      <th>Connexion</th>
                      <th>Déconnexion</th>
                      <th>Durée</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.map((activity) => (
                      <React.Fragment key={activity.id}>
                        <tr 
                          className={expandedRows.includes(activity.id) ? 'table-active' : ''}
                          onClick={() => toggleRowExpand(activity.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>
                            <div className="d-flex align-items-center">
                              <span className="me-2">
                                {renderActionIcon(activity.action_type)}
                              </span>
                              {renderActionBadge(activity.action_type)}
                            </div>
                          </td>
                          <td>{activity.type}</td>
                          <td>{formatDateSafe(activity.login_time)}</td>
                          <td>{activity.logout_time ? formatDateSafe(activity.logout_time) : 'En cours'}</td>
                          <td>{activity.duration}</td>
                          <td className="text-end">
                            <Button 
                              variant="link" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRowExpand(activity.id);
                              }}
                            >
                              <i className={`bi bi-chevron-${expandedRows.includes(activity.id) ? 'up' : 'down'}`}></i>
                            </Button>
                          </td>
                        </tr>
                        {expandedRows.includes(activity.id) && (
                          <tr>
                            <td colSpan="6" className="bg-light">
                              <div className="p-3">
                                <h6>Détails complets :</h6>
                                <div className="details-container">
                                  <div className="detail-item">
                                    <strong>Statut:</strong> {activity.details}
                                  </div>
                                </div>
                              </div>
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
          
          {activities.length > 0 && !loading && (
            <Card.Footer className="py-2 text-muted">
              <small>
                Affichage de {activities.length} session{activities.length > 1 ? 's' : ''}
              </small>
            </Card.Footer>
          )}
        </Card>
      </Container>
    </>
  );
};

export default ActivityLog;