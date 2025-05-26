// Fichier : WorkflowPage.js (version focalisée sur le suivi)
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Button, Badge, Spinner, Modal, Form, Card, Row, Col, ProgressBar, Tooltip, OverlayTrigger, Accordion } from 'react-bootstrap';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiClock, 
  FiAlertCircle, 
  FiCheckCircle, 
  FiRefreshCw,
  FiCalendar,
  FiFileText,
  FiUser,
  FiTrendingUp,
  FiMessageSquare
} from 'react-icons/fi';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import Navbar from './Navbar';
import Chatbot from './chatbot';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Configuration des couleurs
const statusColors = {
  completed: 'success',
  pending: 'warning',
  in_progress: 'primary',
  failed: 'danger'
};

const priorityColors = {
  haute: 'danger',
  moyenne: 'warning',
  basse: 'info'
};

// Composant de statistiques amélioré
const StatsPanel = ({ workflow, steps }) => {
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const completionPercentage = steps.length ? Math.round((completedSteps / steps.length) * 100) : 0;
  
  const startDate = workflow.created_at ? parseISO(workflow.created_at) : null;
  const endDate = workflow.completed_at ? parseISO(workflow.completed_at) : null;
  const duration = startDate && endDate ? 
    `${Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))} jours` : 
    'En cours';

  return (
    <Card className="mb-4">
      <Card.Body>
        <Row>
          <Col md={4} className="border-end">
            <div className="text-center">
              <h6 className="text-muted">Statut</h6>
              <Badge bg={statusColors[workflow.status]} className="fs-6 p-2">
                {workflow.status}
              </Badge>
            </div>
          </Col>
          <Col md={4} className="border-end">
            <div className="text-center">
              <h6 className="text-muted">Progression</h6>
              <ProgressBar 
                now={completionPercentage} 
                label={`${completionPercentage}%`} 
                variant={completionPercentage === 100 ? 'success' : 'primary'}
                className="mt-1"
                style={{ height: '24px' }}
              />
            </div>
          </Col>
          <Col md={4}>
            <div className="text-center">
              <h6 className="text-muted">Étapes</h6>
              <h4>
                {completedSteps} <small className="text-muted">/ {steps.length}</small>
              </h4>
            </div>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
};

// Composant d'étape simplifié
const StepItem = ({ step, onComplete }) => {
  const isCompleted = step.status === 'completed';
  const completionDate = step.completed_at ? parseISO(step.completed_at) : null;

  return (
    <motion.div 
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
    >
      <Card className={`mb-2 ${isCompleted ? 'border-success' : ''}`}>
        <Card.Body className="p-3">
          <div className="d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center">
              <div className={`rounded-circle bg-${isCompleted ? 'success' : 'light'} p-2 me-3`}>
                {isCompleted ? 
                  <FiCheckCircle className="text-white" /> : 
                  <FiClock className={isCompleted ? 'text-white' : 'text-secondary'} />
                }
              </div>
              <div>
                <h5 className="mb-1">{step.name}</h5>
                <p className="text-muted mb-0">{step.description}</p>
                {completionDate && (
                  <small className="text-muted">
                    Terminé le {format(completionDate, 'PPp', { locale: fr })}
                  </small>
                )}
              </div>
            </div>
          </div>
        </Card.Body>
      </Card>
    </motion.div>
  );
};

// Composant BPMN Viewer
const BpmnViewer = ({ workflowId }) => {
  const [bpmnXml, setBpmnXml] = useState(null);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchBpmn = async () => {
      try {
        const response = await axios.get(
          `http://localhost:5000/api/workflows/${workflowId}/bpmn`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setBpmnXml(response.data);
      } catch (err) {
        console.error("Failed to load BPMN diagram", err);
        toast.error("Erreur de chargement du diagramme BPMN");
      } finally {
        setLoading(false);
      }
    };

    fetchBpmn();
  }, [workflowId, token]);

  useEffect(() => {
    if (!bpmnXml || typeof window === 'undefined') return;

    const container = document.getElementById('bpmn-container');
    container.innerHTML = ''; // Clear previous content

    // Load BPMN viewer
    const BpmnViewer = require('bpmn-js/lib/Viewer').default;
    const viewer = new BpmnViewer({
      container: '#bpmn-container'
    });

    viewer.importXML(bpmnXml)
      .then(() => {
        viewer.get('canvas').zoom('fit-viewport');
      })
      .catch(err => {
        console.error('Failed to render BPMN diagram', err);
      });

    return () => {
      viewer.destroy();
    };
  }, [bpmnXml]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '400px' }}>
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  return (
    <div id="bpmn-container" style={{ height: '400px', width: '100%' }} />
  );
};

// Composant de résultats
const ResultsPanel = ({ workflow, logs }) => {
  const [activeKey, setActiveKey] = useState('0');

  return (
    <Card className="mb-4">
      <Card.Header>
        <h5 className="mb-0">Résultats et validation</h5>
      </Card.Header>
      <Card.Body>
        <Accordion activeKey={activeKey} onSelect={(k) => setActiveKey(k)}>
          <Accordion.Item eventKey="0">
            <Accordion.Header>
              <FiFileText className="me-2" />
              Rapport final
            </Accordion.Header>
            <Accordion.Body>
              {workflow.final_report ? (
                <div>
                  <h6>Validation:</h6>
                  <Badge bg={workflow.is_approved ? 'success' : 'danger'} className="mb-3">
                    {workflow.is_approved ? 'Approuvé' : 'Rejeté'}
                  </Badge>
                  
                  <h6>Commentaires:</h6>
                  <p>{workflow.final_report}</p>
                  
                  {workflow.completed_at && (
                    <div className="text-muted small">
                      <FiCalendar className="me-1" />
                      Terminé le {format(parseISO(workflow.completed_at), 'PPp', { locale: fr })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-3 text-muted">
                  <FiAlertCircle size={24} className="me-2" />
                  Aucun rapport final disponible
                </div>
              )}
            </Accordion.Body>
          </Accordion.Item>
          
          <Accordion.Item eventKey="1">
            <Accordion.Header>
              <FiTrendingUp className="me-2" />
              Métriques
            </Accordion.Header>
            <Accordion.Body>
              <Row>
                <Col md={6}>
                  <div className="mb-3">
                    <h6>Date de création:</h6>
                    <p>
                      <FiCalendar className="me-1" />
                      {format(parseISO(workflow.created_at), 'PPp', { locale: fr })}
                    </p>
                  </div>
                  
                  <div className="mb-3">
                    <h6>Initiateur:</h6>
                    <p>
                      <FiUser className="me-1" />
                      {workflow.created_by || 'Non spécifié'}
                    </p>
                  </div>
                </Col>
                <Col md={6}>
                  <div className="mb-3">
                    <h6>Dernière mise à jour:</h6>
                    <p>
                      <FiCalendar className="me-1" />
                      {format(parseISO(workflow.updated_at), 'PPp', { locale: fr })}
                    </p>
                  </div>
                  
                  <div className="mb-3">
                    <h6>Responsable:</h6>
                    <p>
                      <FiUser className="me-1" />
                      {workflow.assigned_to || 'Non assigné'}
                    </p>
                  </div>
                </Col>
              </Row>
            </Accordion.Body>
          </Accordion.Item>
          
          <Accordion.Item eventKey="2">
            <Accordion.Header>
              <FiMessageSquare className="me-2" />
              Historique des actions
            </Accordion.Header>
            <Accordion.Body>
              {logs.length > 0 ? (
                <div className="timeline">
                  {logs.map((log, index) => (
                    <div key={index} className="timeline-item mb-3">
                      <div className="d-flex">
                        <div className="timeline-badge bg-primary text-white rounded-circle p-2 me-3">
                          <FiMessageSquare />
                        </div>
                        <div>
                          <h6 className="mb-1">{log.action}</h6>
                          <p className="text-muted small mb-1">{log.message}</p>
                          <small className="text-muted">
                            {format(parseISO(log.timestamp), 'PPp', { locale: fr })}
                            {log.user && ` par ${log.user}`}
                          </small>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-3 text-muted">
                  <FiAlertCircle size={24} className="me-2" />
                  Aucun historique disponible
                </div>
              )}
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      </Card.Body>
    </Card>
  );
};

export default function WorkflowPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const [workflow, setWorkflow] = useState(null);
  const [steps, setSteps] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showDiagram, setShowDiagram] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationComment, setValidationComment] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [wfRes, logRes] = await Promise.all([
        axios.get(`http://localhost:5000/api/workflows/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`http://localhost:5000/api/workflows/${id}/logs`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      setWorkflow(wfRes.data.workflow);
      setSteps(wfRes.data.steps);
      setLogs(logRes.data);
    } catch (err) {
      toast.error('Erreur de chargement des données');
      navigate('/workflows');
    } finally {
      setLoading(false);
    }
  }, [id, token, navigate]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const completeStep = async (step) => {
    try {
      await axios.post(
        `http://localhost:5000/api/workflows/${id}/steps/${step.id}/complete`, 
        {}, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Étape "${step.name}" complétée`);
      fetchAll();
    } catch {
      toast.error('Erreur lors de la complétion');
    }
  };

  const analyzeLogsWithAI = async () => {
    try {
      setIsAnalyzing(true);
      const logsText = logs.map(log => log.message).join('\n');
      
      const response = await axios.post(
        `http://localhost:5000/api/workflows/${id}/analyze-logs`, 
        { 
          prompt: logsText,
          workflowInfo: {
            name: workflow?.name || "",
            description: workflow?.description || ""
          }
        },
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );
  
      toast.info(
        <div>
          <h6>Analyse IA des logs</h6>
          <pre style={{ whiteSpace: 'pre-wrap' }}>
            {response.data.analysis}
          </pre>
        </div>,
        { autoClose: 10000 }
      );
  
    } catch (error) {
      console.error("Détails de l'erreur:", error);
      toast.error(
        error.response?.data?.message || 
        error.message || 
        "Erreur lors de l'analyse IA",
        { autoClose: 5000 }
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFinalValidation = async (isApproved) => {
    try {
      await axios.post(
        `http://localhost:5000/api/workflows/${id}/validate`,
        {
          is_approved: isApproved,
          comment: validationComment
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Workflow ${isApproved ? 'approuvé' : 'rejeté'} avec succès`);
      setShowValidationModal(false);
      fetchAll();
    } catch (err) {
      toast.error(`Erreur lors de la validation: ${err.response?.data?.message || err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} />
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <Chatbot />
      
      <div className="container-fluid py-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* En-tête */}
          

          {/* Panneau de statistiques */}
          <StatsPanel workflow={workflow} steps={steps} />

          {/* Diagramme de workflow */}
          <Card className="mb-4">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Visualisation du processus</h5>
              <Button 
                variant="outline-primary" 
                size="sm" 
                onClick={() => setShowDiagram(!showDiagram)}
              >
                {showDiagram ? 'Masquer' : 'Afficher'}
              </Button>
            </Card.Header>
            <AnimatePresence>
              {showDiagram && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card.Body className="p-0" style={{ height: '400px' }}>
                    <BpmnViewer workflowId={id} />
                  </Card.Body>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>

          {/* Étapes du workflow */}
          <Card className="mb-4">
            <Card.Header>
              <h5 className="mb-0">Parcours du workflow</h5>
            </Card.Header>
            <Card.Body>
              {steps.length === 0 ? (
                <div className="text-center py-4">
                  <FiAlertCircle size={48} className="text-muted mb-3" />
                  <h5>Aucune étape définie</h5>
                </div>
              ) : (
                <div className="steps-container">
                  {steps.map((step, index) => (
                    <StepItem 
                      key={step.id} 
                      step={step} 
                      onComplete={completeStep}
                    />
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Résultats et validation */}
          <ResultsPanel workflow={workflow} logs={logs} />

          {/* Bouton de validation finale (si workflow terminé) */}
          {workflow.status === 'completed' && !workflow.final_report && (
            <div className="text-center mb-4">
              <Button 
                variant="primary" 
                size="lg"
                onClick={() => setShowValidationModal(true)}
              >
                Valider le workflow
              </Button>
            </div>
          )}
        </motion.div>
      </div>

      {/* Modal de validation finale */}
      <Modal show={showValidationModal} onHide={() => setShowValidationModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Validation finale</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Commentaires</Form.Label>
              <Form.Control 
                as="textarea" 
                rows={3}
                value={validationComment}
                onChange={(e) => setValidationComment(e.target.value)}
                placeholder="Ajoutez vos commentaires sur le workflow..."
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="danger" onClick={() => handleFinalValidation(false)}>
            Rejeter
          </Button>
          <Button variant="success" onClick={() => handleFinalValidation(true)}>
            Approuver
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}