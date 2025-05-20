// NewTaskModal.js
import React, { useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import axios from 'axios';

const NewTask = ({ show, onClose, fetchTasks, users }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: '',
    priority: 'Normal',
    assigned_to: '',
    file: null,
    notify: false
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'file') {
      setFormData({ ...formData, file: e.target.files[0] });
    } else {
      setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (key === 'file' && value) data.append('file', value);
      else data.append(key, value);
    });
    data.append('workflow_id', 1); // temporairement fixe

    try {
      await axios.post('http://localhost:5000/api/tasks', data);
      fetchTasks();
      onClose();
      setFormData({
        title: '', description: '', due_date: '', priority: 'Normal',
        assigned_to: '', file: null, notify: false
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Modal show={show} onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title>Nouvelle Tâche</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Titre</Form.Label>
            <Form.Control type="text" name="title" value={formData.title} onChange={handleChange} required />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Description</Form.Label>
            <Form.Control as="textarea" name="description" value={formData.description} onChange={handleChange} />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Échéance</Form.Label>
            <Form.Control type="date" name="due_date" value={formData.due_date} onChange={handleChange} required />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Priorité</Form.Label>
            <Form.Select name="priority" value={formData.priority} onChange={handleChange}>
              <option value="Haute">Haute</option>
              <option value="Normale">Normale</option>
              <option value="Basse">Basse</option>
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Assigner à</Form.Label>
            <Form.Select name="assigned_to" value={formData.assigned_to} onChange={handleChange}>
              <option value="">Choisir un utilisateur</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.username}</option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Fichier</Form.Label>
            <Form.Control type="file" name="file" onChange={handleChange} />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Check type="checkbox" label="Envoyer une notification par email" name="notify" checked={formData.notify} onChange={handleChange} />
          </Form.Group>
          <Button variant="success" type="submit">Ajouter</Button>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default NewTask;
