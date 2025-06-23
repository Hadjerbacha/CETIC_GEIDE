// src/pages/AssignedTasks.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Table, Pagination } from 'react-bootstrap';
import '../style/task.css';
import Navbar from './Navbar';
import { Modal, Button, Form } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

// Fonction pour décoder le token JWT
function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    console.error("Erreur de parsing du token :", e);
    return null;
  }
}

const AssignedTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [stats, setStats] = useState({
    pending: 0,
    rejected: 0,
    completed: 0,
  });
  const navigate = useNavigate();

  const token = localStorage.getItem('token');
  const decodedToken = token ? parseJwt(token) : null;
  const userId = decodedToken?.id;

  // Vérification du token et de l'ID de l'utilisateur
  useEffect(() => {
    console.log("Token:", token);
    console.log("User ID:", userId);
    if (!token || !userId) {
      setError('L\'utilisateur n\'est pas connecté ou les informations sont incorrectes.');
      console.error("Token ou userId non valides.");
    }
  }, [token, userId]);

  const axiosConfig = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
  
  const fetchTasks = async () => {
    if (!userId || !token) return;

    try {
      const response = await axios.get('http://localhost:5000/api/tasks/mes-taches', axiosConfig);
      
      // Filtrer les tâches assignées ET non bloquées
      const assignedTasks = response.data.filter(task => {
        return task.assigned_to?.includes(userId) && task.status !== 'blocked';
      });

      setTasks(assignedTasks);
      
      // Mise à jour des stats
      const statusCounts = {
        pending: 0,
        rejected: 0,
        completed: 0,
      };

      assignedTasks.forEach(task => {
        if (task.status in statusCounts) {
          statusCounts[task.status]++;
        }
      });

      setStats(statusCounts);
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

  useEffect(() => {
    if (token && userId) fetchTasks();
  }, [userId, token]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'var(--bs-gray-500)';
      case 'rejected': return 'var(--bs-danger)';
      case 'completed': return 'var(--bs-success)';
      default: return 'var(--bs-light)';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'haute': return 'var(--bs-danger)';
      case 'moyenne': return 'var(--bs-warning)';
      case 'basse': return 'var(--bs-info)';
      default: return 'var(--bs-secondary)';
    }
  };

  const handleOpenModal = (task) => {
    setSelectedTask(task);
    setCommentText(task.assignment_note || '');
    setShowModal(true);
  };
  
  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedTask(null);
    setCommentText('');
  };
  
  const handleSaveComment = async () => {
    try {
      const res = await axios.patch(`http://localhost:5000/api/tasks/${selectedTask.id}/comment`, {
        assignment_note: commentText,
      }, axiosConfig);
  
      // Met à jour la tâche localement
      setTasks(prev =>
        prev.map(task => (task.id === selectedTask.id ? res.data : task))
      );
  
      handleCloseModal();
    } catch (err) {
      console.error("Erreur d'ajout du commentaire :", err);
      alert("❌ Impossible d'ajouter le commentaire");
    }
  };

  // Logique de filtrage des tâches
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [creatorFilter, setCreatorFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const tasksPerPage = 10;
  const filteredTasks = tasks.filter(task => {
    return (
      (task.title?.toLowerCase().includes(search.toLowerCase()) ||
        task.description?.toLowerCase().includes(search.toLowerCase()) ||
        task.created_by_name?.toLowerCase().includes(search.toLowerCase())) &&
      (statusFilter ? task.status === statusFilter : true) &&
      (priorityFilter ? task.priority === priorityFilter : true) &&
      (creatorFilter ? task.created_by_name.toLowerCase().includes(creatorFilter.toLowerCase()) : true) &&
      (dateFilter ? new Date(task.due_date) <= new Date(dateFilter) : true)
    );
  });
  
  // Pagination des tâches filtrées
  const currentTasks = filteredTasks.slice((currentPage - 1) * tasksPerPage, currentPage * tasksPerPage);

  const [workflows, setWorkflows] = useState([]);
  useEffect(() => {
    const token = localStorage.getItem('token');
    const axiosConfig = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  
    axios.get('http://localhost:5000/api/workflows', axiosConfig)
      .then(res => setWorkflows(res.data))
      .catch(err => console.error("Erreur récupération workflows", err));
  }, []); 
  
  const getWorkflowName = (task) => {
  return task.workflow_name || '---';
};

  const renderStatus = (status) => {
    switch (status) {
      case 'pending': return '⏳ En attente';
      case 'rejected': return '❌ Refusée';
      case 'completed': return '✅ Terminée';
      default: return status;
    }
  };

  return (
    <div className="assigned-tasks-container">
      <Navbar />

      <div className="container-fluid px-4 py-3">
        {/* Header with stats */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1 className="fw-bold text-primary">Mes Tâches</h1>
          <div className="d-flex gap-3">
            <div className="stat-card bg-success bg-opacity-10 border border-success border-opacity-25 rounded-3 p-3">
              <div className="text-success fw-semibold">✅ Terminées</div>
              <div className="fs-3 fw-bold">{stats.completed}</div>
            </div>
            <div className="stat-card bg-secondary bg-opacity-10 border border-secondary border-opacity-25 rounded-3 p-3">
              <div className="text-secondary fw-semibold">⏳ En attente</div>
              <div className="fs-3 fw-bold">{stats.pending}</div>
            </div>
            <div className="stat-card bg-danger bg-opacity-10 border border-danger border-opacity-25 rounded-3 p-3">
              <div className="text-danger fw-semibold">❌ Refusées</div>
              <div className="fs-3 fw-bold">{stats.rejected}</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="filters-container bg-light p-4 rounded-4 shadow-sm mb-4">
          <div className="row g-3">
            <div className="col-md-3">
              <Form.Select 
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="form-select-modern"
              >
                <option value="">Tous les statuts</option>
                <option value="pending">En attente</option>
                <option value="rejected">Refusée</option>
                <option value="completed">Terminée</option>
              </Form.Select>
            </div>
            <div className="col-md-3">
              <Form.Control
                type="text"
                placeholder="Filtrer par créateur"
                value={creatorFilter}
                onChange={e => setCreatorFilter(e.target.value)}
                className="form-control-modern"
              />
            </div>
            <div className="col-md-2">
              <Form.Control
                type="date"
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                className="form-control-modern"
              />
            </div>
            <div className="col-md-4">
              <Form.Control
                type="text"
                placeholder="Rechercher..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="form-control-modern"
              />
            </div>
          </div>
        </div>

        {/* Tasks Table */}
        {error && <div className="alert alert-danger">{error}</div>}

        {tasks.length === 0 ? (
          <div className="empty-state text-center py-5">
            <i className="bi bi-inbox fs-1 text-muted"></i>
            <h4 className="mt-3">Aucune tâche assignée</h4>
            <p className="text-muted">Lorsque des tâches vous seront assignées, elles apparaîtront ici.</p>
          </div>
        ) : (
          <div className="card border-0 shadow-sm">
            <div className="card-body p-0">
              <div className="table-responsive">
                <Table hover className="mb-0">
                  <thead className="table-light">
                    <tr>
                      <th className="ps-4">Tâche</th>
                      <th>Workflow</th>
                      <th>Échéance</th>
                      <th>Créée par</th>
                      <th>Statut</th>
                      <th className="pe-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentTasks.map(task => (
                      <tr 
                        key={task.id}
                        className={
                          new Date(task.due_date) < new Date() && task.status !== 'completed' && 
                          task.status !== 'rejected'
                            ? 'table-warning' 
                            : ''
                        }
                      >
                        <td className="ps-4 fw-semibold">{task.title}</td>
                        <td>{getWorkflowName(task)}</td>
                        <td>
  <div className="d-flex flex-column">
    <span>{new Date(task.due_date).toLocaleDateString()}</span>
    <small className={
      task.status === "completed" 
        ? "text-success"
        : task.status === "rejected"
        ? "text-warning"  // ou une autre classe de couleur pour "refusé"
        : new Date(task.due_date) < new Date()
        ? "text-danger"
        : "text-muted"
    }>
      {(() => {
        const today = new Date();
        const dueDate = new Date(task.due_date);
        const diffTime = dueDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (task.status === "completed") {
          return "✅ Terminée";
        }
        if (task.status === "rejected") {
          return "❌ Refusé";  // ou l'icône de votre choix
        }

        return diffDays >= 0 
          ? `${diffDays} jour(s) restant(s)` 
          : "⛔ Dépassée";
      })()}
    </small>
  </div>
</td>
                        <td>{task.created_by_name}</td>
                        <td>
                          <span 
                            className="badge rounded-pill"
                            style={{
                              backgroundColor: getStatusColor(task.status),
                              color: 'white'
                            }}
                          >
                            {renderStatus(task.status)}
                          </span>
                        </td>
                        <td className="pe-4">
                          <Button
                            size="sm"
                            variant="outline-primary"
                            className="rounded-pill"
                            onClick={() => navigate(`/details_taches/${task.id}`)}
                          >
                            <i className="bi bi-eye me-1"></i> Détails
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </div>
          </div>
        )}

        {/* Pagination */}
        {filteredTasks.length > tasksPerPage && (
          <div className="d-flex justify-content-center mt-4">
            <Pagination className="rounded-pill shadow-sm">
              {Array.from({ length: Math.ceil(filteredTasks.length / tasksPerPage) }, (_, idx) => (
                <Pagination.Item
                  key={idx + 1}
                  active={idx + 1 === currentPage}
                  onClick={() => setCurrentPage(idx + 1)}
                  className="px-3 py-2"
                >
                  {idx + 1}
                </Pagination.Item>
              ))}
            </Pagination>
          </div>
        )}

        {/* Comment Modal */}
        <Modal show={showModal} onHide={handleCloseModal} centered backdrop="static">
          <Modal.Header closeButton className="border-0 pb-0">
            <Modal.Title className="fw-bold">📝 Note sur la tâche</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form>
              <Form.Group controlId="commentTextArea">
                <Form.Control
                  as="textarea"
                  rows={5}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Ajoutez vos commentaires ici..."
                  className="form-control-modern"
                />
              </Form.Group>
            </Form>
          </Modal.Body>
          <Modal.Footer className="border-0">
            <Button 
              variant="outline-secondary" 
              onClick={handleCloseModal}
              className="rounded-pill px-4"
            >
              Annuler
            </Button>
            <Button 
              variant="primary" 
              onClick={handleSaveComment}
              className="rounded-pill px-4"
            >
              <i className="bi bi-save me-1"></i> Enregistrer
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    </div>
  );
};

export default AssignedTasks;