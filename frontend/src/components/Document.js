import React, { useState, useEffect } from 'react';
import './DocumentManagementPage.css';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { Link, useNavigate } from 'react-router-dom';
import Dropdown from 'react-bootstrap/Dropdown';
import * as FaIcons from 'react-icons/fa';
import * as AiIcons from 'react-icons/ai';

const Document = () => {
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

  ///upload
  const [accessType, setAccessType] = useState('private');
  const [allowedUsers, setAllowedUsers] = useState([]); // pour les users spécifiques


  // Conflit de version
  const [showConflictPrompt, setShowConflictPrompt] = useState(false);
  const [conflictingDocName, setConflictingDocName] = useState('');
  const [forceUpload, setForceUpload] = useState(false);
  const navigate = useNavigate();
  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate('/');
  };

  //////



  //navbar
  const [sidebar, setSidebar] = useState(false);
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  const token = localStorage.getItem('token');

  const showSidebar = () => setSidebar(!sidebar);
  const sidebarItems = [
    {
      title: 'Accueil',
      path: '/',
      icon: <AiIcons.AiFillHome />,
    },
    currentUser?.role === 'admin' && {
      title: 'Ajouter utilisateur',
      path: '/AdminUsers',
      icon: <FaIcons.FaUserPlus />,
    },

    {
      title: 'Documents',
      path: '/Document',
      icon: <FaIcons.FaPlus />,
    },
    /*{
      title: 'Workflows',
      path: '/workflows',
      icon: <FaIcons.FaTasks />,
    },*/
    {
      title: 'Tâches créées par vous',
      path: '/workflows',
      icon: <FaIcons.FaClipboardList />,
    },
    {
      title: 'Tâches assignées à vous',
      path: '/mes-taches',
      icon: <FaIcons.FaUserCheck />,
    },
    {
      title: 'Tableau de bord / test doc',
      path: '/documents',
      icon: <FaIcons.FaChartBar />,
    },
    {
      title: 'Archive',
      path: currentUser?.role === 'admin' ? '/archive' : '/archiveUser',
      icon: <FaIcons.FaArchive />,
    },
  ];



  // Fetch documents
  const fetchDocuments = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/documents/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) throw new Error('Non autorisé');
      const data = await res.json();
      if (Array.isArray(data)) {
        setDocuments(data);
        const names = data
          .map(doc => doc.collectionName)
          .filter(name => name && typeof name === 'string');
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

  useEffect(() => { fetchDocuments(); }, [token]);

  // Consultation
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const consultDocument = url => {
    window.open(`http://localhost:5000${url}`, '_blank');
  };

  // Suppression
  const handleDelete = async id => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) return;
    try {
      await fetch(`http://localhost:5000/api/documents/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setDocuments(documents.filter(d => d.id !== id));
      setSavedDocuments(savedDocuments.filter(d => d.id !== id));
    } catch (err) {
      console.error('Erreur suppression :', err);
    }
  };

  // Toggle save
  const toggleSaveDocument = doc => {
    const exists = savedDocuments.some(d => d.id === doc.id);
    if (exists) {
      setSavedDocuments(savedDocuments.filter(d => d.id !== doc.id));
    } else {
      setSavedDocuments([...savedDocuments, doc]);
      setIsSavingCollection(true);
    }
  };

  // Upload
  const handleUpload = async () => {
    if (!pendingFile || !pendingName || !category) {
      setErrorMessage('Veuillez remplir tous les champs requis.');
      return;
    }
    const existingDoc = documents.find(d => d.name === pendingName);
    if (existingDoc && !forceUpload) {
      setConflictingDocName(pendingName);
      setShowConflictPrompt(true);
      return;
    }
    if (pendingFile.size > 10 * 1024 * 1024) {
      setErrorMessage('Le fichier dépasse la limite de 10 Mo.');
      return;
    }
    const formData = new FormData();
    formData.append('name', pendingName);
    formData.append('file', pendingFile);
    formData.append('category', category);
    formData.append('visibility', accessType);
    formData.append('access', accessType);
    formData.append('collectionName', collectionName);
    if (forceUpload) formData.append('isNewVersion', 'true');

    try {
      const res = await fetch('http://localhost:5000/api/documents/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      if (!res.ok) throw new Error(`Erreur : ${res.status}`);
      const newDoc = await res.json();
      setDocuments([newDoc, ...documents]);
      // Reset
      setPendingFile(null);
      setPendingName('');
      setCategory('');
      setCollectionName('');
      setForceUpload(false);
      setShowConflictPrompt(false);
      setConflictingDocName('');
      setErrorMessage(null);
    } catch (err) {
      console.error('Erreur upload :', err);
      setErrorMessage('Erreur lors de l\'envoi du document.');
    }
  };
  //version document



  // Sauvegarde collection
  const saveCollection = async () => {
    const nameToUse = selectedExistingCollection || collectionName;
    if (!nameToUse) {
      setErrorMessage('Veuillez choisir ou entrer un nom de collection.');
      return;
    }
    try {
      const updated = await Promise.all(
        savedDocuments.map(async doc => {
          const res = await axios.put(
            `http://localhost:5000/api/documents/${doc.id}`,
            { collectionName: nameToUse },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          return res.data;
        })
      );
      setDocuments(prev => prev.map(d => updated.find(u => u.id === d.id) || d));
      setSavedDocuments([]);
      setCollectionName('');
      setSelectedExistingCollection('');
      setIsSavingCollection(false);
      if (!collections.includes(nameToUse)) setCollections([...collections, nameToUse]);
    } catch (err) {
      console.error('Erreur sauvegarde collection :', err);
      setErrorMessage('Erreur lors de la sauvegarde des documents.');
    }
  };

  // Filtre avancé
  const handleAdvancedToggle = () => setUseAdvancedFilter(prev => !prev);

  // Highlight
  const highlightMatch = (text, query) => {
    if (!text || !query) return text;
    const esc = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${esc})`, 'gi');
    return text.split(regex).map((part, i) =>
      regex.test(part) ? <span key={i} className="highlight">{part}</span> : part
    );
  };

  const [username, setUsername] = useState('');

  // Décoder JWT pour récupérer userId
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const decoded = jwtDecode(token);
      console.log("Token décodé:", decoded);
      setUserId(decoded.id); // ici tu fixes le problème
    }
  }, []);



  // Récupérer la liste des utilisateurs
  useEffect(() => {
    fetch('http://localhost:5000/api/auth/users')
      .then(res => res.json())
      .then(data => setUsers(data))
      .catch(err => console.error('Erreur chargement utilisateurs :', err));
  }, []);

  // Associer userId au user courant
  useEffect(() => {
    if (userId && users.length > 0) {
      const found = users.find(u => u.id === userId);
      if (found) setCurrentUser(found);
    }
  }, [userId, users]);

  useEffect(() => {
    if (currentUser) {
      console.log("Utilisateur connecté :", currentUser);
    }
  }, [currentUser]);



  // Filter documents
  const filteredDocuments = documents.filter(doc => {
    const docName = doc.name || '';
    const docDate = doc.date ? new Date(doc.date) : null;
    const matchesType =
      filterType === 'Tous les documents' || docName.endsWith(filterType);
    const matchesDate =
      (!startDate || docDate >= new Date(startDate)) &&
      (!endDate || docDate <= new Date(endDate));
    const matchesSearch = docName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAdvanced =
      useAdvancedFilter &&
      (doc.text_content || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesDate && (matchesSearch || matchesAdvanced);
  });

  const getAllVersionsOfDocument = (documents, documentId) => {
    return documents.filter(doc => doc.original_document_id?.toString() === documentId.toString() || doc.id.toString() === documentId.toString());
  };

  return (
    <div className="container">
      <div className="content">
        <h1>Gestion des Documents</h1>
        <button
          className="file-label"
          onClick={() => navigate('/folder')}
        >
          Aller aux dossiers
        </button>

        {currentUser ? (
          <Dropdown>
            <Dropdown.Toggle variant="light" id="dropdown-basic" className="text-success fw-bold">
              {currentUser.name} {currentUser.prenom}
            </Dropdown.Toggle>

            <Dropdown.Menu>
              <Dropdown.Item href="/help">Aide</Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item onClick={handleLogout} className="text-danger">
                Déconnexion
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>) : (
          <div className="text-danger">Aucun utilisateur connecté</div>
        )}
        <div className="controls">
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <select value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="Tous les documents">Tous les documents</option>
            <option value=".pdf">PDF</option>
            <option value=".docx">Word</option>
            <option value=".jpg">Images</option>
          </select>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          <button className={useAdvancedFilter ? 'button-sup' : 'button-re'} onClick={handleAdvancedToggle}>
            {useAdvancedFilter ? 'Désactiver Recherche Avancée' : 'Activer Recherche Avancée'}
          </button>
        </div>

        {errorMessage && <p className="error">{errorMessage}</p>}

        <div className="document-upload">
          <input
            type="text"
            placeholder="Nom du document"
            value={pendingName}
            onChange={e => setPendingName(e.target.value)}
          />
          <label className="file-label">
            Choisir un fichier
            <input
              type="file"
              onChange={e => setPendingFile(e.target.files[0])}
              accept=".pdf,.docx,.jpg,.jpeg,.png"
            />
          </label>
          <select value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">Choisir une catégorie</option>
            <option value="rapport">Rapport</option>
            <option value="article">Article</option>
            <option value="mémoire">Mémoire</option>
            <option value="autre">Autre</option>
          </select>
          <div>
            <select id="access" value={accessType} onChange={(e) => setAccessType(e.target.value)}>
              <option value="private">Privé</option>
              <option value="public">Tous les utilisateurs</option>
              <option value="custom">Utilisateurs spécifiques</option>
            </select>
          </div>

          <button onClick={handleUpload}>Uploader</button>

          {/* Bloc confirmation conflit de version */}
          {showConflictPrompt && (
            <div className="conflict-dialog">
              <p>
                Un fichier avec le nom <strong>{conflictingDocName}</strong> existe déjà.<br />
                Voulez-vous sauvegarder une nouvelle version du document ?
              </p>
              <button
                className="button-oui"
                onClick={() => {
                  setForceUpload(true);
                  handleUpload();
                }}
              >
                Oui
              </button>
              <button
                className="button-non"
                onClick={() => {
                  setShowConflictPrompt(false);
                  setForceUpload(false);
                }}
              >
                Non
              </button>
            </div>
          )}
        </div>
        {showModal && selectedDoc && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2>Détails du document</h2>
              <p><strong>Nom :</strong> {selectedDoc.name}</p>
              <p><strong>Catégorie :</strong> {selectedDoc.category}</p>
              <p><strong>Collection :</strong> {selectedDoc.collectionName || 'Aucune'}</p>
              <p><strong>Date d’upload :</strong> {new Date(selectedDoc.createdAt).toLocaleString()}</p>
              <p><strong>Visibilité :</strong> {selectedDoc.visibility}</p>
              <p><strong>Contenu extrait :</strong></p>
              <div className="doc-text-content">
                {selectedDoc.text_content
                  ? <pre>{selectedDoc.text_content}</pre>
                  : <em>Pas de contenu extrait disponible</em>}
              </div>

              <div className="modal-actions">
                <button className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
            </div>
          </div>
        )}


        {isSavingCollection && savedDocuments.length > 0 && (
          <div className="saved-collection">
            <h3>📁 Mon dossier</h3>
            <select value={selectedExistingCollection} onChange={e => setSelectedExistingCollection(e.target.value)}>
              <option value="">Choisir un dossier existant</option>
              {collections.map(col => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="...ou entrer un nouveau nom"
              value={collectionName}
              onChange={e => setCollectionName(e.target.value)}
            />
            <button onClick={saveCollection}>Sauvegarder</button>
            <ul>
              {savedDocuments.map(doc => (
                <li key={doc.id}>
                  {doc.name} - {doc.category}
                  <button onClick={() => toggleSaveDocument(doc)}>❌</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <table className="document-table">
          <thead>
            <tr>
              <th>Document</th>
              <th></th>
              <th>Date de creation</th>
              <th>Catégorie</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDocuments.length > 0 ? (
              filteredDocuments.map(doc => (
                <tr key={doc.id}>
                  <td>
                    {highlightMatch(doc.name, searchQuery)}{' '}
                    {doc.version ? `(version ${doc.version})` : ''}

                  </td>
                  <td>
                    <button
                      onClick={() => {
                        setSelectedDoc(doc);  // Mettez à jour selectedDoc avec l'objet du document
                        window.open(`http://localhost:5000${doc.file_path}`, '_blank');
                        setShowModal(false);
                      }}
                      className="p-0 m-0 bg-transparent border-none outline-none hover:opacity-70"
                      style={{ all: 'unset', cursor: 'pointer' }}
                    >
                      📄
                    </button>

                  </td>

                  <td>{doc.date ? new Date(doc.date).toLocaleString() : 'Date inconnue'}</td>
                  <td>{doc.category || 'Non spécifié'}</td>
                  <td className="actions">
                    <button className="button" onClick={() => {
                      setSelectedDoc(doc);
                      setShowModal(true);
                      setShowDetails(false);
                    }}>
                      Details

                    </button>

                    <button className="button-sup" onClick={() => handleDelete(doc.id)}>
                      Supprimer
                    </button>
                    <button className="button-save" onClick={() => toggleSaveDocument(doc)}>
                      {savedDocuments.some(saved => saved.id === doc.id)
                        ? 'Retirer de la collection'
                        : 'Save'}
                    </button>
                    <button className="button-share" >
                      share
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center' }}>
                  Aucun document trouvé
                </td>
              </tr>
            )}
          </tbody>
        </table>

      </div>
    </div>
  );
};


export default Document;