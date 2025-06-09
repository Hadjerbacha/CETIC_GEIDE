import React, { useState, useEffect } from "react";
import axios from "axios";
import { Modal, Button, Form, Table, Badge, Container } from "react-bootstrap";
import Navbar from './Navbar';
import Groupe from './Groupe';
import Tabs from 'react-bootstrap/Tabs';
import Tab from 'react-bootstrap/Tab';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
const AdminUsers = () => {
	const [users, setUsers] = useState([]);
	const [showAddModal, setShowAddModal] = useState(false);
	const [showEditModal, setShowEditModal] = useState(false);
	const [selectedUser, setSelectedUser] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
	const [formData, setFormData] = useState({
		name: "",
		prenom: "",
		email: "",
		password: "",
		role: "employe",
	});

	// Récupérer les users
	const fetchUsers = async () => {
		try {
			const token = localStorage.getItem("token");
			const res = await axios.get("http://localhost:5000/api/auth/users", {
				headers: { Authorization: `Bearer ${token}` },
			});
			setUsers(res.data);
		} catch (error) {
			console.error("Erreur lors du chargement des utilisateurs :", error);
		}
	};

	useEffect(() => {
		fetchUsers();
	}, []);

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
			password: "", // Vide pour éviter d’afficher le hash
			role: user.role,
		});
		setShowEditModal(true);
	};

	const handleUpdateUser = async () => {
		try {
			const token = localStorage.getItem("token");
            console.log(selectedUser.id);
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

      const handleDeleteUser = async () => {
        if (!userToDelete) return;
      
        try {
          const token = localStorage.getItem("token");
          await axios.delete(`http://localhost:5000/api/auth/users/${userToDelete.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          fetchUsers();
          setShowDeleteModal(false);
          setUserToDelete(null);
        } catch (error) {
          console.error("Erreur de suppression :", error);
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
                        <div className="d-flex justify-content-between align-items-center mb-4">
                            <h2 className="mb-0">Utilisateurs</h2>
                            <Button 
                                variant="success" 
                                onClick={() => setShowAddModal(true)}
                                className="d-flex align-items-center"
                            >
                                <FiPlus className="me-2" /> Ajouter un utilisateur
                            </Button>
                        </div>
                        
                        <div className="users-table p-3">
                            <Table hover responsive>
                                <thead className="table-header">
                                    <tr>
                                        <th>Nom</th>
                                        <th>Prénom</th>
                                        <th>Email</th>
                                        <th>Rôle</th>
                                        <th className="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user) => (
                                        <tr key={user.id}>
                                            <td className="fw-semibold">{user.name}</td>
                                            <td>{user.prenom}</td>
                                            <td>{user.email}</td>
                                            <td>{getRoleBadge(user.role)}</td>
                                            <td className="text-end">
                                                <Button
                                                    variant="outline-warning"
                                                    size="sm"
                                                    className="action-btn me-2"
                                                    onClick={() => handleEditUser(user)}
                                                >
                                                    <FiEdit2 />
                                                </Button>
                                                <Button 
                                                    variant="outline-danger" 
                                                    size="sm" 
                                                    className="action-btn"
                                                    onClick={() => handleDeleteClick(user)}
                                                >
                                                    <FiTrash2 />
                                                </Button>
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

                {/* [Les modals existants restent inchangés...] */}
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
								<option value="employe">Employé</option><option value="admin">Administrateur</option>
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

                <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered style={{ zIndex: 1050 }}
  backdrop="static">
                <Modal.Header closeButton>
                    <Modal.Title>Confirmation de suppression</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    Êtes-vous sûr de vouloir supprimer l'utilisateur :
                    <strong> {userToDelete?.name} {userToDelete?.prenom}</strong> ?
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
                    Annuler
                    </Button>
                    <Button variant="danger" onClick={handleDeleteUser}>
                    Oui, supprimer
                    </Button>
                </Modal.Footer>
                </Modal>
            </Container>
        </div>
    );
};

export default AdminUsers;