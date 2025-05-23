import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Button, Container, Card, Alert } from 'react-bootstrap';
import axios from 'axios';
import Navbar from './Navbar';

const DocumentCompletion = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  
  const [docInfo, setDocInfo] = useState(null);
  const [name, setName] = useState('');
  const [summary, setSummary] = useState('');
  const [tags, setTags] = useState('');
  const [priority, setPriority] = useState('');
  const [extraFields, setExtraFields] = useState({});
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/documents/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const doc = res.data;
        setDocInfo(doc);
        setName(doc.name);
        setSummary(doc.summary || '');
        setTags((doc.tags || []).join(', '));
        setPriority(doc.priority || '');
      } catch (error) {
        console.error('Erreur chargement document :', error);
        setErrorMessage("Erreur lors du chargement du document.");
      }
    };

    if (id && token) fetchDocument();
  }, [id, token]);

  useEffect(() => {
    if (!docInfo) return;
    switch (docInfo.category) {
      case 'facture':
        setExtraFields({
          montant: '',
          date_facture: '',
          numero_facture: ''
        });
        break;
      case 'cv':
        setExtraFields({
          nom_candidat: '',
          experience: '',
          domaine: ''
        });
        break;
      default:
        setExtraFields({});
    }
  }, [docInfo]);

const handleSubmit = async (e) => {
  e.preventDefault();
  const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);

  try {
    setIsSaving(true); // On active le mode sauvegarde / succès

    await axios.put(`http://localhost:5000/api/documents/${id}`, {
      name,
      summary,
      tags: tagArray,
      prio: priority,
      ...extraFields
    }, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });

    setSuccessMessage("Document enregistré avec succès !");
    
    // Après 2 secondes on redirige
    setTimeout(() => {
      navigate('/Documents');
    }, 2000);

  } catch (error) {
    setIsSaving(false);
    setErrorMessage("Échec de la mise à jour.");
  }
};
  const renderDocumentViewer = () => {
  if (!docInfo || !docInfo.file_path) return null;

  const fileExtension = docInfo.file_path.split('.').pop().toLowerCase();
  const fullUrl = `http://localhost:5000${docInfo.file_path}`;

  if (['jpg', 'jpeg', 'png'].includes(fileExtension)) {
    return <img src={fullUrl} alt="document" style={{ width: '100%' }} />;
  } else if (fileExtension === 'pdf') {
    return (
      <iframe
        title="PDF Viewer"
        src={fullUrl}
        width="100%"
        height="600px"
        style={{ border: 'none' }}
      ></iframe>
    );
  } else if (['mp4', 'webm', 'ogg'].includes(fileExtension)) {
    return (
      <video controls style={{ width: '100%' }}>
        <source src={fullUrl} type={`video/${fileExtension}`} />
        Votre navigateur ne supporte pas la lecture de cette vidéo.
      </video>
    );
  } else {
    return <Alert variant="warning">Format non supporté pour l’aperçu.</Alert>;
  }
};


  return (
    <>  <Navbar />
 <Container fluid className="py-4" style={{ minHeight: '100vh' }}>
  {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}

  <div className="row">
    {/* Formulaire : 8 colonnes */}
    <div className="col-md-8">
      <Card className="p-4 shadow-sm">
        <h3 className="mb-4">📝 Compléter les informations du document</h3>
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Nom du document</Form.Label>
            <Form.Control
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Description</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Tags</Form.Label>
            <Form.Control
              type="text"
              placeholder="mot1, mot2, mot3"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Priorité</Form.Label>
            <Form.Select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="">-- Choisir --</option>
              <option value="basse">Basse</option>
              <option value="moyenne">Moyenne</option>
              <option value="haute">Haute</option>
            </Form.Select>
          </Form.Group>

          {Object.entries(extraFields).map(([key, value]) => (
            <Form.Group className="mb-3" key={key}>
              <Form.Label>{key.replace('_', ' ').toUpperCase()}</Form.Label>
              <Form.Control
                type="text"
                value={value}
                onChange={(e) => setExtraFields(prev => ({ ...prev, [key]: e.target.value }))}
              />
            </Form.Group>
          ))}

          <div className="d-flex justify-content-end">
        <Button
  variant={isSaving ? "success" : "primary"}
  type="submit"
  disabled={isSaving}
  className={isSaving ? "btn-success-message" : ""}
>
  {isSaving ? (
    <>
      ✅ Document enregistré avec succès
    </>
  ) : (
    "Enregistrer"
  )}
</Button>

          </div>
        </Form>
      </Card>
    </div>

    {/* Aperçu : 4 colonnes */}
    <div className="col-md-4">
      <Card className="p-3 shadow-sm">
        <h5 className="mb-3">📄 Aperçu du document</h5>
        {renderDocumentViewer()}
      </Card>
    </div>
  </div>
</Container>

      </>
  );
};

export default DocumentCompletion;
