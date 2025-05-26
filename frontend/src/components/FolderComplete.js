// routes : /folder/:id/complete
const FolderCompletion = () => {
  const { id } = useParams(); // id du dossier
  const [folderInfo, setFolderInfo] = useState(null);
  const [name, setName] = useState('');
  const [summary, setSummary] = useState('');
  const [tags, setTags] = useState('');
  const [priority, setPriority] = useState('');
  const [files, setFiles] = useState([]);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchFolder = async () => {
      const res = await axios.get(`http://localhost:5000/api/folders/${id}`);
      setFolderInfo(res.data);
      setName(res.data.name);
      setSummary(res.data.summary || '');
      setTags((res.data.tags || []).join(', '));
      setPriority(res.data.priority || '');
      setFiles(res.data.files || []);
    };
    fetchFolder();
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const tagArray = tags.split(',').map(t => t.trim());
    await axios.put(`http://localhost:5000/api/folders/${id}`, {
      name,
      summary,
      tags: tagArray,
      priority
    });
    setSuccess(true);
    setTimeout(() => navigate('/Documents'), 1500);
  };

  return (
    <Container className="py-4">
      <h3>📁 Compléter les infos du dossier</h3>
      <Form onSubmit={handleSubmit}>
        <Form.Group className="mb-3">
          <Form.Label>Nom du dossier</Form.Label>
          <Form.Control value={name} onChange={e => setName(e.target.value)} required />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label>Description</Form.Label>
          <Form.Control as="textarea" value={summary} onChange={e => setSummary(e.target.value)} />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label>Tags</Form.Label>
          <Form.Control value={tags} onChange={e => setTags(e.target.value)} />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label>Priorité</Form.Label>
          <Form.Select value={priority} onChange={e => setPriority(e.target.value)}>
            <option value="">-- Choisir --</option>
            <option value="basse">Basse</option>
            <option value="moyenne">Moyenne</option>
            <option value="haute">Haute</option>
          </Form.Select>
        </Form.Group>

        <h5>🗂️ Fichiers importés :</h5>
        <ul>
          {files.map((f, idx) => <li key={idx}>{f.name}</li>)}
        </ul>

        <div className="d-flex justify-content-end">
          <Button type="submit">Enregistrer le dossier</Button>
        </div>
      </Form>
      {success && <Alert variant="success" className="mt-3">✅ Dossier enregistré !</Alert>}
    </Container>
  );
};
