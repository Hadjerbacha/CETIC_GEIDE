import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Container, Card, Spinner, Alert, ListGroup } from 'react-bootstrap';
import axios from 'axios';
import Navbar from './Navbar';

const FolderDetailsPage = () => {
  const { id } = useParams();
  const [folder, setFolder] = useState(null);
  const [subfolders, setSubfolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Récupérer le dossier parent
        const folderRes = await axios.get(`http://localhost:5000/api/folders/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setFolder(folderRes.data);

        // Récupérer les sous-dossiers
        const subRes = await axios.get(`http://localhost:5000/api/folders/${id}/children`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSubfolders(subRes.data);
      } catch (err) {
        console.error(err);
        setError("Erreur lors du chargement des détails ou des sous-dossiers.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, token]);

  return (
    <>
      <Navbar />
      <Container fluid className="py-4 px-5">
        {loading && <Spinner animation="border" />}
        {error && <Alert variant="danger">{error}</Alert>}

        {!loading && folder && (
          <Card className="shadow-lg border-0 w-100 p-4">
            <Card.Body>
              <Card.Title className="mb-4 display-6">📁 Détails du dossier</Card.Title>
              <p><strong>ID :</strong> {folder.id}</p>
              <p><strong>Nom :</strong> {folder.name}</p>
              <p><strong>Description :</strong> {folder.description || 'Aucune description fournie.'}</p>
              <p><strong>Date de création :</strong> {new Date(folder.date).toLocaleDateString()}</p>

              <hr />

              <h5 className="mt-4 mb-3">📂 Sous-dossiers</h5>
              {subfolders.length === 0 ? (
                <p>Aucun sous-dossier.</p>
              ) : (
                <ListGroup>
                  {subfolders.map((sub) => (
                    <ListGroup.Item key={sub.id}>{sub.name}</ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </Card.Body>
          </Card>
        )}
      </Container>
    </>
  );
};

export default FolderDetailsPage;
