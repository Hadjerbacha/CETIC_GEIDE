import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Card, Button, Alert, Spinner, Row, Col, ButtonGroup, Dropdown, DropdownButton, ListGroup, Form, Modal } from 'react-bootstrap';
import axios from 'axios';
import Navbar from './Navbar';
import { FaFolderOpen, FaPlus, FaFolderPlus, FaFileUpload } from 'react-icons/fa';
import { FaCloudUploadAlt } from 'react-icons/fa';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FiFileText } from 'react-icons/fi';
import Select from 'react-select';
import { FaShare } from 'react-icons/fa';

const FolderDetailsPage = () => {
  const { id } = useParams();
  const [folders, setFolders] = useState([]);
  const navigate = useNavigate();
  const [subfolders, setSubfolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const token = localStorage.getItem('token');
  const [showImportFolderModal, setShowImportFolderModal] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(null); // 'document' ou 'subfolder'
  const [showShareModal, setShowShareModal] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [allGroups, setAllGroups] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const GROUPS_API = 'http://localhost:5000/api/groups'; // Ajustez selon votre API

  const [pendingFile, setPendingFile] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [accessType, setAccessType] = useState('private');
  const [permissions, setPermissions] = useState({
    can_modify: false,
    can_delete: false
  });
  const [allowedUsers, setAllowedUsers] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [documentId, setDocumentId] = useState(null);
  const [step, setStep] = useState(1);
  const [folderName, setFolderName] = useState('');
  const [userId, setUserId] = useState(null);
  const [documents, setDocuments] = useState([]);

  const [folder, setFolder] = useState(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  useEffect(() => {
    const fetchFolder = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/folders/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('Folder data:', res.data);
        setFolder(res.data);
      } catch (error) {
        setError("Erreur lors du chargement du dossier");
      } finally {
        setLoading(false);
      }
    };

    fetchFolder();
  }, [id, token]);

  const fetchData = async () => {
    try {
      const folderRes = await axios.get(`http://localhost:5000/api/folders/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFolders(folderRes.data);

      const subRes = await axios.get(`http://localhost:5000/api/folders/${id}/children`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSubfolders(subRes.data);

      const docRes = await axios.get(`http://localhost:5000/api/folders/${id}/documents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDocuments(docRes.data);
    } catch (err) {
      console.error(err);
      setError("Erreur lors du chargement des données du dossier.");
    } finally {
      setLoading(false);
    }
  };

  const fetchFolder = async () => {
  try {
    const res = await axios.get(`http://localhost:5000/api/folders/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setFolder(res.data);
    // Initialisez aussi les sélections de partage si nécessaire
    setSelectedUsers(allUsers.filter(u => res.data.share_users?.includes(u.value)));
    setSelectedGroups(allGroups.filter(g => res.data.share_groups?.includes(g.value)));
  } catch (error) {
    setError("Erreur lors du chargement du dossier");
    console.error(error);
  } finally {
    setLoading(false);
  }
};

  // Utilisez vos fonctions existantes telles quelles
const fetchUsers = async () => {
  try {
    const res = await axios.get('http://localhost:5000/api/auth/users/');
    const formatted = res.data.map(u => ({ value: u.id, label: `${u.name} ${u.prenom}` }));
    setAllUsers(formatted);
  } catch (err) {
    console.error('Erreur chargement des utilisateurs', err);
  }
};

const fetchGroups = async () => {
  try {
    const res = await axios.get(GROUPS_API);
    setAllGroups(res.data.map(g => ({ value: g.id, label: g.name }))); // Formatage pour react-select
  } catch (err) {
    console.error('Erreur récupération groupes:', err);
  }
};

useEffect(() => {
  const loadData = async () => {
    await fetchFolder();
    await fetchUsers();
    await fetchGroups();
    await fetchData();
  };

  loadData();
}, [id, token]);


useEffect(() => {
  const loadData = async () => {
    await fetchFolder();
    await fetchUsers();
    await fetchGroups();
    await fetchData();
  };

  loadData();
}, [id, token]);


  useEffect(() => {
    fetchData();
  }, [id, token]);

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    try {
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      };

      // Changer ici : URL correcte pour création dossier
      const response = await axios.post(
        'http://localhost:5000/api/folders',
        {
          name: folderName,
          parent_id: null // ou currentFolderId si tu veux créer un sous-dossier
        },
        config
      );

      console.log('Dossier créé:', response.data);
      setShowCreateFolderModal(false);
      setFolderName('');
      // Recharge la liste des dossiers
      const res = await axios.get('http://localhost:5000/api/folders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFolders(res.data);

    } catch (error) {
      console.error('Erreur création dossier:', error);
      alert('Impossible de créer le dossier.');
    }
  };

  const handleShareFolder = async (userIds, groupIds) => {
  try {
    const res = await axios.put(
      `http://localhost:5000/api/folders/${id}/share`,
      {
        share_users: userIds,
        share_groups: groupIds
      },
      {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Mettre à jour l'état local avec la réponse complète du serveur
    setFolder(res.data);
    
    toast.success("Partage mis à jour avec succès!");
    return true;
  } catch (err) {
    console.error("Erreur lors du partage:", err);
    
    let errorMessage = "Erreur lors de la mise à jour du partage";
    if (err.response) {
      if (err.response.status === 403) {
        errorMessage = "Vous n'avez pas la permission de partager ce dossier";
      } else if (err.response.data?.error) {
        errorMessage = err.response.data.error;
      }
    }
    
    toast.error(errorMessage);
    return false;
  }
};

  const handleImportFolder = async () => {
    if (!folderName || !pendingFile || pendingFile.length === 0) {
      alert("Veuillez fournir un nom de dossier et au moins un fichier.");
      return;
    }

    const formData = new FormData();
    formData.append("name", folderName);

    for (let i = 0; i < pendingFile.length; i++) {
      formData.append("files", pendingFile[i]);
    }

    try {
      const res = await axios.post("http://localhost:5000/api/folders/import", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data"
        }
      });

      console.log("Dossier importé :", res.data);
      setShowImportFolderModal(false);
      setFolderName('');
      setPendingFile(null);

      // Recharger les dossiers
      const updated = await axios.get('http://localhost:5000/api/folders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFolders(updated.data);

    } catch (err) {
      console.error("Erreur lors de l'importation :", err);
      alert("Erreur lors de l'importation du dossier.");
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
    formData.append("folder_id", selectedFolderId);

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

      console.log("Folder ID reçu :", selectedFolderId);
      console.log("useParams id :", id);
      // Rediriger vers la page de complétion
      navigate(`/document/${data.id}/complete`);
    } catch (err) {
      console.error("Erreur lors de l'envoi du fichier :", err);
      setErrorMessage("Erreur lors de l'envoi du fichier.");
    }
  };

  const createWorkflow = async () => {
    try {
      const res = await axios.post(
        `http://localhost:5000/api/folders/${id}/create-workflow`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Workflow créé avec succès!');

      // Rafraîchissement des données après 1 seconde
      setTimeout(() => {
        window.location.reload(); // Rafraîchissement complet de la page
      }, 1000);

    } catch (err) {
      console.error('Erreur création workflow:', err);
      toast.error(err.response?.data?.error || 'Erreur lors de la création du workflow');
    }
  };

  return (
    <>
      <Navbar />
      <Container fluid className="py-4 px-5">
        {loading && <Spinner animation="border" />}
        {error && <Alert variant="danger">{error}</Alert>}

        {!loading && folder && (
          <Card className="shadow-lg border-0 w-100 p-4">
            <Card.Body>
              <Card.Title className="mb-4 display-6">📁 Détails du dossier</Card.Title>

              <ButtonGroup className="mt-3">
  <Button
    variant="primary"
    onClick={createWorkflow}
    disabled={folder?.workflow_id}
  >
    <FiFileText className="me-2" />
    {folder?.workflow_id ? 'Workflow déjà appliqué' : 'Créer un workflow'}
  </Button>
  
  <Button 
    variant="info" 
    onClick={() => {
      setSelectedUsers(allUsers.filter(u => folder?.share_users?.includes(u.value)));
      setSelectedGroups(allGroups.filter(g => folder?.share_groups?.includes(g.value)));
      setShowShareModal(true);
    }}
    className="ms-2"
  >
    <FaShare className="me-2" />
    Partager
  </Button>
</ButtonGroup>
              <p><strong>ID :</strong> {id ?? 'N/A'}</p>
              <p><strong>Nom :</strong> {folder.name ?? 'Sans nom'}</p>
              <p><strong>Description :</strong> {folder.description ? folder.description : 'Aucune description fournie.'}</p>
              <p><strong>Date de création :</strong> {folder.date ? new Date(folder.date).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Date non disponible'}</p>
              <Dropdown>
                <Dropdown.Toggle variant="primary" id="dropdown-basic">
                  <FaFolderOpen className="me-2" /> Options
                </Dropdown.Toggle>

                <Dropdown.Menu>
                  <Dropdown.Item onClick={() => setShowCreateFolderModal(true)}>
                    <FaFolderPlus className="me-2" />
                    Créer un dossier vide
                  </Dropdown.Item>

                  <Dropdown.Item onClick={() => setShowImportFolderModal(true)}>
                    <FaFolderOpen className="me-2" />
                    Importer un dossier
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>

              <hr />

              <h5 className="mt-4 mb-3">📂 Sous-dossiers</h5>
              <hr />

              <h5 className="mt-4 mb-3">📄 Fichiers</h5>

              {documents.length === 0 ? (
                <p>Aucun fichier dans ce dossier.</p>
              ) : (
                <ListGroup>
                  {documents.map((doc) => (
                    <ListGroup.Item key={doc.id} action onClick={() => navigate(`/documents/${doc.id}`)}>
                      <strong>{doc.name}</strong> – {new Date(doc.date).toLocaleDateString()}
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}


              {subfolders.length === 0 ? (
                <p>Aucun sous-dossier.</p>
              ) : (
                <ListGroup>
                  {subfolders.map((sub) => (
                    <ListGroup.Item
                      key={sub.id}
                      action
                      onClick={() => navigate(`/folder/${sub.id}`)}
                    >
                      <strong> {sub.name}</strong>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
             
              {folder.workflow_id && (
                <div className="mt-4">
                  <h5>Workflow associé</h5>
                  <Alert variant="info">
                    Ce dossier a un workflow associé (ID: {folder.workflow_id})
                  </Alert>
                  <Button
                    variant="info"
                    onClick={() => navigate(`/workflowz/${folder.workflow_id}`)}
                  >
                    Voir le workflow
                  </Button>
                </div>
              )}
            </Card.Body>
          </Card>
        )}
      </Container>
      <Modal style={{ zIndex: 1050 }} show={showImportFolderModal} onHide={() => setShowImportFolderModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Importer un dossier</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group controlId="formFolderName">
              <Form.Label>Nom du dossier</Form.Label>
              <Form.Control
                type="text"
                placeholder="Nom du dossier"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
              />
            </Form.Group>
            <Form.Group controlId="formFolderFiles" className="mt-3">
              <Form.Label>Fichiers</Form.Label>
              <Form.Control
                type="file"
                multiple
                webkitdirectory="true"
                directory="true"
                onChange={(e) => setPendingFile(e.target.files)}
              />
              <Form.Text className="text-muted">
                Sélectionnez un dossier à importer depuis votre système de fichiers.
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowImportFolderModal(false)}>
            Annuler
          </Button>
          <Button variant="primary" onClick={handleImportFolder}>
            Importer
          </Button>
        </Modal.Footer>
      </Modal>


      <Modal show={showCreateFolderModal} style={{ zIndex: 1050 }} onHide={() => setShowCreateFolderModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Créer un nouveau dossier</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleCreateFolder}>
            <Form.Group controlId="folderName">
              <Form.Label>Nom du dossier</Form.Label>
              <Form.Control
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="Entrez un nom"
                required
              />
            </Form.Group>
            <div className="d-flex justify-content-end mt-3">
              <Button variant="secondary" onClick={() => setShowCreateFolderModal(false)}>Annuler</Button>
              <Button variant="primary" type="submit" className="ms-2">Créer</Button>
            </div>
          </Form>
        </Modal.Body>
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

      {/* Modal de partage */}
<Modal show={showShareModal} style={{ zIndex: 1050 }} onHide={() => setShowShareModal(false)} size="lg">
  <Modal.Header closeButton>
    <Modal.Title>Partager le dossier "{folder?.name}"</Modal.Title>
  </Modal.Header>
  <Modal.Body>
    <Form>
      <Form.Group className="mb-4">
        <Form.Label>Utilisateurs</Form.Label>
        <Select
          isMulti
          options={allUsers}
          value={selectedUsers}
          onChange={(selected) => setSelectedUsers(selected || [])}
          placeholder="Sélectionnez des utilisateurs..."
          className="basic-multi-select"
          classNamePrefix="select"
        />
      </Form.Group>

      <Form.Group>
        <Form.Label>Groupes</Form.Label>
        <Select
          isMulti
          options={allGroups}
          value={selectedGroups}
          onChange={(selected) => setSelectedGroups(selected || [])}
          placeholder="Sélectionnez des groupes..."
          className="basic-multi-select"
          classNamePrefix="select"
        />
      </Form.Group>

      <div className="mt-4 p-3 bg-light rounded">
        <h6>Actuellement partagé avec :</h6>
        {folder?.share_users?.length > 0 || folder?.share_groups?.length > 0 ? (
          <>
            {folder.share_users?.length > 0 && (
              <div>
                <strong>Utilisateurs :</strong>
                <ul>
                  {folder.share_users.map(userId => {
                    const user = allUsers.find(u => u.value === userId);
                    return <li key={userId}>{user ? user.label : `ID: ${userId}`}</li>;
                  })}
                </ul>
              </div>
            )}
            {folder.share_groups?.length > 0 && (
              <div>
                <strong>Groupes :</strong>
                <ul>
                  {folder.share_groups.map(groupId => {
                    const group = allGroups.find(g => g.value === groupId);
                    return <li key={groupId}>{group ? group.label : `ID: ${groupId}`}</li>;
                  })}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p>Ce dossier n'est pas partagé.</p>
        )}
      </div>
    </Form>
  </Modal.Body>
  <Modal.Footer>
    <Button variant="secondary" onClick={() => setShowShareModal(false)}>
      Annuler
    </Button>
    <Button 
      variant="primary" 
      onClick={async () => {
        await handleShareFolder(
          selectedUsers.map(u => u.value),
          selectedGroups.map(g => g.value)
        );
        setShowShareModal(false);
      }}
    >
      Enregistrer le partage
    </Button>
  </Modal.Footer>
</Modal>

    </>
  );
};

export default FolderDetailsPage;
