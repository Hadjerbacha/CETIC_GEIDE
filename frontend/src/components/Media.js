import React, { useState, useEffect, useRef } from 'react';
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
import importDoc from './img/importDoc.jpg';
import importFolder from './img/importFolder.jpg';
import { Dropdown, ButtonGroup } from 'react-bootstrap';
import { FaUpload, FaFileUpload, FaFolderOpen } from 'react-icons/fa';


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
  const categories = [ 'photo', 'video', 'autre'];
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categoryClickCount, setCategoryClickCount] = useState(0);
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
  const [searchFilters, setSearchFilters] = useState({});
  const [showFilterCard, setShowFilterCard] = useState(false);
  const [showUploadFolderForm, setShowUploadFolderForm] = useState(false);
  const [uploadType, setUploadType] = useState(null);
  const [folderFiles, setFolderFiles] = useState([]);
  const [folderName, setFolderName] = useState('');
  const [folderDescription, setFolderDescription] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [parentId, setParentId] = useState(null);
  const btnRefs = useRef({});

  const [archivedRequests, setArchivedRequests] = useState({});

  const handleClick = (docId) => {
    handleArchiveRequest(docId);
    setArchivedRequests((prev) => ({
      ...prev,
      [docId]: true,
    }));
  };
  useEffect(() => {
    const activeBtn = btnRefs.current[selectedCategory || ''];
    const highlight = document.querySelector('.category-highlight');
    if (activeBtn && highlight) {
      const { offsetLeft, offsetWidth } = activeBtn;
      highlight.style.transform = `translateX(${offsetLeft}px)`;
      highlight.style.width = `${offsetWidth}px`;
    }
  }, [selectedCategory]);







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

  const handleArchiveRequest = async (docId) => {
    try {
      // Vérifiez que docId et userId sont valides
      if (!docId || !userId) {
        throw new Error("ID de document ou utilisateur manquant");
      }

      const response = await axios.post(
        'http://localhost:5000/api/documents/archive-requests',
        {
          documentId: Number(docId), // Assurez-vous que c'est un nombre
          requesterId: Number(userId) // Assurez-vous que c'est un nombre
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 5000
        }
      );

      toast.success(response.data.message || "Demande envoyée avec succès");
    } catch (error) {
      let errorMessage = "Échec de l'envoi de la demande";

      if (error.response) {
        // Messages d'erreur spécifiques du serveur
        errorMessage = error.response.data?.message || errorMessage;

        // Cas particuliers
        if (error.response.status === 400) {
          errorMessage = error.response.data?.error || "Données de requête invalides";
        }
      }

      console.error("Détails de l'erreur:", {
        config: error.config,
        response: error.response?.data
      });

      toast.error(errorMessage);
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
 const isMediaFile = (doc) => {
  const filePath = doc.file_path?.toString() || '';
  const extension = filePath.split('.').pop().toLowerCase();
  
  const photoExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
  
  return {
    isPhoto: photoExtensions.includes(extension),
    isVideo: videoExtensions.includes(extension)
  };
};

const filteredDocuments = latestDocs.filter((doc) => {
  // 1. Vérification STRICTE que le document est un média (uniquement photos ou vidéos)
  const filePath = doc.file_path?.toString() || '';
  const extension = filePath.split('.').pop().toLowerCase();
  
  const photoExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'svg'];
  const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'mpeg', '3gp'];
  
  const isPhoto = photoExtensions.includes(extension);
  const isVideo = videoExtensions.includes(extension);
  
  // Exclusion stricte de tous les autres types (pdf, py, docx, etc.)
  if (!isPhoto && !isVideo) return false;

  // 2. Normalisation des données pour la recherche avancée
  const docName = doc.name ? doc.name.toString().toLowerCase() : '';
  const docDate = doc.date ? new Date(doc.date) : null;
  const docContent = doc.text_content ? doc.text_content.toString().toLowerCase() : '';
  const docTags = Array.isArray(doc.tags) ? doc.tags.map(t => t.toString().toLowerCase()) : [];

  // 3. Filtrage par type de média (photo/vidéo)
  const matchesMediaType = 
    !selectedCategory ||
    (selectedCategory === 'photo' && isPhoto) ||
    (selectedCategory === 'video' && isVideo);

  if (!matchesMediaType) return false;

  // 4. Filtrage par date
  const matchesDate = (!startDate || (docDate && docDate >= new Date(startDate))) &&
                     (!endDate || (docDate && docDate <= new Date(endDate)));

  // 5. Recherche globale
  const searchLower = searchQuery.toLowerCase();
  const matchesSearch = useAdvancedFilter ? (
    docContent.includes(searchLower) ||
    docName.includes(searchLower) ||
    docTags.some(tag => tag.includes(searchLower))
  ) : (
    docName.includes(searchLower)
  );

  // 6. Filtres avancés spécifiques aux médias
  const matchesAdvancedFilters = (() => {
    if (!showAdvancedFilters) return true;

    const filters = Object.fromEntries(
      Object.entries(searchFilters).map(([k, v]) =>
        [k, v ? v.toString().toLowerCase() : ''])
    );

    return (
      (!filters.description || (doc.description?.toLowerCase().includes(filters.description))) &&
      (!filters.tags || filters.tags.split(',')
        .map(t => t.trim())
        .every(tag => docTags.includes(tag))) &&
      (!filters.creation_date || 
        (doc.creation_date && new Date(doc.creation_date).toISOString().split('T')[0] === filters.creation_date))
    );
  })();

  // 7. Application combinée de tous les filtres
  return matchesMediaType && matchesDate && matchesSearch && matchesAdvancedFilters;
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

      // 1. Créer le workflow
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

      // 2. Générer les tâches selon le type de document
      await axios.post(
        `http://localhost:5000/api/workflows/${res.data.id}/generate-from-template`,
        { documentType: modalDoc.category },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Workflow créé avec les tâches appropriées !');
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

  const handleShareDocument = async () => {
    const visibilityValue = shareAccessType === 'custom' ? 'custom' : 'public';

    try {
      const response = await axios.post(
        `http://localhost:5000/api/documents/${docToShare.id}/share`,
        {
          visibility: visibilityValue,
          id_share: selectedUsers.length > 0 ? selectedUsers : [],
          id_group: selectedGroup ? [selectedGroup] : [],
          can_modify: permissions.modify,
          can_delete: permissions.delete,
          can_share: permissions.share,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Afficher un toast de succès
      toast.success('Document partagé avec succès ! Les utilisateurs ont été notifiés.');

      // Mettre à jour l'état local
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
      toast.error('Erreur lors du partage du document');
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



  const handleAdvancedSearch = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/documents/search`, {
        params: {
          category: selectedCategory,
          ...searchFilters
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      // ➕ setDocuments(res.data); // ou setFilteredDocuments
      console.log('Résultats :', res.data);
    } catch (err) {
      console.error('Erreur recherche avancée :', err);
    }
  };

  const handleCategoryButtonClick = (cat) => {
    if (selectedCategory === cat) {
      // Si on reclique sur la même catégorie
      setShowAdvancedFilters(prev => !prev);
    } else {
      // Si on clique sur une autre catégorie, on change sans afficher le filtre
      setSelectedCategory(cat);
      setShowAdvancedFilters(false);
    }
  };

  const handleFolderUpload = async () => {
    const formData = new FormData();

    folderFiles.forEach((file) => {
      formData.append('files', file);
    });

    formData.append('name', folderName);           // ✔️ nom du dossier
    formData.append('description', folderDescription); // ✔️ description
    if (userId) {
      formData.append('userId', userId);           // ✔️ optionnel mais utile
    }

    try {
      const token = localStorage.getItem('token'); // si besoin
      const res = await axios.post('http://localhost:5000/api/folders', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      const { folderId } = res.data;
      navigate(`/folder/${folderId}`);
    } catch (error) {
      console.error('Erreur upload dossier :', error);
    }
  };

  const handleArchive = async (docId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/documents/${docId}/archive`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`, // Très important !
        },
      });

      const data = await response.json(); // On lit la réponse pour voir le message

      if (!response.ok) {
        console.error('Erreur API:', data);
        throw new Error(data.message || 'Erreur lors de l’archivage');
      }

      alert('Document archivé avec succès ✅');
    } catch (error) {
      console.error('Erreur frontend:', error);
      alert('Une erreur est survenue ❌');
    }
  };



  return (
    <>
      <Navbar />
      <div className="container-fluid">
        <Row className="my-3">
          <Col md={4}><Form.Control type="text" placeholder="Rechercher..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></Col>
          <Col md={2}>
            <Form.Select value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="Tous les documents">Tous</option>
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
              <Dropdown as={ButtonGroup} className="mb-3 float-end">
                <Dropdown.Toggle variant="light" size="sm" title="Importer">
                  <FaUpload className="me-1" />
                  Importer
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item onClick={() => setShowUploadForm(prev => !prev)}>
                    <FaFileUpload className="me-2" />
                    Télécharger un document
                  </Dropdown.Item>
                  <Dropdown.Item onClick={() => setShowUploadFolderForm(true)}>
                    <FaFolderOpen className="me-2" />
                    Télécharger un dossier
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>

              <Modal
                show={showUploadFolderForm}
                onHide={() => setShowUploadFolderForm(false)}
                centered
                backdrop="static"
                style={{ zIndex: 1050 }}
              >
                <Modal.Header closeButton>
                  <Modal.Title>Importer un dossier</Modal.Title>
                </Modal.Header>

                <Modal.Body>
                  <Form>
                    <Form.Group className="mb-3">
                      <Form.Label>Nom du dossier</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="Nom du dossier"
                        value={folderName}
                        onChange={(e) => setFolderName(e.target.value)}
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Description du dossier</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={2}
                        placeholder="Description"
                        value={folderDescription}
                        onChange={(e) => setFolderDescription(e.target.value)}
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Fichiers</Form.Label>
                      <Form.Control
                        type="file"
                        webkitdirectory="true"
                        directory=""
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files);
                          setFolderFiles(files);
                          console.log('📁 Fichiers du dossier sélectionné :', files);
                        }}
                      />
                    </Form.Group>
                  </Form>
                </Modal.Body>

                <Modal.Footer>
                  <Button variant="secondary" onClick={() => setShowUploadFolderForm(false)}>
                    Annuler
                  </Button>
                  <Button
                    variant="primary"
                    disabled={!folderFiles.length || !folderName}
                    onClick={handleFolderUpload}
                  >
                    Suivant
                  </Button>
                </Modal.Footer>
              </Modal>

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
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.bmp,.mp3,.mp4,.avi,.mkv,.zip,.rar,.7z,.py,.js"
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
              {showAdvancedFilters && (
                <div className="filter-container mt-3">
                  <Card className="filter-card mt-3">
                    {selectedCategory === 'demande_conge' && (
                      <>
                        <h5 className="mb-3">🔎 Recherche avancée - Demande de congé</h5>
                        <Form>
                          <div className="d-flex align-items-end gap-3 flex-wrap">
                            <Form.Group className="mb-0">
                              <Form.Label>Numéro demande</Form.Label>
                              <Form.Control
                                type="text"
                                value={searchFilters.numdemande || ''}
                                onChange={(e) => setSearchFilters({ ...searchFilters, numdemande: e.target.value })}
                              />
                            </Form.Group>
                            <Form.Group className="mb-0">
                              <Form.Label>Date congé</Form.Label>
                              <Form.Control
                                type="date"
                                value={searchFilters.dateconge || ''}
                                onChange={(e) => setSearchFilters({ ...searchFilters, dateconge: e.target.value })}
                              />
                            </Form.Group>
                            <div className="d-flex align-items-end">
                              <Button className="btn-purple" onClick={filteredDocuments}>
                                Rechercher
                              </Button>

                            </div>
                          </div>
                        </Form>
                      </>
                    )}

                    {selectedCategory === 'cv' && (
                      <>
                        <h5 className="mb-3">🔎 Recherche avancée - CV</h5>
                        <Form>
                          <div className="d-flex align-items-end gap-3 flex-wrap">
                            <Form.Group className="mb-0">
                              <Form.Label>Nom candidat</Form.Label>
                              <Form.Control
                                type="text"
                                value={searchFilters.nom_candidat || ''}
                                onChange={(e) => setSearchFilters({ ...searchFilters, nom_candidat: e.target.value })}
                              />
                            </Form.Group>
                            <Form.Group className="mb-0">
                              <Form.Label>Métier</Form.Label>
                              <Form.Control
                                type="text"
                                value={searchFilters.metier || ''}
                                onChange={(e) => setSearchFilters({ ...searchFilters, metier: e.target.value })}
                              />
                            </Form.Group>
                            <div className="d-flex align-items-end">
                              <Button className="btn-purple" onClick={filteredDocuments}>
                                Rechercher
                              </Button>

                            </div>
                          </div>
                        </Form>
                      </>
                    )}

                    {selectedCategory === 'facture' && (
                      <>
                        <h5 className="mb-3">🔎 Recherche avancée - Facture</h5>
                        <Form>
                          <div className="d-flex align-items-end gap-3 flex-wrap">
                            <Form.Group className="mb-0">
                              <Form.Label>Numéro facture</Form.Label>
                              <Form.Control
                                type="text"
                                value={searchFilters.numero_facture || ''}
                                onChange={(e) => setSearchFilters({ ...searchFilters, numero_facture: e.target.value })}
                              />
                            </Form.Group>

                            <Form.Group className="mb-0">
                              <Form.Label>Montant</Form.Label>
                              <Form.Control
                                type="number"
                                value={searchFilters.montant || ''}
                                onChange={(e) => setSearchFilters({ ...searchFilters, montant: e.target.value })}
                              />
                            </Form.Group>

                            <Form.Group className="mb-0">
                              <Form.Label>Date facture</Form.Label>
                              <Form.Control
                                type="date"
                                value={searchFilters.date_facture || ''}
                                onChange={(e) => setSearchFilters({ ...searchFilters, date_facture: e.target.value })}
                              />
                            </Form.Group>

                            <Form.Group className="mb-0">
                              <Form.Label>Entreprise</Form.Label>
                              <Form.Control
                                type="text"
                                value={searchFilters.nom_entreprise || ''}
                                onChange={(e) => setSearchFilters({ ...searchFilters, nom_entreprise: e.target.value })}
                              />
                            </Form.Group>

                            <Form.Group className="mb-0">
                              <Form.Label>Produit</Form.Label>
                              <Form.Control
                                type="text"
                                value={searchFilters.produit || ''}
                                onChange={(e) => setSearchFilters({ ...searchFilters, produit: e.target.value })}
                              />
                            </Form.Group>

                            <div className="d-flex align-items-end">
                              <Button className="btn-purple" onClick={filteredDocuments}>
                                Rechercher
                              </Button>
                            </div>
                          </div>
                        </Form>
                      </>
                    )}
                    {selectedCategory === 'Contrat' && (
                      <>
                        <h5 className="mb-3">🔎 Recherche avancée - Contrats</h5>
                        <Form>
                          <div className="d-flex align-items-end gap-3 flex-wrap">
                            <Form.Group className="mb-0">
                              <Form.Label>Numéro contrat</Form.Label>
                              <Form.Control
                                value={searchFilters.numero_contrat || ''}
                                onChange={(e) => setSearchFilters({ ...searchFilters, numero_contrat: e.target.value })}
                              />
                            </Form.Group>

                            <Form.Group className="mb-0">
                              <Form.Label>Type de contrat</Form.Label>
                              <Form.Control
                                value={searchFilters.type_contrat || ''}
                                onChange={(e) => setSearchFilters({ ...searchFilters, type_contrat: e.target.value })}
                              />
                            </Form.Group>

                            <Form.Group className="mb-0">
                              <Form.Label>Partie prenante</Form.Label>
                              <Form.Control
                                value={searchFilters.partie_prenante || ''}
                                onChange={(e) => setSearchFilters({ ...searchFilters, partie_prenante: e.target.value })}
                              />
                            </Form.Group>

                            <Form.Group className="mb-0">
                              <Form.Label>Date signature</Form.Label>
                              <Form.Control
                                type="date"
                                value={searchFilters.date_signature || ''}
                                onChange={(e) => setSearchFilters({ ...searchFilters, date_signature: e.target.value })}
                              />
                            </Form.Group>

                            <Form.Group className="mb-0">
                              <Form.Label>Statut</Form.Label>
                              <Form.Control
                                value={searchFilters.statut || ''}
                                onChange={(e) => setSearchFilters({ ...searchFilters, statut: e.target.value })}
                              />
                            </Form.Group>

                            <div className="d-flex align-items-end">
                              <Button className="btn-purple" onClick={filteredDocuments}>
                                Rechercher
                              </Button>
                            </div>
                          </div>
                        </Form>
                      </>
                    )}

                    {selectedCategory === 'Rapport' && (
                      <>
                        <h5 className="mb-3">🔎 Recherche avancée - Rapports</h5>
                        <Form>
                          <div className="d-flex align-items-end gap-3 flex-wrap">
                            <Form.Group className="mb-0">
                              <Form.Label>Type de rapport</Form.Label>
                              <Form.Control
                                value={searchFilters.type_rapport || ''}
                                onChange={(e) => setSearchFilters({ ...searchFilters, type_rapport: e.target.value })}
                              />
                            </Form.Group>

                            <Form.Group className="mb-0">
                              <Form.Label>Auteur</Form.Label>
                              <Form.Control
                                value={searchFilters.auteur || ''}
                                onChange={(e) => setSearchFilters({ ...searchFilters, auteur: e.target.value })}
                              />
                            </Form.Group>

                            <Form.Group className="mb-0">
                              <Form.Label>Date rapport</Form.Label>
                              <Form.Control
                                type="date"
                                value={searchFilters.date_rapport || ''}
                                onChange={(e) => setSearchFilters({ ...searchFilters, date_rapport: e.target.value })}
                              />
                            </Form.Group>

                            <Form.Group className="mb-0">
                              <Form.Label>Destinataire</Form.Label>
                              <Form.Control
                                value={searchFilters.destinataire || ''}
                                onChange={(e) => setSearchFilters({ ...searchFilters, destinataire: e.target.value })}
                              />
                            </Form.Group>

                            <div className="d-flex align-items-end">
                              <Button className="btn-purple" onClick={filteredDocuments}>
                                Rechercher
                              </Button>
                            </div>
                          </div>
                        </Form>
                      </>
                    )}
                    {['autre', 'photo', 'video'].includes(selectedCategory) && (
                      <>
                        <h5 className="mb-3">
                          🔎 Recherche avancée - {selectedCategory === 'photo' ? 'Photos' : selectedCategory === 'video' ? 'Vidéos' : 'Autres documents'}
                        </h5>
                        <Form>
                          <div className="d-flex align-items-end gap-3 flex-wrap">
                            {/* Description - Modifié pour avoir la même hauteur 
                            <Form.Group className="mb-0 flex-grow-1">
                              <Form.Label>Description</Form.Label>
                              <Form.Control
                                as="textarea"
                                rows={1}  // Changé de 3 à 1
                                style={{ minHeight: '38px', resize: 'vertical' }}  // Hauteur fixe comme les autres champs
                                value={searchFilters.description || ''}
                                onChange={(e) => setSearchFilters({ ...searchFilters, description: e.target.value })}
                              />
                            </Form.Group>*/}

                            {/* Tags */}
                            <Form.Group className="mb-0" style={{ minWidth: '200px' }}>
                              <Form.Label>Tags</Form.Label>
                              <Form.Control
                                type="text"
                                value={searchFilters.tags || ''}
                                onChange={(e) => setSearchFilters({ ...searchFilters, tags: e.target.value })}
                                placeholder="Séparés par des virgules"
                              />
                            </Form.Group>

                            {/* Priorité */}
                            <Form.Group className="mb-0" style={{ minWidth: '200px' }}>
                              <Form.Label>Priorité</Form.Label>
                              <Form.Select
                                value={searchFilters.priority || ''}
                                onChange={(e) => setSearchFilters({ ...searchFilters, priority: e.target.value })}
                              >
                                <option value="">Toutes</option>
                                <option value="basse">Basse</option>
                                <option value="moyenne">Moyenne</option>
                                <option value="haute">Haute</option>
                              </Form.Select>
                            </Form.Group>

                            {/* Bouton de recherche */}
                            <div className="d-flex align-items-end">
                              <Button className="btn-purple" onClick={filteredDocuments}>
                                Rechercher
                              </Button>

                              {['autre'].includes(selectedCategory) && (
                                <Button
                                  className="btn-purple ms-2"
                                  variant="outline-secondary"
                                  onClick={() => navigate('/documents-non-complets')}
                                >
                                  Documents non complétés
                                </Button>
                              )}
                            </div>
                          </div>
                        </Form>
                      </>
                    )}
                  </Card>
                </div>
              )}




              <div className="container-fluid d-flex flex-column gap-4 mb-4">
                <style>{`

  .btn-purple {
    background-color: rgb(83, 82, 99) !important;
    border-color: rgb(83, 82, 99) !important;
    color: #fff;
    font-weight: 600;
    transition: all 0.3s ease-in-out;
    border-radius: 8px;
    padding: 8px 16px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-purple:hover {
    background-color: rgb(33, 32, 39) !important;
    border-color: rgb(33, 32, 39) !important;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  .form-control, .form-select {
    border-radius: 8px !important;
    border: 1px solid #ddd !important;
    height: 38px;
  }

  .form-control:focus, .form-select:focus {
    box-shadow: 0 0 0 0.25rem rgba(108, 99, 255, 0.25);
    border-color: #6c63ff !important;
  }

  textarea.form-control {
    min-height: 38px;
    resize: vertical;
  }

.form-control {
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1) !important;
  border-radius: 8px !important;
  border: 1px solid #ddd !important;
}
.form-control:hover {
  box-shadow: inset 0 4px 6px rgba(0, 0, 0, 0.1) !important;
  border-radius: 8px !important;
  border: 1px solid #ddd !important;
}
                .filter-card {
  background: #f9f9f9;
  border-radius: 40px;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.15), 0 4px 12px rgba(0, 0, 0, 0.05);
  border: none;
  padding: 1.5rem;
  transition: all 0.3s ease-in-out;
}

.category-container {
  display: inline-flex;
  gap: 0;
  border-radius: 40px;
  overflow: hidden;
  background: #f9f9f9;
  padding: 3px;
  position: relative;
  justify-content: center;
  align-items: center;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.5);
}

.category-highlight {
  position: absolute;
  height: 100%;
  top: 0;
  left: 0;
  background: #6c63ff;
  border-radius: 40px;
  z-index: 1;
  transition: all 0.3s ease;
  width: 0;
}

.category-btn {
  position: relative;
  border: none;
  border-radius: 40px;
  padding: 8px 18px;
  font-weight: 600;
  font-size: 0.95rem;
  background: transparent;
  color: #555;
  margin: 0 3px;
  cursor: pointer;
  z-index: 2;
}

.category-btn.active {
  color: #fff;
}
`}</style>
                <div className="d-flex justify-content-center mt-3">
                  <div className="category-container position-relative">
                    <div className="category-highlight"></div>

                    <button
                      ref={(el) => (btnRefs.current[''] = el)}
                      className={`category-btn ${selectedCategory === '' ? 'active' : ''}`}
                      onClick={() => setSelectedCategory('')}
                    >
                      Toutes
                    </button>

                    {categories.map((cat) => (
                      <button
                        key={cat}
                        ref={(el) => (btnRefs.current[cat] = el)}
                        className={`category-btn ${selectedCategory === cat ? 'active' : ''}`}
                        onClick={() => handleCategoryButtonClick(cat)}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
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
                        .sort((a, b) => new Date(b.date) - new Date(a.date)) // tri du plus récent au plus ancien
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
                                  disabled={
                                    !(userRole === 'admin' || doc.owner_id === userId) ||
                                    isMediaFile(doc).isPhoto ||
                                    isMediaFile(doc).isVideo
                                  }
                                  title={
                                    isMediaFile(doc).isPhoto || isMediaFile(doc).isVideo
                                      ? 'Workflow non disponible pour les médias'
                                      : userRole === 'admin' || doc.owner_id === userId
                                        ? 'Créer un workflow'
                                        : 'Non autorisé à créer un workflow'
                                  }
                                  style={{
                                    opacity: (userRole === 'admin' || doc.owner_id === userId) &&
                                      !isMediaFile(doc).isPhoto &&
                                      !isMediaFile(doc).isVideo
                                      ? 1
                                      : 0.15,
                                    pointerEvents: (userRole === 'admin' || doc.owner_id === userId) &&
                                      !isMediaFile(doc).isPhoto &&
                                      !isMediaFile(doc).isVideo
                                      ? 'auto'
                                      : 'none'
                                  }}
                                >
                                  <i className="bi bi-play-fill me-1"></i>
                                </Button>
                                {/* Archiver */}

                                {userRole === 'admin' ? (
                                  // Bouton Archive pour l'admin (archive directe)
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    className="ms-2"
                                    onClick={() => handleArchive(doc.id)}
                                    title="Archiver le document"
                                  >
                                    <i className="bi bi-archive"></i>
                                  </Button>
                                ) : (
                                  // Bouton pour les non-admins (envoie une demande)
                                  <Button
                                    variant={archivedRequests[doc.id] ? "warning" : "secondary"}
                                    size="sm"
                                    className="ms-2"
                                    onClick={() => handleClick(doc.id)}
                                    disabled={archivedRequests[doc.id]}
                                    title={
                                      archivedRequests[doc.id]
                                        ? "Demande d'archivage envoyée"
                                        : "Demander l'archivage"
                                    }
                                  >
                                    <i className="bi bi-archive"></i>
                                  </Button>
                                )}
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
                      const visibilityValue = shareAccessType === 'custom' ? 'custom' : 'public';

                      try {
                        console.log("PARTAGE ENVOYÉ 👉", {
                          visibility: visibilityValue,
                          id_share: selectedUsers,
                          id_group: selectedGroup ? [selectedGroup] : [],
                          can_modify: permissions.modify,
                          can_delete: permissions.delete,
                          can_share: permissions.share
                        });

                        await axios.post(`http://localhost:5000/api/documents/${docToShare.id}/share`,
                          {
                            visibility: visibilityValue,
                            id_share: selectedUsers.length > 0 ? selectedUsers : [],
                            id_group: selectedGroup ? [selectedGroup] : [],
                            can_modify: permissions.modify,
                            can_delete: permissions.delete,
                            can_share: permissions.share,
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