import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Card, Button, Alert, Spinner, Row, Col, ButtonGroup, Dropdown, DropdownButton, ListGroup, Form, Modal } from 'react-bootstrap';
import axios from 'axios';
import Navbar from './Navbar';
import { FaFolderOpen, FaPlus, FaFolderPlus, FaFileUpload } from 'react-icons/fa';
import { FaCloudUploadAlt } from 'react-icons/fa';


const FolderListPage = () => {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortOption, setSortOption] = useState('date');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(null); // 'document' ou 'subfolder'
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [inputName, setInputName] = useState('');
  const [inputDescription, setInputDescription] = useState('');
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const { id } = useParams(); // récupère le folder_id depuis l'URL
  const currentFolderId = parseInt(id); // s’assure que c’est bien un nombre
  const [showImportFolderModal, setShowImportFolderModal] = useState(false);

  const [pendingFile, setPendingFile] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
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
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const fetchFolders = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/folders', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setFolders(res.data);
      } catch (err) {
        console.error('Erreur chargement des dossiers :', err);
        setError("Erreur lors du chargement des dossiers.");
      } finally {
        setLoading(false);
      }
    };
    fetchFolders();
  }, [token]);

  const handleViewFolder = (folderId) => {
    navigate(`/folder/${folderId}`);
  };

  const sortFolders = (folders) => {
    switch (sortOption) {
      case 'alpha':
        return [...folders].sort((a, b) => a.name.localeCompare(b.name));
      case 'size':
        return [...folders].sort((a, b) => (b.size || 0) - (a.size || 0));
      case 'count':
        return [...folders].sort((a, b) => (b.file_count || 0) - (a.file_count || 0));
      case 'date':
      default:
        return [...folders].sort((a, b) => new Date(b.date) - new Date(a.date));
    }
  };

  const filteredFolders = folders.filter(folder =>
    folder.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (folder.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedFolders = sortFolders(filteredFolders);

  const openModal = (folderId, type) => {
    setSelectedFolderId(folderId);
    setModalType(type);

    if (type === 'document') {
      setShowUploadForm(true); // <-- Ouvre le bon modal
    } else {
      setShowModal(true);
    }
  }

  const handleSubmit = async () => {
    try {
      if (modalType === 'subfolder') {
        await axios.post(`http://localhost:5000/api/folders/${selectedFolderId}/subfolders`, {
          name: inputName,
          description: inputDescription
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else if (modalType === 'document') {
        // Redirection vers une page d'upload avec le folderId
        navigate(`/folders/${selectedFolderId}/upload-document`);
        return;
      }

      // Réinitialisation et recharge des dossiers
      setInputName('');
      setInputDescription('');
      setShowModal(false);
      const res = await axios.get('http://localhost:5000/api/folders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFolders(res.data);
    } catch (error) {
      console.error('Erreur lors de la création :', error);
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


  return (
    <>
      <Navbar />
      <Container fluid className="py-4">
        <div className="mb-4">
          <h3 className="mb-3">📁 Gestion des dossiers</h3>
          <Form className="mb-3">
            <Form.Control
              type="text"
              placeholder="🔍 Rechercher un dossier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </Form>
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



          <div className="d-flex justify-content-end">
            <DropdownButton id="dropdown-sort" title="Trier par" variant="outline-secondary" onSelect={setSortOption}>
              <Dropdown.Item eventKey="date">Date</Dropdown.Item>
              <Dropdown.Item eventKey="alpha">Nom (A-Z)</Dropdown.Item>
              <Dropdown.Item eventKey="size">Taille</Dropdown.Item>
              <Dropdown.Item eventKey="count">Nombre de fichiers</Dropdown.Item>
            </DropdownButton>
          </div>
        </div>

        {loading && <Spinner animation="border" />}
        {error && <Alert variant="danger">{error}</Alert>}
        {!loading && !error && sortedFolders.length === 0 && (
          <Alert variant="info">Aucun dossier trouvé.</Alert>
        )}

        <Row xs={1} md={2} lg={3} className="g-4">
          {sortedFolders.map(folder => (
            <Col key={folder.id}>
              <Card className="h-100 shadow-sm border-0">
                <Card.Body>
                  <Card.Title className="d-flex justify-content-between align-items-center">
                    <span><FaFolderOpen className="me-2 text-primary" /> {folder.name}</span>
                    <Dropdown as={ButtonGroup} className="mb-3 float-end">
                      <Dropdown.Toggle variant="light" size="sm" title="Ajouter">
                        <FaPlus />
                      </Dropdown.Toggle>
                      <Dropdown.Menu>
                        <Dropdown.Item onClick={() => openModal(folder.id, 'subfolder')}>
                          <FaFolderPlus className="me-2" />
                          Ajouter un sous-dossier
                        </Dropdown.Item>
                        <Dropdown.Item onClick={() => openModal(folder.id, 'document')}>
                          <FaFileUpload className="me-2" />
                          Ajouter un document
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown>
                  </Card.Title>
                  <Card.Text>{folder.description || 'Aucune description'}</Card.Text>
                </Card.Body>
                <Card.Footer className="text-end bg-white border-top-0">
                  <div className="d-flex justify-content-between">
                    <small className="text-muted">
                      📅 {new Date(folder.date).toLocaleDateString()}
                    </small>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={() => handleViewFolder(folder.id)}
                    >
                      Ouvrir
                    </Button>
                  </div>
                </Card.Footer>
              </Card>
            </Col>
          ))}
        </Row>
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
    </>
  );
};

export default FolderListPage;
