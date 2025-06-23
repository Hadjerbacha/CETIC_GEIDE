import React, { useState, useEffect } from "react";
import axios from "axios";
import { Modal, Button, Form, Table, Badge, Container, InputGroup, FormControl, Dropdown } from "react-bootstrap";
import Navbar from './Navbar';
import Groupe from './Groupe';
import Tabs from 'react-bootstrap/Tabs';
import Tab from 'react-bootstrap/Tab';
import { FiPlus, FiEdit2, FiTrash2, FiUserX, FiUserCheck, FiSearch } from 'react-icons/fi';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusAction, setStatusAction] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    prenom: "",
    email: "",
    password: "",
    role: "employe",
  });

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (roleFilter) params.append('role', roleFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const res = await axios.get(`http://localhost:5000/api/auth/users?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(res.data);
      setFilteredUsers(res.data);
    } catch (error) {
      console.error("Erreur lors du chargement des utilisateurs :", error);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [searchTerm, roleFilter, statusFilter]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddUser = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.post("http://localhost:5000/api/auth/register", formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setShowAddModal(false);
      setFormData({
        name: "",
        prenom: "",
        email: "",
        password: "",
        role: "employe",
      });
      fetchUsers();
    } catch (error) {
      console.error("Erreur d'ajout :", error);
    }
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      prenom: user.prenom,
      email: user.email,
      password: "", // Vide pour éviter d'afficher le hash
      role: user.role,
    });
    setShowEditModal(true);
  };

  const handleUpdateUser = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `http://localhost:5000/api/auth/users/${selectedUser.id}`,
        formData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setShowEditModal(false);
      fetchUsers();
    } catch (error) {
      console.error("Erreur de mise à jour :", error);
    }
  };

  const handleDeleteClick = (user) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

// Nouvelle fonction pour la suppression définitive
const handlePermanentDelete = async () => {
  if (!userToDelete) return;

  try {
    const token = localStorage.getItem("token");
    await axios.delete(`http://localhost:5000/api/auth/users/${userToDelete.id}`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { permanent: 'true' } // Toujours true pour cette fonction
    });
    fetchUsers();
    setShowDeleteModal(false);
    setUserToDelete(null);
  } catch (error) {
    console.error("Erreur de suppression définitive :", error);
  }
};

// Ancienne fonction modifiée pour ne faire que la désactivation
const handleDeleteUser = async () => {
  if (!userToDelete) return;

  try {
    const token = localStorage.getItem("token");
    await axios.delete(`http://localhost:5000/api/auth/users/${userToDelete.id}`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { permanent: 'false' } // Toujours false pour cette fonction
    });
    fetchUsers();
    setUserToDelete(null);
  } catch (error) {
    console.error("Erreur de désactivation :", error);
  }
};

  const handleStatusChange = async () => {
    if (!selectedUser || !statusAction) return;
    
    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `http://localhost:5000/api/auth/users/${selectedUser.id}/status`,
        { action: statusAction },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowStatusModal(false);
      fetchUsers();
    } catch (error) {
      console.error("Erreur de changement de statut :", error);
    }
  };

  const getRoleBadge = (role) => {
    const variants = {
      admin: "danger",
      directeur: "primary",
      "directeur financier": "info",
      manager: "secondary",
      "responsable commercial": "dark",
      chef: "warning",
      juriste: "primary",
      comptable: "info",
      "gestionnaire RH": "dark",
      employe: "success"
    };
    return <Badge bg={variants[role]} className="text-capitalize">{role}</Badge>;
  };

  const getStatusBadge = (isActive) => {
    return isActive ? 
      <Badge bg="success" className="me-2">Actif</Badge> : 
      <Badge bg="secondary" className="me-2">Inactif</Badge>;
  };

  return (
    <div className="admin-users-page">
      <Navbar />
      
      <style>
        {`
          .admin-users-page {
            background-color: #f8f9fa;
            min-height: 100vh;
          }
          .custom-tabs .nav-link {
            color: #495057;
            font-weight: 500;
            border: none;
            padding: 0.75rem 1.5rem;
            margin-right: 0.5rem;
          }
          .custom-tabs .nav-link.active {
            color: #fff !important;
            background-color: #0d6efd;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(13, 110, 253, 0.3);
          }
          .users-table {
            background-color: white;
            border-radius: 10px;
            box-shadow: 0 2px 15px rgba(0, 0, 0, 0.05);
          }
          .table-header {
            background-color: #f8f9fa;
          }
          .action-btn {
            padding: 0.25rem 0.5rem;
            font-size: 0.875rem;
          }
          .modern-tabs .nav-link {
            color: #495057;
            font-weight: 500;
            border-radius: 10px;
            transition: all 0.3s ease;
            background-color: transparent;
            margin: 0 4px;
            padding: 0.75rem 1.2rem;
          }
          .modern-tabs .nav-link.active {
            background-color: #0d6efd;
            color: white !important;
            box-shadow: 0 4px 12px rgba(13, 110, 253, 0.3);
          }
          .modern-tabs .nav-link:hover {
            background-color: #e9f0fe;
            color: #0d6efd;
          }
          .search-container {
            background-color: white;
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
          }
        `}
      </style>

      <Container fluid className="py-4">
        <Tabs
          defaultActiveKey="users"
          id="admin-tabs"
          className="nav nav-pills nav-fill modern-tabs mb-4 shadow-sm rounded-3 bg-white"
          mountOnEnter
          unmountOnExit
        >
          <Tab eventKey="users" title="Gestion des Utilisateurs">
            <div className="search-container mb-4">
              <div className="row g-3">
                <div className="col-md-4">
                  <InputGroup>
                    <InputGroup.Text>
                      <FiSearch />
                    </InputGroup.Text>
                    <FormControl
                      placeholder="Rechercher par nom, prénom ou email"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </InputGroup>
                </div>
                <div className="col-md-3">
                  <Form.Select 
                    value={roleFilter} 
                    onChange={(e) => setRoleFilter(e.target.value)}
                  >
                    <option value="">Tous les rôles</option>
                    <option value="admin">Administrateur</option>
                    <option value="directeur">Directeur</option>
                    <option value="directeur financier">Directeur financier</option>
                    <option value="manager">Manager</option>
                    <option value="responsable commercial">Responsable commercial</option>
                    <option value="chef">Chef de département</option>
                    <option value="juriste">Juriste</option>
                    <option value="comptable">Comptable</option>
                    <option value="gestionnaire RH">Gestionnaire RH</option>
                    <option value="employe">Employé</option>
                  </Form.Select>
                </div>
                <div className="col-md-3">
                  <Form.Select 
                    value={statusFilter} 
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">Tous les statuts</option>
                    <option value="active">Actifs seulement</option>
                    <option value="inactive">Inactifs seulement</option>
                  </Form.Select>
                </div>
                <div className="col-md-2 d-flex justify-content-end">
                  <Button 
                    variant="success" 
                    onClick={() => setShowAddModal(true)}
                    className="d-flex align-items-center"
                  >
                    <FiPlus className="me-2" /> Ajouter
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="users-table p-3">
              <Table hover responsive>
                <thead className="table-header">
                  <tr>
                    <th>Statut</th>
                    <th>Nom</th>
                    <th>Prénom</th>
                    <th>Email</th>
                    <th>Rôle</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td>{getStatusBadge(user.is_active)}</td>
                      <td className="fw-semibold">{user.name}</td>
                      <td>{user.prenom}</td>
                      <td>{user.email}</td>
                      <td>{getRoleBadge(user.role)}</td>
                      <td className="text-end">
                        <div className="d-inline-flex">
                          <Button
                            variant="outline-warning"
                            size="sm"
                            className="me-2"
                            onClick={() => handleEditUser(user)}
                          >
                            <FiEdit2 />
                          </Button>
<Dropdown>
  <Dropdown.Toggle variant="outline-danger" size="sm" id="dropdown-basic">
    <FiTrash2 />
  </Dropdown.Toggle>
  <Dropdown.Menu>
    <Dropdown.Item 
      onClick={() => {
        setSelectedUser(user);
        setStatusAction('deactivate');
        setShowStatusModal(true); // Ouvre la modal de confirmation pour désactivation
      }}
    >
      Désactiver
    </Dropdown.Item>
    <Dropdown.Item 
      onClick={() => {
        setUserToDelete(user);
        setShowDeleteModal(true); // Ouvre la modal pour suppression définitive
      }}
      className="text-danger"
    >
      Supprimer définitivement
    </Dropdown.Item>
  </Dropdown.Menu>
</Dropdown>
                          {user.is_active ? (
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              className="ms-2"
                              onClick={() => {
                                setSelectedUser(user);
                                setStatusAction('deactivate');
                                setShowStatusModal(true);
                              }}
                              title="Désactiver"
                            >
                              <FiUserX />
                            </Button>
                          ) : (
                            <Button
                              variant="outline-success"
                              size="sm"
                              className="ms-2"
                              onClick={() => {
                                setSelectedUser(user);
                                setStatusAction('activate');
                                setShowStatusModal(true);
                              }}
                              title="Réactiver"
                            >
                              <FiUserCheck />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Tab>
          <Tab eventKey="groups" title="Gestion des Groupes">
            <Groupe />
          </Tab>
        </Tabs>

        {/* Modal d'ajout */}
        <Modal
          show={showAddModal}
          onHide={() => setShowAddModal(false)}
          style={{ zIndex: 1050 }}
          backdrop="static"
          centered
        >
          <Modal.Header closeButton>
            <Modal.Title>Ajouter un utilisateur</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form>
              <Form.Group className="mb-2">
                <Form.Control
                  type="text"
                  placeholder="Nom"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                />
              </Form.Group>
              <Form.Group className="mb-2">
                <Form.Control
                  type="text"
                  placeholder="Prénom"
                  name="prenom"
                  value={formData.prenom}
                  onChange={handleChange}
                />
              </Form.Group>
              <Form.Group className="mb-2">
                <Form.Control
                  type="email"
                  placeholder="Email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                />
              </Form.Group>
              <Form.Group className="mb-2">
                <Form.Control
                  type="password"
                  placeholder="Mot de passe"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                />
              </Form.Group>
              <Form.Group className="mb-2">
                <Form.Select name="role" value={formData.role} onChange={handleChange}>
                  <option value="admin">Administrateur</option>
                  <option value="directeur">Directeur</option>
                  <option value="directeur financier">Directeur financier</option>
                  <option value="manager">Manager</option>
                  <option value="responsable commercial">Responsable commercial</option>
                  <option value="chef">Chef de département</option>
                  <option value="juriste">Juriste</option>
                  <option value="comptable">Comptable</option>
                  <option value="gestionnaire RH">Gestionnaire RH</option>
                  <option value="employe">Employé</option>
                </Form.Select>
              </Form.Group>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>
              Annuler
            </Button>
            <Button variant="success" onClick={handleAddUser}>
              Enregistrer
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Modal de modification */}
        <Modal show={showEditModal} onHide={() => setShowEditModal(false)} style={{ zIndex: 1050 }}
          backdrop="static"
          centered>
          <Modal.Header closeButton>
            <Modal.Title>Modifier l'utilisateur</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form>
              <Form.Group className="mb-2">
                <Form.Control
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                />
              </Form.Group>
              <Form.Group className="mb-2">
                <Form.Control
                  type="text"
                  name="prenom"
                  value={formData.prenom}
                  onChange={handleChange}
                />
              </Form.Group>
              <Form.Group className="mb-2">
                <Form.Control
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                />
              </Form.Group>
              <Form.Group className="mb-2">
                <Form.Control
                  type="password"
                  name="password"
                  placeholder="Nouveau mot de passe (facultatif)"
                  value={formData.password}
                  onChange={handleChange}
                />
              </Form.Group>
              <Form.Group className="mb-2">
                <Form.Select name="role" value={formData.role} onChange={handleChange}>
                  <option value="admin">Administrateur</option>
                  <option value="directeur">Directeur</option>
                  <option value="directeur financier">Directeur financier</option>
                  <option value="manager">Manager</option>
                  <option value="responsable commercial">Responsable commercial</option>
                  <option value="chef">Chef de département</option>
                  <option value="juriste">Juriste</option>
                  <option value="comptable">Comptable</option>
                  <option value="gestionnaire RH">Gestionnaire RH</option>
                  <option value="employe">Employé</option>
                </Form.Select>
              </Form.Group>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              Annuler
            </Button>
            <Button variant="warning" onClick={handleUpdateUser}>
              Modifier
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Modal de suppression */}
        <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered style={{ zIndex: 1050 }}
          backdrop="static">
          <Modal.Header closeButton>
            <Modal.Title>Confirmation de suppression</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p>Êtes-vous sûr de vouloir supprimer définitivement l'utilisateur :</p>
            <p><strong>{userToDelete?.name} {userToDelete?.prenom}</strong> ?</p>
            <p className="text-danger">Cette action est irréversible et supprimera toutes les données associées.</p>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
              Annuler
            </Button>
            <Button variant="danger" onClick={handlePermanentDelete}> {/* Appel direct de la nouvelle fonction */}
    Confirmer la suppression
  </Button>
          </Modal.Footer>
        </Modal>

        {/* Modal de changement de statut */}
        <Modal show={showStatusModal} onHide={() => setShowStatusModal(false)} centered style={{ zIndex: 1050 }}
          backdrop="static">
          <Modal.Header closeButton>
            <Modal.Title>
              {statusAction === 'activate' ? 'Réactivation du compte' : 'Désactivation du compte'}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {statusAction === 'activate' ? (
              <>
                <p>Êtes-vous sûr de vouloir réactiver le compte de :</p>
                <p><strong>{selectedUser?.name} {selectedUser?.prenom}</strong> ?</p>
              </>
            ) : (
              <>
                <p>Êtes-vous sûr de vouloir désactiver le compte de :</p>
                <p><strong>{selectedUser?.name} {selectedUser?.prenom}</strong> ?</p>
                <p className="text-muted">
                  Le compte sera désactivé et pourra être réactivé ultérieurement.
                  Après 90 jours d'inactivité, il pourra être supprimé définitivement.
                </p>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowStatusModal(false)}>
              Annuler
            </Button>
            <Button 
              variant={statusAction === 'activate' ? 'success' : 'warning'} 
              onClick={handleStatusChange}
            >
              {statusAction === 'activate' ? 'Réactiver' : 'Désactiver'}
            </Button>
          </Modal.Footer>
        </Modal>
      </Container>
    </div>
  );
};

export default AdminUsers;