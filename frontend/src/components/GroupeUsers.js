import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Button, Modal, Form, Table } from 'react-bootstrap';
import Select from 'react-select';  // Import de react-select

const GroupeUsers = () => {
    const [groups, setGroups] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [groupForm, setGroupForm] = useState({ name: '', description: '', users: [] });
    const [showModal, setShowModal] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(null);

    // Charger tous les groupes avec leurs utilisateurs
    const fetchGroups = async () => {
        const token = localStorage.getItem("token");
        try {
            const res = await axios.get("http://localhost:5000/api/groups/", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setGroups(res.data); // plus de regroupement ici
        } catch (err) {
            console.error("Erreur lors de la récupération des groupes :", err);
        }
    };
    

    // Charger tous les utilisateurs
    const fetchUsers = async () => {
        const token = localStorage.getItem("token");
        try {
            const res = await axios.get("http://localhost:5000/api/auth/users", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAllUsers(res.data);
        } catch (err) {
            console.error("Erreur lors de la récupération des utilisateurs :", err);
        }
    };

    useEffect(() => {
        fetchGroups();
        fetchUsers();
    }, []);

    const handleChange = (e) => {
        setGroupForm({ ...groupForm, [e.target.name]: e.target.value });
    };

    // Conversion des utilisateurs en format d'options pour react-select
    const userOptions = allUsers.map(user => ({
        value: user.id,
        label: user.name
    }));

    const handleUserSelect = (selectedOptions) => {
        const selectedIds = selectedOptions ? selectedOptions.map(option => option.value) : [];
        setGroupForm(prev => ({ ...prev, users: selectedIds }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem("token");

        try {
            let groupId;
            if (selectedGroup) {
                // Update
                const res = await axios.put(`http://localhost:5000/api/groups/${selectedGroup.id}`, {
                    name: groupForm.name,
                    description: groupForm.description
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                groupId = res.data.id;
            } else {
                // Create
                const res = await axios.post(`http://localhost:5000/api/groups/`, {
                    name: groupForm.name,
                    description: groupForm.description
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                groupId = res.data.id;
                console.log("Groupe id :", groupId);
            }

            // Ajouter les utilisateurs au groupe
            if (groupForm.users.length > 0) {
                await axios.post(`http://localhost:5000/api/groups/${groupId}/users`, {
                    userIds: groupForm.users
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }

            // Réinitialisation
            setGroupForm({ name: '', description: '', users: [] });
            setSelectedGroup(null);
            setShowModal(false);
            fetchGroups();
        } catch (err) {
            console.error("Erreur lors de la création/mise à jour du groupe :", err);
        }
    };

    const handleEdit = (group) => {
        setSelectedGroup(group);
        setGroupForm({
            name: group.name,
            description: group.description,
            users: group.users.map(u => u.id)
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        const token = localStorage.getItem("token");
        try {
            await axios.delete(`http://localhost:5000/api/groups/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchGroups();
        } catch (err) {
            console.error("Erreur lors de la suppression :", err);
        }
    };

    return (
        <div className="container-fluid mt-4">
            <Button onClick={() => {
                setGroupForm({ name: '', description: '', users: [] });
                setSelectedGroup(null);
                setShowModal(true);
            }}>Ajouter un groupe</Button>

            <Table striped bordered hover className="mt-3">
                <thead>
                    <tr>
                        <th>Nom</th>
                        <th>Description</th>
                        <th>Utilisateurs</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {groups.map(group => (
                        <tr key={group.id}>
                            <td>{group.name}</td>
                            <td>{group.description}</td>
                            <td>{group.users.map(u => u.name).join(', ')}</td>
                            <td>
                                <Button size="sm" variant="warning" onClick={() => handleEdit(group)} className="me-2">
                                    Modifier
                                </Button>
                                <Button size="sm" variant="danger" onClick={() => handleDelete(group.id)}>
                                    Supprimer
                                </Button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </Table>

            {/* Modal */}
            <Modal show={showModal} onHide={() => setShowModal(false)} style={{ zIndex: 1050 }} backdrop="static" centered>
                <Form onSubmit={handleSubmit}>
                    <Modal.Header closeButton>
                        <Modal.Title>{selectedGroup ? "Modifier un groupe" : "Ajouter un groupe"}</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <Form.Group className="mb-3">
                            <Form.Label>Nom du groupe</Form.Label>
                            <Form.Control type="text" name="name" value={groupForm.name} onChange={handleChange} required />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Description</Form.Label>
                            <Form.Control type="text" name="description" value={groupForm.description} onChange={handleChange} required />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Utilisateurs</Form.Label>
                            <Select
                                isMulti
                                options={userOptions}
                                value={userOptions.filter(option => groupForm.users.includes(option.value))}
                                onChange={handleUserSelect}
                            />
                        </Form.Group>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={() => setShowModal(false)}>Annuler</Button>
                        <Button variant="success" type="submit">{selectedGroup ? "Mettre à jour" : "Créer"}</Button>
                    </Modal.Footer>
                </Form>
            </Modal>
        </div>
    );
};

export default GroupeUsers;
