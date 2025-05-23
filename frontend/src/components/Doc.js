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
import Tesseract from 'tesseract.js';
import { getDocument } from 'pdfjs-dist/webpack'; // Importer getDocument depuis pdfjs-dist
import { pdfjs } from 'pdfjs-dist/webpack';

const Doc = () => {
  const [errorMessage, setErrorMessage] = useState('');
  const [documents, setDocuments] = useState([]);
  const [savedDocuments, setSavedDocuments] = useState([]);
  const [pendingName, setPendingName] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('Tous les documents');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [useAdvancedFilter, setUseAdvancedFilter] = useState(false);
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
  const [showShareModal, setShowShareModal] = useState(false);
  const [docToShare, setDocToShare] = useState(null);
  const [shareAccessType, setShareAccessType] = useState('private');
  const [shareUsers, setShareUsers] = useState([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [modalDoc, setModalDoc] = useState(null);
  const [autoWfName, setAutoWfName] = useState('');
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [allowedUsers, setAllowedUsers] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [existingWorkflow, setExistingWorkflow] = useState(null);
  const categories = ['Contrat', 'Mémoire', 'Article', 'Rapport'];
  const [selectedCategory, setSelectedCategory] = useState('');
  const [summary, setSummary] = useState('');
  const [access, setAccess] = useState('private');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [allGroups, setAllGroups] = useState([]);  // Liste des groupes
  const [selectedGroup, setSelectedGroup] = useState(null); // Groupe sélectionné
  const [category, setCategory] = useState('');
  const [myPermissions, setMyPermissions] = useState(null);
  const [conflictingDoc, setConflictingDoc] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState(1); // pour gérer les étapes (1 = fichier, 2 = détails)
const [documentId, setDocumentId] = useState(null); // ID du document renvoyé par le backend




  const [permissions, setPermissions] = useState({
    consult: true,  // toujours activé
    modify: true,
    delete: true,
    share: true,
  });

  useEffect(() => {
    if (accessType === "private") {
      setPermissions({
        consult: true,
        modify: true,
        delete: true,
        share: true,
      });
    } else {
      setPermissions({
        ...permissions,
        modify: false,
        delete: false,
        share: false,
      });
    }
  }, [accessType]);


  const GROUPS_API = 'http://localhost:5000/api/groups';


  const [formData, setFormData] = useState({
    documentName: '',
    category: '',
    file: null,
    accessType: 'private',
    users: [],
  });

  const token = localStorage.getItem('token');
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();
  const [userId, setUserId] = useState(null);

  // Ajoutez ce state en haut du composant
  const [userRole, setUserRole] = useState('');

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



  const openShareModal = (doc) => {
    setDocToShare(doc);
    setShareAccessType(doc.access || 'private');
    setShareUsers(doc.allowedUsers || []);
    setShowShareModal(true);
  };

  const fetchDocuments = async () => {
    try {
     const res = await fetch('http://localhost:5000/api/documents/latest', {
  headers: { Authorization: `Bearer ${token}` }
});

      if (res.status === 401) throw new Error('Non autorisé');
      const data = await res.json();
      if (Array.isArray(data)) {
        setDocuments(data);
        const names = data.map(doc => doc.collectionName).filter(name => name && typeof name === 'string');
        setCollections([...new Set(names)]);
      } else {
        console.error('Données invalides:', data);
        setDocuments([]);
        setCollections([]);
      }
    } catch (err) {
      console.error('Erreur chargement documents:', err);
      setErrorMessage("Erreur d'autorisation ou de connexion.");
    }
  };

  useEffect(() => {
    fetchDocuments();
    fetchUsers();
    fetchGroups();
  }, [token]);



  const fetchUsers = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/auth/users/');
      const formatted = res.data.map(u => ({ value: u.id, label: `${u.name} ${u.prenom}` }));
      setUsers(formatted);
      setAllUsers(formatted);
    } catch (err) {
      console.error('Erreur chargement des utilisateurs', err);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await axios.get(GROUPS_API);
      setAllGroups(res.data); // Remplir la liste des groupes
    } catch (err) {
      console.error('Erreur récupération groupes:', err);
    }
  };

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
      console.error('Erreur suppression:', err);
    }
  };

  const handleUpload = async () => {
    if (!pendingFile || !pendingName) {
      setErrorMessage('Veuillez remplir tous les champs requis.');
      return;
    }

    if (pendingFile.size > 100 * 1024 * 1024) {
      setErrorMessage('La vidéo dépasse la limite de 100 Mo.');
      return;
    }


    const existingDoc = documents.find(doc => doc.name === pendingName);

    if (existingDoc && !forceUpload) {
      const isAllowedToModify =
        userRole === 'admin' ||
        existingDoc.owner_id === userId ||
        (existingDoc.permissions && existingDoc.permissions.can_modify);

      if (isAllowedToModify) {
        // Afficher le prompt de confirmation
        setConflictingDocName(pendingName);
        setConflictingDoc(existingDoc);
        setShowConflictPrompt(true);
        return;
      } else {
        setErrorMessage("⚠️ Un document avec ce nom existe déjà. Vous n'avez pas les droits pour le modifier.");
        return;
      }
    }

    const formData = new FormData();
    formData.append('name', pendingName);
    formData.append('file', pendingFile);
    formData.append('visibility', accessType);
    formData.append('access', accessType);
    formData.append('collectionName', collectionName || '');
    formData.append('summary', description || '');
    formData.append('prio', priority || '');
    formData.append('can_modify', permissions.modify);
    formData.append('can_delete', permissions.delete);
    formData.append('can_share', permissions.share);

    const parsedTags =
      Array.isArray(tags)
        ? tags
        : typeof tags === 'string'
          ? tags.split(',').map(tag => tag.trim()).filter(Boolean)
          : [];
    formData.append('tags', JSON.stringify(parsedTags));

    const allowedIds = allowedUsers.map(u => u?.id || u).filter(Boolean);
    formData.append('id_share', JSON.stringify(allowedIds));

    const groupIds = selectedGroup ? [selectedGroup] : [];
    formData.append('id_group', JSON.stringify(groupIds));

    if (forceUpload) {
      formData.append('isNewVersion', 'true');
    }

    try {
      const res = await fetch('http://localhost:5000/api/documents/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) throw new Error(`Erreur : ${res.status}`);
      const newDoc = await res.json();
      setDocuments(prev => [newDoc, ...prev]);

      // Réinitialisation
      setPendingFile(null);
      setPendingName('');
      setCategory('');
      setCollectionName('');
      setForceUpload(false);
      setShowConflictPrompt(false);
      setConflictingDocName('');
      setConflictingDoc(null);
      setErrorMessage(null);

    } catch (err) {
      console.error('❌ Erreur upload :', err);
      setErrorMessage("Erreur lors de l'envoi du document.");
    }
  };

const handleNextStep = async () => {
  if (!pendingFile) {
    setErrorMessage('Veuillez sélectionner un fichier.');
    return;
  }

  if (pendingFile.size > 100 * 1024 * 1024) {
    setErrorMessage('La vidéo dépasse la limite de 100 Mo.');
    return;
  }

  const formData = new FormData();
  formData.append('file', pendingFile);
  formData.append('visibility', accessType);
  formData.append('access', accessType);
  formData.append('can_modify', permissions.modify);
  formData.append('can_delete', permissions.delete);
  formData.append('can_share', permissions.share);

  const allowedIds = allowedUsers.map(u => u?.id || u).filter(Boolean);
  formData.append('id_share', JSON.stringify(allowedIds));

  const groupIds = selectedGroup ? [selectedGroup] : [];
  formData.append('id_group', JSON.stringify(groupIds));

  try {
    const res = await fetch('http://localhost:5000/api/documents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    if (!res.ok) throw new Error(`Erreur upload fichier : ${res.status}`);
    const data = await res.json();

    setDocumentId(data.id); // ou data.document_id selon ce que tu retournes
    setStep(2); // Facultatif maintenant
    setShowUploadForm(false); // ferme le modal

    // Rediriger vers la page de complétion
    navigate(`/document/${data.id}/complete`);
  } catch (err) {
    console.error("Erreur lors de l'envoi du fichier :", err);
    setErrorMessage("Erreur lors de l'envoi du fichier.");
  }
};


 const latestDocs = Object.values(
  documents.reduce((acc, doc) => {
    // Utilise original_id s'il existe, sinon fallback sur name
    const key = doc.original_id || doc.name.toLowerCase().trim();
    if (!acc[key] || doc.version > acc[key].version) {
      acc[key] = doc;
    }
    return acc;
  }, {})
);



  const filteredDocuments = latestDocs.filter((doc) => {
    const docName = doc.name || '';
    const docFilePath = doc.file_path || '';
    const docDate = doc.date ? new Date(doc.date) : null;
    const docContent = doc.text_content || '';
    const docCategory = doc.category || '';
    const docSummary = doc.summary || '';
    const docDescription = doc.description || '';
    const docTags = Array.isArray(doc.tags) ? doc.tags : [];
    const docFolder = doc.folder || '';
    const docAuthor = doc.author || '';

    const fileExtension = docFilePath.split('.').pop().toLowerCase();

    const matchesType = filterType === 'Tous les documents' ||
      fileExtension === filterType.toLowerCase();

    const matchesDate = (!startDate || docDate >= new Date(startDate)) &&
      (!endDate || docDate <= new Date(endDate));

    const matchesSearch = useAdvancedFilter
      ? (
        docContent.toLowerCase().includes(searchQuery.toLowerCase()) ||
        docSummary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        docDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
        docFolder.toLowerCase().includes(searchQuery.toLowerCase()) ||
        docAuthor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        docTags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      )
      : docName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === '' ||
      (docCategory && docCategory.toLowerCase() === selectedCategory.toLowerCase());

    return matchesType && matchesDate && matchesSearch && matchesCategory;
  });


  const handleOpenConfirm = async (doc) => {
    setModalDoc(doc);
    setAutoWfName(`WF_${doc.name}`);

    try {
      const res = await axios.get(
        `http://localhost:5000/api/workflows/document/${doc.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setExistingWorkflow(res.data.exists ? res.data.workflow : null);
      setShowConfirmModal(true);

    } catch (err) {
      console.error('Erreur vérification workflow:', err);

      if (err.response?.status === 500) {
        toast.error("Erreur serveur lors de la vérification des workflows");
      } else {
        toast.error("Erreur de connexion");
      }

      setExistingWorkflow(null);
      setShowConfirmModal(true);
    }
  };

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
  };

  const handleConfirmCreate = async () => {
    try {
      const token = localStorage.getItem('token');
      const todayISO = new Date().toISOString().slice(0, 10);

      const res = await axios.post(
        'http://localhost:5000/api/workflows',
        {
          documentId: modalDoc.id,
          name: autoWfName,
          status: 'pending',
          template: modalDoc.category,
          created_by: userId,
          echeance: todayISO
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

  const checkWorkflowExists = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await axios.get(
        `http://localhost:5000/api/workflows/document/${modalDoc.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.exists) {
        setExistingWorkflow(res.data.workflow);
      } else {
        setExistingWorkflow(null);
      }
      setShowConfirmModal(true);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la vérification du workflow");
    }
  };

  const handleCategoryClick = async (category) => {
    try {
      const res = await fetch(`http://localhost:5000/api/documents?category=${category}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Erreur : ${res.status}`);
      const data = await res.json();
      setDocuments(data); // Remplacer la liste actuelle par les documents filtrés
    } catch (err) {
      console.error('Erreur chargement catégorie :', err);
      setErrorMessage('Impossible de charger les documents pour cette catégorie.');
    }
  };

  const handleUpdatePermissions = async () => {
    try {
      const payload = {
        visibility: shareAccessType === 'public' ? 'public' : 'custom',
        id_share: selectedUsers.length > 0 ? selectedUsers[0] : null, // ou gérer plusieurs
        id_group: selectedGroup || null
      };

      await axios.post(`http://localhost:5000/api/documents/${docToShare.id}/share`, payload, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      toast.success('Permissions mises à jour avec succès !');
      setShowShareModal(false);
    } catch (error) {
      console.error('Erreur de mise à jour des permissions :', error);
      toast.error('Échec de mise à jour des permissions.');
    }
  };

  const handlePermissionChange = (type) => (e) => {
    const checked = e.target.checked;
    setPermissions((prev) => ({
      ...prev,
      consult: true,
      [type]: checked,
    }));
  };

  const [permissionsByDoc, setPermissionsByDoc] = useState({});

  const fetchPermissions = async (documentId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/documents/${documentId}/my-permissions`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });


      if (!res.ok) throw new Error("Accès refusé");

      const data = await res.json();

      setPermissionsByDoc((prev) => ({
        ...prev,
        [documentId]: data,
      }));
    } catch (err) {
      console.error(`Erreur récupération permissions document ${documentId}:`, err);
      setPermissionsByDoc((prev) => ({
        ...prev,
        [documentId]: null,
      }));
    }
  };
  useEffect(() => {
    documents.forEach(doc => {
      if (!permissionsByDoc[doc.id]) {
        fetchPermissions(doc.id);
      }
    });
  }, [documents]);


  return (
    <>
      <Navbar />
      <div className="container-fluid">
        <Row className="my-3">
          <Col md={4}><Form.Control type="text" placeholder="Rechercher..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></Col>
          <Col md={2}>
            <Form.Select value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="Tous les documents">Tous</option>
              <option value="pdf">PDF</option>
              <option value="docx">Word</option>
              <option value="jpg">Images</option>
              <option value="mp4">Vidéo (MP4)</option>
              <option value="webm">Vidéo (WebM)</option>
            </Form.Select>

          </Col>

          <Col md={2}><Form.Control type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></Col>
          <Col md={2}><Form.Control type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></Col>
          <Col md={2}><Button variant={useAdvancedFilter ? 'danger' : 'success'} onClick={() => setUseAdvancedFilter(!useAdvancedFilter)}>
            {useAdvancedFilter ? 'Désactiver Avancé' : 'Recherche Avancée'}
          </Button></Col>
        </Row>
        <br />

        <Container fluid className="d-flex justify-content-center">
          <Card className="w-100 border border-transparent">
            <Card.Body>
              <br />

              <Button
                variant={showUploadForm ? "danger" : "primary"}
                onClick={() => setShowUploadForm(!showUploadForm)}
                className="mb-4"
                style={{ marginBottom: "1rem" }}
              >
                {showUploadForm ? 'Annuler' : 'Télécharger un document'}
              </Button>
<Modal
  show={showUploadForm}
  onHide={() => setShowUploadForm(false)}
  centered
  backdrop="static"
  style={{ zIndex: 1050 }}
>
  <Modal.Header closeButton>
    <Modal.Title>Importer un fichier</Modal.Title>
  </Modal.Header>

  <Modal.Body>
    {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}

    <div className="text-center">
      <input
        type="file"
        id="file-upload"
        style={{ display: 'none' }}
        accept=".pdf,.docx,.jpg,.jpeg,.png,.mp4,.webm"
        onChange={(e) => setPendingFile(e.target.files[0])}
      />

      <Button
        variant="outline-primary"
        onClick={() => document.getElementById('file-upload').click()}
        className="d-flex align-items-center justify-content-center mx-auto"
        style={{
          height: '45px',
          width: '100%',
          maxWidth: '350px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          borderRadius: '8px'
        }}
      >
        <FaCloudUploadAlt size={20} className="me-2" />
        {pendingFile ? pendingFile.name : 'Choisir un fichier'}
      </Button>
    </div>
  </Modal.Body>

  <Modal.Footer>
    <Button
      variant="secondary"
      onClick={() => setShowUploadForm(false)}
    >
      Annuler
    </Button>
    <Button
      variant="primary"
      disabled={!pendingFile}
      onClick={handleNextStep}
    >
      Suivant
    </Button>
  </Modal.Footer>
</Modal>



              <div className="container-fluid d-flex flex-column gap-4 mb-4">
                <div className="d-flex flex-wrap gap-2 justify-content-center">
                  <Button
                    key="all"
                    variant={selectedCategory === '' ? 'secondary' : 'outline-secondary'}
                    className="rounded-pill fw-semibold px-4 py-2"
                    style={{ transition: 'all 0.2s ease-in-out' }}
                    onClick={() => setSelectedCategory('')}
                    onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
                    onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                  >
                    Toutes
                  </Button>

                  {categories.map((cat) => (
                    <Button
                      key={cat}
                      variant={selectedCategory === cat ? 'secondary' : 'outline-secondary'}
                      className="rounded-pill fw-semibold px-4 py-2"
                      style={{ transition: 'all 0.2s ease-in-out' }}
                      onClick={() => setSelectedCategory(cat)}
                      onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
                      onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                    >
                      {cat}
                    </Button>
                  ))}
                </div>

                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Date</th>
                      <th>Catégorie</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocuments.length > 0 ? (
                      filteredDocuments
                        .sort((a, b) => (b.version || 0) - (a.version || 0)) // tri version décroissante
                        .map(doc => {
                          const perms = permissionsByDoc[doc.id] || {};
                          return (
                            <tr key={doc.id}>
                              <td>
                                <span>
                                  {doc.name} {doc.version && `(version ${doc.version})`}
                                </span>

                                <button
                                  onClick={() => {
                                    setSelectedDoc(doc);
                                    navigate(`/docvoir/${doc.id}`);
                                    setShowModal(false);
                                  }}
                                  className="p-0 m-0 bg-transparent border-0"
                                  style={{ cursor: 'pointer' }}
                                >
                                  📄
                                </button>
                              </td>

                              <td>{doc.date ? new Date(doc.date).toLocaleString() : 'Inconnue'}</td>
                              <td>{doc.category || 'Non spécifiée'}</td>
                              <td>
                                {/* Détails (toujours actif) */}
                                <Button
                                  variant="info"
                                  size="sm"
                                  className="me-2"
                                  onClick={() => navigate(`/documents/${doc.id}`)}
                                  title="Voir les détails"
                                >
                                  <i className="bi bi-list-ul"></i>
                                </Button>

                                {/* Supprimer */}
                                <Button
                                  variant="danger"
                                  size="sm"
                                  className="me-2"
                                  onClick={() => {
                                    if (userRole === 'admin' || perms.can_delete || doc.owner_id === userId) {
                                      handleDelete(doc.id);
                                    }
                                  }}
                                  disabled={!(userRole === 'admin' || perms.can_delete || doc.owner_id === userId)}
                                  title={
                                    userRole === 'admin' || perms.can_delete || doc.owner_id === userId
                                      ? 'Supprimer'
                                      : 'Non autorisé à supprimer'
                                  }
                                  style={{
                                    opacity: userRole === 'admin' || perms.can_delete || doc.owner_id === userId ? 1 : 0.15,
                                    pointerEvents: userRole === 'admin' || perms.can_delete || doc.owner_id === userId ? 'auto' : 'none'
                                  }}
                                >
                                  <i className="bi bi-trash"></i>
                                </Button>

                                {/* Partager */}
                                <Button
                                  variant="light"
                                  size="sm"
                                  className="me-2"
                                  onClick={() => {
                                    if (userRole === 'admin' || perms.can_share || doc.owner_id === userId) {
                                      openShareModal(doc);
                                    }
                                  }}
                                  disabled={!(userRole === 'admin' || perms.can_share || doc.owner_id === userId)}
                                  title={
                                    userRole === 'admin' || perms.can_share || doc.owner_id === userId
                                      ? 'Partager'
                                      : 'Non autorisé à partager'
                                  }
                                  style={{
                                    opacity: userRole === 'admin' || perms.can_share || doc.owner_id === userId ? 1 : 0.15,
                                    pointerEvents: userRole === 'admin' || perms.can_share || doc.owner_id === userId ? 'auto' : 'none'
                                  }}
                                >
                                  <img src={shareIcon} width="20" alt="Partager" />
                                </Button>

                                {/* Créer un workflow */}
                                <Button
                                  variant="dark"
                                  size="sm"
                                  className="ms-2"
                                  onClick={() => {
                                    if (userRole === 'admin' || doc.owner_id === userId) {
                                      handleOpenConfirm(doc);
                                    }
                                  }}
                                  disabled={!(userRole === 'admin' || doc.owner_id === userId)}
                                  title={
                                    userRole === 'admin' || doc.owner_id === userId
                                      ? 'Créer un workflow'
                                      : 'Non autorisé à créer un workflow'
                                  }
                                  style={{
                                    opacity: userRole === 'admin' || doc.owner_id === userId ? 1 : 0.15,
                                    pointerEvents: userRole === 'admin' || doc.owner_id === userId ? 'auto' : 'none'
                                  }}
                                >
                                  <i className="bi bi-play-fill me-1"></i>
                                </Button>
                              </td>

                            </tr>
                          );
                        })
                    ) : (
                      <tr>
                        <td colSpan="4" className="text-center">
                          Aucun document trouvé
                        </td>
                      </tr>
                    )}

                  </tbody>
                </Table>
              </div>


              <Modal
                show={showShareModal}
                onHide={() => setShowShareModal(false)}
                backdrop="static"
                keyboard={false}
                centered
                style={{ zIndex: 1050 }}
              >
                <Modal.Header closeButton>
                  <Modal.Title>Partager le document : {docToShare?.name}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                  <Form>
                    <Form.Group className="mb-3">
                      <Form.Label>Type d'accès</Form.Label>
                      <Form.Select
                        value={shareAccessType}
                        onChange={(e) => setShareAccessType(e.target.value)}
                      >
                        <option value="public">Public (Tous les utilisateurs)</option>
                        <option value="custom">Sélectionner des utilisateurs ou des groupes</option>
                      </Form.Select>
                    </Form.Group>

                    {shareAccessType === 'custom' && (
                      <>
                        <Form.Group as={Row} className="mb-3">
                          <Col md={6}>
                            <Form.Label>Utilisateurs</Form.Label>
                            <Select
                              isMulti
                              options={allUsers}
                              value={allUsers.filter(option => allowedUsers.includes(option.value))}
                              onChange={(selectedOptions) => {
                                const selectedUserIds = selectedOptions.map(opt => opt.value);
                                setSelectedUsers(selectedUserIds);
                                setAllowedUsers(selectedUserIds);
                              }}
                              placeholder="Select users..."
                              classNamePrefix="select"
                            />
                          </Col>

                          <Col md={6}>
                            <Form.Label>Groupe</Form.Label>
                            <Select
                              value={
                                selectedGroup
                                  ? {
                                    value: selectedGroup,
                                    label: allGroups.find(group => group.id === selectedGroup)?.nom,
                                  }
                                  : null
                              }
                              options={allGroups.map(group => ({
                                value: group.id,
                                label: group.nom,
                              }))}
                              onChange={(selectedOption) => {
                                setSelectedGroup(selectedOption ? selectedOption.value : null);
                              }}
                              placeholder="Sélectionner un groupe..."
                              classNamePrefix="select"
                            />
                          </Col>
                        </Form.Group>
                      </>
                    )}
                  </Form>


                  {(userId === docToShare?.owner_id || userRole === 'admin') && (
                    <Col md={4} className="d-flex flex-column justify-content-start">
                      <label><strong>Droits d'accès :</strong></label>

                      <Form.Check
                        type="checkbox"
                        id="read-access"
                        label="Consulter"
                        checked={permissions.consult}
                        disabled // toujours activé
                      />

                      <Form.Check
                        type="checkbox"
                        id="modify-access"
                        label="Modifier"
                        checked={permissions.modify}
                        onChange={(e) =>
                          setPermissions((prev) => ({ ...prev, modify: e.target.checked }))
                        }
                      />

                      <Form.Check
                        type="checkbox"
                        id="delete-access"
                        label="Supprimer"
                        checked={permissions.delete}
                        onChange={(e) =>
                          setPermissions((prev) => ({ ...prev, delete: e.target.checked }))
                        }
                      />

                      <Form.Check
                        type="checkbox"
                        id="share-access"
                        label="Partager"
                        checked={permissions.share}
                        onChange={(e) =>
                          setPermissions((prev) => ({ ...prev, share: e.target.checked }))
                        }
                      />
                    </Col>
                  )}


                </Modal.Body>
                <Modal.Footer>
                  <Button variant="secondary" onClick={() => setShowShareModal(false)}>
                    Annuler
                  </Button>
                  <Button
                    variant="primary"
                    onClick={async () => {
                      const visibilityValue = shareAccessType === 'public' ? 'public' : 'custom';

                      try {
                        await axios.put(
                          `http://localhost:5000/api/documents/${docToShare.id}`,
                          {
                            visibility: visibilityValue,
                            id_share: selectedUsers.length > 0 ? selectedUsers : [],     // tableau d'IDs
                            id_group: selectedGroup ? [selectedGroup] : [],              // tableau d'un seul élément ou vide
                          },
                          { headers: { Authorization: `Bearer ${token}` } }
                        );

                        setDocuments(docs =>
                          docs.map(doc =>
                            doc.id === docToShare.id
                              ? {
                                ...doc,
                                visibility: visibilityValue,
                                id_share: selectedUsers,
                                id_group: selectedGroup ? [selectedGroup] : [],
                              }
                              : doc
                          )
                        );

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
                  {existingWorkflow ? (
                    <div className="text-center">
                      <Alert variant="warning">
                        Un workflow existe déjà pour ce document !
                      </Alert>
                      <p><strong>Nom:</strong> {existingWorkflow.name}</p>
                      <p><strong>Statut:</strong> {existingWorkflow.status}</p>
                      <Button
                        variant="primary"
                        onClick={() => {
                          setShowConfirmModal(false);
                          navigate(`/workflowz/${existingWorkflow.id}`);
                        }}
                      >
                        Voir le workflow existant
                      </Button>
                    </div>
                  ) : (
                    <>
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
                      </Form.Group>
                    </>
                  )}
                </Modal.Body>

                <Modal.Footer>
                  <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>
                    Annuler
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleConfirmCreate}
                    disabled={!!existingWorkflow}
                  >
                    Créer
                  </Button>
                </Modal.Footer>
              </Modal>
            </Card.Body>
          </Card>
        </Container>
      </div>
    </>
  );
};
export default Doc;