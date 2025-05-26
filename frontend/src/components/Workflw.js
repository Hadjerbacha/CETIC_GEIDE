import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Container, 
  Card, 
  ProgressBar, 
  ListGroup, 
  Button, 
  Modal,
  Form,
  Alert,
  Badge,
  Row,
  Col
} from 'react-bootstrap';
import axios from 'axios';
import { toast } from 'react-toastify';
import BPMNViewer from '../components/BPMNViewer';
import { AuthContext } from '../context/AuthContext';
import 'react-toastify/dist/ReactToastify.css';

const WorkflowTracking = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [workflow, setWorkflow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionModal, setActionModal] = useState(false);
  const [comment, setComment] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [documentDetails, setDocumentDetails] = useState(null);

  useEffect(() => {
    const fetchWorkflow = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/workflows/${id}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
        setWorkflow(res.data);
        
        // Fetch associated document details
        if (res.data.document_id) {
          const docRes = await axios.get(`http://localhost:5000/api/documents/${res.data.document_id}`, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`
            }
          });
          setDocumentDetails(docRes.data);
        }
      } catch (err) {
        setError('Erreur lors du chargement du workflow');
        toast.error('Erreur lors du chargement du workflow');
      } finally {
        setLoading(false);
      }
    };
    
    fetchWorkflow();
    const interval = setInterval(fetchWorkflow, 10000); // Auto-refresh every 10 seconds
    
    return () => clearInterval(interval);
  }, [id]);

  const handleAction = async () => {
    try {
      await axios.post(`http://localhost:5000/api/workflows/${id}/process`, {
        action: selectedAction,
        comment
      }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      toast.success('Action enregistrée avec succès');
      setActionModal(false);
      setComment('');
      setSelectedAction('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors du traitement');
    }
  };

  const getStepStatusBadge = (step) => {
    if (step.status === 'completed') return 'success';
    if (step.status === 'rejected') return 'danger';
    if (workflow.current_step === step.step_number) return 'primary';
    return 'secondary';
  };

  if (loading) return (
    <Container className="my-5 text-center">
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Chargement...</span>
      </div>
    </Container>
  );

  if (error) return (
    <Container className="my-5">
      <Alert variant="danger">{error}</Alert>
    </Container>
  );

  return (
    <Container className="my-5">
      <Row className="mb-4">
        <Col>
          <Button variant="outline-secondary" onClick={() => navigate(-1)}>
            &larr; Retour
          </Button>
        </Col>
      </Row>

      <Card className="mb-4 shadow">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h2>{workflow?.name}</h2>
              {documentDetails && (
                <p className="mb-0">
                  <strong>Document associé:</strong> {documentDetails.name}
                  <Button 
                    variant="link" 
                    size="sm" 
                    onClick={() => navigate(`/documents/${documentDetails.id}`)}
                  >
                    Voir le document
                  </Button>
                </p>
              )}
            </div>
            <Badge bg={workflow?.status === 'completed' ? 'success' : 
                      workflow?.status === 'rejected' ? 'danger' : 'warning'} className="fs-6">
              {workflow?.status?.toUpperCase()}
            </Badge>
          </div>
          
          <div className="my-4">
            <ProgressBar 
              now={workflow?.progress || 0} 
              label={`${Math.round(workflow?.progress || 0)}%`} 
              animated={workflow?.status === 'pending'}
              variant={workflow?.status === 'completed' ? 'success' : 
                      workflow?.status === 'rejected' ? 'danger' : 'primary'}
            />
          </div>

          {workflow?.steps && (
            <BPMNViewer 
              steps={workflow.steps} 
              currentStep={workflow.current_step} 
            />
          )}
        </Card.Body>
      </Card>

      <Row>
        <Col md={8}>
          <Card className="mb-4 shadow">
            <Card.Header className="bg-primary text-white">
              <h4>Étapes du Workflow</h4>
            </Card.Header>
            <ListGroup variant="flush">
              {workflow?.steps?.map(step => (
                <ListGroup.Item 
                  key={step.id}
                  className={`${step.step_number === workflow.current_step ? 'bg-light' : ''}`}
                >
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <div className="d-flex align-items-center mb-2">
                        <Badge bg={getStepStatusBadge(step)} className="me-2">
                          Étape {step.step_number}
                        </Badge>
                        <h5 className="mb-0">{step.action_type}</h5>
                      </div>
                      <p className="mb-1">
                        <strong>Assigné à:</strong> {step.assigned_to?.name || 'Non assigné'}
                      </p>
                      {step.comment && (
                        <p className="mb-1">
                          <strong>Commentaire:</strong> {step.comment}
                        </p>
                      )}
                      <small className={`text-${getStepStatusBadge(step)}`}>
                        Statut: {step.status} {step.completed_at && `le ${new Date(step.completed_at).toLocaleString()}`}
                      </small>
                    </div>
                    
                    {step.step_number === workflow.current_step && 
                     step.assigned_to?.id === user?.id && (
                      <Button 
                        variant="primary"
                        size="sm"
                        onClick={() => setActionModal(true)}
                      >
                        Traiter
                      </Button>
                    )}
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </Card>
        </Col>

        <Col md={4}>
          <Card className="shadow">
            <Card.Header className="bg-primary text-white">
              <h4>Historique des Actions</h4>
            </Card.Header>
            <ListGroup variant="flush" style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {workflow?.history?.length > 0 ? (
                workflow.history.map(item => (
                  <ListGroup.Item key={item.id}>
                    <div className="d-flex justify-content-between">
                      <div>
                        <strong>{item.user?.name}</strong> - {item.action}
                        {item.comment && <p className="mt-1 mb-0 text-muted">{item.comment}</p>}
                      </div>
                      <small className="text-muted">
                        {new Date(item.created_at).toLocaleTimeString()}
                      </small>
                    </div>
                  </ListGroup.Item>
                ))
              ) : (
                <ListGroup.Item className="text-center text-muted">
                  Aucun historique disponible
                </ListGroup.Item>
              )}
            </ListGroup>
          </Card>
        </Col>
      </Row>

      {/* Action Modal */}
      <Modal show={actionModal} onHide={() => setActionModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Traiter l'étape</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Action requise</Form.Label>
              <div className="d-flex gap-2">
                <Button 
                  variant={selectedAction === 'approve' ? 'success' : 'outline-success'}
                  onClick={() => setSelectedAction('approve')}
                  className="flex-grow-1"
                >
                  Approuver
                </Button>
                <Button 
                  variant={selectedAction === 'reject' ? 'danger' : 'outline-danger'}
                  onClick={() => setSelectedAction('reject')}
                  className="flex-grow-1"
                >
                  Rejeter
                </Button>
                <Button 
                  variant={selectedAction === 'request_changes' ? 'warning' : 'outline-warning'}
                  onClick={() => setSelectedAction('request_changes')}
                  className="flex-grow-1"
                >
                  Demander des modifications
                </Button>
              </div>
            </Form.Group>
            
            <Form.Group>
              <Form.Label>Commentaire {selectedAction === 'reject' && '(obligatoire)'}</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                required={selectedAction === 'reject'}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setActionModal(false)}>
            Annuler
          </Button>
          <Button 
            variant="primary" 
            onClick={handleAction}
            disabled={!selectedAction || (selectedAction === 'reject' && !comment)}
          >
            Confirmer
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default WorkflowTracking;