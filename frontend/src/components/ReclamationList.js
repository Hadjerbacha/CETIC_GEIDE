import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from './Navbar';
import { Container, Table, Alert, Spinner, Card } from 'react-bootstrap';

const ReclamationList = () => {
    const [reclamations, setReclamations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchReclamations = async () => {
            try {
                const response = await axios.get('/api/reclamations');
                setReclamations(response.data);
                setLoading(false);
            } catch (err) {
                setError("Erreur lors du chargement des réclamations.");
                setLoading(false);
            }
        };

        fetchReclamations();
    }, []);

    return (
        <>
            <Navbar />
            <Container className="mt-5 d-flex justify-content-center">
                {loading && <Spinner animation="border" />}
                {error && <Alert variant="danger">{error}</Alert>}
    
                {!loading && !error && (
                    <Card className="shadow-sm w-100" style={{ maxWidth: '900px' }}>
                        <Card.Body>
                            <h3 className="text-center mb-4">📋 Liste des réclamations</h3>
                            {reclamations.length === 0 ? (
                                <Alert variant="info" className="text-center">Aucune réclamation trouvée.</Alert>
                            ) : (
                                <Table striped bordered hover responsive>
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Catégorie</th>
                                            <th>Texte</th>
                                            <th>Priorité</th>
                                            <th>Date</th>
                                            <th>Fichier</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reclamations.map((rec, index) => (
                                            <tr key={rec.id}>
                                                <td>{index + 1}</td>
                                                <td>{rec.category}</td>
                                                <td>{rec.reclamation}</td>
                                                <td>{rec.priority}</td>
                                                <td>{new Date(rec.created_at).toLocaleString()}</td>
                                                <td>
                                                    {rec.file_path ? (
                                                        <a href={`/uploads/${rec.file_path}`} target="_blank" rel="noopener noreferrer">
                                                            Voir
                                                        </a>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            )}
                        </Card.Body>
                    </Card>
                )}
            </Container>
        </>
    );
    
};

export default ReclamationList;
