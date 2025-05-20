import React, { useState, useEffect } from 'react';
import './FolderManagementPage.css';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { Link, useNavigate } from 'react-router-dom';
import Dropdown from 'react-bootstrap/Dropdown';
import * as FaIcons from 'react-icons/fa';
import * as AiIcons from 'react-icons/ai';
 

const FolderManagementPage = () => {
  const [folders, setFolders] = useState([]);
  const [folderName, setFolderName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  
  const navigate = useNavigate();
  useEffect(() => {
    // Charger les dossiers existants lors du chargement de la page
    axios.get('/api/folders')
      .then(response => {
        setFolders(response.data);
      })
      .catch(error => {
        setErrorMessage('Erreur lors du chargement des dossiers');
      });
  }, []);

  const handleFolderSubmit = async (e) => {
    e.preventDefault();

    if (!folderName) {
      setErrorMessage('Le nom du dossier ne peut pas être vide.');
      return;
    }

    setIsSaving(true);
    try {
      const response = await axios.post('/api/folders', { name: folderName });
      setFolders([...folders, response.data]);
      setFolderName('');
      setErrorMessage('');
    } catch (error) {
      setErrorMessage('Erreur lors de la création du dossier');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFolder = async (folderId) => {
    try {
      await axios.delete(`/api/folders/${folderId}`);
      setFolders(folders.filter(folder => folder.id !== folderId));
    } catch (error) {
      setErrorMessage('Erreur lors de la suppression du dossier');
    }
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  const filteredFolders = folders.filter(folder => 
    folder.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="folder-management-page">
      <div className="header">
        <h1>Folders</h1>
        <button 
      className="bg-green-600 text-black px-4 py-2 rounded hover:bg-green-700 transition"
      onClick={() => navigate('/Document')}
    >
      Voir les fichiers
    </button>

      </div>

      <div className="controls">
        <input
          type="text"
          placeholder="Rechercher un dossier..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
        />
        <form onSubmit={handleFolderSubmit}>
          <input
            type="text"
            placeholder="Nom du dossier"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
          />
          <button type="submit" disabled={isSaving}>
            {isSaving ? 'Création en cours...' : 'Créer un Dossier'}
          </button>
        </form>
        {errorMessage && <p className="error">{errorMessage}</p>}
      </div>

      <div className="folder-list">
        {filteredFolders.length > 0 ? (
          <ul>
            {filteredFolders.map(folder => (
              <li key={folder.id}>
                <span>{folder.name}</span>
                <button onClick={() => handleDeleteFolder(folder.id)} className="delete-btn">
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>Aucun dossier trouvé.</p>
        )}
      </div>
    </div>
  );
};

export default FolderManagementPage;
