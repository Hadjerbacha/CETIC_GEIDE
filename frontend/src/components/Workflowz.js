// Fichier : WorkflowPage.js (version focalisée sur le suivi)
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Button, Badge, Spinner, Modal, Form, Card, Row, Col, ProgressBar, Tooltip, OverlayTrigger, Accordion } from 'react-bootstrap';
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
const StatsPanel = ({ workflow, steps, onStatusUpdate }) => {
  const token = localStorage.getItem('token');
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const hasRejected = steps.some(s => s.status === 'rejected');
  const completionPercentage = steps.length ? Math.round((completedSteps / steps.length) * 100) : 0;

  const startDate = workflow.created_at ? parseISO(workflow.created_at) : null;
  const endDate = workflow.completed_at ? parseISO(workflow.completed_at) : null;
  const duration = startDate && endDate ? 
    `${Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))} jours` : 
    'En cours';
 
  // ✅ Appel API automatique quand les statuts changent
  useEffect(() => {
    const updateWorkflowStatus = async () => {
      let newStatus = null;

      if (hasRejected) {
        newStatus = 'rejected';
      } else if (completedSteps === steps.length) {
        newStatus = 'completed';
      }

      if (newStatus && newStatus !== workflow.status) {
        try {
          const res = await axios.patch(`/api/workflows/${workflow.id}/force-status`, {
            status: newStatus,
          }, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });


          console.log('Statut du workflow mis à jour:', res.data.workflowStatus);
          if (onStatusUpdate) onStatusUpdate(newStatus); // pour rafraîchir dans le parent si nécessaire
        } catch (err) {
          console.error('Erreur lors de la mise à jour du workflow:', err);
        }
      }
    };

    if (steps.length > 0) {
      updateWorkflowStatus();
    }
  }, [steps]); // Déclenché si steps change

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
const StepItem = ({ step, onComplete, onReject, workflowStatus }) => {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  
  const isCompleted = step.status === 'completed';
  const isPending = step.status === 'pending';
  const isBlocked = step.status === 'blocked';
  const isRejected = step.status === 'rejected';
  const completionDate = step.completed_at ? parseISO(step.completed_at) : null;
  const rejectionDate = step.rejected_at ? parseISO(step.rejected_at) : null;

  const handleComplete = async () => {
    try {
      await onComplete(step);
    } catch (err) {
      toast.error('Erreur lors de la complétion');
    }
  };

  const handleReject = () => {
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    try {
      await onReject(step, rejectReason);
      setShowRejectModal(false);
      setRejectReason('');
    } catch (err) {
      toast.error('Erreur lors du rejet');
    }
  };

  return (
    <>
      <motion.div whileHover={{ scale: 1.01 }} transition={{ duration: 0.2 }}>
        <Card className={`mb-2 ${
          isCompleted ? 'border-success' : 
          isRejected ? 'border-danger' : 
          isBlocked ? 'bg-light' : ''
        }`}>
          <Card.Body className="p-3">
            <div className="d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center">
                <div className={`rounded-circle ${
                  isCompleted ? 'bg-success' : 
                  isRejected ? 'bg-danger' : 
                  isBlocked ? 'bg-secondary' : 'bg-light'
                } p-2 me-3`}>
                  {isCompleted ? (
                    <FiCheckCircle className="text-white" />
                  ) : isRejected ? (
                    <FiAlertCircle className="text-white" />
                  ) : isBlocked ? (
                    <FiClock className="text-white" />
                  ) : (
                    <FiClock className="text-secondary" />
                  )}
                </div>
                <div>
                  <h5 className="mb-1">{step.name}</h5>
                  <p className="text-muted mb-0">{step.description}</p>
                  
                  {/* Date de complétion */}
                  {completionDate && (
                    <small className="text-muted d-block">
                      Terminé le {format(completionDate, 'PPp', { locale: fr })}
                    </small>
                  )}
                  
                  {/* Raison du rejet */}
                  {/*{isRejected && (
                    <div className="mt-2">
                      <small className="text-danger fw-bold">Raison du refus:</small>
                      <p className="mb-0 small">{step.rejection_reason}</p>
                      <small className="text-muted">
                        Refusé le {format(rejectionDate, 'PPp', { locale: fr })}
                        {step.rejected_by && ` par ${step.rejected_by}`}
                      </small>
                    </div>
                  )}*/}
                  
                  {/* Statut bloqué */}
                  {isBlocked && (
                    <small className="text-warning d-block">
                      En attente des tâches précédentes
                    </small>
                  )}
                </div>
              </div>
              
              {/* Actions */}
              {isPending && workflowStatus === 'in_progress' && (
                <div className="d-flex gap-2">
                  <Button 
                    variant="outline-success" 
                    size="sm"
                    onClick={handleComplete}
                  >
                    Valider
                  </Button>
                  <Button 
                    variant="outline-danger" 
                    size="sm"
                    onClick={handleReject}
                  >
                    Rejeter
                  </Button>
                </div>
              )}
            </div>
          </Card.Body>
        </Card>
      </motion.div>
    </>
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

    // Load BPMN viewer with zoom and pan controls
    const BpmnViewer = require('bpmn-js/lib/Viewer').default;
    const viewer = new BpmnViewer({
      container: '#bpmn-container',
      height: '100%',
      width: '100%'
    });

    viewer.importXML(bpmnXml)
      .then(() => {
        const canvas = viewer.get('canvas');
        canvas.zoom('fit-viewport', 'auto');
        
        // Add colored overlays based on task status
        viewer.on('import.done', () => {
          const elementRegistry = viewer.get('elementRegistry');
          const modeling = viewer.get('modeling');
        });
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
      <div className="d-flex justify-content-center align-items-center" style={{ height: '500px' }}>
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  return (
    <div 
      id="bpmn-container" 
      style={{ 
        height: '500px', 
        width: '100%',
        border: '1px solid #dee2e6',
        borderRadius: '4px'
      }} 
    />
  );
};

// Composant de résultats
const ResultsPanel = ({ workflow, logs, files }) => {
  return (
    <Card className="mb-4">
      <Card.Header>
        <h5 className="mb-0">Résultats et validation</h5>
      </Card.Header>
      <Card.Body>
              {files.length > 0 ? (
                <div className="list-group" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {files.map((file, index) => (
                    <div key={index} className="list-group-item">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <FiFileText className="me-2" />
                          <a
                            href={`http://localhost:5000${file.file_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {file.file_name || 'Fichier de réponse'}
                          </a>
                        </div>
                        <small className="text-muted">
                          {format(parseISO(file.submitted_at), 'PPp', { locale: fr })}
                        </small>
                      </div>
                      {file.comment && (
                        <div className="mt-2">
                          <small className="text-muted">Commentaire:</small>
                          <p className="mb-0 small">{file.comment}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-3 text-muted">
                  <FiAlertCircle size={24} className="me-2" />
                  Aucun fichier de réponse soumis
                </div>
              )}
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
  const [responseFiles, setResponseFiles] = useState([]);

   const fetchResponseFiles = useCallback(async () => {
  try {
    const response = await axios.get(
      `http://localhost:5000/api/workflows/${id}/responses`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setResponseFiles(response.data);
  } catch (err) {
    console.error("Failed to load response files", err);
  }
}, [id, token]);

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
      await fetchResponseFiles(); 
    } catch (err) {
      toast.error('Erreur de chargement des données');
      navigate('/workflows');
    } finally {
      setLoading(false);
    }
  }, [id, token, navigate, fetchResponseFiles]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

const completeStep = async (step) => {
  try {
    const response = await axios.patch(
      `http://localhost:5000/api/workflows/${step.id}/status`,
      { status: 'completed' },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    toast.success('Statut mis à jour !');
    fetchAll();
  } catch (err) {
    toast.error('Échec de la mise à jour');
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
          <ResultsPanel 
            workflow={workflow} 
            logs={logs} 
            files={responseFiles} 
          />

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