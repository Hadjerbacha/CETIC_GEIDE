// AssignTaskModal.js
import React, { useState } from 'react';
import { Modal, Button, Form, Badge } from 'react-bootstrap';
import axios from 'axios';

const AssignTask = ({ show, onClose, users, fetchTasks }) => {
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [document, setDocument] = useState(null);
  const [note, setNote] = useState('');
  const [sendNotification, setSendNotification] = useState(false);
  const [searchUser, setSearchUser] = useState('');

  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(searchUser.toLowerCase())
  );

  const handleUserSelect = (user) => {
    if (!selectedUsers.find((u) => u.id === user.id)) {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const handleUserRemove = (userId) => {
    setSelectedUsers(selectedUsers.filter((u) => u.id !== userId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append('file', document);
    formData.append('note', note);
    formData.append('notify', sendNotification);
    formData.append('assigned_to', JSON.stringify(selectedUsers.map((u) => u.id)));

    try {
      await axios.post('http://localhost:5000/api/assign-task', formData);
      fetchTasks();
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Modal show={show} onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title>Assigner une Tâche</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Choisir un document</Form.Label>
            <Form.Control type="file" onChange={(e) => setDocument(e.target.files[0])} />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Rechercher un utilisateur</Form.Label>
            <Form.Control type="text" placeholder="Nom ou rôle" value={searchUser} onChange={(e) => setSearchUser(e.target.value)} />
            <div className="mt-2" style={{ maxHeight: '150px', overflowY: 'auto' }}>
              {filteredUsers.map((user) => (
                <div key={user.id} className="d-flex justify-content-between align-items-center border p-2 mb-1">
                  <span>{user.username} ({user.role})</span>
                  <Button size="sm" onClick={() => handleUserSelect(user)}>Ajouter</Button>
                </div>
              ))}
            </div>
          </Form.Group>

          <div className="mb-3">
            <Form.Label>Utilisateurs assignés</Form.Label>
            <div>
              {selectedUsers.map((u) => (
                <Badge key={u.id} pill bg="primary" className="me-2 mb-2" onClick={() => handleUserRemove(u.id)} style={{ cursor: 'pointer' }}>
                  {u.username} ×
                </Badge>
              ))}
            </div>
          </div>

          <Form.Group className="mb-3">
            <Form.Label>Note / Instructions</Form.Label>
            <Form.Control as="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Form.Group>

          <Form.Check type="checkbox" label="Envoyer une notification par email" checked={sendNotification} onChange={(e) => setSendNotification(e.target.checked)} />

          <Button variant="primary" type="submit">Assigner</Button>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default AssignTask;
