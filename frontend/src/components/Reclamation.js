import React, { useState } from 'react';
import axios from 'axios';
import Navbar from './Navbar';
import { Container, Card, Button, Form, Alert, Row, Col } from 'react-bootstrap';

const Reclamation = () => {
    const [reclamationText, setReclamationText] = useState('');
    const [category, setCategory] = useState('');
    const [priority, setPriority] = useState('moyenne');
    const [file, setFile] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [history, setHistory] = useState([]); // Historique des réclamations (optionnel)

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!reclamationText.trim() || !category) {
            setError('Tous les champs sont obligatoires.');
            return;
        }

        const formData = new FormData();
        formData.append('reclamation', reclamationText);
        formData.append('category', category);
        formData.append('priority', priority);
        if (file) {
            formData.append('file', file);
        }

        try {
            const response = await axios.post('/api/reclamations', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (response.status === 200) {
                setSuccess(true);
                setReclamationText('');
                setCategory('');
                setPriority('moyenne');
                setFile(null);
            }
        } catch (error) {
            setError('Une erreur est survenue, veuillez réessayer.');
        }
    };

    return (
        <>
            <Navbar />
            <Container className="mt-4 d-flex justify-content-center">
                <Card className="shadow p-4" style={{ width: '100%', maxWidth: '700px' }}>
                    <Card.Body>
                        <h3>Faire une réclamation</h3>
                        <Form onSubmit={handleSubmit}>
                            {/* Catégorie de la réclamation */}
                            <Form.Group className="mb-3">
                                <Form.Label><strong>Catégorie :</strong></Form.Label>
                                <Form.Control
                                    as="select"
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                >
                                    <option value="">Sélectionner une catégorie</option>
                                    <option value="problème_technique">Problème Technique</option>
                                    <option value="problème_processus">Problème de Processus</option>
                                    <option value="problème_général">Problème Général</option>
                                </Form.Control>
                            </Form.Group>

                            {/* Texte de la réclamation */}
                            <Form.Group className="mb-3">
                                <Form.Label><strong>Réclamation :</strong></Form.Label>
                                <Form.Control
                                    as="textarea"
                                    rows={4}
                                    value={reclamationText}
                                    onChange={(e) => setReclamationText(e.target.value)}
                                />
                            </Form.Group>

                            {/* Priorité */}
                            <Form.Group className="mb-3">
                                <Form.Label><strong>Priorité :</strong></Form.Label>
                                <Form.Control
                                    as="select"
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value)}
                                >
                                    <option value="basse">Basse</option>
                                    <option value="moyenne">Moyenne</option>
                                    <option value="élevée">Élevée</option>
                                </Form.Control>
                            </Form.Group>

                            {/* Joindre un fichier */}
                            <Form.Group className="mb-3">
                                <Form.Label><strong>Joindre un fichier :</strong></Form.Label>
                                <Form.Control
                                    type="file"
                                    onChange={handleFileChange}
                                />
                            </Form.Group>

                            {/* Affichage des messages d'erreur ou de succès */}
                            {error && <Alert variant="danger">{error}</Alert>}
                            {success && <Alert variant="success">Réclamation envoyée avec succès !</Alert>}

                            {/* Bouton de soumission */}
                            <Button variant="primary" type="submit" className="mt-3">
                                Soumettre
                            </Button>
                        </Form>
                    </Card.Body>
                </Card>
            </Container>

            {/* Historique des réclamations (optionnel) */}
            {history.length > 0 && (
                <Container className="mt-5">
                    <h4>Historique de vos réclamations</h4>
                    {history.map((reclamation, index) => (
                        <Card key={index} className="mb-3">
                            <Card.Body>
                                <Card.Title>{reclamation.category}</Card.Title>
                                <Card.Text>{reclamation.reclamation}</Card.Text>
                                <Card.Text><strong>Priorité:</strong> {reclamation.priority}</Card.Text>
                                <Card.Text><strong>Statut:</strong> {reclamation.status}</Card.Text>
                            </Card.Body>
                        </Card>
                    ))}
                </Container>
            )}
        </>
    );
};

export default Reclamation;
