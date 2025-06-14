import React, { useState, useEffect } from 'react';
import { Table, Button, Form, Col, Row, Container, Card, Alert, InputGroup } from 'react-bootstrap';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import Navbar from './Navbar';
import { FaSearch, FaArrowLeft } from 'react-icons/fa';

const DocNonComplete = () => {
  const [documents, setDocuments] = useState([]);
  const [filteredDocuments, setFilteredDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterType, setFilterType] = useState('Tous les documents');
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchIncompleteDocuments = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/documents/incomplete', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setDocuments(res.data);
        setFilteredDocuments(res.data);
        setLoading(false);
      } catch (err) {
        setError('Erreur lors du chargement des documents');
        setLoading(false);
        console.error(err);
      }
    };

    fetchIncompleteDocuments();
  }, [token]);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, startDate, endDate, filterType, documents]);

  const applyFilters = () => {
    let results = [...documents];

    // Filtre par recherche textuelle
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      results = results.filter(doc => 
        doc.name.toLowerCase().includes(query) ||
        (doc.description && doc.description.toLowerCase().includes(query))
      );
    }

    // Filtre par type de document
    if (filterType !== 'Tous les documents') {
      results = results.filter(doc => {
        const extension = doc.file_path?.split('.').pop().toLowerCase();
        return extension === filterType.toLowerCase();
      });
    }

    // Filtre par date
    if (startDate) {
      results = results.filter(doc => {
        const docDate = new Date(doc.created_at);
        return docDate >= new Date(startDate);
      });
    }

    if (endDate) {
      results = results.filter(doc => {
        const docDate = new Date(doc.created_at);
        return docDate <= new Date(endDate);
      });
    }

    setFilteredDocuments(results);
  };

  const handleCompleteDocument = (docId) => {
    navigate(`/document/${docId}/complete`);
  };

  const resetFilters = () => {
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    setFilterType('Tous les documents');
    setFilteredDocuments(documents);
  };

  const handleGoBack = () => {
    if (location.state?.from) {
      navigate(location.state.from);
    } else {
      navigate(-1); // Retour à la page précédente par défaut
    }
  };

  return (
    <>
      <Navbar />
      <Container className="mt-4">
        <Card>
          <Card.Body>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <Card.Title className="mb-0">Documents non complétés</Card.Title>
              <Button 
                variant="outline-secondary" 
                onClick={handleGoBack}
                className="d-flex align-items-center"
              >
                <FaArrowLeft className="me-2" />
                Retour
              </Button>
            </div>

            {/* Barre de recherche et filtres */}
            <Row className="mb-4">
              <Col md={4}>
                <InputGroup>
                  <InputGroup.Text>
                    <FaSearch />
                  </InputGroup.Text>
                  <Form.Control
                    type="text"
                    placeholder="Rechercher par nom..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </InputGroup>
              </Col>
              <Col md={2}>
                <Form.Select 
                  value={filterType} 
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="Tous les documents">Tous les types</option>
                  <option value="pdf">PDF</option>
                  <option value="docx">Word</option>
                  <option value="xlsx">Excel</option>
                  <option value="jpg">Image (JPG)</option>
                  <option value="png">Image (PNG)</option>
                </Form.Select>
              </Col>
              <Col md={2}>
                <Form.Control
                  type="date"
                  placeholder="Date de début"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </Col>
              <Col md={2}>
                <Form.Control
                  type="date"
                  placeholder="Date de fin"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </Col>
            </Row>

            {loading ? (
              <Alert variant="info">Chargement en cours...</Alert>
            ) : error ? (
              <Alert variant="danger">{error}</Alert>
            ) : filteredDocuments.length === 0 ? (
              <Alert variant="info">Aucun document non complété trouvé</Alert>
            ) : (
              <Table striped bordered hover responsive>
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.map(doc => (
                    <tr key={doc.id}>
                      <td>{doc.name}</td>
                      <td>{new Date(doc.created_at).toLocaleDateString()}</td>
                      <td>{doc.file_path?.split('.').pop().toUpperCase()}</td>
                      <td>
                        <Button 
                          variant="primary" 
                          size="sm"
                          onClick={() => handleCompleteDocument(doc.id)}
                          className="me-2"
                        >
                          Compléter
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card.Body>
        </Card>
      </Container>
    </>
  );
};

export default DocNonComplete;