import React, { useState } from 'react';

const Chat = () => {
  const [message, setMessage] = useState('');
  const [results, setResults] = useState([]);

  const handleSend = async () => {
    if (!message.trim()) return;
    try {
      const response = await fetch(`http://localhost:5000/search?q=${encodeURIComponent(message)}`);
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Erreur lors de la recherche', error);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '30px auto', fontFamily: 'sans-serif' }}>
      <h2>📁 Chatbot Recherche de Documents</h2>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <input
          type="text"
          value={message}
          placeholder="Ex: lettre, chère, rapport, etc."
          onChange={(e) => setMessage(e.target.value)}
          style={{ flex: 1, padding: '10px' }}
        />
        <button onClick={handleSend} style={{ padding: '10px 15px' }}>Rechercher</button>
      </div>
      {results.length > 0 ? (
        <ul>
          {results.map((doc) => (
            <li key={doc.id} style={{ marginBottom: '15px', background: '#f9f9f9', padding: '10px', borderRadius: '8px' }}>
              <strong>{doc.titre}</strong><br />
              <small>{doc.contenu.slice(0, 200)}...</small>
            </li>
          ))}
        </ul>
      ) : (
        <p>Aucun document trouvé pour : <i>{message}</i></p>
      )}
    </div>
  );
};

export default Chat;
