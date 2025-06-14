import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Button, Container, Card, Alert } from 'react-bootstrap';
import axios from 'axios';
import Navbar from './Navbar';
import { jwtDecode } from 'jwt-decode';

const DocumentCompletion = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  // États
  const [docInfo, setDocInfo] = useState(null);
  const [baseName, setBaseName] = useState('');
  const [extension, setExtension] = useState('');
  const [summary, setSummary] = useState('');
  const [tags, setTags] = useState('');
  const [priority, setPriority] = useState('');
  const [extraFields, setExtraFields] = useState({});
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [userId, setUserId] = useState(null);
  const [userRole, setUserRole] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  const [existingDocument, setExistingDocument] = useState(null);
  const [differenceNote, setDifferenceNote] = useState('');
  const [canAddVersion, setCanAddVersion] = useState(false);
  const [isNewVersion, setIsNewVersion] = useState(false);

  const category = docInfo?.category || '';

  useEffect(() => {
    const checkName = async () => {
      const fullName = extension ? `${baseName}.${extension}` : baseName;
      const duplicateExists = await checkForDuplicate(fullName);
      if (!duplicateExists) {
        setExistingDocument(null);
        setIsNewVersion(false);
      }
    };

    if (baseName.trim()) {
      checkName();
    }
  }, [baseName, extension]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (baseName.trim()) {
        const fullName = extension ? `${baseName}.${extension}` : baseName;
        await checkForDuplicate(fullName);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [baseName, extension]);

  useEffect(() => {
    const initialize = async () => {
      if (!id || !token) return;

      try {
        // Récupération des infos utilisateur
        const { id: decodedId, role } = jwtDecode(token);
        setUserId(decodedId);
        setUserRole(role);

        // Vérification des permissions
        const permRes = await axios.get(`http://localhost:5000/api/documents/${id}/my-permissions`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCanAddVersion(role === 'admin' || permRes.data.can_modify);

        // Chargement du document
        const res = await axios.get(`http://localhost:5000/api/documents/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const doc = res.data;
        setDocInfo(doc);
        setSummary(doc.summary || '');
        setTags((doc.tags || []).join(', '));
        setPriority(doc.priority || '');

        // Extraction du nom et extension
        const parts = doc.name.split('.');
        if (parts.length > 1) {
          setExtension(parts.pop());
          setBaseName(parts.join('.'));
        } else {
          setBaseName(doc.name);
          setExtension('');
        }

        // Champs spécifiques par catégorie
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
          },
          contrat: {
            numero_contrat: '',
            type_contrat: '',
            partie_prenante: '',
            date_signature: '',
            date_echeance: '',
            montant: '',
            statut: ''
          },
          rapport: {
            type_rapport: '',
            auteur: '',
            date_rapport: '',
            periode_couverte: '',
            destinataire: ''
          }
        };

        if (doc.category && defaultFields[doc.category]) {
          try {
            const metaRes = await axios.get(`http://localhost:5000/api/documents/${id}/metadata`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            setExtraFields({ ...defaultFields[doc.category], ...metaRes.data });
          } catch (metaErr) {
            setExtraFields(defaultFields[doc.category]);
          }
        }

      } catch (error) {
        setErrorMessage("Erreur lors du chargement du document.");
      }
    };

    initialize();
  }, [id, token]);

  const validateCategoryFields = (category, values) => {
    switch (category) {
      case 'facture':
        return values.num_facture && values.nom_entreprise && values.montant && values.date_facture;
      case 'cv':
        return values.num_cv && values.nom_candidat && values.metier && values.lieu;
      case 'demande_conge':
        return values.num_demande && values.date_debut && values.date_fin && values.motif;
      case 'contrat':
        return values.numero_contrat && values.type_contrat && values.partie_prenante && values.date_signature;
      case 'rapport':
        return values.type_rapport && values.auteur && values.date_rapport;
      default:
        return true;
    }
  };

  const checkForDuplicate = async (docName) => {
    if (!docName.trim()) return false;

    try {
      const res = await axios.get(`http://localhost:5000/api/documents/check-name`, {
        params: { name: docName, currentDocId: id },
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.exists) {
        setExistingDocument(res.data.document);
        return true;
      }
      return false;
    } catch (error) {
      setErrorMessage("Erreur lors de la vérification du nom");
      return false;
    }
  };

  const shouldShowCommonFields = (category) => {
    return !['contrat', 'rapport'].includes(category);
  };

  const saveDocument = async () => {
    setIsSaving(true);
    try {
      const fullName = extension ? `${baseName}.${extension}` : baseName;
      const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);

      const payload = {
        name: fullName,
        is_completed: true,
        summary,
        tags: tagArray,
        priority,
        ...extraFields
      };

      await axios.put(`http://localhost:5000/api/documents/${id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccessMessage("Document enregistré avec succès !");
      setIsCompleted(true);
      setTimeout(() => navigate('/Documents'), 2000);
    } catch (error) {
      setErrorMessage("Échec de la mise à jour.");
    } finally {
      setIsSaving(false);
    }
  };

 const handleSaveAsVersion = async () => {
  setIsSaving(true);
  try {
    const fullName = extension ? `${baseName}.${extension}` : baseName;
    const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);

    const payload = {
      name: fullName,
      summary,
      tags: tagArray,
      priority,
      diff_version: differenceNote, // Note de version
      is_completed: true, // Marquer comme complet
      ...extraFields
    };

    // Utilisation de la route PUT au lieu de POST /versions
    await axios.put(`http://localhost:5000/api/documents/${id}`, payload, {
      headers: { Authorization: `Bearer ${token}` }
    });

    setSuccessMessage("Document enregistré comme nouvelle version avec succès !");
    setIsCompleted(true);
    setTimeout(() => navigate('/Documents'), 2000);
  } catch (error) {
    setErrorMessage(error.response?.data?.error || "Échec de l'enregistrement");
  } finally {
    setIsSaving(false);
  }
};

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validateCategoryFields(category, extraFields)) {
      setErrorMessage("Veuillez remplir tous les champs obligatoires");
      return;
    }

    if (isNewVersion && !differenceNote.trim()) {
      setErrorMessage("Veuillez décrire les modifications pour la nouvelle version");
      return;
    }

    try {
      if (isNewVersion) {
        await handleSaveAsVersion();
      } else {
        await saveDocument();
      }
    } catch (error) {
      setErrorMessage(error.message || "Erreur lors de l'enregistrement");
    }
  };

  const isFormValid = () => {
    const isCommonFieldsValid = shouldShowCommonFields(category) 
      ? baseName.trim() && summary.trim() && tags.trim() && priority.trim()
      : baseName.trim();
    
    const isCategoryValid = validateCategoryFields(category, extraFields);
    const hasNameConflict = existingDocument && existingDocument.id !== docInfo?.id && !canAddVersion;
    
    return isCommonFieldsValid && isCategoryValid && !hasNameConflict;
  };

  const renderDocumentViewer = () => {
    if (!docInfo?.file_path) return null;

    const fileExtension = docInfo.file_path.split('.').pop().toLowerCase();
    const fullUrl = `http://localhost:5000${docInfo.file_path}`;

    if (['jpg', 'jpeg', 'png'].includes(fileExtension)) {
      return <img src={fullUrl} alt="document" className="w-100" />;
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
    } else {
      return <Alert variant="warning">Format non supporté pour l'aperçu.</Alert>;
    }
  };

  return (
    <>
      <Navbar />
      <Container fluid className="py-4" style={{ minHeight: '100vh' }}>
        {errorMessage && <Alert variant="danger" dismissible onClose={() => setErrorMessage(null)}>{errorMessage}</Alert>}
        {successMessage && <Alert variant="success" dismissible onClose={() => setSuccessMessage(null)}>{successMessage}</Alert>}

        <div className="row">
          <div className="col-md-8">
            <Card className="p-4 shadow-sm">
              <h3 className="mb-4">📝 Compléter les informations du document</h3>

              {existingDocument && existingDocument.id !== docInfo?.id && (
                <Alert variant={canAddVersion ? "warning" : "danger"} className="mb-3">
                  <strong>Un document avec ce nom existe déjà.</strong>
                  {canAddVersion ? (
                    <Form.Check
                      type="switch"
                      id="version-switch"
                      label="Ajouter comme nouvelle version"
                      checked={isNewVersion}
                      onChange={() => setIsNewVersion(!isNewVersion)}
                      className="mt-2"
                    />
                  ) : (
                    <p className="mb-0 mt-2">Vous n'avez pas les droits de modification.</p>
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
                    {extension && (
                      <>
                        <span className="mx-2">.</span>
                        <Form.Control
                          type="text"
                          value={extension}
                          readOnly
                          style={{ width: '100px', backgroundColor: '#e9ecef' }}
                        />
                      </>
                    )}
                  </div>
                </Form.Group>

                {Object.entries(extraFields).map(([key, value]) => (
                  <Form.Group className="mb-3" key={key}>
                    <Form.Label>
                      {key.replace(/_/g, ' ').charAt(0).toUpperCase() + key.replace(/_/g, ' ').slice(1)}
                    </Form.Label>
                    <Form.Control
                      type={key.toLowerCase().includes('date') ? 'date' : 'text'}
                      value={value}
                      onChange={(e) => setExtraFields(prev => ({ ...prev, [key]: e.target.value }))}
                      required={validateCategoryFields(category, extraFields)}
                    />
                  </Form.Group>
                ))}

                {shouldShowCommonFields(category) && (
                  <>
                    <Form.Group className="mb-3">
                      <Form.Label>Description</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        required
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Tags (séparés par des virgules)</Form.Label>
                      <Form.Control
                        type="text"
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        required
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Priorité</Form.Label>
                      <Form.Select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                        required
                      >
                        <option value="">-- Choisir --</option>
                        <option value="basse">Basse</option>
                        <option value="moyenne">Moyenne</option>
                        <option value="haute">Haute</option>
                      </Form.Select>
                    </Form.Group>
                  </>
                )}

                {isNewVersion && (
                  <Form.Group className="mb-3">
                    <Form.Label>Modifications apportées (obligatoire)</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={differenceNote}
                      onChange={(e) => setDifferenceNote(e.target.value)}
                      placeholder="Décrivez les changements par rapport à la version précédente"
                      required
                    />
                  </Form.Group>
                )}

                <div className="d-flex justify-content-between">
                  {existingDocument && canAddVersion && !isNewVersion && (
                    <Button 
                      variant="outline-secondary"
                      onClick={() => setBaseName(prev => `${prev}_${Date.now()}`)}
                    >
                      Modifier le nom
                    </Button>
                  )}
                  
                  <Button
                    variant="success"
                    type="submit"
                    disabled={!isFormValid() || isSaving}
                    className="ms-auto"
                  >
                    {isSaving ? 'Enregistrement...' : 'Enregistrer'}
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