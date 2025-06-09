import React, { useEffect, useState } from 'react';

const DocArchive = ({ token }) => {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchArchivedDocs = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/documents/archived', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Erreur lors du chargement');

        setDocs(data);
      } catch (err) {
        console.error('Erreur:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchArchivedDocs();
  }, [token]);

  if (loading) return <p>Chargement en cours...</p>;
  if (error) return <p style={{ color: 'red' }}>Erreur : {error}</p>;

  return (
    <div className="container mt-4">
      <h2>📁 Documents archivés</h2>
      {docs.length === 0 ? (
        <p>Aucun document archivé.</p>
      ) : (
        <ul className="list-group">
          {docs.map(doc => (
            <li key={doc.id} className="list-group-item d-flex justify-content-between align-items-center">
              <div>
                <strong>{doc.name}</strong> — version {doc.version}
                <br />
                <small>Archivé le : {new Date(doc.date).toLocaleDateString()}</small>
              </div>
              <a className="btn btn-outline-primary btn-sm" href={`/${doc.file_path}`} target="_blank" rel="noreferrer">
                📄 Consulter
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default DocArchive;
