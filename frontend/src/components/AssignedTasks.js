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
    cancelled: 0,
    in_progress: 0,
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

  useEffect(() => {
   const fetchTasks = async () => {
  if (!userId || !token) return;

  try {
    const response = await axios.get('http://localhost:5000/api/tasks/mes-taches', axiosConfig);
    
    // Filtrer les tâches assignées ET non bloquées
    const assignedTasks = response.data.filter(task => {
      return task.assigned_to?.includes(userId) && task.status !== 'blocked';
    });

    setTasks(assignedTasks);
    
    // Mise à jour des stats (optionnel - retirez "blocked" si nécessaire)
    const statusCounts = {
      pending: 0,
      cancelled: 0,
      in_progress: 0,
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

    if (token && userId) fetchTasks();
  }, [userId, token]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'secondary';
      case 'cancelled': return 'danger';
      case 'in_progress': return 'primary';
      case 'completed': return 'success';
      default: return 'light';
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const res = await fetch(`http://localhost:5000/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error('Erreur lors de la mise à jour du statut');

      const updatedTask = await res.json();

      setTasks(prev =>
        prev.map(task => (task.id === taskId ? updatedTask : task))
      );
    } catch (error) {
      console.error("Erreur de mise à jour automatique :", error);
      alert("❌ Impossible de changer le statut !");
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'haute': return 'danger';
      case 'moyenne': return 'warning';
      case 'basse': return 'info';
      default: return 'secondary';
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
      alert("❌ Impossible d’ajouter le commentaire");
    }
  };

  // Logique de filtrage des tâches
  const [statusFilter, setStatusFilter] = useState(''); // Filtre par statut
  const [priorityFilter, setPriorityFilter] = useState(''); // Filtre par priorité
  const [creatorFilter, setCreatorFilter] = useState(''); // Filtre par créateur
  const [dateFilter, setDateFilter] = useState(''); // Filtre par date

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
    const token = localStorage.getItem('token'); // Récupère le token JWT du localStorage
    const axiosConfig = {
      headers: {
        Authorization: `Bearer ${token}`, // Ajoute le token dans les en-têtes
      },
    };
  
    axios.get('http://localhost:5000/api/workflows', axiosConfig)
      .then(res => setWorkflows(res.data))
      .catch(err => console.error("Erreur récupération workflows", err));
  }, []); 
  
  const getWorkflowName = (id) => {
  const wf = workflows.find(w => w.id === id);
  return wf ? wf.name : '---';
};


  return (
    <div>
      <Navbar />

      <div className="d-flex justify-content-end align-items-center m-4" style={{ flexWrap: 'nowrap' }}>
  <Form.Control
    as="select"
    value={statusFilter}
    onChange={e => setStatusFilter(e.target.value)}
    style={{ width: '150px', marginRight: '10px' }}
  >
    <option value="">Filtrer par statut</option>
    <option value="pending">En attente</option>
    <option value="cancelled">Annulée</option>
    <option value="in_progress">En cours</option>
    <option value="completed">Terminée</option>
  </Form.Control>
  <Form.Control
    as="select"
    value={priorityFilter}
    onChange={e => setPriorityFilter(e.target.value)}
    style={{ width: '150px', marginRight: '10px' }}
  >
    <option value="">Filtrer par priorité</option>
    <option value="Haute">Haute</option>
    <option value="Moyenne">Moyenne</option>
    <option value="Basse">Basse</option>
  </Form.Control>
  <Form.Control
    type="text"
    placeholder="Filtrer par créateur"
    value={creatorFilter}
    onChange={e => setCreatorFilter(e.target.value)}
    style={{ width: '200px', marginRight: '10px' }}
  />
  <Form.Control
    type="date"
    value={dateFilter}
    onChange={e => setDateFilter(e.target.value)}
    style={{ width: '180px', marginRight: '10px' }}
  />
  <Form.Control
    type="text"
    placeholder="Rechercher..."
    style={{ width: '250px' }}
    onChange={e => setSearch(e.target.value)}
  />
</div>



      <div className="row m-4">
  <div className="col-md-3">
    <div className="card text-white bg-success shadow">
      <div className="card-body">
        <h5 className="card-title">✅ Terminées</h5>
        <p className="card-text fs-4">{stats.completed}</p>
      </div>
    </div>
  </div>
  <div className="col-md-3">
    <div className="card text-white bg-primary shadow">
      <div className="card-body">
        <h5 className="card-title">🔧 En cours</h5>
        <p className="card-text fs-4">{stats.in_progress}</p>
      </div>
    </div>
  </div>
  <div className="col-md-3">
    <div className="card text-white bg-secondary shadow">
      <div className="card-body">
        <h5 className="card-title">⏳ En attente</h5>
        <p className="card-text fs-4">{stats.pending}</p>
      </div>
    </div>
  </div>
  <div className="col-md-3">
    <div className="card text-white bg-danger shadow">
      <div className="card-body">
        <h5 className="card-title">❌ Annulées</h5>
        <p className="card-text fs-4">{stats.cancelled}</p>
      </div>
    </div>
  </div>
</div>

      {error && <p className="text-danger">{error}</p>}

      {tasks.length === 0 ? (
        <p className='m-4'>Aucune tâche assignée.</p>
      ) : (
        <div className="m-4">
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>Tâche</th>
              <th>Workflow liée</th>
              <th>Échéance</th>
              <th>Crée par</th>
              <th>Priorité</th>
              <th>Statut</th>
              <th>Actions</th>

            </tr>
          </thead>
          <tbody>
             {currentTasks.map(task => (
             <tr
             key={task.id}
             className={
               new Date(task.due_date) < new Date() && task.status !== 'completed' ? 'table-danger' : ''
             }
           >
           
                <td>{task.title}</td>
                <td>{getWorkflowName(task.workflow_id)}</td>
                <td>{new Date(task.due_date).toLocaleDateString()}<br/>      
  {(() => {
    const today = new Date();
    const dueDate = new Date(task.due_date);
    const diffTime = dueDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (task.status === "completed") {
      return "✅ Terminée";
    }

    return diffDays >= 0 ? `${diffDays} jour(s)` : "⛔ Dépassée";
  })()}
</td>
                <td>{task.created_by_name}</td>
                <td className={getPriorityColor(task.priority)}>
                    {task.priority}
                </td>
                <td>
                  <select
                    value={task.status}
                    className={`form-select form-select-sm bg-${getStatusColor(task.status)} text-white`}
                    onChange={(e) => handleStatusChange(task.id, e.target.value)}
                  >
                    <option value="pending" className="text-dark">⏳ En attente</option>
                    <option value="cancelled" className="text-dark">❌ Annulée</option>
                    <option value="in_progress" className="text-dark">🔧 En cours</option>
                    <option value="completed" className="text-dark">✅ Terminée</option>
                  </select>
                </td>
                <td>
  <Button
    size="sm"
    variant="info"
    onClick={() => navigate(`/details_taches/${task.id}`)}
  >
    📄 Détails
  </Button>
</td>


              </tr>
            ))}
          </tbody>
        </Table>
        </div>
      )}

        {/* Pagination */}
         <div className="m-4">   
        <Pagination>
                {Array.from({ length: Math.ceil(filteredTasks.length / tasksPerPage) }, (_, idx) => (
                <Pagination.Item
                    key={idx + 1}
                    active={idx + 1 === currentPage}
                    onClick={() => setCurrentPage(idx + 1)}
                >
                    {idx + 1}
                </Pagination.Item>
                ))}
            </Pagination>
</div>
      <Modal show={showModal} onHide={handleCloseModal}  style={{ zIndex: 1050 }}
  backdrop="static"
  centered>
        <Modal.Header closeButton>
            <Modal.Title>💬 Note sur la tâche</Modal.Title>
        </Modal.Header>
        <Modal.Body>
            <Form>
            <Form.Group controlId="commentTextArea">
                <Form.Label>Note</Form.Label>
                <Form.Control
                as="textarea"
                rows={4}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Ajoutez une note ici..."
                />
            </Form.Group>
            </Form>
        </Modal.Body>
        <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal}>
            Annuler
            </Button>
            <Button variant="primary" onClick={handleSaveComment}>
            💾 Enregistrer
            </Button>
        </Modal.Footer>
        </Modal>

    </div>
  );
  
};

export default AssignedTasks;
