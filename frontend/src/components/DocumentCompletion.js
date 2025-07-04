import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Button, Container, Card, Alert } from 'react-bootstrap';
import axios from 'axios';
import Navbar from './Navbar';
import { jwtDecode } from 'jwt-decode';

const DocumentCompletion = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  // États
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
  const [differenceNote, setDifferenceNote] = useState('');
  const [canAddVersion, setCanAddVersion] = useState(false);
  const [isNewVersion, setIsNewVersion] = useState(true);

  const category = docInfo?.category || '';

  useEffect(() => {
    const checkName = async () => {
      const fullName = extension ? `${baseName}.${extension}` : baseName;
      const duplicateExists = await checkForDuplicate(fullName);
      if (!duplicateExists) {
        setExistingDocument(null);
        setIsNewVersion(false);
      }
    };

    if (baseName.trim()) {
      checkName();
    }
  }, [baseName, extension]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (baseName.trim()) {
        const fullName = extension ? `${baseName}.${extension}` : baseName;
        await checkForDuplicate(fullName);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [baseName, extension]);
  useEffect(() => {
    const initialize = async () => {
      if (!id || !token) return;

      try {
        // 1. Récupération des infos utilisateur
        const { id: decodedId, role } = jwtDecode(token);
        setUserId(decodedId);
        setUserRole(role);

        // 2. Chargement du document actuel
        const res = await axios.get(`http://localhost:5000/api/documents/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const doc = res.data;
        setDocInfo(doc);
        setIsCompleted(doc.is_completed);

        // 3. Trouver la dernière version complétée (en excluant le document actuel)
        const lastCompleted = await getLastCompletedVersion(doc.name, id);

        // 4. Vérification des permissions
        let canModify = false;
        if (role === 'admin') {
          canModify = true;
        } else {
          // Vérifier les permissions sur la dernière version complétée si elle existe
          const docIdToCheck = lastCompleted ? lastCompleted.id : id;
          try {
            const permRes = await axios.get(
              `http://localhost:5000/api/documents/${docIdToCheck}/my-permissions`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            canModify = permRes.data.can_modify;
          } catch (permErr) {
            console.error("Erreur vérification permissions:", permErr);
            canModify = false;
          }
        }
        setCanAddVersion(canModify);

        // 5. Initialisation des champs du formulaire
        setSummary(doc.summary || '');
        setTags((doc.tags || []).join(', '));
        setPriority(doc.priority || '');

        // Extraction nom et extension
        const parts = doc.name.split('.');
        if (parts.length > 1) {
          setExtension(parts.pop());
          setBaseName(parts.join('.'));
        } else {
          setBaseName(doc.name);
          setExtension('');
        }

        // 6. Initialisation des champs spécifiques
        const defaultFields = {
          facture: {
            numero_facture: '',
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
            setExtraFields({ ...defaultFields[doc.category], ...metaRes.data });
          } catch (metaErr) {
            setExtraFields(defaultFields[doc.category]);
          }
        }

      } catch (error) {
        console.error("Erreur initialisation:", error);
        setErrorMessage("Erreur lors du chargement du document.");
      }
    };

    initialize();

    return () => {
      // Cleanup si nécessaire
    };
  }, [id, token]);

  const validateDates = (dateDebut, dateFin) => {
    if (!dateDebut || !dateFin) return true; // La validation de champ vide est déjà gérée ailleurs
    return new Date(dateFin) >= new Date(dateDebut);
  };

  const validateCategoryFields = (category, values) => {
    switch (category) {
      case 'facture':
        return values.numero_facture && values.nom_entreprise && values.montant && values.date_facture;
      case 'cv':
        return values.num_cv && values.nom_candidat && values.metier && values.lieu;
      case 'demande_conge':
        return (
          values.num_demande &&
          values.date_debut &&
          values.date_fin &&
          values.motif &&
          validateDates(values.date_debut, values.date_fin)
        );
      case 'contrat':
        return values.numero_contrat && values.type_contrat && values.partie_prenante && values.date_signature;
      case 'rapport':
        return values.type_rapport && values.auteur && values.date_rapport;
      default:
        return true;
    }
  };

  const getLastCompletedVersion = async (docName, excludeId = null) => {
    try {
      const params = {
        name: docName,
        exclude_id: excludeId
      };

      const res = await axios.get(`http://localhost:5000/api/documents/last-completed`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data.document;
    } catch (error) {
      console.error("Error fetching last completed version:", error);
      return null;
    }
  };


  const checkForDuplicate = async (docName) => {
    if (!docName.trim()) return false;

    try {
      // 1. Vérifier si un document avec ce nom existe
      const res = await axios.get(`http://localhost:5000/api/documents/check-name`, {
        params: { name: docName, currentDocId: id },
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.exists) {
        // 2. Trouver la dernière version complétée (en excluant le document actuel)
        const lastCompleted = await getLastCompletedVersion(docName, id);

        if (lastCompleted) {
          setExistingDocument(lastCompleted);
        } else {
          setExistingDocument(res.data.document);
        }
        return true;
      }
      return false;
    } catch (error) {
      setErrorMessage("Erreur lors de la vérification du nom");
      return false;
    }
  };

  const shouldShowCommonFields = (category) => {
    return !['contrat', 'rapport', 'facture', 'demande_conge', 'cv'].includes(category);
  };

  const saveDocument = async () => {
    setIsSaving(true);
    try {
      const fullName = extension ? `${baseName}.${extension}` : baseName;
      const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);

      const payload = {
        name: fullName,
        is_completed: true,
        summary,
        tags: tagArray,
        priority,
        ...extraFields
      };

      await axios.put(`http://localhost:5000/api/documents/${id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
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

  const handleSaveAsVersion = async () => {
    setIsSaving(true);
    try {
      const fullName = extension ? `${baseName}.${extension}` : baseName;
      const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);

      const payload = {
        name: fullName,
        summary,
        tags: tagArray,
        priority,
        diff_version: differenceNote, // Note de version
        is_completed: true, // Marquer comme complet
        ...extraFields
      };

      // Utilisation de la route PUT au lieu de POST /versions
      await axios.put(`http://localhost:5000/api/documents/${id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccessMessage("Document enregistré comme nouvelle version avec succès !");
      setIsCompleted(true);
      setTimeout(() => navigate('/Documents'), 2000);
    } catch (error) {
      setErrorMessage(error.response?.data?.error || "Échec de l'enregistrement");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validation des champs obligatoires selon la catégorie
   if (!validateCategoryFields(category, extraFields)) {
    if (category === 'demande_conge' && 
        extraFields.date_debut && 
        extraFields.date_fin && 
        !validateDates(extraFields.date_debut, extraFields.date_fin)) {
      setErrorMessage("La date de fin doit être postérieure à la date de début");
    } else {
      setErrorMessage("Veuillez remplir tous les champs obligatoires");
    }
    return;
  }

    // Validation pour les nouvelles versions
    if (isNewVersion && !differenceNote.trim()) {
      setErrorMessage("Veuillez décrire les modifications pour la nouvelle version");
      return;
    }

    // Validation des champs communs
    const isCommonFieldsValid = shouldShowCommonFields(category)
      ? baseName.trim() && summary.trim() && tags.trim() && priority.trim()
      : baseName.trim();

    if (!isCommonFieldsValid) {
      setErrorMessage("Veuillez remplir tous les champs obligatoires");
      return;
    }

    // Validation des conflits de noms
    if (existingDocument && existingDocument.id !== docInfo?.id && !canAddVersion) {
      setErrorMessage("Un document avec ce nom existe déjà et vous n'avez pas les droits de modification");
      return;
    }

    try {
      setIsSaving(true);

      if (isNewVersion) {
        await handleSaveAsVersion();
      } else {
        await saveDocument();
      }
    } catch (error) {
      console.error("Erreur lors de l'enregistrement:", error);
      setErrorMessage(error.response?.data?.message || error.message || "Une erreur est survenue lors de l'enregistrement");
    } finally {
      setIsSaving(false);
    }
  };


  const isFormValid = () => {
    const isCommonFieldsValid = shouldShowCommonFields(category)
      ? baseName.trim() && summary.trim() && tags.trim() && priority.trim()
      : baseName.trim();

    const isCategoryValid = validateCategoryFields(category, extraFields);
    const hasNameConflict = existingDocument && existingDocument.id !== docInfo?.id && !canAddVersion;

    return isCommonFieldsValid && isCategoryValid && !hasNameConflict;
  };

  const renderDocumentViewer = () => {
    if (!docInfo?.file_path) return null;

    const fileExtension = docInfo.file_path.split('.').pop().toLowerCase();
    const fullUrl = `http://localhost:5000${docInfo.file_path}`;

    if (['jpg', 'jpeg', 'png'].includes(fileExtension)) {
      return <img src={fullUrl} alt="document" className="w-100" />;
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
    } else {
      return <Alert variant="warning">Format non supporté pour l'aperçu.</Alert>;
    }
  };

  return (
    <>
      <Navbar />
      <Container fluid className="py-4" style={{ minHeight: '100vh' }}>
        {errorMessage && <Alert variant="danger" dismissible onClose={() => setErrorMessage(null)}>{errorMessage}</Alert>}
        {successMessage && <Alert variant="success" dismissible onClose={() => setSuccessMessage(null)}>{successMessage}</Alert>}

        <div className="row">
          <div className="col-md-8">
            <Card className="p-4 shadow-sm">
              <h3 className="mb-4">📝 Compléter les informations du document</h3>

              {existingDocument && existingDocument.id !== docInfo?.id && (
                <Alert variant={canAddVersion ? "warning" : "danger"} className="mb-3">
                  <strong>Un fichier avec ce nom existe déjà.</strong>
                  {canAddVersion ? (
                    <Form.Check
                      type="switch"
                      id="version-switch"
                      label="Ajouter comme nouvelle version (pour un nouveau fichier veuillez changez le nom)"
                      checked={isNewVersion}
                      onChange={() => setIsNewVersion(!isNewVersion)}
                      className="mt-2"
                    />
                  ) : (
                    <p className="mb-0 mt-2">Veuillez changer le nom svp.</p>
                  )}
                </Alert>
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
                          style={{ width: '100px', backgroundColor: '#e9ecef' }}
                        />
                      </>
                    )}
                  </div>
                </Form.Group>

                {category === 'facture' ? (
                  <>
                    <Form.Group className="mb-3">
                      <Form.Label>Numéro de facture</Form.Label>
                      <Form.Control
                        type="text"
                        value={extraFields.numero_facture || ''}
                        onChange={(e) => setExtraFields({ ...extraFields, numero_facture: e.target.value })}
                        required
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Date de facture</Form.Label>
                      <Form.Control
                        type="date"
                        value={extraFields.date_facture || ''}
                        onChange={(e) => setExtraFields({ ...extraFields, date_facture: e.target.value })}
                        required
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Montant</Form.Label>
                      <Form.Control
                        type="text"
                        value={extraFields.montant || ''}
                        onChange={(e) => setExtraFields({ ...extraFields, montant: e.target.value })}
                        required
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Nom entreprise</Form.Label>
                      <Form.Control
                        type="text"
                        value={extraFields.nom_entreprise || ''}
                        onChange={(e) => setExtraFields({ ...extraFields, nom_entreprise: e.target.value })}
                        required
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Produit</Form.Label>
                      <Form.Control
                        type="text"
                        value={extraFields.produit || ''}
                        onChange={(e) => setExtraFields({ ...extraFields, produit: e.target.value })}
                        required
                      />
                    </Form.Group>
                  </>
                ) : (
                  Object.entries(extraFields).map(([key, value]) => (
                    <Form.Group className="mb-3" key={key}>
                      <Form.Label>
                        {key.replace(/_/g, ' ').charAt(0).toUpperCase() + key.replace(/_/g, ' ').slice(1)}
                      </Form.Label>
                      <Form.Control
                        type={key.toLowerCase().includes('date') ? 'date' : 'text'}
                        value={value || ''}
                        onChange={(e) => setExtraFields(prev => ({ ...prev, [key]: e.target.value }))}
                        required
                      />
                    </Form.Group>
                  ))
                )}

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

                {isNewVersion && (
                  <Form.Group className="mb-3">
                    <Form.Label>Modifications apportées (obligatoire)</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={differenceNote}
                      onChange={(e) => setDifferenceNote(e.target.value)}
                      placeholder="Décrivez les changements par rapport à la version précédente"
                      required
                    />
                  </Form.Group>
                )}

                <div className="d-flex justify-content-between">

                  <Button
                    variant="success"
                    type="submit"
                    disabled={
                      !isFormValid() ||
                      isSaving ||
                      (isNewVersion && !differenceNote.trim())
                    }
                    className="ms-auto"
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
      </Container>
    </>
  );
};

export default DocumentCompletion;