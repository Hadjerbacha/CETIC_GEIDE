import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Container, Card, Button, Alert } from 'react-bootstrap';
import Navbar from './Navbar';

const DocVoir = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [document, setDocument] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);
    const token = localStorage.getItem('token');

    useEffect(() => {
        const fetchDocument = async () => {
            try {
                const response = await axios.get(`http://localhost:5000/api/documents/${id}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setDocument(response.data);
            } catch (error) {
                console.error('Erreur lors de la récupération du document :', error);
                setErrorMessage('Impossible de charger le document.');
            }
        };

        if (id && token) {
            fetchDocument();
        }
    }, [id, token]);

    const renderDocumentViewer = (url) => {
        return (
            <iframe
                src={url}
                title="Document"
                width="100%"
                height="800px"
                style={{
                    border: 'none',
                    borderRadius: '10px',
                }}
            />
        );
    };

    return (
        <>
            <Navbar />
            <Container className="mt-4 d-flex justify-content-center">
                {errorMessage ? (
                    <Alert variant="danger">{errorMessage}</Alert>
                ) : document ? (
                    <Card className="shadow p-3" style={{ width: '100%', maxWidth: '1000px' }}>
                        <Card.Body className="p-0">
                            <div className="d-flex justify-content-end mb-2">
                                <Button
                                    variant="info"
                                    className="me-2"
                                    onClick={() => navigate(`/Documents/${document.id}`)}
                                >
                                    🔍 Voir détails
                                </Button>
                                <Button variant="secondary" onClick={() => navigate('/documents')}>
                                    ← Retour
                                </Button>
                            </div>
                            {document.file_path ? (
                                renderDocumentViewer(`http://localhost:5000${document.file_path}`)
                            ) : (
                                <Alert variant="warning">Aucun contenu disponible pour ce document.</Alert>
                            )}

                        </Card.Body>
                    </Card>
                ) : (
                    <p>Chargement du document...</p>
                )}
            </Container>
        </>
    );
};

export default DocVoir;
