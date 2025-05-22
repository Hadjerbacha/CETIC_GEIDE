import React, { useEffect, useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import { Modal, Button, Form, Table, Pagination, Badge, Accordion, Tab, Tabs } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Navbar from './Navbar';
import Chatbot from './chatbot';
import OverdueAlertWorkflow from './AlertsWorkflow';
import { jwtDecode } from 'jwt-decode';
import BpmnViewer from './Bpmn';
import { FiGitBranch } from 'react-icons/fi';
import { ProgressBar } from 'react-bootstrap';
import Select from 'react-select';

const WorkflowWithTasks = () => {
  // États pour les workflows
  const [workflows, setWorkflows] = useState([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
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
  const [expandedWorkflow, setExpandedWorkflow] = useState(null);

  // États pour les tâches
  const [taskSearch, setTaskSearch] = useState('');
  const [taskFilterStatus, setTaskFilterStatus] = useState('');
  const [taskFilterPriority, setTaskFilterPriority] = useState('');
  const [taskFilterDueDate, setTaskFilterDueDate] = useState('');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskNameError, setTaskNameError] = useState('');
  const [taskFormData, setTaskFormData] = useState({
    title: '',
    description: '',
    due_date: '',
    priority: '',
    assigned_to: [],
    file: null,
    notify: false,
    workflow_id: null,
  });

  // États pour les workflows (création/édition)
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState({
    name: '', description: '', echeance: '', priorite: ''
  });
  const [nameError, setNameError] = useState('');
  const [editingWorkflow, setEditingWorkflow] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedWorkflowName, setSelectedWorkflowName] = useState('');

  // Récupération des données initiales
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
    fetchGroups();
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

  const fetchGroups = useCallback(async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await axios.get('http://localhost:5000/api/groups/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGroups(res.data);
    } catch (err) {
      console.error("Erreur chargement des groupes", err);
    }
  }, []);

 const fetchTasks = async (workflowId) => {
  try {
    const token = localStorage.getItem("token");
    const res = await axios.get(`http://localhost:5000/api/workflows/${workflowId}/tasks`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    setTasks(prev => {
      // Filtrer les tâches existantes pour ce workflow et ajouter les nouvelles
      const otherTasks = prev.filter(task => task.workflow_id !== workflowId);
      return [...otherTasks, ...res.data];
    });
  } catch (err) {
    console.error("Erreur chargement des tâches", err);
    setTasks(prev => prev.filter(task => task.workflow_id !== workflowId));
  }
};

  const fetchTasksForWorkflow = async (workflowId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:5000/api/workflows/${workflowId}/tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    } catch (err) {
      console.error("Erreur chargement des tâches du workflow", err);
      return [];
    }
  };

  // Fonctions utilitaires pour les workflows
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
    if (workflowTasks.length === 0) return { 
      completed: 0, 
      inProgress: 0, 
      pending: 0,
      total: 0, 
      percentage: 0 
    };

    const completed = workflowTasks.filter(t => t.status === 'completed').length;
    const inProgress = workflowTasks.filter(t => t.status === 'in_progress').length;
    const pending = workflowTasks.length - completed - inProgress;
    const percentage = Math.round((completed / workflowTasks.length) * 100);

    return { 
      completed,
      inProgress,
      pending,
      total: workflowTasks.length,
      percentage
    };
  };

  function formatDateForInput(dateStr) {
    const date = new Date(dateStr);
    const timezoneOffset = date.getTimezoneOffset() * 60000;
    const localISODate = new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10);
    return localISODate;
  }

  // Filtrage et pagination des workflows
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

  // Filtrage des tâches pour le workflow sélectionné
  const filteredTasks = useMemo(() => {
    if (!expandedWorkflow) return [];
    
    return tasks
      .filter(task => task.workflow_id === expandedWorkflow)
      .filter(task => {
        const searchMatch =
          task.title?.toLowerCase().includes(taskSearch.toLowerCase()) ||
          task.description?.toLowerCase().includes(taskSearch.toLowerCase());
      
        const statusMatch = taskFilterStatus === "" || task.status === taskFilterStatus;
        const priorityMatch = taskFilterPriority === "" || task.priority === taskFilterPriority;
      
        // Gérer le filtre d'échéance
        const now = new Date();
        const taskDueDate = new Date(task.due_date);
        let dueDateMatch = true;
      
        if (taskFilterDueDate === "upcoming") {
          dueDateMatch = taskDueDate >= now;
        } else if (taskFilterDueDate === "overdue") {
          dueDateMatch = taskDueDate < now;
        }
      
        return searchMatch && statusMatch && priorityMatch && dueDateMatch;
      });
  }, [tasks, expandedWorkflow, taskSearch, taskFilterStatus, taskFilterPriority, taskFilterDueDate]);

  // Gestion des workflows
  const handleWorkflowModalClose = () => {
    setShowWorkflowModal(false);
    setNewWorkflow({ name: '', description: '', echeance: '', priorite: '' });
    setEditingWorkflow(null);
  };

  const handleWorkflowModalShow = () => setShowWorkflowModal(true);

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
      handleWorkflowModalClose();
    } catch (err) {
      console.error('Erreur création workflow', err);
      toast.error("Erreur création.");
    }
  };

  const handleEditWorkflowClick = (wf) => {
    setEditingWorkflow({ ...wf });
    setShowWorkflowModal(true);
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
      handleWorkflowModalClose();
    } catch (err) {
      console.error("Erreur update", err);
      toast.error("Erreur lors de la mise à jour.");
    }
  };

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

  // Gestion des tâches
  const openTaskModal = (workflowId, task = null) => {
    if (task) {
      const assigned = Array.isArray(task.assigned_ids)
        ? task.assigned_ids
        : Array.isArray(task.assigned_to)
          ? (typeof task.assigned_to[0] === 'object'
              ? task.assigned_to.map(u => u.id)
              : task.assigned_to)
          : [];
  
      setEditingTask(task);
      setTaskFormData({
        title: task.title,
        description: task.description,
        due_date: formatDateForInput(task.due_date),
        priority: task.priority,
        assigned_to: assigned,
        file: null,
        fileName: task.file_name || '',
        notify: false,
        workflow_id: workflowId
      });
    } else {
      resetTaskForm(workflowId);
    }
    setShowTaskModal(true);
  };

  const resetTaskForm = (workflowId) => {
    setEditingTask(null);
    setTaskFormData({
      title: '',
      description: '',
      due_date: '',
      priority: '',
      assigned_to: [],
      file: null,
      notify: false,
      workflow_id: workflowId
    });
  };

  const closeTaskModal = () => {
    setShowTaskModal(false);
  };

  const handleTaskInputChange = e => {
    const { name, value, type, checked, files } = e.target;
    setTaskFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'file' ? files[0] : value
    }));
  };

  const handleTaskSelectChange = selected => {
    setTaskFormData(prev => ({ ...prev, assigned_to: selected.map(s => s.value) }));
  };

  const handleTaskSubmit = async e => {
    e.preventDefault();

    setTaskNameError('');  // Réinitialise l'erreur avant chaque soumission

    // Vérification si une tâche avec le même nom existe déjà dans le workflow
    const existingTask = tasks.find(task => 
      task.title.toLowerCase() === taskFormData.title.toLowerCase() && 
      task.workflow_id === taskFormData.workflow_id &&
      (!editingTask || task.id !== editingTask.id)
    );

    if (existingTask) {
      setTaskNameError('Une tâche avec ce nom existe déjà dans ce workflow!');
      return;
    }

    const data = new FormData();
    const user = JSON.parse(localStorage.getItem('user'));
  
    // Ajout des données du formulaire
    for (const key in taskFormData) {
      if (key === 'assigned_to') {
        data.append(key, JSON.stringify(taskFormData[key]));
      } else if (taskFormData[key]) {
        data.append(key, taskFormData[key]);
      }
    }
  
    // Ajout du workflow_id
    if (taskFormData.workflow_id) {
      data.set('workflow_id', taskFormData.workflow_id);
    }
  
    // Ajout du créateur
    if (user?.id) {
      data.append('created_by', user.id);
    }
  
    // Définir l'URL de l'API
    const endpoint = editingTask
      ? `http://localhost:5000/api/tasks/${editingTask.id}`
      : 'http://localhost:5000/api/tasks/';
  
    try {
      // Envoi des données pour la création ou mise à jour de la tâche
      const response = await axios({
        method: editingTask ? 'put' : 'post',
        url: endpoint,
        data,
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
  
      // Si la tâche est nouvellement créée, récupérer son ID
      if (!editingTask) {
        const newTask = response.data;
        const taskId = newTask.id;
        
        if (taskFormData.notify) {
          const notificationData = {
            user_id: taskFormData.assigned_to,
            message: `Vous avez une nouvelle tâche : ${taskFormData.title}`,
            type: 'task',
            related_task_id: taskId,
            created_at: new Date()
          };
    
          try {
            await axios.post('http://localhost:5000/api/notifications', notificationData, {
              headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`
              }
            });
          } catch (err) {
            console.error("Erreur lors de l'envoi de la notification interne", err);
          }
        }
      }
  
      // Rafraîchir les tâches et fermer le modal
      await fetchTasks();
      closeTaskModal();
  
    } catch (err) {
      console.error("Erreur d'enregistrement :", err);
    }
  };

  const handleDeleteTask = async id => {
    if (window.confirm("Confirmer la suppression ?")) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`http://localhost:5000/api/tasks/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        await fetchTasks();
      } catch (err) {
        console.error("Erreur suppression :", err);
      }
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error('Erreur lors de la mise à jour du statut');
      const updatedTask = await res.json();
      setTasks(tasks.map(task => task.id === taskId ? updatedTask : task));
    } catch (err) {
      console.error(err);
      alert("Impossible de changer le statut !");
    }
  };

  // Options pour le sélecteur d'assignation
  const userOptions = users.map(user => ({
    label: user.label,
    value: user.value,
    type: 'user'
  }));
  
  const groupOptions = groups.map(group => ({
    label: group.nom,
    value: group.id,
    type: 'group'
  }));
  
  const groupedOptions = [
    {
      label: 'Utilisateurs',
      options: userOptions
    },
    {
      label: 'Groupes',
      options: groupOptions
    }
  ];

  const isTaskFormValid = taskFormData.title.trim() !== '' &&
                        taskFormData.due_date.trim() !== '' &&
                        taskFormData.priority.trim() !== '' &&
                        taskFormData.assigned_to.length > 0;

  // Toggle l'affichage des tâches d'un workflow
  const toggleWorkflowTasks = async (workflowId) => {
    if (expandedWorkflow === workflowId) {
      setExpandedWorkflow(null);
    } else {
      setExpandedWorkflow(workflowId);
      // Charger les tâches si elles ne sont pas déjà chargées
      if (!tasks.some(task => task.workflow_id === workflowId)) {
        const workflowTasks = await fetchTasksForWorkflow(workflowId);
        setTasks(prev => [...prev, ...workflowTasks]);
      }
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
            placeholder="Rechercher des workflows..."
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
                <React.Fragment key={wf.id}>
                  <tr>
                    <td>
                      <Button 
                        variant="link" 
                        onClick={() => toggleWorkflowTasks(wf.id)}
                        className="p-0 text-decoration-none"
                      >
                        {wf.name}
                      </Button>
                    </td>
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
                            <span>
                              {progress.completed} terminées / {progress.inProgress} en cours / {progress.total} tâches
                            </span>
                            <span>{progress.percentage}%</span>
                          </div>
                          <ProgressBar>
                            <ProgressBar 
                              variant="success" 
                              now={(progress.completed / progress.total) * 100} 
                              key={1} 
                              label={`${progress.completed}`}
                            />
                            <ProgressBar 
                              variant="warning" 
                              now={(progress.inProgress / progress.total) * 100} 
                              key={2} 
                              label={`${progress.inProgress}`}
                            />
                            <ProgressBar 
                              variant="secondary" 
                              now={(progress.pending / progress.total) * 100} 
                              key={3} 
                            />
                          </ProgressBar>
                        </>
                      ) : 'Aucune tâche'}
                    </td>
                    <td>
                      <Button variant="warning" size="sm" className="me-2" onClick={() => handleEditWorkflowClick(wf)} title="Modifier">
                        <i className="bi bi-pencil-square"></i>
                      </Button>

                      <Button variant="danger" size="sm" className="me-2" onClick={() => handleDeleteConfirm(wf.id, wf.name)} title="Supprimer">
                        <i className="bi bi-trash"></i>
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
                  
                  {/* Affichage des tâches du workflow */}
                  {expandedWorkflow === wf.id && (
                    <tr>
                      <td colSpan="6" className="p-0">
                        <div className="p-3 bg-light">
                          <div className="d-flex justify-content-between flex-wrap align-items-center my-3">
                            <div className="d-flex gap-2 flex-wrap">
                              <Button onClick={() => openTaskModal(wf.id)} className="btn btn-primary">
                                Nouvelle Tâche
                              </Button>
                            </div>

                            <div className="d-flex gap-2 flex-wrap justify-content-end">
                              <Form.Select
                                style={{ width: '160px' }}
                                value={taskFilterStatus}
                                onChange={e => setTaskFilterStatus(e.target.value)}
                              >
                                <option value="">Tous les statuts</option>
                                <option value="pending">En attente</option>
                                <option value="cancelled">Annulée</option>
                                <option value="in_progress">En cours</option>
                                <option value="completed">Terminée</option>
                              </Form.Select>

                              <Form.Select
                                style={{ width: '160px' }}
                                value={taskFilterPriority}
                                onChange={e => setTaskFilterPriority(e.target.value)}
                              >
                                <option value="">Toutes les priorités</option>
                                <option value="Haute">Haute</option>
                                <option value="Moyenne">Moyenne</option>
                                <option value="Basse">Basse</option>
                              </Form.Select>

                              <Form.Select
                                style={{ width: '160px' }}
                                value={taskFilterDueDate}
                                onChange={e => setTaskFilterDueDate(e.target.value)}
                              >
                                <option value="">Toutes les échéances</option>
                                <option value="upcoming">À venir</option>
                                <option value="overdue">En retard</option>
                              </Form.Select>

                              <Form.Control
                                type="text"
                                placeholder="Rechercher des tâches..."
                                style={{ width: '200px' }}
                                value={taskSearch}
                                onChange={e => setTaskSearch(e.target.value)}
                              />
                            </div>
                          </div>

                          <Table striped bordered hover responsive>
                            <thead>
                              <tr>
                                <th>Titre</th>
                                <th>Description</th>
                                <th>Documents liés</th>
                                <th>Assignée à</th>
                                <th>Échéance</th>
                                <th>Priorité</th>
                                <th>Statut</th>
                                <th>Note</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredTasks.map(task => {
                                const assignedTo = Array.isArray(task.assigned_to) ? task.assigned_to : [];
                                const dueDate = task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Non définie';
                                
                                return (
                                  <tr key={task.id}>
                                    <td>{task.title || 'Sans titre'}</td>
                                    <td>{task.description || 'Aucune description'}</td>
                                    <td>
                                      {task.file_path ? (
                                        <a href={`http://localhost:5000${task.file_path}`} target="_blank" rel="noreferrer">
                                          <i className="bi bi-file-earmark-text" style={{ fontSize: '1.5rem' }}></i>
                                        </a>
                                      ) : 'Aucun fichier'}
                                    </td>
                                    <td>
                                      {users
                                        .filter(u => assignedTo.includes(u.value))
                                        .map(u => u.label)
                                        .join(', ') || 'Non assignée'}
                                    </td>
                                    <td>{dueDate}</td>
                                    <td>{task.priority}</td>
                                    <td>
                                      <span className={`badge bg-${getStatusColor(task.status)} text-white`}>
                                        {getStatusIcon(task.status)} {getStatusLabel(task.status)}
                                      </span>
                                    </td>
                                    <td>{task.assignment_note || 'Aucune note'}</td>
                                    <td>
                                      <Button size="sm" variant="warning" onClick={() => openTaskModal(wf.id, task)}>Modifier</Button>{' '}
                                      <Button size="sm" variant="danger" onClick={() => handleDeleteTask(task.id)}>Supprimer</Button>{' '}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </Table>

                          {filteredTasks.length === 0 && (
                            <div className="text-center py-3">
                              Aucune tâche trouvée pour ce workflow
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
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

      {/* Modal pour l'édition/création de workflow */}
      <Modal show={showWorkflowModal} onHide={handleWorkflowModalClose} style={{ zIndex: 1050, width: '100%' }}>
        <Modal.Header closeButton>
          <Modal.Title>{editingWorkflow ? 'Modifier un workflow' : 'Créer un workflow'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group>
              <Form.Label>Nom</Form.Label>
              <Form.Control
                type="text"
                value={editingWorkflow ? editingWorkflow.name : newWorkflow.name}
                onChange={e => editingWorkflow 
                  ? setEditingWorkflow({ ...editingWorkflow, name: e.target.value })
                  : setNewWorkflow({ ...newWorkflow, name: e.target.value })
                }
              />
            </Form.Group>
            <Form.Group className="mt-2">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={editingWorkflow ? editingWorkflow.description : newWorkflow.description}
                onChange={e => editingWorkflow 
                  ? setEditingWorkflow({ ...editingWorkflow, description: e.target.value })
                  : setNewWorkflow({ ...newWorkflow, description: e.target.value })
                }
              />
            </Form.Group>
            <Form.Group className="mt-2">
              <Form.Label>Échéance</Form.Label>
              <Form.Control
                type="date"
                value={editingWorkflow 
                  ? formatDateForInput(editingWorkflow.echeance) 
                  : newWorkflow.echeance
                }
                onChange={e => editingWorkflow 
                  ? setEditingWorkflow({ ...editingWorkflow, echeance: e.target.value })
                  : setNewWorkflow({ ...newWorkflow, echeance: e.target.value })
                }
              />
            </Form.Group>
            <Form.Group className="mt-2">
              <Form.Label>Priorité</Form.Label>
              <Form.Select
                value={editingWorkflow ? editingWorkflow.priorite : newWorkflow.priorite}
                onChange={e => editingWorkflow 
                  ? setEditingWorkflow({ ...editingWorkflow, priorite: e.target.value })
                  : setNewWorkflow({ ...newWorkflow, priorite: e.target.value })
                }
              >
                <option value="">Sélectionner...</option>
                <option value="élevée">Haute</option>
                <option value="moyenne">Moyenne</option>
                <option value="faible">Basse</option>
              </Form.Select>
            </Form.Group>
            {nameError && <Form.Text className="text-danger">{nameError}</Form.Text>}
          </Form>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={handleWorkflowModalClose}>
            Annuler
          </Button>
          <Button 
            variant="primary" 
            onClick={editingWorkflow ? handleUpdateWorkflow : handleCreateWorkflow}
            disabled={
              !editingWorkflow && (
                !newWorkflow.name.trim() ||
                !newWorkflow.description.trim() ||
                !newWorkflow.echeance ||
                !newWorkflow.priorite
              )
            }
          >
            {editingWorkflow ? 'Mettre à jour' : 'Créer'}
          </Button>
        </Modal.Footer>
      </Modal>
      {/* Modal de confirmation de suppression */}

      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} style={{ zIndex: 1050 }}>
        <Modal.Header closeButton>
          <Modal.Title>Confirmer la suppression</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Êtes-vous sûr de vouloir supprimer le workflow "{selectedWorkflowName}" ?
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Annuler
          </Button>
          <Button variant="danger" onClick={confirmDeleteWorkflow}>
            Supprimer
          </Button>
        </Modal.Footer>


      </Modal>

      {/* Modal pour l'édition/création de tâche */}

      <Modal show={showTaskModal} onHide={closeTaskModal} style={{ zIndex: 1050 }}>

        <Modal.Header closeButton>

          <Modal.Title>{editingTask ? 'Modifier une tâche' : 'Créer une tâche'}</Modal.Title>
        </Modal.Header>

        <Modal.Body>

          <Form onSubmit={handleTaskSubmit}>

            <Form.Group className="mb-3">
              <Form.Label>Titre*</Form.Label>
              <Form.Control
                type="text"
                name="title"
                value={taskFormData.title}
                onChange={handleTaskInputChange}
                isInvalid={taskNameError !== ''}
              />
              <Form.Control.Feedback type="invalid">
                {taskNameError}
              </Form.Control.Feedback>

            </Form.Group>

            <Form.Group className="mb-3">

              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                name="description"
                rows={3}
                value={taskFormData.description}
                onChange={handleTaskInputChange}
                />
                </
Form.Group>


            <Form.Group className="mb-3">
              <Form.Label>Échéance*</Form.Label>
              <Form.Control
                type="date"
                name="due_date"
                value={taskFormData.due_date}
                onChange={handleTaskInputChange}
                min={new Date().toISOString().split('T')[0]} 
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Priorité*</Form.Label>
              <Form.Select
                name="priority"
                value={taskFormData.priority}
                onChange={handleTaskInputChange}
              >
                <option value="">Sélectionner...</option>
                <option value="Haute">Haute</option>
                <option value="Moyenne">Moyenne</option>
                <option value="Basse">Basse</option>
              </Form.Select>
              </
              Form.Group>
              
            <Form.Group className="mb-3">
              <Form.Label>Assignée à*</Form.Label>
              <Select
                isMulti
                options={groupedOptions}
                value={taskFormData.assigned_to.map(id => ({
                  label: users.find(u => u.value === id)?.label || groups.find(g => g.id === id)?.nom,
                  value: id
                }))}
                onChange={handleTaskSelectChange}
                styles={{
                  control: (base) => ({
                    ...base,
                    borderColor: taskFormData.assigned_to.length === 0 ? 'red' : base.borderColor,
                  }),
                }}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Fichier</Form.Label>
              <Form.Control
                type="file"
                name="file"
                onChange={handleTaskInputChange}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                label="Notifier les utilisateurs assignés"
                name="notify"
                checked={taskFormData.notify}
                onChange={handleTaskInputChange}
              />
              
            </Form.Group>
          </Form>
          
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={closeTaskModal}>
            Annuler
          </Button>
          <Button 
            variant="primary" 
            type="submit" 
            onClick={handleTaskSubmit}
            disabled={!isTaskFormValid}
          >
            {editingTask ? 'Mettre à jour' : 'Créer'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
    

  );
}
export default WorkflowWithTasks;