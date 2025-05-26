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

  const [isDuplicate, setIsDuplicate] = useState(false);
  const [canAddVersion, setCanAddVersion] = useState(false);
  const [differenceNote, setDifferenceNote] = useState('');

  const [baseName, setBaseName] = useState('');
  const [extension, setExtension] = useState('');


  useEffect(() => {
    const fetchDocumentAndMetadata = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/documents/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const doc = res.data;
        setDocInfo(doc);
        const parts = doc.name.split('.');
        if (parts.length > 1) {
          setExtension(parts.pop()); // Dernière partie = extension
          setBaseName(parts.join('.')); // Tout le reste
        } else {
          setBaseName(doc.name);
          setExtension('');
        }

        setSummary(doc.summary || '');
        setTags((doc.tags || []).join(', '));
        setPriority(doc.priority || '');

        const defaultFields = {
          facture: {
            num_facture: '',
            nom_entreprise: '',
            produit: '',
            montant: '',
            date_facture: ''
          },
          cv: {
            num_cv: '',
            nom_candidat: '',
            metier: '',
            lieu: '',
            experience: '',
            domaine: ''
          },
          demande_conge: {
            num_demande: '',
            date_debut: '',
            date_fin: '',
            motif: ''
          }
        };

        if (doc.category && defaultFields[doc.category]) {
          try {
            const metaRes = await axios.get(`http://localhost:5000/api/documents/${id}/metadata`, {
              headers: { Authorization: `Bearer ${token}` }
            });

            const merged = { ...defaultFields[doc.category], ...metaRes.data };
            setExtraFields(merged);
          } catch (metaErr) {
            console.warn("⚠️ Erreur chargement métadonnées :", metaErr);
            setExtraFields(defaultFields[doc.category]);
          }
        } else {
          setExtraFields({});
        }

        // Vérifier les doublons
        const resAll = await axios.get(`http://localhost:5000/api/documents`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const otherDocs = resAll.data.filter(d => d.id !== doc.id);
        const duplicate = otherDocs.find(d => d.name === doc.name);

        if (duplicate) {
          setIsDuplicate(true);
          const isAdmin = localStorage.getItem('role') === 'admin';
          const canModify = doc.permissions?.can_modify === true;

          setCanAddVersion(isAdmin || canModify);
        }

      } catch (error) {
        console.error('Erreur chargement document :', error);
        setErrorMessage("Erreur lors du chargement du document.");
      }
    };

    if (id && token) fetchDocumentAndMetadata();
  }, [id, token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);

    if (isDuplicate && !canAddVersion) {
      setErrorMessage("❌ Ce nom est déjà utilisé. Veuillez en choisir un autre.");
      return;
    }

    try {
      setIsSaving(true);

      await axios.put(`http://localhost:5000/api/documents/${id}`, {
        name,
        summary,
        tags: tagArray,
        prio: priority,
        ...extraFields,
        difference_note: isDuplicate && canAddVersion ? differenceNote : undefined
      }, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      setSuccessMessage("✅ Document enregistré avec succès !");
      setTimeout(() => {
        navigate('/Documents');
      }, 2000);

    } catch (error) {
      console.error(error);
      setIsSaving(false);
      setErrorMessage("❌ Échec de la mise à jour.");
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
        />
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

  const fetchPermissions = async () => {
    const res = await axios.get(`http://localhost:5000/api/documents/${id}/my-permissions`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const { can_modify, access_type } = res.data;
    const isAdmin = localStorage.getItem('role') === 'admin';

    setCanAddVersion(isAdmin || can_modify);
  };


  return (
    <>
      <Navbar />
      <Container fluid className="py-4" style={{ minHeight: '100vh' }}>
        {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}
        {successMessage && <Alert variant="success">{successMessage}</Alert>}

        <div className="row">
          <div className="col-md-8">
            <Card className="p-4 shadow-sm">
              <h3 className="mb-4">📝 Compléter les informations du document</h3>
              {isDuplicate && (
                <Alert variant={canAddVersion ? "info" : "danger"}>
                  {canAddVersion ? (
                    <>⚠️ Un document avec ce nom existe déjà. Vous pouvez l'enregistrer comme <strong>nouvelle version</strong>.<br />Veuillez décrire les différences ci-dessous.</>
                  ) : (
                    <>🚫 Un document avec ce nom existe déjà <strong>Veuillez changer le nom du document.</strong></>
                  )}
                </Alert>
              )}
              <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3">
  <Form.Label>Nom du document</Form.Label>
  <div className="d-flex align-items-center">
    <Form.Control
      type="text"
      value={baseName}
      onChange={(e) => setBaseName(e.target.value)}
      required
    />
    <span className="ms-2">.<strong>{extension}</strong></span>
  </div>
</Form.Group>


                {Object.entries(extraFields).map(([key, value]) => (
                  <Form.Group className="mb-3" key={key}>
                    <Form.Label>{key.replace(/_/g, ' ').toUpperCase()}</Form.Label>
                    <Form.Control
                      type={key.toLowerCase().includes('date') ? 'date' : 'text'}
                      value={value}
                      onChange={(e) =>
                        setExtraFields((prev) => ({
                          ...prev,
                          [key]: e.target.value
                        }))
                      }
                    />
                  </Form.Group>
                ))}

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
                  <Form.Select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    <option value="">-- Choisir --</option>
                    <option value="basse">Basse</option>
                    <option value="moyenne">Moyenne</option>
                    <option value="haute">Haute</option>
                  </Form.Select>
                </Form.Group>

                {isDuplicate && canAddVersion && (
                  <Form.Group className="mb-3">
                    <Form.Label>Différences avec la version précédente</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={differenceNote}
                      onChange={(e) => setDifferenceNote(e.target.value)}
                      placeholder="Décrivez ce qui change par rapport à la version précédente..."
                      required
                    />
                  </Form.Group>
                )}

                <div className="d-flex justify-content-end">
                  <Button
                    variant={isSaving ? 'success' : 'primary'}
                    type="submit"
                    disabled={isSaving}
                    className={isSaving ? 'btn-success-message' : ''}
                  >
                    {isSaving ? '✅ Enregistrement...' : 'Enregistrer'}
                  </Button>
                </div>
              </Form>
            </Card>
          </div>

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
