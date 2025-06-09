import React, { useEffect, useState } from 'react';
import { 
  Table, Card, Button, Badge, Form, Modal, Spinner, 
  Pagination, Dropdown, Accordion, Tab, Tabs 
} from 'react-bootstrap';
import axios from 'axios';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'react-toastify';
import { FiDownload, FiSearch, FiFilter, FiPrinter, FiFileText } from 'react-icons/fi';
import Navbar from './Navbar';
import { jsPDF } from 'jspdf';

const ArchivePage = () => {
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArchive, setSelectedArchive] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: 'completed_at', direction: 'desc' });
  const [filters, setFilters] = useState({
    dateRange: null,
    reportType: 'all'
  });

  // Fetch archives with filters
  const fetchArchives = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        search: searchTerm,
        sort: `${sortConfig.key},${sortConfig.direction}`,
        ...filters,
        include: 'tasks,document'
      };
  
      const res = await axios.get('http://localhost:5000/api/workflows/archives', {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
  
      setArchives(res.data);
    } catch (err) {
      handleFetchError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchError = (err) => {
    console.error('Erreur:', err);
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    } else {
      toast.error(err.response?.data?.message || 'Erreur lors du chargement des archives');
    }
  };

  useEffect(() => {
    fetchArchives();
  }, [currentPage, searchTerm, sortConfig, filters]);

  // Sort data
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Download report
  const downloadReport = async (archive, fileFormat = 'pdf') => {
    try {
      if (fileFormat === 'pdf') {
        await generateAndDownloadPdf(archive);
      } else {
        downloadTextReport(archive);
      }
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Erreur lors de la génération du rapport');
    }
  };

  // Download text report
  const downloadTextReport = (archive) => {
    const content = archive.validation_report || 'Aucun rapport disponible';
    const element = document.createElement('a');
    const file = new Blob([content], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `rapport_${archive.document_id}_${format(parseISO(archive.completed_at), 'yyyy-MM-dd')}.txt`;
    document.body.appendChild(element);
    element.click();
    setTimeout(() => {
      URL.revokeObjectURL(element.href);
      document.body.removeChild(element);
    }, 100);
  };

  // Generate and download PDF report
  const generateAndDownloadPdf = async (archive) => {
    const doc = new jsPDF();
    const marginLeft = 14;
    let yPosition = 20;
  
    // Configuration générale
    doc.setFont('Times', 'normal');
    doc.setFontSize(18);
    doc.text('RAPPORT DE VALIDATION', 105, yPosition, { align: 'center' });
  
    yPosition += 10;
    doc.setFontSize(12);
    if (archive.automated) {
      doc.setTextColor(100);
      doc.text('⚙️  Ce workflow a été complété automatiquement.', 105, yPosition, { align: 'center' });
      doc.setTextColor(0, 0, 0);
      yPosition += 10;
    }
  
    // ✳️ Introduction
    const intro = `
  Le document intitulé "${archive.document?.name || 'Non spécifié'}" a été validé via le workflow "${archive.name}".
  Ce processus, destiné à assurer la conformité et la traçabilité des actions réalisées, a été mené à son terme avec succès le ${format(parseISO(archive.completed_at), 'PPPP', { locale: fr })}.
  Le présent rapport fournit une vue complète sur le document, son cheminement, et les actions effectuées.`;
  
    const splitIntro = doc.splitTextToSize(intro, 180);
    doc.setFontSize(12);
    doc.text(splitIntro, marginLeft, yPosition);
    yPosition += splitIntro.length * 7;
  
    // 📌 Section 1 - Informations Générales
    yPosition += 5;
    doc.setFontSize(14);
    doc.text('1. Informations Générales', marginLeft, yPosition);
    doc.setFontSize(12);
    yPosition += 8;
  
    const formatDate = (dateStr) => format(parseISO(dateStr), 'PPpp', { locale: fr });
  
    const infoLines = [
      `🔹 Workflow : ${archive.name || 'Non spécifié'}`,
      `🔹 ID Document : DOC-${archive.document_id}`,
      `🔹 Statut : ${archive.status}`,
      `🔹 Date de création : ${formatDate(archive.workflow_created_at)}`,
      `🔹 Date d'achèvement : ${formatDate(archive.completed_at)}`,
      `🔹 Durée totale : ${archive.stats?.workflow_duration || 'N/A'} jours`
    ];
    infoLines.forEach(line => {
      doc.text(line, marginLeft, yPosition);
      yPosition += 7;
    });
  
    // 📄 Section 2 - Détails du Document
    yPosition += 5;
    doc.setFontSize(14);
    doc.text('2. Détails du Document', marginLeft, yPosition);
    doc.setFontSize(12);
    yPosition += 8;
  
    const docDetails = [
      `Nom : ${archive.document?.name || 'Non spécifié'}`,
      `Type : ${archive.document?.category || 'Non spécifié'}`,
      `Description : ${archive.document?.description || 'Non spécifié'}`,
      `Priorité : ${archive.document?.priority || 'Non spécifié'}`,
      `Tags : ${archive.document?.tags?.join(', ') || 'Aucun'}`
    ];
    docDetails.forEach(line => {
      doc.text(line, marginLeft, yPosition);
      yPosition += 7;
    });
  
    // ✅ Section 3 - Parcours des Tâches
    yPosition += 5;
    doc.setFontSize(14);
    doc.text('3. Parcours des Tâches', marginLeft, yPosition);
    doc.setFontSize(12);
    yPosition += 8;
  
    if (archive.tasks && archive.tasks.length > 0) {
      archive.tasks.forEach((task, index) => {
        if (yPosition > 250) {
          doc.addPage();
          yPosition = 20;
        }
  
        doc.text(`🔸 Tâche ${index + 1} : ${task.title}`, marginLeft, yPosition);
        yPosition += 7;
        const taskLines = [
          `- Statut : ${task.status}`,
          `- Priorité : ${task.priority}`,
          `- Assigné à : ${task.assigned_usernames || task.assigned_to?.join(', ') || 'Non assigné'}`,
          `- Date de création : ${formatDate(task.created_at)}`,
          `- Échéance : ${task.due_date ? formatDate(task.due_date) : 'Non spécifiée'}`,
          `- Description : ${task.description || 'Aucune description'}`,
          `- Note d'assignation : ${task.assignment_note || 'Aucune note'}`,
          task.file_path ? `- Fichier joint : ${task.file_path}` : null
        ];
        taskLines.filter(Boolean).forEach(line => {
          doc.text(line, marginLeft + 6, yPosition);
          yPosition += 6;
        });
  
        yPosition += 4;
      });
    } else {
      doc.text('Aucune tâche enregistrée pour ce workflow.', marginLeft, yPosition);
      yPosition += 12;
    }
  
    // 📌 Section 4 - Conclusion
    yPosition += 5;
    doc.setFontSize(14);
    doc.text('4. Conclusion', marginLeft, yPosition);
    yPosition += 8;
    doc.setFontSize(12);
  
    const conclusion = `
  Le présent document atteste de la validation officielle du workflow mentionné, selon les critères établis. Il peut être utilisé comme preuve en cas d’audit ou de contrôle de conformité interne.`;
  
    const splitConclusion = doc.splitTextToSize(conclusion, 180);
    doc.text(splitConclusion, marginLeft, yPosition);
  
    // 💾 Sauvegarde
    doc.save(`rapport_${archive.document_id}_${format(parseISO(archive.completed_at), 'yyyy-MM-dd')}.pdf`);
  };
  // Export all to CSV
  const exportAllToCSV = () => {
    const headers = ['ID', 'Document', 'Workflow', 'Date achèvement', 'Statut'];
    const csvContent = [
      headers.join(','),
      ...archives.map(a => [
        a.id,
        `DOC-${a.document_id}`,
        `"${a.name}"`,
        format(parseISO(a.completed_at), 'yyyy-MM-dd'),
        a.status
      ].join(','))
    ].join('\n');

    const element = document.createElement('a');
    const file = new Blob([csvContent], {type: 'text/csv'});
    element.href = URL.createObjectURL(file);
    element.download = `archives_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(element);
    element.click();
  };

  // Restore archive
  const restoreArchive = async (archiveId) => {
    if (window.confirm('Voulez-vous vraiment restaurer ce workflow?')) {
      try {
        await axios.post(`/api/workflows/archives/${archiveId}/restore`, {}, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        toast.success('Workflow restauré avec succès');
        fetchArchives();
      } catch (err) {
        handleFetchError(err);
      }
    }
  };

  return (
    <><Navbar />
    <div className="container-fluid py-4">
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center flex-wrap">
          <div className="d-flex align-items-center mb-2 mb-md-0">
            <h4 className="mb-0 me-3">Archives des Workflows</h4>
          </div>
          
          <div className="d-flex flex-wrap gap-2">
            <div className="position-relative">
              <FiSearch className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted" />
              <Form.Control
                type="search"
                placeholder="Rechercher..."
                style={{ width: '250px', paddingLeft: '2.5rem' }}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <Dropdown>
              <Dropdown.Toggle variant="outline-secondary">
                <FiFilter className="me-1" /> Filtres
              </Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.ItemText>Filtrer par :</Dropdown.ItemText>
                <Form.Group className="px-3 py-2">
                  <Form.Label>Date</Form.Label>
                  <Form.Control 
                    type="date" 
                    onChange={(e) => setFilters({...filters, dateRange: e.target.value})}
                  />
                </Form.Group>
                <Form.Group className="px-3 py-2">
                  <Form.Label>Type de rapport</Form.Label>
                  <Form.Select 
                    onChange={(e) => setFilters({...filters, reportType: e.target.value})}
                  >
                    <option value="all">Tous</option>
                    <option value="with_report">Avec rapport</option>
                    <option value="without_report">Sans rapport</option>
                  </Form.Select>
                </Form.Group>
              </Dropdown.Menu>
            </Dropdown>
            
            <Dropdown>
              <Dropdown.Toggle variant="outline-primary">
                <FiDownload className="me-1" /> Exporter
              </Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.Item onClick={exportAllToCSV}>CSV complet</Dropdown.Item>
                <Dropdown.Item onClick={() => exportAllToCSV()}>PDF sélection</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>
        </Card.Header>
        
        <Card.Body>
          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2">Chargement des archives...</p>
            </div>
          ) : archives.length === 0 ? (
            <div className="text-center py-5">
              <FiFileText size={48} className="text-muted mb-3" />
              <h5>Aucune archive trouvée</h5>
              <p className="text-muted">Aucun workflow n'a été archivé pour le moment</p>
            </div>
          ) : (
            <>
              <div className="table-responsive" style={{ overflow: 'visible', position: 'relative' }}>

                <Table striped hover>
                  <thead>
                    <tr>
                      <th onClick={() => requestSort('document_id')} className="cursor-pointer">
                        Document {sortConfig.key === 'document_id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => requestSort('name')} className="cursor-pointer">
                        Workflow {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => requestSort('completed_at')} className="cursor-pointer">
                        Date {sortConfig.key === 'completed_at' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archives.map(archive => (
                      <tr key={archive.id}>
                        <td>DOC-{archive.document_id}</td>
                        <td>{archive.name}</td>
                        <td>{format(parseISO(archive.completed_at), 'PP', { locale: fr })}</td>
                        <td>
                          <div className="d-flex gap-2 align-items-center flex-wrap">
                            <Button variant="outline-primary" size="sm" onClick={() => {
                              setSelectedArchive(archive);
                              setShowModal(true);
                            }} style={{ 
                              zIndex: 9999, 
                              position: 'absolute', 
                              right: 135
                            }}>
                              Détails
                            </Button>
                            <Dropdown  style={{ 
    zIndex: 9999, 
    position: 'absolute', 
    right: 70
  }}
      >
                              <Dropdown.Toggle variant="outline-secondary" size="sm" id="dropdown-actions" >
                                Plus
                              </Dropdown.Toggle>
                              <Dropdown.Menu>
                                <Dropdown.Item onClick={() => downloadReport(archive, 'txt')}>
                                  <FiDownload className="me-2" /> Télécharger (TXT)
                                </Dropdown.Item>
                                <Dropdown.Item onClick={() => downloadReport(archive, 'pdf')}>
                                  <FiDownload className="me-2" /> Télécharger (PDF)
                                </Dropdown.Item>
                                <Dropdown.Divider />
                                <Dropdown.Item onClick={() => restoreArchive(archive.id)}>
                                  Restaurer
                                </Dropdown.Item>
                              </Dropdown.Menu>
                            </Dropdown>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              <br/>
              <div className="d-flex justify-content-between align-items-center mt-3">
                <div className="text-muted">
                  Affichage de {Math.min(archives.length, itemsPerPage)} sur {archives.length} archives
                </div>
                <Pagination>
                  <Pagination.Prev 
                    disabled={currentPage === 1} 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                  />
                  {[...Array(Math.ceil(archives.length / itemsPerPage)).keys()].map(num => (
                    <Pagination.Item
                      key={num + 1}
                      active={num + 1 === currentPage}
                      onClick={() => setCurrentPage(num + 1)}
                    >
                      {num + 1}
                    </Pagination.Item>
                  ))}
                  <Pagination.Next 
                    disabled={currentPage === Math.ceil(archives.length / itemsPerPage)} 
                    onClick={() => setCurrentPage(p => p + 1)} 
                  />
                </Pagination>
              </div>
            </>
          )}
        </Card.Body>
      </Card>

      {/* Modal de détails */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered style={{ zIndex: 1050, width: '100%' }}
      >
        <Modal.Header closeButton>
          <Modal.Title>Détails de l'archive</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedArchive && (
            <Tabs defaultActiveKey="report" className="mb-3">
              <Tab eventKey="report" title="Rapport">
                <div className="mt-3">
                  <h5>{selectedArchive.name}</h5>
                  <div className="row mt-3">
                    <div className="col-md-6">
                      <p><strong>Document:</strong> DOC-{selectedArchive.document_id}</p>
                      <p><strong>Créé par:</strong> {selectedArchive.creator}</p>
                    </div>
                    <div className="col-md-6">
                      <p><strong>Date de création:</strong> {format(parseISO(selectedArchive.workflow_created_at), 'PPpp', { locale: fr })}</p>
                      <p><strong>Date d'achèvement:</strong> {format(parseISO(selectedArchive.completed_at), 'PPpp', { locale: fr })}</p>
                    </div>
                  </div>
                  
                  <Card className="mt-3">
                    <Card.Header className="d-flex justify-content-between align-items-center">
                      <span>Rapport de validation</span>
                      <Button 
                        variant="outline-primary" 
                        size="sm"
                        onClick={() => downloadReport(selectedArchive)}
                      >
                        <FiDownload className="me-1" /> Télécharger
                      </Button>
                    </Card.Header>
                  </Card>
                </div>
              </Tab>
            </Tabs>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Fermer
          </Button>
          <Button variant="primary" onClick={() => {
            downloadReport(selectedArchive);
            setShowModal(false);
          }}>
            <FiPrinter className="me-1" /> Imprimer
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
    </>
  );
};

export default ArchivePage;