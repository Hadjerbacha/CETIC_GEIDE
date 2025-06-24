import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Button, Card, Alert } from 'react-bootstrap';
import { jwtDecode } from 'jwt-decode';

const DetailsTask = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [comment, setComment] = useState('');
  const [responseFile, setResponseFile] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionType, setActionType] = useState(null); // 'complete' or 'reject'
  const [workflowDocument, setWorkflowDocument] = useState(null);
   const [taskFile, setTaskFile] = useState(null);
  const token = localStorage.getItem('token');

 useEffect(() => {
  const fetchTaskAndDocuments = async () => {
      try {
        // 1. Récupérer la tâche spécifique
        const taskResponse = await axios.get(`http://localhost:5000/api/tasks/mes-taches`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const taskData = taskResponse.data.find(t => t.id.toString() === id);
        if (!taskData) {
          navigate('/mes-taches');
          return;
        }

        setTask(taskData);
        setComment(taskData.assignment_note || '');

        // 2. Récupérer le fichier attaché directement à la tâche
        if (taskData.file_path) {
          setTaskFile({
            name: 'Fichier attaché à la tâche',
            path: taskData.file_path
          });
        }

        // 3. Si la tâche a un workflow, récupérer le document associé
        if (taskData.workflow_id) {
          try {
            const workflowResponse = await axios.get(
              `http://localhost:5000/api/workflows/${taskData.workflow_id}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );

            if (workflowResponse.data.workflow?.document_id) {
              const documentResponse = await axios.get(
                `http://localhost:5000/api/documents/${workflowResponse.data.workflow.document_id}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              setWorkflowDocument(documentResponse.data);
            }
          } catch (error) {
            console.error('Erreur récupération workflow/document:', error);
          }
        }
      } catch (error) {
        console.error('Erreur récupération tâche:', error);
        navigate('/mes-taches');
      }
    };

    fetchTaskAndDocuments();
  }, [id, token, navigate]);

  const handleCommentChange = (e) => setComment(e.target.value);
  const handleFileChange = (e) => setResponseFile(e.target.files[0]);
  const handleRejectionReasonChange = (e) => setRejectionReason(e.target.value);

  const resetAction = () => {
    setActionType(null);
    setRejectionReason('');
  };

  const handleUpdate = async () => {
    try {
      if (actionType === 'reject' && !rejectionReason) {
        alert('Veuillez fournir une raison pour le refus');
        return;
      }

      // 1. Mise à jour du commentaire si on est en mode complétion ou si commentaire existe
      if (comment && (actionType === 'complete' || !actionType)) {
        await axios.patch(`http://localhost:5000/api/tasks/${id}/comment`, {
          user_id: task.created_by,
          assignment_note: comment
        }, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
      }

      // 2. Envoi du fichier de réponse si on est en mode complétion
      if (responseFile && actionType === 'complete') {
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

      // 3. Mise à jour du statut si actionType est défini
      if (actionType) {
        const updateData = {
          status: actionType === 'complete' ? 'completed' : 'rejected'
        };

        if (actionType === 'reject') {
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
          message: actionType === 'complete' 
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

        setSuccessMessage(`Statut mis à jour: ${actionType === 'complete' ? 'Terminée' : 'Refusée'}`);
        setTimeout(() => {
          setSuccessMessage('');
          navigate('/mes-taches');
        }, 2000);
      } else {
        setSuccessMessage('Mise à jour réussie !');
        setTimeout(() => setSuccessMessage(''), 3000);
      }

      resetAction();
    } catch (error) {
      console.error('Erreur lors de la mise à jour :', error);
      alert(error.response?.data?.error || 'Erreur lors de la mise à jour.');
    }
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
          <ul className="list-unstyled">
            {/* Fichier attaché directement à la tâche */}
            {taskFile && (
              <li className="mb-2">
                <a 
                  href={`http://localhost:5000${taskFile.path}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-decoration-none"
                >
                  <i className="bi bi-file-earmark me-2"></i>
                  {taskFile.name}
                </a>
              </li>
            )}

            {/* Document principal du workflow */}
            {workflowDocument && (
              <li className="mb-2">
                <a 
                  href={`http://localhost:5000${workflowDocument.file_path}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-decoration-none"
                >
                  <i className="bi bi-file-earmark-text me-2"></i>
                  Document du workflow: {workflowDocument.name}
                </a>
              </li>
            )}

            {/* Message si aucun fichier */}
            {!taskFile && !workflowDocument && (
              <li className="text-muted">Aucun fichier associé à cette tâche</li>
            )}
          </ul>

          <hr />

          {/* Comment and file section - visible only when completing task */}
          {actionType === 'complete' && (
            <>
              <Form.Group>
                <Form.Label><strong>Commentaire :</strong></Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  value={comment}
                  onChange={handleCommentChange}
                  placeholder="Ajoutez un commentaire (optionnel)"
                />
              </Form.Group>

              <Form.Group className="mt-3">
                <Form.Label>Fichier de réponse :</Form.Label>
                <Form.Control 
                  type="file" 
                  onChange={handleFileChange} 
                  placeholder="Ajoutez un fichier de réponse (optionnel)"
                />
              </Form.Group>
            </>
          )}

          {/* Rejection reason section - visible only when rejecting task */}
          {actionType === 'reject' && (
            <Form.Group>
              <Form.Label><strong>Raison du refus :</strong></Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                value={rejectionReason}
                onChange={handleRejectionReasonChange}
                placeholder="Veuillez indiquer la raison du refus (obligatoire)"
                required
              />
            </Form.Group>
          )}

          {successMessage && <Alert variant="success" className="mt-3">{successMessage}</Alert>}

          <div className="d-flex justify-content-between mt-4">
  <Button variant="secondary" onClick={() => navigate('/mes-taches')}>
    ⬅️ Retour
  </Button>

  <div className="d-flex gap-2">
    {task.status !== 'completed' && (
      <>
        {actionType ? (
          <>
            <Button variant="secondary" onClick={resetAction}>
              Annuler
            </Button>
            <Button variant="primary" onClick={handleUpdate}>
              Mettre à jour
            </Button>
          </>
        ) : (
          <>
            <Button 
              variant="danger" 
              onClick={() => setActionType('reject')}
            >
              Refuser la tâche
            </Button>
            <Button 
              variant="success" 
              onClick={() => setActionType('complete')}
            >
              Terminer la tâche
            </Button>
          </>
        )}
      </>
    )}
  </div>
</div>
        </Card.Body>
      </Card>
    </div>
  );
};

export default DetailsTask;