import React, { useEffect, useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import { Modal, Button, Form, Table, Pagination, Badge } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Navbar from './Navbar';
import Chatbot from './chatbot';
import OverdueAlertWorkflow from './AlertsWorkflow';
import {jwtDecode} from 'jwt-decode';
import BpmnViewer from './Bpmn';
import { FiGitBranch } from 'react-icons/fi';
import { ProgressBar } from 'react-bootstrap';


const Workflow = () => {
  const [workflows, setWorkflows] = useState([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [userId, setUserId] = useState(null);
  const workflowsPerPage = 10;
  const navigate = useNavigate();
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [aiSuggestionLoading, setAiSuggestionLoading] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const decoded = jwtDecode(token);
      setUserId(decoded.id);
    }
  }, []);

  useEffect(() => {
    fetchWorkflows();
    fetchUsers();
    fetchTasks();
  }, []);

  const fetchWorkflows = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/workflows', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWorkflows(res.data);
    } catch (err) {
      console.error('Erreur chargement des workflows', err);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/auth/users/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const formatted = res.data.map(u => ({ value: u.id, label: `${u.name} ${u.prenom}` }));
      setUsers(formatted);
    } catch (err) {
      console.error('Erreur chargement des utilisateurs', err);
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/tasks', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTasks(res.data);
    } catch (err) {
      console.error("Erreur lors du chargement des tâches", err);
    }
  }, []);

  const getWorkflowStatus = (workflowId) => {
    const workflowTasks = tasks.filter(task => task.workflow_id === workflowId);
    if (workflowTasks.length === 0) return 'pending';

    const statuses = workflowTasks.map(task => task.status);
    if (statuses.every(s => s === 'completed')) return 'completed';
    if (statuses.includes('pending')) return 'pending';
    if (statuses.includes('cancelled')) return 'cancelled';
    if (statuses.includes('in_progress')) return 'in_progress';

    return 'pending';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'secondary';
      case 'in_progress': return 'primary';
      case 'completed': return 'success';
      case 'cancelled': return 'danger';
      default: return 'secondary';
    }
  };
  
  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'in_progress': return '🔧';
      case 'completed': return '✅';
      case 'cancelled': return '❌';
      default: return '';
    }
  };
  
  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending': return 'En attente';
      case 'in_progress': return 'En cours';
      case 'completed': return 'Terminée';
      case 'cancelled': return 'Annulée';
      default: return '';
    }
  };

  const getPriorityBadge = (priority) => {
    let variant = 'secondary';
    if (priority === 'élevée') variant = 'danger';
    else if (priority === 'moyenne') variant = 'warning';
    else if (priority === 'faible') variant = 'success';
    
    return <Badge bg={variant}>{priority}</Badge>;
  };

  const getTaskProgress = (workflowId) => {
    const workflowTasks = tasks.filter(task => task.workflow_id === workflowId);
    if (workflowTasks.length === 0) return { completed: 0, total: 0, percentage: 0 };
    
    const completed = workflowTasks.filter(t => t.status === 'completed').length;
    const percentage = Math.round((completed / workflowTasks.length) * 100);
    
    return { completed, total: workflowTasks.length, percentage };
  };

  function formatDateForInput(dateStr) {
    const date = new Date(dateStr);
    const timezoneOffset = date.getTimezoneOffset() * 60000;
    const localISODate = new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10);
    return localISODate;
  }

  const filteredWorkflows = useMemo(() => {
    return workflows.filter(wf => {
      const status = getWorkflowStatus(wf.id, tasks);
      const matchesUser = wf.created_by === userId || (wf.assigned_to || []).includes(userId);
      const matchesSearch = wf.name?.toLowerCase().includes(search.toLowerCase()) || 
                          wf.description?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = !filterStatus || status === filterStatus;
      const matchesPriority = !filterPriority || wf.priorite === filterPriority;
      const matchesDate = !dateFilter || (wf.echeance && formatDateForInput(wf.echeance) === dateFilter);

      return matchesUser && matchesSearch && matchesStatus && matchesPriority && matchesDate;
    });
  }, [workflows, tasks, search, filterStatus, filterPriority, dateFilter, userId]);

  const currentWorkflows = useMemo(() => {
    return filteredWorkflows.slice((currentPage - 1) * workflowsPerPage, currentPage * workflowsPerPage);
  }, [filteredWorkflows, currentPage]);

  const handleDetailsClick = useCallback((workflowId) => {
    navigate(`/details_workflow/${workflowId}`);
  }, [navigate]);

  const [showModal, setShowModal] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState({
    name: '', description: '', echeance: '', priorite: ''
  });
  const [nameError, setNameError] = useState('');
  const [editingWorkflow, setEditingWorkflow] = useState(null);

  const handleModalClose = () => {
    setShowModal(false);
    setNewWorkflow({ name: '', description: '', echeance: '', priorite: '' });
    setEditingWorkflow(null);
  };

  const handleModalShow = () => setShowModal(true);

  const handleCreateWorkflow = async () => {
    const { name, description, echeance, priorite } = newWorkflow;
    
    if (!name.trim() || !description.trim() || !echeance || !priorite) {
      toast.error("Veuillez remplir tous les champs obligatoires (*) !");
      return;
    }
    
    const workflowExists = workflows.some(wf => wf.name.toLowerCase() === name.trim().toLowerCase());
    
    if (workflowExists) {
      setNameError('Un workflow avec ce nom existe déjà !');
      return;
    } else {
      setNameError('');
    }

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('http://localhost:5000/api/workflows', {
        ...newWorkflow,
        created_by: userId,
        status: 'pending'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWorkflows([...workflows, res.data]);
      toast.success("Workflow créé !");
      handleModalClose();
    } catch (err) {
      console.error('Erreur création workflow', err);
      toast.error("Erreur création.");
    }
  };

  const handleEditClick = (wf) => {
    setEditingWorkflow({ ...wf });
    setShowModal(true);
  };

  const handleUpdateWorkflow = async () => {
    try {
      const token = localStorage.getItem('token');
      const calculatedStatus = getWorkflowStatus(editingWorkflow.id);
      const res = await axios.put(`http://localhost:5000/api/workflows/${editingWorkflow.id}`, {
        ...editingWorkflow,
        status: calculatedStatus
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWorkflows(prev => prev.map(wf => wf.id === res.data.id ? res.data : wf));
      toast.success("Workflow mis à jour !");
      handleModalClose();
    } catch (err) {
      console.error("Erreur update", err);
      toast.error("Erreur lors de la mise à jour.");
    }
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedWorkflowName, setSelectedWorkflowName] = useState('');

  const handleDeleteConfirm = (id, name) => {
    setSelectedWorkflowId(id);
    setSelectedWorkflowName(name);
    setShowDeleteModal(true);
  };
  
  const confirmDeleteWorkflow = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:5000/api/workflows/${selectedWorkflowId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWorkflows(prev => prev.filter(wf => wf.id !== selectedWorkflowId));
      toast.success("Workflow supprimé !");
      setShowDeleteModal(false);
    } catch (err) {
      console.error("Erreur suppression", err);
      toast.error("Erreur suppression.");
    }
  };

  const suggestDescription = async (title) => {
    setAiSuggestionLoading(true);
    try {
      const res = await axios.post('http://localhost:5000/api/ai/suggest_description', { title });
      setNewWorkflow(prev => ({ ...prev, description: res.data.description }));
    } catch (err) {
      toast.error("Erreur IA : Impossible de suggérer la description");
    } finally {
      setAiSuggestionLoading(false);
    }
  };

  return (
    <div className="container-fluid g-0">
      <Navbar />
      <Chatbot />

      <div className="m-4 d-flex justify-content-between align-items-center flex-wrap gap-3">
        <div className="d-flex align-items-center gap-2 flex-wrap justify-content-end ms-auto">
          <Form.Select
            style={{ width: '200px' }}
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="">Tous les statuts</option>
            <option value="pending">En attente</option>
            <option value="cancelled">Annulé</option>
            <option value="in_progress">En cours</option>
            <option value="completed">Terminé</option>
          </Form.Select>

          <Form.Select
            style={{ width: '200px' }}
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
          >
            <option value="">Toutes les priorités</option>
            <option value="élevée">Haute</option>
            <option value="moyenne">Moyenne</option>
            <option value="faible">Basse</option>
          </Form.Select>

          <Form.Control
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            style={{ width: '200px', marginRight: '10px' }}
          />

          <Form.Control
            type="text"
            placeholder="Rechercher..."
            style={{ width: '270px' }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="d-flex gap-2 align-items-end flex-wrap w-100 ms-4 mb-4">
        <Form.Control
          placeholder="Nom*"
          value={newWorkflow.name}
          onChange={e => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
          style={{ maxWidth: '250px' }}
          aria-label="Nom du workflow"
        />
        <Form.Control
          placeholder="Description*"
          value={newWorkflow.description}
          onChange={e => setNewWorkflow({ ...newWorkflow, description: e.target.value })}
          style={{ maxWidth: '250px' }}
          aria-label="Description du workflow"
        />
        <Form.Control
          type="date"
          value={newWorkflow.echeance}
          onChange={e => setNewWorkflow({ ...newWorkflow, echeance: e.target.value })}
          style={{ maxWidth: '220px' }}
          min={new Date().toISOString().split('T')[0]} 
          aria-label="Date d'échéance"
        />
        <Form.Select
          value={newWorkflow.priorite}
          onChange={e => setNewWorkflow({ ...newWorkflow, priorite: e.target.value })}
          style={{ maxWidth: '220px' }}
          aria-label="Priorité"
        >
          <option value="">Priorité*</option>
          <option value="élevée">Haute</option>
          <option value="moyenne">Moyenne</option>
          <option value="faible">Basse</option>
        </Form.Select>

        <Button
          variant="primary"
          onClick={handleCreateWorkflow}
          disabled={
            !newWorkflow.name.trim() ||
            !newWorkflow.description.trim() ||
            !newWorkflow.echeance ||
            !newWorkflow.priorite
          }
        >
          Créer un workflow
        </Button>
        {nameError && <Form.Text className="text-danger">{nameError}</Form.Text>}
      </div>

      {editingWorkflow && (
        <Modal show={showModal} onHide={handleModalClose} style={{ zIndex: 1050, width: '100%' }}>
          <Modal.Header closeButton>
            <Modal.Title>Modifier un workflow</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form>
              <Form.Group>
                <Form.Label>Nom</Form.Label>
                <Form.Control
                  type="text"
                  value={editingWorkflow.name}
                  onChange={e => setEditingWorkflow({ ...editingWorkflow, name: e.target.value })}
                />
              </Form.Group>
              <Form.Group className="mt-2">
                <Form.Label>Description</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={editingWorkflow.description}
                  onChange={e => setEditingWorkflow({ ...editingWorkflow, description: e.target.value })}
                />
              </Form.Group>
              <Form.Group className="mt-2">
                <Form.Label>Échéance</Form.Label>
                <Form.Control
                  type="date"
                  value={formatDateForInput(editingWorkflow.echeance)}
                  onChange={e => setEditingWorkflow({ ...editingWorkflow, echeance: e.target.value })}
                />
              </Form.Group>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleModalClose}>Annuler</Button>
            <Button variant="primary" onClick={handleUpdateWorkflow}>Modifier</Button>
          </Modal.Footer>
        </Modal>
      )}

      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} style={{ zIndex: 1050, width: '100%' }}>
        <Modal.Header closeButton>
          <Modal.Title>Confirmer la suppression</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Êtes-vous sûr de vouloir supprimer le workflow <strong>"{selectedWorkflowName}"</strong> ?
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Annuler</Button>
          <Button variant="danger" onClick={confirmDeleteWorkflow}>Supprimer</Button>
        </Modal.Footer>
      </Modal>

      <OverdueAlertWorkflow workflows={workflows} className="m-4"/>

      <div className='m-4'>
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>Workflow</th>
              <th>Description</th>
              <th>Échéance</th>
              <th>Statut</th>
              <th>Progression</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentWorkflows.map(wf => {
              const status = getWorkflowStatus(wf.id);
              const progress = getTaskProgress(wf.id);
              return (
                <tr key={wf.id}>
                  <td>{wf.name}</td>
                  <td>{wf.description ? wf.description : "-"}</td>
                  <td>{new Date(wf.echeance).toLocaleDateString()}</td>
                  <td>
                    <span className={`badge bg-${getStatusColor(status)} text-white`}>
                      {getStatusIcon(status)} {getStatusLabel(status)}
                    </span>
                  </td>
                  <td>
                    {progress.total > 0 ? (
                      <>
                        <div className="d-flex justify-content-between small mb-1">
                          <span>{progress.completed}/{progress.total} tâches</span>
                          <span>{progress.percentage}%</span>
                        </div>
                        <ProgressBar 
                          now={progress.percentage} 
                          variant={progress.percentage === 100 ? 'success' : 'primary'}
                          style={{ height: '5px' }}
                        />
                      </>
                    ) : 'Aucune tâche'}
                  </td>
                  <td>
                    <Button variant="warning" size="sm" className="me-2" onClick={() => handleEditClick(wf)} title="Modifier">
                      <i className="bi bi-pencil-square"></i>
                    </Button>

                    <Button variant="danger" size="sm" className="me-2" onClick={() => handleDeleteConfirm(wf.id, wf.name)} title="Supprimer">
                      <i className="bi bi-trash"></i>
                    </Button>

                    <Button variant="info" size="sm" className="me-2" onClick={() => handleDetailsClick(wf.id)} title="Tâches">
                      <i className="bi bi-list-ul"></i>
                    </Button>

                    <Button 
                      variant="outline-primary" 
                      size="sm" 
                      title="Voir le diagramme BPMN"
                      onClick={() => setSelectedWorkflowId(wf.id)}
                    >
                      <FiGitBranch />

                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </Table>
        
        {selectedWorkflowId && (
          <div className="mt-4">
            <h4>Diagramme BPMN du workflow</h4>
            <BpmnViewer workflowId={selectedWorkflowId} />
          </div>
        )}

        <Pagination className="mt-3">
          {[...Array(Math.ceil(filteredWorkflows.length / workflowsPerPage)).keys()].map(number => (
            <Pagination.Item
              key={number + 1}
              active={number + 1 === currentPage}
              onClick={() => setCurrentPage(number + 1)}
            >
              {number + 1}
            </Pagination.Item>
          ))}
        </Pagination>
      </div>
    </div>
  );
};

export default Workflow;