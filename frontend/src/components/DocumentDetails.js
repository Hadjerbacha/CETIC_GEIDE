import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from './Navbar';
import { Container, Row, Col, Card, Button, Form, Alert } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

const DocumentDetails = () => {
  const { id } = useParams();
  const [document, setDocument] = useState(null);
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const token = localStorage.getItem('token');
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [showVersions, setShowVersions] = useState(false);
  const [oldVersions, setOldVersions] = useState([]);
  const [requestSent, setRequestSent] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
    

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/documents/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Échec du chargement du document");
        const doc = await res.json();
        setDocument(doc);
        setSelectedVersion(doc.version);
      } catch (error) {
        console.error("Erreur document :", error);
        setErrorMessage("Impossible de charger le document.");
      }
    };


    const fetchVersions = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/documents/versions/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Échec du chargement des versions");
        const versionList = await res.json();
        setVersions(versionList);
      } catch (error) {
        console.error("Erreur versions :", error);
      }
    };

    if (id && token) {
      fetchDocument();
      fetchVersions();
    }
  }, [id, token]);

  const handleVersionChange = async (e) => {
    const versionId = e.target.value;
    const selected = versions.find(v => v.id === parseInt(versionId));
    if (selected) {
      try {
        const res = await fetch(`http://localhost:5000/api/documents/version/${selected.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Échec du chargement de la version sélectionnée");
        const versionDoc = await res.json();
        setDocument(versionDoc);
        setSelectedVersion(versionDoc.version);
      } catch (error) {
        console.error("Erreur chargement version :", error);
      }
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  const handleSummarize = async () => {
    if (!document?.text_content) {
      setSummary("⚠️ Le document ne contient pas de texte analysable.");
      return;
    }
  
    setIsSummarizing(true);
    setSummary(null);
  
    try {
      // Limite à 10 000 caractères pour éviter les dépassements de tokens
      const textToSummarize = document.text_content.slice(0, 10000); 
      const summaryText = await generateSummary(textToSummarize);
      setSummary(summaryText);
    } catch (error) {
      setSummary("❌ Erreur lors de la génération du résumé.");
    } finally {
      setIsSummarizing(false);
    }
  };

  const generateSummary = async (text) => {
    try {
      const response = await axios.post(
        "http://localhost:5000/api/summarize",
        { text },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      return response.data.summary || "Aucun résumé généré.";
    } catch (error) {
      console.error("Erreur résumé:", error.response?.data || error.message);
      return "❌ Impossible de générer le résumé (erreur API).";
    }
  };



  const renderDocumentViewer = () => {
    if (!document || !document.file_path) return null;

    const fileExtension = document.file_path.split('.').pop().toLowerCase();
    const fullUrl = `http://localhost:5000${document.file_path}`;

    if (['jpg', 'jpeg', 'png'].includes(fileExtension)) {
      return <img src={fullUrl} alt="document" style={{ width: '100%' }} />;
    } else if (fileExtension === 'pdf') {
      return (
        <iframe
          title="PDF Viewer"
          src={fullUrl}
          width="100%"
          height="100%"
          style={{ border: 'none', minHeight: '600px' }}
        ></iframe>
      );
    } else {
      return <Alert variant="warning">Format non supporté.</Alert>;
    }
  };

  const handleRequestAccess = async () => {
    try {
      // Trouver l'administrateur
      const adminUser = users.find(u => u.role === 'admin');
      if (!adminUser) {
        alert("❌ Aucun administrateur trouvé.");
        return;
      }

      // Log pour vérifier l'ID de l'utilisateur
      console.log("User ID (expéditeur):", userId);  // Affiche l'ID de l'utilisateur connecté
      console.log("Admin ID (destinataire):", adminUser.id);  // Affiche l'ID de l'administrateur trouvé

      const res = await fetch(`http://localhost:5000/api/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: adminUser.id, // L'admin est le destinataire
          sender_id: userId,     // L'utilisateur connecté est l'expéditeur
          message: `Demande d'accés aux anciennes versions du document #${id}`,
          type: 'request',
          related_task_id: null,
          document_id: id,       // facultatif mais utile pour le suivi
        }),
      });

      if (!res.ok) throw new Error("Erreur lors de la demande");

      // Mettre à jour l'état de requestSent après envoi de la demande
      setRequestSent(true);

      // Sauvegarder dans localStorage
      localStorage.setItem(`requestSent_${id}`, 'true');

      alert("✅ Votre demande d'accès a été envoyée à l'administrateur.");
    } catch (error) {
      console.error("Erreur demande accès :", error);
      alert("❌ Une erreur est survenue lors de la demande.");
    }
  };

  useEffect(() => {
    // Vérifie si la demande a déjà été envoyée
    const requestSentStatus = localStorage.getItem(`requestSent_${id}`);
    if (requestSentStatus === 'true') {
      setRequestSent(true);
    }
  }, [id]);

  // Décoder JWT pour récupérer userId
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const decoded = jwtDecode(token);
      setUserId(decoded.id); // ici tu fixes le problème
    }
  }, []);

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

  const fetchOldVersions = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/document_versions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOldVersions(res.data);
    } catch (error) {
      console.error('Erreur lors de la récupération des anciennes versions:', error);
    }
  };
  const handleViewVersions = () => {
    navigate(`/document/${document.id}/versions`);
  };


  console.log("Liste des utilisateurs:", users);
  console.log("userId:", userId, "typeof:", typeof userId);
  console.log("users[0].id typeof:", typeof users[0]?.id);
  console.log("currentUser:", currentUser);
  console.log("Versions:", versions.length);

   const fetchNotifications = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`http://localhost:5000/api/notifications/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setNotifications(res.data);
      } catch (error) {
        console.error('Erreur lors de la récupération des notifications:', error);
      }
    };

     useEffect(() => {
        if (currentUser) {
          axios.get(`http://localhost:5000/api/notifications/${currentUser.id}`)
            .then(res => {
              const unreadCount = res.data.filter(notification => !notification.is_read).length;
              setUnreadNotificationsCount(unreadCount);
            })
            .catch(err => console.error("Erreur notifications :", err));
        }
      }, [currentUser]);

  return (
    <>
      <Navbar />
      <Container fluid className="px-4 py-3" style={{ minHeight: '100vh' }}>
        {errorMessage ? (
          <Alert variant="danger">{errorMessage}</Alert>
        ) : document ? (
          <Row style={{ height: '100%' }}>
            {/* Colonne gauche : visualisation du document */}
            <Col md={8}>
              <Card className="h-100">
                <Card.Header>📄 Aperçu du document</Card.Header>
                <Card.Body style={{ padding: 0 }}>{renderDocumentViewer()}</Card.Body>
              </Card>
            </Col>

            {/* Colonne droite : détails */}
            <Col md={4}>
              <Card className="h-100">
                <Card.Body>
                  <div className="d-flex justify-content-end">
                    <Button variant="secondary" size="sm" onClick={handleBack}>
                      ⬅️ Retour
                    </Button>
                  </div>

                  <h4 className="mt-3">📌 Détails</h4>
                  <p><strong>Nom :</strong> {document.name}</p>
                  <p><strong>Catégorie :</strong> {document.category}</p>
                  <p><strong>Collection :</strong> {document.collectionName || 'Aucune'}</p>
                  <p><strong>Date d’upload :</strong> {new Date(document.createdAt).toLocaleString()}</p>
                  <p><strong>Visibilité :</strong> {document.visibility}</p>

                  {document.version !== undefined && document.version !== null && (
                    <p className="mt-4">
                      <strong>ℹ️ Version actuelle :</strong> {document.version}
                      {document.version > 1 && currentUser?.role !== 'admin' && (
                        <Button
                          variant="warning"
                          className="mt-2"
                          onClick={handleRequestAccess}
                          disabled={requestSent}  // Désactive le bouton si la demande a été envoyée
                        >
                          {requestSent ? "Demande envoyée" : "🔒 Demander l'accès aux anciennes versions"}
                        </Button>
                      )}
                      {document.version > 1 && (
                        (currentUser?.role === 'admin' || document.access === true )
                        && <Button
                          variant="outline-secondary"
                          className="mt-2 rounded-pill fw-semibold px-4 py-2"
                          onClick={handleViewVersions}
                          style={{
                            transition: 'all 0.2s ease-in-out',
                          }}
                          onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                          onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                          Voir les versions
                        </Button>
                      )}
                    </p>
                  )}

                  <Button variant="info" onClick={handleSummarize} disabled={isSummarizing}>
                    {isSummarizing ? "Résumé en cours..." : "🧠 Résumer ce document"}
                  </Button>

                  {summary && (
                    <Alert variant="light" className="mt-3">
                      <h6>📝 Résumé :</h6>
                      <p>{summary}</p>
                    </Alert>
                  )}
                  {versions.length > 0 && (
                    <Form.Group className="mt-4">
                      <Form.Label><strong>📑 Versions :</strong></Form.Label>
                      <Form.Select value={selectedVersion} onChange={handleVersionChange}>
                        {versions.map(v => (
                          <option key={v.id} value={v.id}>
                            Version {v.version} – {new Date(v.date).toLocaleDateString()}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        ) : (
          <p>Chargement du document...</p>
        )}
      </Container>
    </>
  );
};

export default DocumentDetails;
