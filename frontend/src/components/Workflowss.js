import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Modal, Button, Form, Table, Pagination } from 'react-bootstrap';
import Select from 'react-select';
import Navbar from './Navbar';
import Chatbot from './chatbot';
import OverdueAlert from './Alerts';
import {jwtDecode} from 'jwt-decode';
import './Details';

const Workflowss = () => {
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: '',
    priority: '',
    assigned_to: [],
    file: null,
    notify: false,
  });

  const tasksPerPage = 10;
  useEffect(() => {
    // Fonction à exécuter au chargement de la page
    (function () {
    })();
    // Récupérer le jeton JWT depuis le stockage local
    const token = localStorage.getItem('token');
    console.log("tokennnnnnnn",token)

    if (token) {
      // Déchiffrer le jeton JWT pour obtenir les informations de l'utilisateur
      const decodedUser = jwtDecode(token);
      console.log("user",decodedUser)

  
      
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchUsers();
  }, []); // Notez que fetchTasks n'est plus inclus dans le tableau des dépendances si vous ne voulez pas qu'il se réexécute.
  
  const fetchTasks = async () => {
    try {
      const token = localStorage.getItem('token'); // ✅ Directement ici
  
      if (!token) {
        console.error("Token manquant");
        return;
      }
  
      const res = await axios.get('http://localhost:5000/api/tasks/', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setTasks(res.data);
    } catch (err) {
      console.error('Erreur chargement des tâches', err?.response?.data || err.message);
    }
  };
  
  

  const fetchUsers = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/auth/users/');
      const formatted = res.data.map(u => ({ value: u.id, label: `${u.name} ${u.prenom}` }));
      setUsers(formatted);
    } catch (err) {
      console.error('Erreur chargement des utilisateurs', err);
    }
  };

  const formatDateForInput = (dateString) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const openModal = task => {
    if (task) {
      const assigned =
        Array.isArray(task.assigned_ids)
          ? task.assigned_ids
          : Array.isArray(task.assigned_to)
            ? (typeof task.assigned_to[0] === 'object'
                ? task.assigned_to.map(u => u.id)
                : task.assigned_to)
            : [];
  
      setEditingTask(task);
      setFormData({
        title: task.title,
        description: task.description,
        due_date: formatDateForInput(task.due_date),
        priority: task.priority,
        assigned_to: assigned,
        file: null,
        fileName: task.file_name || '',
        notify: false
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };
  

  const resetForm = () => {
    setEditingTask(null);
    setFormData({
      title: '',
      description: '',
      due_date: '',
      priority: '',
      assigned_to: [],
      file: null,
      notify: false
    });
  };

  const closeModal = () => {
    resetForm();
    setShowModal(false);
  };

  const handleInputChange = e => {
    const { name, value, type, checked, files } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'file' ? files[0] : value
    }));
  };

  const handleSelectChange = selected => {
    setFormData(prev => ({ ...prev, assigned_to: selected.map(s => s.value) }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    const data = new FormData();
  
    const user = JSON.parse(localStorage.getItem('user')); // 👈 Récupération du user connecté
  
    for (const key in formData) {
      if (key === 'assigned_to') {
        data.append(key, JSON.stringify(formData[key]));
      } else if (formData[key]) {
        data.append(key, formData[key]);
      }
    }
  
    if (user?.id) {
      data.append('created_by', user.id); // 👈 Ajout de created_by dans FormData
    }
  
    const endpoint = editingTask
      ? `http://localhost:5000/api/tasks/${editingTask.id}`
      : 'http://localhost:5000/api/tasks/';
  
    try {
      await axios({
        method: editingTask ? 'put' : 'post',
        url: endpoint,
        data,
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${localStorage.getItem('token')}` // 👈 Auth si besoin
        }
      });
      if (!editingTask && formData.notify) {
        try {
          await axios.post('http://localhost:5000/api/tasks/notify', {
            assigned_to: formData.assigned_to,
            title: formData.title,
            description: formData.description,
            due_date: formData.due_date,
          }, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`
            }
          });
          console.log("Notification envoyée");
        } catch (err) {
          console.error("Erreur lors de l'envoi de la notification", err);
        }
      }
      
      fetchTasks();
      closeModal();
    } catch (err) {
      console.error("Erreur d'enregistrement :", err);
    }
  };
  

  const handleDelete = async id => {
    if (window.confirm("Confirmer la suppression ?")) {
      try {
        const token = localStorage.getItem('token'); // ou sessionStorage selon ton app
        await axios.delete(`http://localhost:5000/api/tasks/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        fetchTasks();
      } catch (err) {
        console.error("Erreur suppression :", err);
      }
    }
  };
  
  const user = JSON.parse(localStorage.getItem('user'));

  const userTasks = tasks.filter(task =>
    task.created_by === user.id || (task.assigned_to || []).includes(user.id)
  );
  
  const filteredTasks = userTasks.filter(task =>
    task.title?.toLowerCase().includes(search.toLowerCase()) ||
    task.description?.toLowerCase().includes(search.toLowerCase())
  );
  
  const currentTasks = filteredTasks.slice((currentPage - 1) * tasksPerPage, currentPage * tasksPerPage);

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'secondary';
      case 'assigned': return 'info';
      case 'in_progress': return 'warning';
      case 'completed': return 'success';
      default: return 'light';
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

  const [groups, setGroups] = useState([]);

  const fetchGroups = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await axios.get('http://localhost:5000/api/groups/', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setGroups(res.data);
    } catch (err) {
      console.error("Erreur chargement des groupes", err);
    }
  };
  

useEffect(() => {
  fetchGroups();
}, []);

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
  
  
  return (
    <div className="container-fluid g-0">
      <Navbar />
      <br/>
      <Chatbot /> 
      <div className="d-flex justify-content-between align-items-center m-4">
        <Button onClick={() => openModal(null)}>Nouvelle Tâche</Button>
        <Form.Control
          type="text"
          placeholder="Rechercher..."
          style={{ width: '300px' }}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <br/> 
      <OverdueAlert tasks={tasks} className="m-4" />
      <div className='m-4'>
          <Table striped bordered hover responsive m-4>
            <thead>
              <tr>
                <th>Titre</th>
                <th>Description</th>
                <th>Échéance</th>
                <th>Priorité</th>
                <th>Fichier</th>
                <th>Statut</th>
                <th>Assignée à</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentTasks.map(task => (
                <tr key={task.id}>
                  <td>{task.title}</td>
                  <td>{task.description}</td>
                  <td>{new Date(task.due_date).toLocaleDateString()}</td>
                  <td>{task.priority}</td>
                  <td>
                    {task.file_path && (
                      <a href={`http://localhost:5000${task.file_path}`} target="_blank" rel="noreferrer">Voir</a>
                    )}
                  </td>
                  <td>
      <select
        value={task.status}
        className={`form-select form-select-sm bg-${getStatusColor(task.status)} text-white`}
        onChange={(e) => handleStatusChange(task.id, e.target.value)}
      >
        <option value="pending" className="text-dark">⏳ En attente</option>
        <option value="assigned" className="text-dark">📌 Assignée</option>
        <option value="in_progress" className="text-dark">🔧 En cours</option>
        <option value="completed" className="text-dark">✅ Terminée</option>
      </select>
          </td>

          <td>
            {users
              .filter(u => task.assigned_to?.includes(u.value))
              .map(u => u.label)
              .join(', ')}
          </td>

                  <td>
                    <Button size="sm" variant="warning" onClick={() => openModal(task)}>Modifier</Button>{' '}
                    <Button size="sm" variant="danger" onClick={() => handleDelete(task.id)}>Supprimer</Button>{' '}
                    <Button size="sm" variant="info" onClick={() => window.location.href = `./details/${task.id}`}>Détails</Button>

                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
      </div>
<div className='m-4'>
      <Pagination  m-4 style={{ zIndex: 100, position: "relative"}}>
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
      {/* MODAL */}
      <Modal show={showModal} onHide={closeModal}  style={{ zIndex: 1050, width: '100%' }}
  backdrop="static"
  centered>
        <Modal.Header closeButton>
          <Modal.Title>{editingTask ? 'Modifier Tâche' : 'Nouvelle Tâche'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group>
              <Form.Label>Titre</Form.Label>
              <Form.Control name="title" value={formData.title} onChange={handleInputChange} required />
            </Form.Group>
            <Form.Group>
              <Form.Label>Description</Form.Label>
              <Form.Control as="textarea" name="description" value={formData.description} onChange={handleInputChange} required />
            </Form.Group>
            <Form.Group>
  <Form.Label>Échéance</Form.Label>
  <Form.Control
    type="date"
    name="due_date"
    value={formData.due_date}
    onChange={handleInputChange}
    min={new Date().toISOString().split('T')[0]} // 👉 empêche les dates passées
    required
  />
</Form.Group>
            <Form.Group>
              <Form.Label>Priorité</Form.Label>
              <Form.Select name="priority" value={formData.priority} onChange={handleInputChange}>
                <option value="">Choisir...</option>
                <option value="Haute">Haute</option>
                <option value="Moyenne">Moyenne</option>
                <option value="Basse">Basse</option>
              </Form.Select>
            </Form.Group>
            <Form.Group>
  <Form.Label>Assigner à</Form.Label>
  <Select
    isMulti
    options={groupedOptions}
    value={groupedOptions
      .flatMap(group => group.options)
      .filter(option => formData.assigned_to.includes(option.value))}
    onChange={(selectedOptions) => {
      const selectedValues = selectedOptions.map(opt => opt.value);
      setFormData(prev => ({ ...prev, assigned_to: selectedValues }));
    }}
  />
</Form.Group>

            <Form.Group>
  <Form.Label>Fichier</Form.Label>
  <Form.Control type="file" name="file" onChange={handleInputChange} />
  
  {/* Affiche le fichier existant si on édite une tâche et qu'un fichier est présent */}
  {editingTask && formData.fileName && (
    <div className="mt-2">
      <small className="text-muted">
        Fichier existant :{" "}
        <a
          href={`http://localhost:5000${editingTask.file_path}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {formData.fileName}
        </a>
      </small>
    </div>
  )}
</Form.Group>

            <Form.Group controlId="notifyCheckbox">
  <Form.Check
    type="checkbox"
    label="Envoyer une notification"
    name="notify"
    checked={formData.notify}
    onChange={handleInputChange}
  />
</Form.Group>

            <Button variant="primary" type="submit" className="mt-3">
              {editingTask ? 'Modifier' : 'Créer'}
            </Button>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default Workflowss;
