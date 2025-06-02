import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Button, Container, Card, Alert } from 'react-bootstrap';
import axios from 'axios';
import Navbar from './Navbar';
import { jwtDecode } from 'jwt-decode';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

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
  const [userId, setUserId] = useState(null);
  const [userRole, setUserRole] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [existingDocumentId, setExistingDocumentId] = useState(null);
  const [documentName, setDocumentName] = useState('');
const [documentSummary, setDocumentSummary] = useState('');
const saveDocumentVersion = async (id, file) => {
  // logique ici
};

  // Modifiez le useEffect pour récupérer le rôle
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const { id, role } = jwtDecode(token);
        setUserId(id);
        setUserRole(role);
      } catch (e) {
        console.error('Token invalide:', e);
      }
    }
  }, []);



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
          const isAdmin = userRole === 'admin';
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

  console.log('🔍 userRole', userRole);

  // Annule l'action actuelle (retour ou reset selon votre logique)
const handleCancel = () => {
  // Exemple : revenir à la page précédente ou fermer la section duplication
  setIsDuplicate(false);
  setDifferenceNote('');
};

// Enregistre comme une nouvelle version
const handleSaveAsNewVersion = () => {
  if (!differenceNote.trim()) return;

  // Ajoutez ici l’appel à votre fonction backend d'enregistrement
  // Exemple :
  const payload = {
    originalDocumentId: existingDocumentId,
    newVersionNote: differenceNote,
    file: uploadedFile,
    // autres métadonnées nécessaires
  };

  // Appel à l'API (exemple avec fetch ou axios)
  saveDocumentVersion(payload)
    .then(() => {
      toast.success("Nouvelle version enregistrée avec succès !");
      navigate("/documents"); // ou autre redirection
    })
    .catch((error) => {
      console.error("Erreur lors de l'enregistrement :", error);
      toast.error("Échec de l'enregistrement de la nouvelle version.");
    });
};

// Propose de renommer le fichier
const handleRename = () => {
  // Ici vous pouvez soit :
  // - afficher une modal de renommage
  // - ou directement vider le champ pour laisser l’utilisateur en saisir un nouveau

  // Exemple simple : vider le nom pour forcer un nouveau
  setDocumentName('');
  toast.info("Veuillez saisir un nouveau nom de document.");
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
  userRole === "admin" ? (
    <>
      <Alert variant="info">
        ⚠️ Un document portant ce nom existe déjà. Vous pouvez l'enregistrer comme une <strong>nouvelle version</strong>.<br />
        Merci d’indiquer les différences par rapport à la version précédente.
      </Alert>

      <Form.Group className="mb-3">
        <Form.Label>Différences apportées</Form.Label>
        <Form.Control
          as="textarea"
          rows={3}
          value={differenceNote}
          onChange={(e) => setDifferenceNote(e.target.value)}
          placeholder="Précisez les modifications ou ajouts apportés à cette version..."
          required
        />
      </Form.Group>

      <div className="d-flex justify-content-end gap-2">
        <Button
          variant="secondary"
          onClick={handleCancel} // à définir si pas encore fait
        >
          Annuler
        </Button>
        <Button
          variant="primary"
          onClick={handleSaveAsNewVersion} // à définir aussi
          disabled={!differenceNote.trim()} // pour éviter les validations vides
        >
          Enregistrer comme nouvelle version
        </Button>
      </div>
    </>
  ) : (
    <>
      <Alert variant="danger">
        ❌ Ce nom de document est déjà utilisé et vous ne disposez pas des droits de modification.<br />
        Veuillez renommer votre fichier pour poursuivre l’enregistrement.
      </Alert>

      <div className="d-flex justify-content-end">
        <Button
          variant="warning"
          onClick={handleRename} // à définir pour proposer le renommage
        >
          Renommer le fichier
        </Button>
      </div>
    </>
  )
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
