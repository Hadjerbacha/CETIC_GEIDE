import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Container, 
  Card, 
  ProgressBar, 
  ListGroup, 
  Button, 
  Modal,
  Form,
  Alert,
  Badge
} from 'react-bootstrap';
import axios from 'axios';
import { BPMNViewer } from '../components/BPMNViewer';
import { toast } from 'react-toastify';

const WorkflowTracking = () => {
  const { id } = useParams();
  const [workflow, setWorkflow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState(false);
  const [comment, setComment] = useState('');
  const [selectedAction, setSelectedAction] = useState('');

  useEffect(() => {
    const fetchWorkflow = async () => {
      try {
        const res = await axios.get(`/api/workflows/${id}`);
        setWorkflow(res.data);
      } catch (err) {
        toast.error('Erreur lors du chargement du workflow');
      } finally {
        setLoading(false);
      }
    };
    
    fetchWorkflow();
    const interval = setInterval(fetchWorkflow, 10000); // Rafraîchissement automatique
    
    return () => clearInterval(interval);
  }, [id]);

  const handleAction = async () => {
    try {
      await axios.post(`/api/workflows/${id}/process`, {
        action: selectedAction,
        comment
      });
      
      toast.success('Action enregistrée avec succès');
      setActionModal(false);
      setComment('');
      setSelectedAction('');
    } catch (err) {
      toast.error('Erreur lors du traitement');
    }
  };

  if (loading) return <div className="text-center my-5">Chargement...</div>;

  return (
    <Container className="my-5">
      <Card className="mb-4 shadow">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center">
            <h2>{workflow.name}</h2>
            <Badge bg={workflow.status === 'completed' ? 'success' : 
                      workflow.status === 'rejected' ? 'danger' : 'warning'}>
              {workflow.status.toUpperCase()}
            </Badge>
          </div>
          
          <div className="my-4">
            <ProgressBar 
              now={workflow.progress} 
              label={`${Math.round(workflow.progress)}%`} 
              animated={workflow.status === 'pending'}
            />
          </div>

          <BPMNViewer 
            steps={workflow.steps} 
            currentStep={workflow.current_step} 
          />
        </Card.Body>
      </Card>

      <Card className="mb-4 shadow">
        <Card.Header>
          <h4>Étapes du Workflow</h4>
        </Card.Header>
        <ListGroup variant="flush">
          {workflow.steps.map(step => (
            <ListGroup.Item 
              key={step.id}
              className={`d-flex justify-content-between align-items-center ${
                step.step_number === workflow.current_step ? 'bg-light' : ''
              }`}
            >
              <div>
                <h5>Étape {step.step_number}: {step.action_type}</h5>
                <p className="mb-1">
                  <strong>Assigné à:</strong> {step.assigned_to.name}
                </p>
                <small className={`text-${
                  step.status === 'approved' ? 'success' :
                  step.status === 'rejected' ? 'danger' : 'muted'
                }`}>
                  Statut: {step.status} {step.completed_at && `le ${new Date(step.completed_at).toLocaleString()}`}
                </small>
              </div>
              
              {step.step_number === workflow.current_step && 
               step.assigned_to.id === currentUser.id && (
                <Button 
                  variant="primary"
                  onClick={() => setActionModal(true)}
                >
                  Traiter
                </Button>
              )}
            </ListGroup.Item>
          ))}
        </ListGroup>
      </Card>

      <Card className="shadow">
        <Card.Header>
          <h4>Historique des Actions</h4>
        </Card.Header>
        <ListGroup variant="flush">
          {workflow.history.map(item => (
            <ListGroup.Item key={item.id}>
              <div className="d-flex justify-content-between">
                <div>
                  <strong>{item.user.name}</strong> - {item.action}
                  {item.comment && <p className="mt-1 mb-0">{item.comment}</p>}
                </div>
                <small className="text-muted">
                  {new Date(item.created_at).toLocaleString()}
                </small>
              </div>
            </ListGroup.Item>
          ))}
        </ListGroup>
      </Card>

      {/* Modal pour les actions */}
      <Modal show={actionModal} onHide={() => setActionModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Traiter l'étape</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Action</Form.Label>
              <div className="d-flex gap-2">
                <Button 
                  variant={selectedAction === 'approve' ? 'success' : 'outline-success'}
                  onClick={() => setSelectedAction('approve')}
                >
                  Approuver
                </Button>
                <Button 
                  variant={selectedAction === 'reject' ? 'danger' : 'outline-danger'}
                  onClick={() => setSelectedAction('reject')}
                >
                  Rejeter
                </Button>
              </div>
            </Form.Group>
            
            <Form.Group>
              <Form.Label>Commentaire (optionnel)</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
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
            disabled={!selectedAction}
          >
            Confirmer
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default WorkflowTracking;