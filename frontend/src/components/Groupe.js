import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import Select from 'react-select';
import { Modal, Button, Table, Form, Badge, Container } from 'react-bootstrap';
import { FiPlus, FiEdit2, FiTrash2, FiUsers } from 'react-icons/fi';

const API = 'http://localhost:5000/api/groups';
const USERS_API = 'http://localhost:5000/api/auth/users/';

const Groupe = () => {
  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ nom: '', description: '', user_ids: [] });
  const [editId, setEditId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  const token = localStorage.getItem('token');
  const axiosAuth = axios.create({ headers: { Authorization: `Bearer ${token}` } });

  useEffect(() => {
    if (token) {
      const decoded = jwtDecode(token);
      setCurrentUser(decoded);
    }
    fetchGroups();
    fetchUsers();
  }, []);

    // Utilisation de useEffect pour observer la mise à jour de currentUser
    useEffect(() => {
        if (currentUser) {
          console.log('Utilisateur connecté page groupe:', currentUser);  // Affichage des infos utilisateur après mise à jour
        }
      }, [currentUser]); // Ce useEffect sera déclenché à chaque modification de currentUser

  const fetchGroups = async () => {
    try {
      const res = await axiosAuth.get(API);
      setGroups(res.data);
    } catch (err) {
      console.error('Erreur récupération groupes :', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axiosAuth.get(USERS_API);
      setUsers(res.data);
    } catch (err) {
      console.error('Erreur récupération utilisateurs :', err);
    }
  };

  const handleSelectChange = (selectedOptions) => {
    const ids = selectedOptions.map(opt => opt.value);
    setForm(prev => ({ ...prev, user_ids: ids }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
  e.preventDefault();

  // Forcer user_ids à être un tableau d'entiers
  const formattedForm = {
    ...form,
    user_ids: form.user_ids.map(id => parseInt(id, 10))
  };

  try {
    if (editId) {
      await axiosAuth.put(`${API}/${editId}`, formattedForm);
    } else {
      await axiosAuth.post(API, formattedForm);
    }
    resetForm();
    fetchGroups();
  } catch (err) {
    console.error('Erreur enregistrement groupe :', err);
  }
};


  const resetForm = () => {
    setForm({ nom: '', description: '', user_ids: [] });
    setEditId(null);
    setShowModal(false);
  };

  const handleEdit = (group) => {
    setForm(group);
    setEditId(group.id);
    setShowModal(true);
  };

  const confirmDelete = (id) => {
    setDeleteId(id);
    setShowConfirm(true);
  };

  const handleDelete = async () => {
    try {
      await axiosAuth.delete(`${API}/${deleteId}`);
      setShowConfirm(false);
      setDeleteId(null);
      fetchGroups();
    } catch (err) {
      console.error('Erreur suppression :', err);
    }
  };

  const getUserName = (id) => {
    const user = users.find(u => u.id === id);
    return user ? `${user.name} ${user.prenom}` : `ID:${id}`;
  };

  const userOptions = users.map(u => ({
    value: u.id,
    label: `${u.name} ${u.prenom}`,
  }));

  const selectedUserOptions = userOptions.filter(opt => form.user_ids.includes(opt.value));

    return (
        <div className="groups-page">
            <style>
                {`
                .groups-page {
                    background-color: transparent;
                }
                .groups-table {
                    background-color: white;
                    border-radius: 10px;
                    box-shadow: 0 2px 15px rgba(0, 0, 0, 0.05);
                }
                .table-header {
                    background-color: #f8f9fa;
                }
                .user-badge {
                    background-color: #e9ecef;
                    color: #495057;
                    margin: 2px;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 0.8rem;
                }
                .action-btn {
                    padding: 0.25rem 0.5rem;
                    font-size: 0.875rem;
                }
                `}
            </style>

            <Container fluid>
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h2 className="mb-0">Groupes</h2>
                    <Button 
                        variant="success" 
                        onClick={() => setShowModal(true)}
                        className="d-flex align-items-center"
                    >
                        <FiPlus className="me-2" /> Ajouter un groupe
                    </Button>
                </div>

                <div className="groups-table p-3">
                    <Table hover responsive>
                        <thead className="table-header">
                            <tr>
                                <th>Nom</th>
                                <th>Description</th>
                                <th>Membres</th>
                                <th className="text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {groups.map(g => (
                                <tr key={g.id}>
                                    <td className="fw-semibold">{g.nom}</td>
                                    <td>{g.description || '-'}</td>
                                    <td>
                                        <div className="d-flex flex-wrap">
                                            {g.user_ids?.map(id => (
                                                <Badge key={id} className="user-badge d-flex align-items-center">
                                                    <FiUsers className="me-1" size={12} />
                                                    {getUserName(id)}
                                                </Badge>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="text-end">
                                        <Button
                                            variant="outline-warning"
                                            size="sm"
                                            className="action-btn me-2"
                                            onClick={() => handleEdit(g)}
                                        >
                                            <FiEdit2 />
                                        </Button>
                                        <Button
                                            variant="outline-danger"
                                            size="sm"
                                            className="action-btn"
                                            onClick={() => confirmDelete(g.id)}
                                        >
                                            <FiTrash2 />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>

                {/* [Les modals existants restent inchangés...] */}
                {/* Modal Ajout / Modification */}
      <Modal show={showModal} onHide={resetForm} style={{ zIndex: 1050 }}
  backdrop="static"
  centered>
        <Form onSubmit={handleSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>{editId ? 'Modifier Groupe' : 'Ajouter Groupe'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Nom</Form.Label>
              <Form.Control
                type="text"
                name="nom"
                value={form.nom}
                onChange={handleChange}
                placeholder="Nom du groupe"
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Description du groupe"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Utilisateurs</Form.Label>
              <Select
                isMulti
                options={userOptions}
                value={selectedUserOptions}
                onChange={handleSelectChange}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={resetForm}>Annuler</Button>
            <Button variant="success" type="submit">
              {editId ? 'Modifier' : 'Ajouter'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal Confirmation Suppression */}
      <Modal show={showConfirm} onHide={() => setShowConfirm(false)} style={{ zIndex: 1050 }}
  backdrop="static"
  centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirmation</Modal.Title>
        </Modal.Header>
        <Modal.Body>Voulez-vous vraiment supprimer ce groupe ?</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfirm(false)}>Annuler</Button>
          <Button variant="danger" onClick={handleDelete}>Supprimer</Button>
        </Modal.Footer>
      </Modal>
            </Container>
        </div>
    );
};

export default Groupe;