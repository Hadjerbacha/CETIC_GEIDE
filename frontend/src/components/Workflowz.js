// Fichier : WorkflowPage.js (version avec BPMN.js)
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Button, Badge, Spinner, Modal, Form, Card, Row, Col, ProgressBar, Tooltip, OverlayTrigger } from 'react-bootstrap';
import Select from 'react-select';
import { motion, AnimatePresence } from 'framer-motion';
import { FiClock, FiUsers, FiAlertCircle, FiCheckCircle, FiPlus, FiRefreshCw } from 'react-icons/fi';
import { 
   
  FiCalendar, 
  FiUserPlus, 
  FiPaperclip,
  FiMessageSquare,
  FiHash
} from 'react-icons/fi';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import Navbar from './Navbar';
import Chatbot from './chatbot';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FiEdit, FiTrash2 } from 'react-icons/fi';

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

// Composant de carte de tâche personnalisée
const TaskCard = ({ task, onComplete, onEdit, onDelete }) => {
  const dueDate = task.due_date ? parseISO(task.due_date) : null;
  const isOverdue = dueDate && dueDate < new Date() && task.status !== 'completed';
 const [showReassignModal, setShowReassignModal] = useState(false);
const [taskToReassign, setTaskToReassign] = useState(null);
  return (
    <motion.div 
      whileHover={{ y: -2, boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}
      transition={{ duration: 0.2 }}
    >
      <Card className={`mb-3 ${isOverdue ? 'border-danger' : ''}`}>
        <Card.Body>
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <div className="d-flex align-items-center mb-2">
                <Badge bg={statusColors[task.status] || 'secondary'} className="me-2">
                  {task.status === 'completed' ? <FiCheckCircle className="me-1" /> : <FiClock className="me-1" />}
                  {task.status}
                </Badge>
                <Badge bg={priorityColors[task.priority] || 'secondary'}>{task.priority}</Badge>
              </div>
              <h5 className="mb-1">{task.name}</h5>
              <p className="text-muted mb-2">{task.description}</p>
              
              <div className="d-flex align-items-center text-muted small">
                {dueDate && (
                  <>
                    <FiClock className="me-1" />
                    <span className="me-3">
                      {format(dueDate, 'PPp', { locale: fr })}
                    </span>
                  </>
                )}
                {task.assigned_to?.length > 0 && (
                  <>
                    <FiUsers className="me-1" />
                    <span>{task.assigned_to.join(', ')}</span>
                  </>
                )}
              </div>
            </div>
            <div className="d-flex justify-content-end mt-2">
              <Button 
                variant="outline-primary" 
                size="sm" 
                onClick={() => onComplete(task)}
                disabled={task.status === 'completed'}
              >
                {task.status === 'completed' ? 'Terminée' : 'Marquer terminée'}
              </Button>

              <Button 
  variant="outline-secondary" 
  size="sm" 
  className="ms-2"
  onClick={() => onEdit(task)}
>
  <FiEdit /> Modifier
</Button>

<Button 
  variant="outline-danger" 
  size="sm" 
  className="ms-2"
  onClick={() => onDelete(task.id)}
>
  <FiTrash2 /> Supprimer
</Button>
<Button 
  variant="outline-warning" 
  size="sm" 
  className="ms-2"
  onClick={() => {
    setTaskToReassign(task);
    setShowReassignModal(true);
  }}
>
  <FiUserPlus /> Réassigner
</Button>
            </div>
          </div>
        </Card.Body>
      </Card>
    </motion.div>
  );
};

// Composant de statistiques
const StatsPanel = ({ workflow, steps }) => {
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const completionPercentage = steps.length ? Math.round((completedSteps / steps.length) * 100) : 0;

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
              <h6 className="text-muted">Tâches</h6>
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

const TasksPanel = ({ tasks, onEdit, onDelete }) => {
  return (
    
      <Card.Body>
        {tasks.length === 0 ? (
          <div className="text-center py-4">
            <FiAlertCircle size={48} className="text-muted mb-3" />
            <h5>Aucune tâche disponible</h5>
          </div>
        ) : (
          <div className="row row-cols-1 g-3">
            <AnimatePresence>
              {tasks.map((task) => (
                <motion.div
                  key={task.id}
                  className="col"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  whileHover={{ scale: 1.01 }}
                  layout
                >
                  <Card className="h-100 shadow-sm">
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <Card.Title className="mb-0">{task.title}</Card.Title>
                        <div className="d-flex">
                          <Badge bg={priorityColors[task.priority] || 'secondary'} className="me-1">
                            {task.priority}
                          </Badge>
                          <Badge bg={statusColors[task.status] || 'secondary'}>
                            {task.status}
                          </Badge>
                        </div>
                      </div>

                      {task.description && (
                        <Card.Text className="text-muted mb-3">
                          {task.description}
                        </Card.Text>
                      )}

                      <div className="mb-3">
                        {/* Ligne 1: Dates et créateur */}
                        <div className="d-flex flex-wrap align-items-center text-muted small mb-2">
                          <span className="d-flex align-items-center me-3">
                            <FiCalendar className="me-1" />
                            {task.due_date ? format(parseISO(task.due_date), 'PP', { locale: fr }) : 'Sans échéance'}
                          </span>
                          <span className="d-flex align-items-center me-3">
                            <FiUserPlus className="me-1" />
                            Créé le {format(parseISO(task.created_at), 'PP', { locale: fr })}
                          </span>
                        </div>

                        {/* Ligne 2: Fichiers et assignations */}
                        <div className="d-flex flex-wrap align-items-center text-muted small mb-2">
                          {task.file_path && (
                            <span className="d-flex align-items-center me-3">
                              <FiPaperclip className="me-1" />
                              <a href={task.file_path} target="_blank" rel="noopener noreferrer">
                                Pièce jointe
                              </a>
                            </span>
                          )}
{task.assigned_to?.length > 0 && (
  <span className="d-flex align-items-center me-3">
    <FiUsers className="me-1" />
    Assigné à: {task.assigned_usernames || task.assigned_to.join(', ')}
    {task.type === 'validation' && (
      <Badge bg="warning" text="dark" className="ms-2">
        Validation requise
      </Badge>
    )}
  </span>
)}
                        </div>

                        {/* Ligne 3: Notes d'assignation */}
                        {task.assignment_note && (
                          <div className="alert alert-light py-2 px-3 small mb-2">
                            <FiMessageSquare className="me-1" />
                            <strong>Note:</strong> {task.assignment_note}
                          </div>
                        )}
                      </div>

                      <div className="d-flex justify-content-between align-items-center border-top pt-2">
  <div className="text-muted small">
  </div>
  
  <div className="d-flex">
    <Button 
      variant="outline-secondary" 
      size="sm" 
      onClick={() => onEdit(task)}
      className="me-2"
    >
      <FiEdit /> Modifier
    </Button>
    <Button 
      variant="outline-danger" 
      size="sm" 
      onClick={() => onDelete(task.id)}
    >
      <FiTrash2 /> Supprimer
    </Button>
  </div>

                      </div>
                    </Card.Body>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </Card.Body>
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

export default function WorkflowPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const document = location.state?.document;
  const token = localStorage.getItem('token');

  const [workflow, setWorkflow] = useState(null);
  const [steps, setSteps] = useState([]);
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showDiagram, setShowDiagram] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [hasGeneratedTasks, setHasGeneratedTasks] = useState(false);
  const [tasks, setTasks] = useState([]); // État pour stocker les tâches
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [newAssignee, setNewAssignee] = useState("");
  const [reassignReason, setReassignReason] = useState("");
  const [taskToReassign, setTaskToReassign] = useState(null);


  const [taskForm, setTaskForm] = useState({ 
    title: '', 
    description: '', 
    due_date: '', 
    priority: 'moyenne', 
    assigned_to: [] 
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [wfRes, logRes, tasksRes] = await Promise.all([
        axios.get(`http://localhost:5000/api/workflows/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`http://localhost:5000/api/workflows/${id}/logs`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`http://localhost:5000/api/workflows/${id}/tasks`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      const tasks = tasksRes.data;
      const calculatedStatus = determineWorkflowStatus(tasks);
      
      // Si le statut a changé, mettez à jour le workflow
      if (wfRes.data.workflow.status !== calculatedStatus) {
        await axios.patch(
          `http://localhost:5000/api/workflows/${id}`,
          { status: calculatedStatus },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        // Recharger les données après mise à jour
        const updatedWfRes = await axios.get(
          `http://localhost:5000/api/workflows/${id}`, 
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setWorkflow(updatedWfRes.data.workflow);
      } else {
        setWorkflow(wfRes.data.workflow);
      }
      
      setSteps(wfRes.data.steps);
      setLogs(logRes.data);
      setTasks(tasks);
    } catch (err) {
      toast.error('Erreur de chargement des données');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    axios.get('http://localhost:5000/api/auth/users', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setUsers(res.data.map(u => ({ value: u.id, label: u.name }))))
      .catch(() => toast.error("Impossible de charger les utilisateurs"));
  }, [token]);

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

  const openCreateTask = () => {
    setEditingTask(null);
    setTaskForm({ 
      title: '', 
      description: '', 
      due_date: '', 
      priority: 'moyenne', 
      assigned_to: [] 
    });
    setShowTaskModal(true);
  };

  const handleSaveTask = async () => {
    try {
      const payload = { 
        ...taskForm, 
        workflow_id: id, 
        assigned_to: JSON.stringify(taskForm.assigned_to.map(u => u.value))
      };
      console.log("📦 Payload:", payload); // Ajoute ceci
      if (editingTask) {
        await axios.put(
          `http://localhost:5000/api/tasks/${editingTask.id}`, 
          payload, 
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Tâche mise à jour');
      } else {
        await axios.post(
          'http://localhost:5000/api/tasks', 
          payload, 
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Tâche créée');
      }
      setShowTaskModal(false);
      fetchAll();
    } catch {
      toast.error("Erreur lors de la sauvegarde de la tâche");
    }
  };

  
const generateTasks = async () => {
  try {
    // Calculer une date de référence future (par exemple, 2 jours à partir d'aujourd'hui)
    const referenceDate = new Date();
    referenceDate.setDate(referenceDate.getDate() + 2);
    
    const prompt = `Voici le nom d'un workflow : ${workflow.name} et sa description : ${workflow.description}.\n
    Génère une liste de tâches au format JSON, chaque tâche doit avoir les champs suivants : 
    title, description, due_date (au format YYYY-MM-DD, doit être postérieure à ${referenceDate.toISOString().split('T')[0]}) et type (validation/operation). 
    Inclure au moins une tâche de type 'validation' pour le directeur.`;
    
    const response = await axios.post(
      `http://localhost:5000/api/workflows/${id}/generate-tasks`, 
      { prompt }, 
      { headers: { Authorization: `Bearer ${token}` } }
    );

    // Assigner automatiquement les tâches
    await axios.post(
      `http://localhost:5000/api/workflows/${id}/assign-tasks`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );

    toast.success('Tâches générées et assignées avec succès');
    setHasGeneratedTasks(true);
    fetchAll();
  } catch (err) {
    toast.error(err.response?.data?.message || "Erreur lors de la génération des tâches");
  }
};
  const handleEditTask = (task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title || task.name || '', // Gère les deux cas (steps et tasks)
      description: task.description || '',
      due_date: task.due_date ? format(parseISO(task.due_date), 'yyyy-MM-dd') : '',
      priority: task.priority || 'moyenne',
      assigned_to: (task.assigned_to || []).map(userId => {
        const match = users.find(u => u.value === userId);
        return {
          value: userId,
          label: match ? match.label : `Utilisateur ${userId}`
        };
      })
    });
    setShowTaskModal(true);
  };
  
  const handleDeleteTask = async (taskId) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette tâche ?")) {
      try {
        await axios.delete(
          `http://localhost:5000/api/tasks/${taskId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Tâche supprimée');
        fetchAll();
      } catch {
        toast.error("Erreur lors de la suppression");
      }
    }
  };

  const analyzeLogsWithAI = async () => {
    try {
      setIsAnalyzing(true);
      const logsText = logs.map(log => log.message).join('\n');
      
      // Vérification que l'ID est bien défini
      if (!id) {
        throw new Error("ID du workflow non disponible");
      }
  
      const response = await axios.post(
        `http://localhost:5000/api/workflows/${id}/analyze-logs`, 
        { 
          prompt: logsText,
          workflowInfo: {  // Ajoutez ces informations si votre backend les utilise
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

  const determineWorkflowStatus = (tasks) => {
    if (tasks.length === 0) return 'pending';
    
    const hasPending = tasks.some(t => t.status === 'pending');
    const hasInProgress = tasks.some(t => t.status === 'in_progress');
    const allCompleted = tasks.every(t => t.status === 'completed');
    
    if (hasPending) return 'pending';
    if (hasInProgress) return 'in_progress';
    if (allCompleted) return 'completed';
    
    return 'pending';
  };

 // Dans Workflowz.js
 useEffect(() => {
  const checkAndArchive = async () => {
    if (workflow?.status === 'completed') {
      try {
        // Vérifier d'abord si le workflow est déjà archivé
        const archiveCheck = await axios.get(
          `http://localhost:5000/api/workflows/archives?workflow_id=${id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (archiveCheck.data.length === 0) { // Si pas encore archivé
          await axios.post(
            `http://localhost:5000/api/workflows/${id}/archive`,
            { validation_report: "Workflow complété automatiquement" },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          toast.success('Workflow archivé avec succès');
        }
      } catch (err) {
        console.error("Erreur lors de l'archivage:", err);
        toast.error("Échec de l'archivage automatique");
      }
    }
  };

  checkAndArchive();
}, [workflow?.status, id, token]);
  

const handleReassign = async (taskId) => {
  try {
    if (!newAssignee) {
      toast.error("Veuillez sélectionner un nouvel assigné");
      return;
    }

    const response = await axios.post(
      `http://localhost:5000/api/workflows/${id}/tasks/${taskId}/reassign`,
      {
        newAssigneeId: newAssignee.value, // Utiliser .value car c'est un Select
        reason: reassignReason
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    if (response.data.success) {
      toast.success('Tâche réassignée avec succès');
      setShowReassignModal(false);
      fetchAll();
    } else {
      toast.error(response.data.error || "Erreur lors de la réassignation");
    }
  } catch (err) {
    toast.error(err.response?.data?.error || "Erreur lors de la réassignation");
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
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h1 className="fw-bold mb-1">{workflow.name}</h1>
              <p className="text-muted mb-0">{workflow.description}</p>
            </div>
            <div className="d-flex gap-2">
              <OverlayTrigger placement="bottom" overlay={<Tooltip>Actualiser les données</Tooltip>}>
                <Button variant="outline-secondary" onClick={fetchAll}>
                  <FiRefreshCw />
                </Button>
              </OverlayTrigger>
              <Button variant="primary" onClick={analyzeLogsWithAI} disabled={isAnalyzing}>
                {isAnalyzing ? 'Analyse en cours...' : 'Analyser avec IA'}
              </Button>
            </div>
          </div>

          {/* Panneau de statistiques */}
          <StatsPanel workflow={workflow} steps={steps} />




          {/* Diagramme de workflow */}
          <Card className="mb-4">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Visualisation du workflow</h5>
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

          {/* Liste des tâches */}
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Tâches du workflow</h5>
              <div className="d-flex gap-2">
                <OverlayTrigger 
  placement="top" 
  overlay={
    <Tooltip>
      {hasGeneratedTasks 
        ? "Les tâches ont déjà été générées automatiquement" 
        : "Générer automatiquement des tâches basées sur le workflow"}
    </Tooltip>
  }
>
  <Button 
    variant={hasGeneratedTasks ? "outline-secondary" : "outline-primary"} 
    size="sm" 
    onClick={generateTasks}
    disabled={hasGeneratedTasks}
  >
    <FiPlus className="me-1" />
    {hasGeneratedTasks ? (
      <>
        <FiCheckCircle className="me-1" />
        Généré
      </>
    ) : "Générer"}
  </Button>
</OverlayTrigger>
                <Button variant="success" size="sm" onClick={openCreateTask}>
                  <FiPlus className="me-1" /> Nouvelle tâche
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
            <TasksPanel 
  tasks={tasks} 
  onEdit={handleEditTask}
  onDelete={handleDeleteTask}
/>
            </Card.Body>
          </Card>
        </motion.div>
      </div>

      {/* Modal de création/édition de tâche */}
      <Modal show={showTaskModal} onHide={() => setShowTaskModal(false)} centered style={{ zIndex: 1050, width: '100%' }}>
        <Modal.Header closeButton>
          <Modal.Title>{editingTask ? 'Modifier la tâche' : 'Nouvelle tâche'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Titre</Form.Label>
              <Form.Control 
                type="text" 
                value={taskForm.title}
                onChange={(e) => setTaskForm({...taskForm, title: e.target.value})}
                placeholder="Nom de la tâche"
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control 
                as="textarea" 
                rows={3}
                value={taskForm.description}
                onChange={(e) => setTaskForm({...taskForm, description: e.target.value})}
                placeholder="Description détaillée"
              />
            </Form.Group>
            
            <Row className="mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Date d'échéance</Form.Label>
                  <Form.Control 
                    type="date" 
                    value={taskForm.due_date}
                    onChange={(e) => setTaskForm({...taskForm, due_date: e.target.value})}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Priorité</Form.Label>
                  <Form.Select 
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({...taskForm, priority: e.target.value})}
                  >
                    <option value="haute">Haute</option>
                    <option value="moyenne">Moyenne</option>
                    <option value="basse">Basse</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            
            <Form.Group className="mb-3">
              <Form.Label>Assigner à</Form.Label>
              <Select
                isMulti
                options={users}
                value={taskForm.assigned_to}
                onChange={(selected) => setTaskForm({...taskForm, assigned_to: selected})}
                placeholder="Sélectionner des utilisateurs..."
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowTaskModal(false)}>
            Annuler
          </Button>
          <Button variant="primary" onClick={handleSaveTask}>
            {editingTask ? 'Enregistrer' : 'Créer'}
          </Button>
        </Modal.Footer>
      </Modal>
      {/* Modal de réassignation */}
<Modal show={showReassignModal} onHide={() => setShowReassignModal(false)}>
  <Modal.Header closeButton>
    <Modal.Title>Réassigner la tâche: {taskToReassign?.title}</Modal.Title>
  </Modal.Header>
  <Modal.Body>
    <Form>
      <Form.Group className="mb-3">
        <Form.Label>Nouvel assigné</Form.Label>
        <Select
          options={users}
          onChange={(selected) => setNewAssignee(selected.value)}
          placeholder="Sélectionner un utilisateur..."
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>Raison</Form.Label>
        <Form.Control
          as="textarea"
          rows={3}
          value={reassignReason}
          onChange={(e) => setReassignReason(e.target.value)}
          placeholder="Pourquoi réassigner cette tâche?"
        />
      </Form.Group>
    </Form>
  </Modal.Body>
  <Modal.Footer>
    <Button variant="secondary" onClick={() => setShowReassignModal(false)}>
      Annuler
    </Button>
    <Button variant="warning" onClick={() => {
      handleReassign(taskToReassign.id);
      setShowReassignModal(false);
    }}>
      Confirmer la réassignation
    </Button>
  </Modal.Footer>
</Modal>

    </>
  );
}