import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Button, Card, Alert, Modal } from 'react-bootstrap';
import { jwtDecode } from 'jwt-decode';

const DetailsTask = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [comment, setComment] = useState('');
  const [responseFile, setResponseFile] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchTask = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/tasks/mes-taches', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const taskData = response.data.find(t => t.id.toString() === id);
        if (taskData) {
          setTask(taskData);
          setComment(taskData.assignment_note || '');
        }
      } catch (error) {
        console.error('Erreur lors de la récupération des tâches :', error);
      }
    };

    fetchTask();
  }, [id, token]);

  const handleCommentChange = (e) => setComment(e.target.value);
  const handleFileChange = (e) => setResponseFile(e.target.files[0]);

  const handleUpdate = async () => {
    try {
      // 1. Mise à jour du commentaire
      await axios.patch(`http://localhost:5000/api/tasks/${id}/comment`, {
        user_id: task.created_by,
        assignment_note: comment
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      // 2. Envoi du fichier de réponse
      if (responseFile) {
        const formData = new FormData();
        formData.append('responseFile', responseFile);
        formData.append('comment', comment);
        
        await axios.post(
          `http://localhost:5000/api/tasks/${id}/upload-response`,
          formData, 
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            }
          }
        );
      }

      setSuccessMessage('Mise à jour réussie !');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Erreur lors de la mise à jour :', error);
      alert(error.response?.data?.error || 'Erreur lors de la mise à jour.');
    }
  };

  const handleStatusChange = async () => {
    try {
      if (selectedStatus === 'rejected' && !rejectionReason) {
        alert('Veuillez fournir une raison pour le refus');
        return;
      }

      const updateData = {
        status: selectedStatus
      };

      if (selectedStatus === 'rejected') {
        updateData.rejection_reason = rejectionReason;
      }

      await axios.patch(`http://localhost:5000/api/tasks/${id}/status`, updateData, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      // Envoyer une notification au créateur
      const decodedToken = jwtDecode(token);
      const currentUserId = decodedToken.id;
      
      await axios.post('http://localhost:5000/api/notifications', {
        user_id: task.created_by,
        sender_id: currentUserId,
        message: selectedStatus === 'completed' 
          ? `La tâche "${task.title}" a été marquée comme terminée` 
          : `La tâche "${task.title}" a été refusée`,
        type: 'task',
        related_task_id: task.id,
        is_read: false
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      setSuccessMessage(`Statut mis à jour: ${selectedStatus === 'completed' ? 'Terminée' : 'Refusée'}`);
      setTimeout(() => {
        setSuccessMessage('');
        navigate('/mes-taches');
      }, 2000);
    } catch (error) {
      console.error('Erreur lors du changement de statut:', error);
      alert(error.response?.data?.error || 'Erreur lors du changement de statut.');
    }
  };

  const openStatusModal = (status) => {
    setSelectedStatus(status);
    setShowStatusModal(true);
  };

  const closeStatusModal = () => {
    setShowStatusModal(false);
    setSelectedStatus('');
    setRejectionReason('');
  };

  const renderStatus = (status) => {
    switch (status) {
      case 'pending':
        return '⏳ En attente';
      case 'rejected':
        return '❌ Refusée';
      case 'completed':
        return '✅ Terminée';
      default:
        return status;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'var(--bs-gray-500)';
      case 'rejected': return 'var(--bs-danger)';
      case 'completed': return 'var(--bs-success)';
      default: return 'var(--bs-light)';
    }
  };

  if (!task) return <p>Chargement...</p>;

  return (
    <div className="d-flex justify-content-center align-items-center m-4" style={{ minHeight: '90vh' }}>
      <Card className="shadow" style={{ width: '60%', maxWidth: '900px' }}>
        <Card.Body>
          <h3 className="mb-3">{task.title}</h3>
          <hr/>
          <p><strong>Description :</strong> {task.description}</p>
          <p><strong>Date limite :</strong> {new Date(task.due_date).toLocaleDateString()}</p>
          <p><strong>Priorité :</strong> {task.priority}</p>
          <p>
            <strong>Statut :</strong> 
            <span 
              className="badge rounded-pill ms-2"
              style={{
                backgroundColor: getStatusColor(task.status),
                color: 'white'
              }}
            >
              {renderStatus(task.status)}
            </span>
          </p>
          <p><strong>Créée le :</strong> {new Date(task.created_at).toLocaleString()}</p>
          <hr />

          <h5>Fichiers liés :</h5>
          <ul>
            {task.file_path && (
              <li>
                <a href={`http://localhost:5000/${task.file_path}`} target="_blank" rel="noreferrer">
                  Fichier
                </a>
              </li>
            )}
          </ul>

          <hr />

          <Form.Group>
            <Form.Label><strong>Commentaire :</strong></Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={comment}
              onChange={handleCommentChange}
            />
          </Form.Group>

          <Form.Group className="mt-3">
            <Form.Label>Fichier de réponse :</Form.Label>
            <Form.Control type="file" onChange={handleFileChange} />
          </Form.Group>

          {successMessage && <Alert variant="success" className="mt-3">{successMessage}</Alert>}

          <div className="d-flex justify-content-between mt-4">
            <Button variant="secondary" onClick={() => navigate('/mes-taches')}>
              ⬅️ Retour
            </Button>

            <div className="d-flex gap-2">
              {task.status !== 'completed' && (
                <Button 
                  variant="danger" 
                  onClick={() => openStatusModal('rejected')}
                >
                  Refuser la tâche
                </Button>
              )}
              
              {task.status !== 'completed' && (
                <Button 
                  variant="success" 
                  onClick={() => openStatusModal('completed')}
                >
                  Terminer la tâche
                </Button>
              )}

              <Button variant="primary" onClick={handleUpdate}>
                Mettre à jour
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Status Change Modal */}
      <Modal show={showStatusModal} onHide={closeStatusModal} centered style={{ zIndex: 1050 }}>
        <Modal.Header closeButton>
          <Modal.Title>
            {selectedStatus === 'completed' ? 'Terminer la tâche' : 'Refuser la tâche'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedStatus === 'completed' ? (
            <>
              <p>Voulez-vous vraiment marquer cette tâche comme terminée ?</p>
              <p>Vous pouvez ajouter un commentaire et un fichier de réponse avant de confirmer.</p>
            </>
          ) : (
            <Form.Group>
              <Form.Label>Raison du refus :</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Veuillez indiquer la raison du refus..."
              />
            </Form.Group>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeStatusModal}>
            Annuler
          </Button>
          <Button 
            variant={selectedStatus === 'completed' ? 'success' : 'danger'} 
            onClick={handleStatusChange}
          >
            Confirmer
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default DetailsTask;