import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Button, Container, Card, Alert, Modal } from 'react-bootstrap';
import axios from 'axios';
import Navbar from './Navbar';
import { jwtDecode } from 'jwt-decode';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const DocumentCompletion = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  // États principaux

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
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [differenceNote, setDifferenceNote] = useState('');
  const [confirmAddVersion, setConfirmAddVersion] = useState(null); // null | true | false


  // Récupérer la catégorie du document
  const category = docInfo?.category || '';



  // Vérifier les permissions
  const [canAddVersion, setCanAddVersion] = useState(false);

  useEffect(() => {
    const checkName = async () => {
      const fullName = extension ? `${baseName}.${extension}` : baseName;
      const duplicateExists = await checkForDuplicate(fullName);
      if (!duplicateExists) {
        setExistingDocument(null); // réinitialiser si pas de duplicata
      }
    };

    if (baseName.trim()) {
      checkName();
    }
    setConfirmAddVersion(null); // Réinitialiser la décision
  }, [baseName, extension]);


  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!isCompleted) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isCompleted]);

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
        const { can_modify } = permRes.data;
        setCanAddVersion(role === 'admin' || can_modify);

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
            const merged = { ...defaultFields[doc.category], ...metaRes.data };
            setExtraFields(merged);
          } catch (metaErr) {
            console.warn("Erreur chargement métadonnées:", metaErr);
            setExtraFields(defaultFields[doc.category]);
          }
        }

      } catch (error) {
        console.error("Erreur initialisation:", error);
        setErrorMessage("Erreur lors du chargement du document.");
      }
    };

    initialize();
  }, [id, token]);

  // Vérifier les champs obligatoires par catégorie
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

  // Vérifier si un document avec ce nom existe déjà
  const checkForDuplicate = async (docName) => {
    try {
      const res = await axios.get(`http://localhost:5000/api/documents/check-name?name=${docName}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.exists && res.data.document.id !== id) {
        setExistingDocument(res.data.document);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Erreur vérification doublon:", error);
      return false;
    }
  };

    const shouldShowCommonFields = (category) => {
  return !['contrat', 'rapport'].includes(category);
};
  // Enregistrer le document normalement
  const saveDocument = async () => {
  setIsSaving(true);
  try {
    const fullName = extension ? `${baseName}.${extension}` : baseName;
    const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);

    const basePayload = {
      name: fullName,
      is_completed: true,
      ...extraFields
    };

    // Ajouter les champs communs seulement si nécessaires
    const fullPayload = shouldShowCommonFields(category) 
      ? { ...basePayload, summary, tags: tagArray, priority }
      : basePayload;

    await axios.put(`http://localhost:5000/api/documents/${id}`, fullPayload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
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

  // Enregistrer comme nouvelle version
  const handleSaveAsVersion = async () => {
    if (!differenceNote.trim()) {
      setErrorMessage("Veuillez décrire les modifications apportées.");
      return;
    }

    setIsSaving(true);
    try {
      const fullName = extension ? `${baseName}.${extension}` : baseName;
      const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);

      const payload = {
        name: fullName,
        summary,
        tags: tagArray,
        priority,
        is_completed: true,
        version_note: differenceNote,
        ...extraFields
      };

      await axios.post(`http://localhost:5000/api/documents/${existingDocument.id}/versions`, payload, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      setSuccessMessage("Nouvelle version enregistrée avec succès !");
      setIsCompleted(true);
      setTimeout(() => navigate('/Documents'), 2000);
    } catch (error) {
      setErrorMessage("Échec de l'enregistrement de la nouvelle version.");
    } finally {
      setIsSaving(false);
      setShowVersionModal(false);
    }
  };

  // Soumission du formulaire
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Valider les champs obligatoires
    if (!validateCategoryFields(category, extraFields)) {
      setErrorMessage("Veuillez remplir tous les champs obligatoires pour cette catégorie.");
      return;
    }

    // Vérifier si le nom a changé
    const fullName = extension ? `${baseName}.${extension}` : baseName;
    const isNameChanged = fullName !== docInfo.name;

    // Si le nom n'a pas changé, enregistrer normalement
    if (!isNameChanged) {
      await saveDocument();
      return;
    }

    // Si le nom a changé, vérifier les doublons
    const duplicateExists = await checkForDuplicate(fullName);

    if (duplicateExists) {
      if (canAddVersion) {
        setShowVersionModal(true);
      } else {
        setErrorMessage("Un document avec ce nom existe déjà. Vous n'avez pas les droits pour le modifier. Veuillez choisir un autre nom.");
      }
    } else {
      await saveDocument();
    }
  };

  // Aperçu du document
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
      return <Alert variant="warning">Format non supporté pour l'aperçu.</Alert>;
    }
  };

  // Vérifier si le formulaire est valide
 const isFormValid = () => {
  const isCommonFieldsValid = shouldShowCommonFields(category) 
    ? baseName.trim() !== '' && summary.trim() !== '' && tags.trim() !== '' && priority.trim() !== ''
    : baseName.trim() !== '';
  
  const isCategoryValid = validateCategoryFields(category, extraFields);
  return isCommonFieldsValid && isCategoryValid;
};

  return (
    <>
      <Navbar />
      <Container fluid className="py-4" style={{ minHeight: '100vh' }}>
        {errorMessage && <Alert variant="danger" onClose={() => setErrorMessage(null)} dismissible>{errorMessage}</Alert>}
        {successMessage && <Alert variant="success" onClose={() => setSuccessMessage(null)} dismissible>{successMessage}</Alert>}

        <div className="row">
          <div className="col-md-8">
            <Card className="p-4 shadow-sm">
              <h3 className="mb-4">📝 Compléter les informations du document</h3>
              {existingDocument && existingDocument.id !== docInfo?.id && canAddVersion && confirmAddVersion === null && (
                <div className="mb-3">
                  <Alert variant="info">
                    Ce nom est déjà utilisé. Voulez-vous l’enregistrer comme une <strong>nouvelle version</strong> du document existant ?
                  </Alert>
                  <div className="d-flex gap-2">
                    <Button variant="outline-success" onClick={() => setConfirmAddVersion(true)}>
                      Oui, ajouter comme nouvelle version
                    </Button>
                    <Button variant="outline-danger" onClick={() => setConfirmAddVersion(false)}>
                      Non, je vais changer le nom
                    </Button>
                  </div>
                </div>
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
            style={{ width: '100px', backgroundColor: '#e9ecef', cursor: 'not-allowed' }}
          />
        </>
      )}
    </div>
  </Form.Group>

  {Object.entries(extraFields).map(([key, value]) => (
    <Form.Group className="mb-3" key={key}>
      <Form.Label>{key.replace(/_/g, ' ').charAt(0).toUpperCase() + key.replace(/_/g, ' ').slice(1)}</Form.Label>
      <Form.Control
        type={key.toLowerCase().includes('date') ? 'date' : 'text'}
        value={value}
        onChange={(e) =>
          setExtraFields((prev) => ({
            ...prev,
            [key]: e.target.value
          }))
        }
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
          placeholder="ex: projet, client, 2023"
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

  <div className="d-flex justify-content-end">
    <Button
      variant="success"
      type="submit"
      disabled={
        !isFormValid() ||
        isSaving ||
        (
          existingDocument &&
          existingDocument.id !== docInfo?.id &&
          (
            !canAddVersion ||
            confirmAddVersion !== true
          )
        )
      }
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

        {/* Modal pour nouvelle version */}
        <Modal show={showVersionModal} onHide={() => setShowVersionModal(false)}>
          <Modal.Header closeButton>
            <Modal.Title>Document existant détecté</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Alert variant="info" className="mb-3">
              Un document portant le nom <strong>{existingDocument?.name}</strong> existe déjà.
            </Alert>

            <p>Vous avez les droits pour :</p>
            <ul>
              <li>Ajouter ce document comme nouvelle version</li>
              <li>Modifier le nom pour créer un document distinct</li>
            </ul>

            <Form.Group className="mb-3">
              <Form.Label>Notes sur les modifications (obligatoire)</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={differenceNote}
                onChange={(e) => setDifferenceNote(e.target.value)}
                placeholder="Décrivez les changements apportés dans cette version..."
                required
              />
              <Form.Text className="text-muted">
                Ces notes aideront à identifier les différences avec la version précédente.
              </Form.Text>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowVersionModal(false)}>
              Modifier le nom
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveAsVersion}
              disabled={!differenceNote.trim() || isSaving}
            >
              {isSaving ? 'Enregistrement...' : 'Enregistrer comme nouvelle version'}
            </Button>
          </Modal.Footer>
        </Modal>
      </Container>
    </>
  );
};

export default DocumentCompletion;