import React, { useEffect, useState } from 'react';
import { Container, Card, Button, Alert, Spinner, Row, Col, Dropdown, DropdownButton, Form } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from './Navbar';
import { FaFolderOpen, FaPlus } from 'react-icons/fa';

const FolderListPage = () => {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortOption, setSortOption] = useState('date');
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchFolders = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/folders', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setFolders(res.data);
      } catch (err) {
        console.error('Erreur chargement des dossiers :', err);
        setError("Erreur lors du chargement des dossiers.");
      } finally {
        setLoading(false);
      }
    };

    fetchFolders();
  }, [token]);

  const handleViewFolder = (folderId) => {
    navigate(`/folder/${folderId}`);
  };

  const handleAddSubfolder = (parentId) => {
    navigate(`/folders/upload?parent=${parentId}`);
  };

  const sortFolders = (folders) => {
    switch (sortOption) {
      case 'alpha':
        return [...folders].sort((a, b) => a.name.localeCompare(b.name));
      case 'size':
        return [...folders].sort((a, b) => (b.size || 0) - (a.size || 0));
      case 'count':
        return [...folders].sort((a, b) => (b.file_count || 0) - (a.file_count || 0));
      case 'date':
      default:
        return [...folders].sort((a, b) => new Date(b.date) - new Date(a.date));
    }
  };

  const filteredFolders = folders.filter(folder =>
    folder.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (folder.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedFolders = sortFolders(filteredFolders);

  return (
    <>
      <Navbar />
      <Container fluid className="py-4">
        <div className="mb-4">
          <h3 className="mb-3">📁 Gestion des dossiers</h3>
          <Form className="mb-3">
            <Form.Control
              type="text"
              placeholder="🔍 Rechercher un dossier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </Form>
          <div className="d-flex justify-content-end">
            <DropdownButton id="dropdown-sort" title={`Trier par`} variant="outline-secondary" onSelect={setSortOption}>
              <Dropdown.Item eventKey="date">Date</Dropdown.Item>
              <Dropdown.Item eventKey="alpha">Nom (A-Z)</Dropdown.Item>
              <Dropdown.Item eventKey="size">Taille</Dropdown.Item>
              <Dropdown.Item eventKey="count">Nombre de fichiers</Dropdown.Item>
            </DropdownButton>
          </div>
        </div>

        {loading && <Spinner animation="border" />} 
        {error && <Alert variant="danger">{error}</Alert>}

        {!loading && !error && sortedFolders.length === 0 && (
          <Alert variant="info">Aucun dossier trouvé.</Alert>
        )}

        <Row xs={1} md={2} lg={3} className="g-4">
          {sortedFolders.map(folder => (
            <Col key={folder.id}>
              <Card className="h-100 shadow-sm border-0">
                <Card.Body>
                  <Card.Title className="d-flex justify-content-between align-items-center">
                    <span><FaFolderOpen className="me-2 text-primary" /> {folder.name}</span>
                    <Button 
                      variant="light" 
                      size="sm" 
                      title="Ajouter un sous-dossier"
                      onClick={() => handleAddSubfolder(folder.id)}
                    >
                      <FaPlus />
                    </Button>
                  </Card.Title>
                  <Card.Text>{folder.description || 'Aucune description'}</Card.Text>
                </Card.Body>
                <Card.Footer className="text-end bg-white border-top-0">
                  <div className="d-flex justify-content-between">
                    <small className="text-muted">
                      📅 {new Date(folder.date).toLocaleDateString()}
                    </small>
                    <Button 
                      variant="outline-primary" 
                      size="sm" 
                      onClick={() => handleViewFolder(folder.id)}
                    >
                      Ouvrir
                    </Button>
                  </div>
                </Card.Footer>
              </Card>
            </Col>
          ))}
        </Row>
      </Container>
    </>
  );
};

export default FolderListPage;