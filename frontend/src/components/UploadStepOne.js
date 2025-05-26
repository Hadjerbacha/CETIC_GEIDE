import React, { useState } from 'react';
import { Button, Modal, Alert } from 'react-bootstrap';
import { FaCloudUploadAlt } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const UploadStepOne = ({ show, onClose, token }) => {
  const [pendingFile, setPendingFile] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const navigate = useNavigate();

  const handleNextStep = async () => {
    if (!pendingFile) {
      setErrorMessage("Veuillez sélectionner un fichier.");
      return;
    }

    if (pendingFile.size > 100 * 1024 * 1024) {
      setErrorMessage("Le fichier dépasse la limite de 100 Mo.");
      return;
    }

    const formData = new FormData();
    formData.append('file', pendingFile);

    try {
      const res = await fetch('http://localhost:5000/api/documents', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) throw new Error("Erreur serveur: " + res.status);
      const data = await res.json();

      navigate(`/document/${data.id}/complete`); // redirection vers une page de formulaire complémentaire
    } catch (err) {
      console.error("Erreur d'upload :", err);
      setErrorMessage("Erreur lors du téléchargement du fichier.");
    }
  };

  return (
    <Modal show={show} onHide={onClose} centered backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>Uploader un fichier</Modal.Title>
      </Modal.Header>
      <Modal.Body className="text-center">
        {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}

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
          style={{ maxWidth: '350px' }}
        >
          <FaCloudUploadAlt size={20} className="me-2" />
          {pendingFile ? pendingFile.name : 'Choisir un fichier'}
        </Button>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Annuler</Button>
        <Button variant="primary" disabled={!pendingFile} onClick={handleNextStep}>Suivant</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default UploadStepOne;
