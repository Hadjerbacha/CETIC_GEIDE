import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import Select from 'react-select';
import { Modal, Button, Form, Container, Alert, Badge, Table, InputGroup, FormControl } from 'react-bootstrap';
import { FiPlus, FiUsers, FiEdit, FiTrash2, FiSearch } from 'react-icons/fi';
import Navbar from './Navbar';

const API = 'http://localhost:5000/api/groups';
const USERS_API = 'http://localhost:5000/api/auth/users/';

const GroupeUser = () => {
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [form, setForm] = useState({ nom: '', description: '', user_ids: [] });
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentGroupId, setCurrentGroupId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const token = localStorage.getItem('token');
  const axiosAuth = axios.create({ headers: { Authorization: `Bearer ${token}` } });

  useEffect(() => {
    if (token) {
      const decoded = jwtDecode(token);
      setCurrentUser(decoded);
      setForm(prev => ({
        ...prev,
        user_ids: [decoded.id]
      }));
    }
    fetchUsers();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchGroups();
    }
  }, [currentUser]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = groups.filter(group => 
        group.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredGroups(filtered);
    } else {
      setFilteredGroups(groups);
    }
  }, [searchTerm, groups]);

  const fetchUsers = async () => {
    try {
      const res = await axiosAuth.get(USERS_API);
      setUsers(res.data);
    } catch (err) {
      console.error('Erreur récupération utilisateurs :', err);
      setErrorMessage('Impossible de charger la liste des utilisateurs');
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await axiosAuth.get(API);
      const userGroups = res.data.filter(group => 
        group.user_ids.includes(currentUser?.id)
      );
      setGroups(userGroups);
      setFilteredGroups(userGroups);
    } catch (err) {
      console.error('Erreur récupération groupes :', err);
      setErrorMessage('Impossible de charger la liste des groupes');
    }
  };

  const handleSelectChange = (selectedOptions) => {
    const ids = selectedOptions.map(opt => opt.value);
    if (currentUser && !ids.includes(currentUser.id)) {
      ids.push(currentUser.id);
    }
    setForm(prev => ({ ...prev, user_ids: ids }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (currentGroupId) {
        await axiosAuth.put(`${API}/${currentGroupId}`, {
          ...form,
          user_ids: form.user_ids.map(id => parseInt(id, 10))
        });
        setSuccessMessage('Groupe mis à jour avec succès!');
      } else {
        await axiosAuth.post(API, {
          ...form,
          user_ids: form.user_ids.map(id => parseInt(id, 10))
        });
        setSuccessMessage('Groupe créé avec succès!');
      }
      
      fetchGroups();
      setTimeout(() => {
        setShowModal(false);
        setShowEditModal(false);
        setSuccessMessage('');
        resetForm();
      }, 2000);
    } catch (err) {
      console.error('Erreur opération groupe :', err);
      setErrorMessage(err.response?.data?.error || 'Erreur lors de l\'opération sur le groupe');
    }
  };

  const handleEdit = (group) => {
    setForm({
      nom: group.nom,
      description: group.description,
      user_ids: group.user_ids
    });
    setCurrentGroupId(group.id);
    setShowEditModal(true);
  };

  const handleDelete = async (groupId) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce groupe?')) {
      try {
        await axiosAuth.delete(`${API}/${groupId}`);
        setSuccessMessage('Groupe supprimé avec succès!');
        fetchGroups();
        setTimeout(() => setSuccessMessage(''), 2000);
      } catch (err) {
        console.error('Erreur suppression groupe :', err);
        setErrorMessage('Erreur lors de la suppression du groupe');
      }
    }
  };

  const resetForm = () => {
    setForm({ nom: '', description: '', user_ids: currentUser ? [currentUser.id] : [] });
    setCurrentGroupId(null);
    setShowModal(false);
    setShowEditModal(false);
    setErrorMessage('');
  };

  const userOptions = users.map(u => ({
    value: u.id,
    label: `${u.name} ${u.prenom}`,
  }));

  const selectedUserOptions = userOptions.filter(opt => form.user_ids.includes(opt.value));

  const getUserName = (id) => {
    const user = users.find(u => u.id === id);
    return user ? `${user.name} ${user.prenom}` : `ID:${id}`;
  };

  return (
    <div className="user-groups-page">
        <br/>
      <style>
        {`
          .user-groups-page {
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
          .search-container {
            background-color: white;
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
          }
          .create-group-btn {
            background-color: #4e73df;
            border: none;
            padding: 10px 20px;
            font-weight: 600;
          }
          .create-group-btn:hover {
            background-color: #2e59d9;
          }
        `}
      </style>
      <Navbar/>
      <Container fluid>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="mb-0">Mes Groupes de Travail</h2>
          <Button 
            variant="success" 
            onClick={() => setShowModal(true)}
            className="d-flex align-items-center"
          >
            <FiPlus className="me-2" /> Créer un groupe
          </Button>
        </div>

        <div className="search-container mb-4">
          <InputGroup>
            <InputGroup.Text>
              <FiSearch />
            </InputGroup.Text>
            <FormControl
              placeholder="Rechercher par nom ou description"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>
        </div>

        {successMessage && <Alert variant="success">{successMessage}</Alert>}
        {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}

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
              {filteredGroups.length > 0 ? (
                filteredGroups.map(group => (
                  <tr key={group.id}>
                    <td className="fw-semibold">{group.nom}</td>
                    <td>{group.description || '-'}</td>
                    <td>
                      <div className="d-flex flex-wrap">
                        {group.user_ids?.map(id => (
                          <Badge key={id} className="user-badge d-flex align-items-center">
                            <FiUsers className="me-1" size={12} />
                            {getUserName(id)}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="text-end">
                      <div className="d-inline-flex align-items-center">
                        <Button
                          variant="outline-warning"
                          size="sm"
                          className="me-2"
                          onClick={() => handleEdit(group)}
                        >
                          <FiEdit />
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => handleDelete(group.id)}
                        >
                          <FiTrash2 />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="text-center">
                    {searchTerm ? 'Aucun groupe ne correspond à votre recherche' : 'Aucun groupe créé pour le moment'}
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>

        {/* Modal Création */}
        <Modal show={showModal} onHide={resetForm} style={{ zIndex: 1050 }} backdrop="static" centered>
          <Form onSubmit={handleSubmit}>
            <Modal.Header closeButton>
              <Modal.Title>Créer un groupe de travail</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}
              
              <Form.Group className="mb-3">
                <Form.Label>Nom du groupe</Form.Label>
                <Form.Control
                  type="text"
                  name="nom"
                  value={form.nom}
                  onChange={handleChange}
                  placeholder="Donnez un nom à votre groupe"
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
                  placeholder="Décrivez l'objectif de ce groupe"
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Membres du groupe</Form.Label>
                <div className="mb-2">
                  <Badge className="user-badge d-inline-flex align-items-center me-2">
                    <FiUsers className="me-1" size={12} />
                    {currentUser?.name} {currentUser?.prenom} (Vous)
                  </Badge>
                </div>
                <Select
                  isMulti
                  options={userOptions}
                  value={selectedUserOptions.filter(opt => opt.value !== currentUser?.id)}
                  onChange={handleSelectChange}
                  placeholder="Ajouter d'autres membres..."
                />
                <Form.Text className="text-muted">
                  Vous serez automatiquement inclus comme membre du groupe.
                </Form.Text>
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={resetForm}>Annuler</Button>
              <Button variant="primary" type="submit">
                Créer le groupe
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>

        {/* Modal Modification */}
        <Modal show={showEditModal} onHide={resetForm} style={{ zIndex: 1050 }} backdrop="static" centered>
          <Form onSubmit={handleSubmit}>
            <Modal.Header closeButton>
              <Modal.Title>Modifier le groupe</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}
              
              <Form.Group className="mb-3">
                <Form.Label>Nom du groupe</Form.Label>
                <Form.Control
                  type="text"
                  name="nom"
                  value={form.nom}
                  onChange={handleChange}
                  placeholder="Donnez un nom à votre groupe"
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
                  placeholder="Décrivez l'objectif de ce groupe"
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Membres du groupe</Form.Label>
                <div className="mb-2">
                  <Badge className="user-badge d-inline-flex align-items-center me-2">
                    <FiUsers className="me-1" size={12} />
                    {currentUser?.name} {currentUser?.prenom} (Vous)
                  </Badge>
                </div>
                <Select
                  isMulti
                  options={userOptions}
                  value={selectedUserOptions.filter(opt => opt.value !== currentUser?.id)}
                  onChange={handleSelectChange}
                  placeholder="Ajouter d'autres membres..."
                />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={resetForm}>Annuler</Button>
              <Button variant="primary" type="submit">
                Enregistrer les modifications
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>
      </Container>
    </div>
  );
};

export default GroupeUser;