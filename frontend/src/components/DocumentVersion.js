import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, Spinner, Tooltip, OverlayTrigger, Container, Row, Col, Button, Form, Table, Alert, InputGroup, FormControl, Modal } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import Navbar from './Navbar';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import 'react-toastify/dist/ReactToastify.css';
import shareIcon from './img/share.png';
import { jwtDecode } from 'jwt-decode';
import { toast } from 'react-toastify';
import { FaCloudUploadAlt } from 'react-icons/fa';
import { useParams } from 'react-router-dom';

const DocumentVersion = () => {
  const { id } = useParams();
  const [documents, setDocuments] = useState([]);
  const [savedDocuments, setSavedDocuments] = useState([]);
  const [pendingName, setPendingName] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('Tous les documents');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [useAdvancedFilter, setUseAdvancedFilter] = useState(false);
  const [category, setCategory] = useState('');
  const [collectionName, setCollectionName] = useState('');
  const [collections, setCollections] = useState([]);
  const [isSavingCollection, setIsSavingCollection] = useState(false);
  const [selectedExistingCollection, setSelectedExistingCollection] = useState('');
  const [selectedVersion, setSelectedVersion] = useState(null);

  const [users, setUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [description, setDescription] = useState('');

  const [showConflictPrompt, setShowConflictPrompt] = useState(false);
  const [conflictingDocName, setConflictingDocName] = useState('');
  const [forceUpload, setForceUpload] = useState(false);
  const [tags, setTags] = useState([]);
  const [priority, setPriority] = useState('');
  const [accessType, setAccessType] = useState('private');

  //modal
  const [showShareModal, setShowShareModal] = useState(false);
  const [docToShare, setDocToShare] = useState(null);
  const [shareAccessType, setShareAccessType] = useState('private');
  const [shareUsers, setShareUsers] = useState([]);



  const token = localStorage.getItem('token');
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();

  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const { id } = jwtDecode(token);
        setUserId(id);
      } catch (e) {
        console.error('Token invalide :', e);
      }
    }
  }, []);

  //fonction MODAL
  const openShareModal = (doc) => {
    setDocToShare(doc);
    setShareAccessType(doc.access || 'private');
    setShareUsers(doc.allowedUsers || []);
    setShowShareModal(true);
  };

  const fetchDocuments = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/documents/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) throw new Error('Non autorisé');
      const data = await res.json();
      if (Array.isArray(data)) {
        setDocuments(data);
        const names = data.map(doc => doc.collectionName).filter(name => name && typeof name === 'string');
        setCollections([...new Set(names)]);
      } else {
        console.error('Données invalides :', data);
        setDocuments([]);
        setCollections([]);
      }
    } catch (err) {
      console.error('Erreur chargement documents :', err);
      setErrorMessage("Erreur d'autorisation ou de connexion.");
    }
  };

  useEffect(() => {
    fetchDocuments();
    fetchUsers();
  }, [token]);


  const fetchUsers = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/auth/users/');
      const formatted = res.data.map(u => ({ value: u.id, label: `${u.name} ${u.prenom}` }));
      setUsers(formatted);
    } catch (err) {
      console.error('Erreur chargement des utilisateurs', err);
    }
  };


  // Consultation
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const consultDocument = url => {
    window.open(`http://localhost:5000${url}`, '_blank');
  };

  const handleDelete = async id => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) return;
    try {
      await fetch(`http://localhost:5000/api/documents/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setDocuments(docs => docs.filter(d => d.id !== id));
      setSavedDocuments(docs => docs.filter(d => d.id !== id));
    } catch (err) {
      console.error('Erreur suppression :', err);
    }
  };


  // Déclaration de la liste des utilisateurs autorisés
  const [allowedUsers, setAllowedUsers] = useState([]);

  // Exemple de fonction pour ajouter un utilisateur à la liste
  const handleAddUser = (user) => {
    setAllowedUsers([...allowedUsers, user]);
  };

  // Exemple de fonction pour supprimer un utilisateur de la liste
  const handleRemoveUser = (user) => {
    setAllowedUsers(allowedUsers.filter(u => u !== user));
  };

  //Upload
  const handleUpload = async () => {
    if (!pendingFile || !pendingName || !category) {
      setErrorMessage('Veuillez remplir tous les champs requis.');
      return;
    }

    const existingDoc = documents.find(d => d.name === pendingName);

    if (existingDoc && !forceUpload) {
      // Affiche une modale ou demande confirmation personnalisée
      setConflictingDocName(pendingName);
      setShowConflictPrompt(true); // Cette modale doit avoir un bouton "Oui" → uploadNewVersion
      return;
    }

    // Cas standard : upload d’un nouveau document
    await uploadNewDocument();
  };

  // 🔽 Nouvelle fonction pour l’upload d’un nouveau document
  const uploadNewDocument = async () => {
    const formData = new FormData();
    formData.append('name', pendingName);
    formData.append('file', pendingFile);
    formData.append('category', category);
    formData.append('access', accessType);
    formData.append('collectionName', collectionName);
    formData.append('description', description);
    formData.append('priority', priority);
    formData.append('tags', JSON.stringify(tags));
    if (accessType === 'custom') {
      formData.append('allowedUsers', JSON.stringify(allowedUsers));
    }

    try {
      const res = await fetch('http://localhost:5000/api/documents/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erreur inconnue");

      alert(result.message);
      setDocuments([result, ...documents]);
      resetForm();
    } catch (err) {
      console.error('Erreur lors de l\'upload du document:', err);
      setErrorMessage(err.message || 'Erreur lors de l\'envoi du document.');
    }
  };

  // 🔽 Fonction appelée quand l'utilisateur clique sur "Oui" dans la modale
  const uploadNewVersion = async (documentId) => {
    const formData = new FormData();
    formData.append('file', pendingFile);
    formData.append('documentId', documentId);
    formData.append('category', category);
    formData.append('collectionName', collectionName);
    formData.append('description', description);
    formData.append('priority', priority);
    formData.append('tags', JSON.stringify(tags));

    try {
      const res = await fetch(`http://localhost:5000/api/documents/${documentId}/versions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erreur inconnue");

      alert("Nouvelle version ajoutée !");
      // Optionnel : recharge la liste des documents
      setForceUpload(false);
      setShowConflictPrompt(false);
      resetForm();
    } catch (err) {
      setErrorMessage(err.message || 'Erreur lors de l\'ajout de la version.');
    }
  };

  // 🔽 Réinitialisation des champs (à appeler après succès)
  const resetForm = () => {
    setPendingFile(null);
    setPendingName('');
    setCategory('');
    setCollectionName('');
    setErrorMessage(null);
    setConflictingDocName('');
  };

  // Étape 1 : Garder seulement la dernière version pour chaque nom de document
  const latestVersionsMap = new Map();

  documents.forEach(doc => {
    const existing = latestVersionsMap.get(doc.name);
    if (!existing || doc.version > existing.version) {
      latestVersionsMap.set(doc.name, doc);
    }
  });

  const latestDocuments = Array.from(latestVersionsMap.values());

  // Étape 2 : Appliquer les filtres existants sur ces derniers documents
  // 1. Trouver le nom du document principal
  const targetDoc = documents.find(doc => doc.id.toString() === id.toString());
  const targetName = targetDoc ? targetDoc.name : '';

  // 2. Filtrer tous les documents avec ce nom
  const filteredDocuments = documents.filter(doc => {
    const docName = doc.name || '';
    const docDate = doc.date ? new Date(doc.date) : null;
    const docContent = doc.text_content || '';

    const matchesType = docName === targetName; // Garde uniquement ceux avec le même nom
    const matchesDate =
      (!startDate || docDate >= new Date(startDate)) &&
      (!endDate || docDate <= new Date(endDate));

    const matchesSearch = useAdvancedFilter
      ? docContent.toLowerCase().includes(searchQuery.toLowerCase())
      : docName.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesType && matchesDate && matchesSearch;
  });




  // En haut de ton composant Doc.js
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [modalDoc, setModalDoc] = useState(null);
  const [autoWfName, setAutoWfName] = useState('');

  // Quand tu cliques sur le bouton, ouvre le modal
  const handleOpenConfirm = (doc) => {
    setModalDoc(doc);
    setAutoWfName(`WF_${doc.name}`);   // nom généré automatiquement
    setShowConfirmModal(true);
  };

  const [showUploadForm, setShowUploadForm] = useState(false);
  const [formData, setFormData] = useState({
    documentName: '',
    category: '',
    file: null,
    accessType: 'private',
    users: [],
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setPendingFile(e.target.files[0]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form data:', formData);
    // Tu pourras envoyer les données à l'API ici
  };

  const handleBack = () => {
    navigate(-1);
  };

  // Confirme et crée
  const handleConfirmCreate = async () => {
    try {
      const token = localStorage.getItem('token');

      // Générer la date du jour au format YYYY-MM-DD
      const todayISO = new Date().toISOString().slice(0, 10);

      const res = await axios.post(
        'http://localhost:5000/api/workflows',
        {
          documentId: modalDoc.id,
          name: autoWfName,
          status: 'pending',
          template: modalDoc.category,
          created_by: userId,
          echeance: todayISO   // ← on transmet la date de création ici
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Workflow créé !');
      setShowConfirmModal(false);
      navigate(`/workflowz/${res.data.id}`, { state: { document: modalDoc } });
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la création du workflow');
    }
  };





  return (
    <>

      <Navbar />
      <div className="container-fluid">

        <Row className="my-3">
          <Col md={4}><Form.Control type="text" placeholder="Rechercher..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></Col>
          <Col md={2}><Form.Select value={filterType} onChange={e => setFilterType(e.target.value)}><option value="Tous les documents">Tous</option><option value=".pdf">PDF</option><option value=".docx">Word</option><option value=".jpg">Images</option></Form.Select></Col>
          <Col md={2}><Form.Control type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></Col>
          <Col md={2}><Form.Control type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></Col>
          <Col md={2}><Button variant={useAdvancedFilter ? 'danger' : 'success'} onClick={() => setUseAdvancedFilter(!useAdvancedFilter)}>{useAdvancedFilter ? 'Désactiver Avancé' : 'Recherche Avancée'}</Button></Col>
        </Row>





        <Container className="mt-5 d-flex justify-content-center">
          <Card className="w-100 shadow-sm" style={{ maxWidth: "1000px" }}>
            <Card.Body>
              <Button variant="secondary" size="sm" onClick={handleBack}>
                ⬅️ Retour
              </Button>
              <h3 className="text-center mb-4">
  📂 Liste des documents : {filteredDocuments[0]?.name || 'Nom inconnu'}
</h3>

              <Table striped bordered hover responsive>
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Date</th>
                    <th>Catégorie</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.length > 0 ? filteredDocuments.map(doc => (
                    <tr key={doc.id}>
                      <td>{doc.name} <button
                        onClick={() => {
                          setSelectedDoc(doc);  // Facultatif, si tu veux toujours garder ça
                          navigate(`/docvoir/${doc.id}`); // redirection vers DocVoir avec l’ID du doc
                          setShowModal(false);
                        }}
                        className="p-0 m-0 bg-transparent border-none outline-none hover:opacity-70"
                        style={{ all: 'unset', cursor: 'pointer' }}
                      >
                        📄
                      </button>
                      </td>
                      <td>{doc.date ? new Date(doc.date).toLocaleString() : 'Inconnue'}</td>
                      <td>{doc.category || 'Non spécifiée'}</td>
                      <td>
                        <Button variant="info" size="sm" className="me-2" onClick={() => navigate(`/documents/${doc.id}`)} title="Détails">
                          <i className="bi bi-list-ul"></i>
                        </Button>

                        <Button variant="danger" size="sm" className="me-2" onClick={() => handleDelete(doc.id)} title="Supprimer">
                          <i className="bi bi-trash"></i>
                        </Button>

                        {/* Bouton de partage */}
                        <Button variant="light" onClick={() => openShareModal(doc)}>
                          <img src={shareIcon} width="20" alt="Partager" />

                        </Button>
                        <Button
                          variant="dark"
                          size="sm"
                          className="ms-2"
                          title="Démarrer le workflow"
                          onClick={() => handleOpenConfirm(doc)}
                        >
                          <i className="bi bi-play-fill me-1"></i>
                        </Button>

                      </td>

                    </tr>
                  )) : (
                    <tr><td colSpan="4" className="text-center">Aucun document trouvé</td></tr>
                  )}

                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Container>
        <Modal
          show={showShareModal}
          onHide={() => setShowShareModal(false)}
          backdrop="static"
          keyboard={false}
          centered
          style={{ zIndex: 1050 }}
          backdropClassName="custom-backdrop"
        >
          <Modal.Header closeButton>
            <Modal.Title>Partager le document : {docToShare?.name}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form>
              <Form.Group>
                <Form.Label>Type d'accès</Form.Label>
                <Form.Select
                  value={shareAccessType}
                  onChange={(e) => setShareAccessType(e.target.value)}
                >
                  <option value="public">Public (Tous les utilisateurs)</option>
                  <option value="custom">Sélectionner des utilisateurs</option>
                </Form.Select>
              </Form.Group>

              {shareAccessType === 'custom' && (
                <Form.Group>
                  <Form.Label>Utilisateurs autorisés</Form.Label>
                  <Select
                    isMulti
                    options={users}
                    value={users.filter(option =>
                      shareUsers.includes(option.value)
                    )}
                    onChange={(selectedOptions) => {
                      const selectedUserIds = selectedOptions.map((opt) => opt.value);
                      setShareUsers(selectedUserIds);
                    }}
                    placeholder="Sélectionner des utilisateurs..."
                  />
                </Form.Group>
              )}
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowShareModal(false)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                const updatedDoc = {
                  ...docToShare,
                  access: shareAccessType,
                  allowedUsers: shareUsers,
                };

                try {
                  await axios.put(`http://localhost:5000/api/documents/${docToShare.id}`, updatedDoc, {
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  setDocuments(docs => docs.map(doc => doc.id === docToShare.id ? updatedDoc : doc));
                  setShowShareModal(false);
                } catch (err) {
                  console.error('Erreur de mise à jour des permissions', err);
                }
              }}
            >
              Enregistrer
            </Button>
          </Modal.Footer>
        </Modal>
        <Modal
          show={showConfirmModal}
          onHide={() => setShowConfirmModal(false)}
          centered
          style={{ zIndex: 1050 }}
        >
          <Modal.Header closeButton>
            <Modal.Title>Créer un nouveau workflow ?</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p>Vous êtes sur le point de créer le workflow pour le document :</p>
            <strong>{modalDoc?.name}</strong>
            <hr />
            <Form.Group>
              <Form.Label>Nom du workflow</Form.Label>
              <Form.Control
                type="text"
                value={autoWfName}
                onChange={e => setAutoWfName(e.target.value)}
              />
              <Form.Text className="text-muted">
                Vous pouvez modifier ce nom si besoin.
              </Form.Text>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>
              Annuler
            </Button>
            <Button variant="primary" onClick={handleConfirmCreate}>
              Créer
            </Button>
          </Modal.Footer>
        </Modal>



      </div>

    </>

  );
};

export default DocumentVersion;