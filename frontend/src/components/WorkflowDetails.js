import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import "bootstrap/dist/css/bootstrap.min.css";
import { Button, Form, Modal, Table, Pagination } from "react-bootstrap";
import Select from "react-select";
import OverdueAlert from "./Alerts";

const Details = () => {
  const { id } = useParams();
  console.log("ID du workflow :", id);
  const [workflowInfo, setWorkflowInfo] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
const [filterPriority, setFilterPriority] = useState('');
const [filterDueDate, setFilterDueDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [nameError, setNameError] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: '',
    priority: '',
    assigned_to: [],
    file: null,
    notify: false,
    workflow_id: id,
  });

  const tasksPerPage = 10;
  const [groups, setGroups] = useState([]);

  // Définir les hooks avant les conditions
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUserId(decoded.id);
      } catch (err) {
        console.error("Erreur de décodage du token :", err);
      }
    }
  }, []);

  useEffect(() => {
    const fetchWorkflow = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get("http://localhost:5000/api/workflows", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
  
        const found = response.data.find((wf) => wf.id === parseInt(id)); // Vérifie que id est bien un entier
        console.log("Workflow trouvé :", found); // Vérification de la valeur trouvée
        if (found) {
          setWorkflowInfo(found);
        } else {
          setError("Workflow introuvable");
        }
      } catch (err) {
        setError("Erreur lors de la récupération des workflows");
      } finally {
        setLoading(false);
      }
    };
  
    fetchWorkflow();
  }, [id]);
  

  useEffect(() => {
    fetchTasks();
    fetchUsers();
    fetchGroups();
  }, []); // Il est OK d'avoir useEffect sans dépendances ici

  const fetchTasks = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`http://localhost:5000/api/workflows/${id}/tasks`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      setTasks(res.data); // Pas besoin de filtrer, le backend le fait déjà
    } catch (err) {
      console.error("Erreur chargement des tâches", err?.response?.data || err.message);
    }
  };
  
  

  const fetchUsers = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/auth/users/");
      const formatted = res.data.map(u => ({ value: u.id, label: `${u.name} ${u.prenom}` }));
      setUsers(formatted);
    } catch (err) {
      console.error("Erreur chargement des utilisateurs", err);
    }
  };

  const fetchGroups = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await axios.get('http://localhost:5000/api/groups/', {
        headers: {
          Authorization: `Bearer ${token}`,
        }
      });
      setGroups(res.data);
    } catch (err) {
      console.error("Erreur chargement des groupes", err);
    }
  };

  // Rendre le JSX après tous les hooks
  if (loading) return <div className="container mt-5">Chargement...</div>;
  if (error) return <div className="container mt-5 text-danger">{error}</div>;

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
        notify: false,
        workflow_id: id
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

    setNameError('');  // Réinitialise l'erreur avant chaque soumission

    // Vérification si une tâche avec le même nom existe déjà dans le workflow
    // Vérification si une tâche avec le même nom existe déjà dans le workflow
  const existingTask = tasks.find(task => task.title.toLowerCase() === formData.title.toLowerCase());

  if (existingTask) {
    setNameError('Une tâche avec ce nom existe déjà dans ce workflow!');
    return;
  }

    const data = new FormData();
    const user = JSON.parse(localStorage.getItem('user'));
  
    // Ajout des données du formulaire
    for (const key in formData) {
      if (key === 'assigned_to') {
        data.append(key, JSON.stringify(formData[key]));
      } else if (formData[key]) {
        data.append(key, formData[key]);
      }
    }
  
    // Ajout du workflow_id
    const workflowIdToUse = workflowInfo?.id || id;
    if (workflowIdToUse) {
      console.log("Ajout du workflow_id:", workflowIdToUse);
      data.set('workflow_id', workflowIdToUse); // Utilisation de .set ici
    } else {
      console.error("workflow_id introuvable !");
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
        const newTask = response.data;  // Assurez-vous que le backend renvoie les informations de la tâche créée, y compris son ID
        const taskId = newTask.id;
        console.log("ID de la nouvelle tâche :", taskId); // Vous pouvez maintenant utiliser cet ID comme vous en avez besoin

        console.log('FormData ID:', taskId);
        const notificationData = {
          user_id: formData.assigned_to,  // ID de l'utilisateur assigné
          message: `Vous avez une nouvelle tâche : ${formData.title}`,
          type: 'task',  // Type de la notification (peut être utilisé pour filtrer dans l'interface utilisateur)
          related_task_id: taskId ? taskId: null, 
          created_at: new Date()
        };
  
        try {
          await axios.post('http://localhost:5000/api/notifications', notificationData, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`
            }
          });
          console.log("Notification interne envoyée");
        } catch (err) {
          console.error("Erreur lors de l'envoi de la notification interne", err);
        }
      }
  
      // Notification par email si la tâche est nouvellement créée
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
          console.log("Notification par email envoyée");
        } catch (err) {
          console.error("Erreur lors de l'envoi de la notification par email", err);
        }
      }
  
      // Rafraîchir les tâches et fermer le modal
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



  const filteredTasks = userTasks.filter(task => {
    const searchMatch =
      task.title?.toLowerCase().includes(search.toLowerCase()) ||
      task.description?.toLowerCase().includes(search.toLowerCase());
  
    const statusMatch = filterStatus === "" || task.status === filterStatus;
    const priorityMatch = filterPriority === "" || task.priority === filterPriority;
  
    // Gérer le filtre d’échéance
    const now = new Date();
    const taskDueDate = new Date(task.due_date);
    let dueDateMatch = true;
  
    if (filterDueDate === "upcoming") {
      dueDateMatch = taskDueDate >= now;
    } else if (filterDueDate === "overdue") {
      dueDateMatch = taskDueDate < now;
    }
  
    return searchMatch && statusMatch && priorityMatch && dueDateMatch;
  });
  
  
  const currentTasks = filteredTasks.slice((currentPage - 1) * tasksPerPage, currentPage * tasksPerPage);

 
  
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
  
  const isFormValid = formData.title.trim() !== '' &&
                    formData.due_date.trim() !== '' &&
                    formData.priority.trim() !== '' &&
                    formData.assigned_to.length > 0;


                    const getStatusColor = (status) => {
                        switch (status) {
                          case 'pending':
                            return 'secondary'; // gris
                          case 'in_progress':
                            return 'primary'; // bleu
                          case 'completed':
                            return 'success'; // vert
                          case 'cancelled':
                            return 'danger'; // rouge
                          default:
                            return 'secondary';
                        }
                      };
                      
                      const getStatusIcon = (status) => {
                        switch (status) {
                          case 'pending':
                            return '⏳';
                          case 'in_progress':
                            return '🔧';
                          case 'completed':
                            return '✅';
                          case 'cancelled':
                            return '❌';
                          default:
                            return '';
                        }
                      };
                      
                      const getStatusLabel = (status) => {
                        switch (status) {
                          case 'pending':
                            return 'En attente';
                          case 'in_progress':
                            return 'En cours';
                          case 'completed':
                            return 'Terminée';
                          case 'cancelled':
                            return 'Annulée';
                          default:
                            return '';
                        }
                      };
                      

  return (
    <div className="container-fluid mt-4">
        {/* Tâches */}
            <div className="card-body m-4">
            <div className="d-flex justify-content-between flex-wrap align-items-center my-3">
  {/* Bloc gauche : Boutons */}
  <div className="d-flex gap-2 flex-wrap">
    <Button onClick={() => openModal(null)} className="btn btn-primary">
      Nouvelle Tâche
    </Button>
    <a href="/workflow" className="btn btn-secondary">
      Retour page workflow
    </a>
  </div>

  {/* Bloc droit : Filtres + recherche */}
  <div className="d-flex gap-2 flex-wrap justify-content-end">
    <Form.Select
      style={{ width: '160px' }}
      value={filterStatus}
      onChange={e => setFilterStatus(e.target.value)}
    >
      <option value="">Tous les statuts</option>
      <option value="pending">En attente</option>
      <option value="cancelled">Annulée</option>
      <option value="in_progress">En cours</option>
      <option value="completed">Terminée</option>
    </Form.Select>

    <Form.Select
      style={{ width: '160px' }}
      value={filterPriority}
      onChange={e => setFilterPriority(e.target.value)}
    >
      <option value="">Toutes les priorités</option>
      <option value="Haute">Haute</option>
    <option value="Moyenne">Moyenne</option>
    <option value="Basse">Basse</option>
    </Form.Select>

    <Form.Select
      style={{ width: '160px' }}
      value={filterDueDate}
      onChange={e => setFilterDueDate(e.target.value)}
    >
      <option value="">Toutes les échéances</option>
      <option value="upcoming">À venir</option>
      <option value="overdue">En retard</option>
    </Form.Select>

    <Form.Control
      type="text"
      placeholder="Rechercher..."
      style={{ width: '200px' }}
      value={search}
      onChange={e => setSearch(e.target.value)}
    />
  </div>
</div>



            <OverdueAlert tasks={tasks} className="m-4" />
      <div className='m-4'>
          <Table striped bordered hover responsive m-4>
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
              {currentTasks.map(task => (
                <tr key={task.id}>
                  <td>{task.title}</td>
                  <td>{task.description}</td>
                  <td>
  {task.file_path && (
    <a href={`http://localhost:5000${task.file_path}`} target="_blank" rel="noreferrer">
      <i className="bi bi-file-earmark-text" style={{ fontSize: '1.5rem' }}></i>
    </a>
  )}
</td>
                  <td>
                    {users
                      .filter(u => task.assigned_to?.includes(u.value))
                      .map(u => u.label)
                      .join(', ')}
                  </td>
                  <td>{new Date(task.due_date).toLocaleDateString()}</td>
                  <td>{task.priority}</td>
                  
                  <td>
  <span className={`badge bg-${getStatusColor(task.status)} text-white`}>
    {getStatusIcon(task.status)} {getStatusLabel(task.status)}
  </span>
</td>
                    <td>{task.assignment_note || 'Aucune note'}</td>

                  <td>
                    <Button size="sm" variant="warning" onClick={() => openModal(task)}>Modifier</Button>{' '}
                    <Button size="sm" variant="danger" onClick={() => handleDelete(task.id)}>Supprimer</Button>{' '}

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
              <Form.Label>
  Titre { !editingTask && <span style={{ color: 'red' }}>*</span> }
</Form.Label>
              <Form.Control name="title" value={formData.title} onChange={handleInputChange} required />
              {!editingTask && nameError && <Form.Text className="text-danger">{nameError}</Form.Text>} {/* Affichage de l'erreur */}
            
            </Form.Group>
            <Form.Group>
              <Form.Label>Description</Form.Label>
              <Form.Control as="textarea" name="description" value={formData.description} onChange={handleInputChange} />
            </Form.Group>
           <Form.Group>
  <Form.Label>Échéance { !editingTask && <span style={{ color: 'red' }}>*</span> }</Form.Label>
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
              <Form.Label>Priorité { !editingTask && <span style={{ color: 'red' }}>*</span> }</Form.Label>
              <Form.Select name="priority" value={formData.priority} onChange={handleInputChange} required>
                <option value="">Choisir...</option>
                <option value="Haute">Haute</option>
                <option value="Moyenne">Moyenne</option>
                <option value="Basse">Basse</option>
              </Form.Select>
            </Form.Group>
            <Form.Group>
  <Form.Label>Assigner à { !editingTask && <span style={{ color: 'red' }}>*</span> }</Form.Label>
  <Select
    isMulti
    required
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

            <Button
  variant="primary"
  type="submit"
  className="mt-3"
  disabled={!editingTask && !isFormValid} // 👈 disable seulement en mode ajout
>
  {editingTask ? 'Modifier' : 'Ajouter Tâche'} 
</Button>

          </Form>
        </Modal.Body>
      </Modal>
            </div>
          </div>
  );
};

export default Details;
 