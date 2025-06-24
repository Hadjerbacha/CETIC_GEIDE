import React, { useEffect, useState } from "react";
import axios from "axios";
import Navbar from './Navbar';
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import "bootstrap/dist/css/bootstrap.min.css";
import './Dashboard.css';
import { faPhotoFilm } from '@fortawesome/free-solid-svg-icons'; // nouvelle icône

import { 
  FontAwesomeIcon
} from '@fortawesome/react-fontawesome';
import { 
  faFileAlt, 
  faTasks, 
  faBell, 
  faClock, 
  faChevronRight,
  faCheckCircle,
  faExclamationTriangle,
  faCalendarAlt,
  faUsers,
  faPlus,
  faFolder,
  faFileContract,
  faChartBar,
  faFileInvoice,
  faUserTie,
  faGlobe,
  faListCheck,
  faDiagramProject,
  faUserGroup,
  faUserShield,
} from '@fortawesome/free-solid-svg-icons';
import { Chart, registerables } from 'chart.js';
import { Bar, Pie, Doughnut } from 'react-chartjs-2';

// Enregistrement des composants Chart.js
Chart.register(...registerables);

function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    console.error("Erreur de parsing du token :", e);
    return null;
  }
}

const Accueil = () => {
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [stats, setStats] = useState({
    documents: 0,
    users: 0,
    workflows: 0,
    tasks: 0
  });
  const [categories, setCategories] = useState([]);
  const [userId, setUserId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  // Dans le useEffect qui récupère userId
useEffect(() => {
  if (token) {
    try {
      const decoded = jwtDecode(token);
      setUserId(decoded.id);
      // Pré-remplir les infos utilisateur basiques
      setCurrentUser({
        name: decoded.name,
        prenom: decoded.prenom
      });
    } catch (err) {
      console.error("Erreur de décodage du token:", err);
    }
  }
}, [token]);

// Récupérer les données seulement quand userId est disponible
useEffect(() => {
  if (!token || !userId) return; // Ne pas exécuter si userId est null

  const config = { headers: { Authorization: `Bearer ${token}` } };

  const fetchData = async () => {
    try {
      const [statsRes, tasksRes, catsRes] = await Promise.all([
        axios.get("http://localhost:5000/api/stats/global", config),
        axios.get("http://localhost:5000/api/tasks/mes-taches", config),
        axios.get("http://localhost:5000/api/documents", config)
        // Retirez la requête pour les infos utilisateur si elle n'est pas essentielle
      ]);

      setStats({
        documents: statsRes.data.totalDocuments,
        users: statsRes.data.totalUsers,
        workflows: statsRes.data.totalWorkflows,
        tasks: statsRes.data.totalTasks
      });

      // Filtrage des tâches
      const assignedTasks = tasksRes.data
        .filter(task => task.assigned_to?.includes(userId) && task.status !== 'blocked' && task.status !== 'completed')
        .slice(0, 5);

      setAssignedTasks(assignedTasks);
      setCategories(catsRes.data);
      
      // Utilisez les infos du token si vous n'avez pas besoin de plus de détails
      const decoded = jwtDecode(token);
      setCurrentUser({
        name: decoded.name,
        prenom: decoded.prenom
      });

    } catch (err) {
      console.error("Erreur lors du chargement des données:", err);
    } finally {
      setLoading(false);
    }
  };

  fetchData();
}, [token, userId]); // Dépend de userId

   const quickLinks = [
    { name: "Tous les documents", icon: faFileInvoice, path: "/documents" },
    { name: "Media", icon: faPhotoFilm, path: "/media" },
    { name: "folders", icon: faFolder, path: "/folder" },
    { name: "Statistiques", icon: faChartBar, path: "/Statistique" }
  ];

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="dashboard-loading">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Chargement...</span>
          </div>
          <p>Chargement du tableau de bord...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="dashboard-container">
        {/* En-tête avec image */}
        <div className="dashboard-header">
          <div className="header-content">
            <h1>Gestion électronique des documents</h1>
            <p className="welcome-message">
              Optimisez votre gestion documentaire avec notre solution complète et sécurisée.
              Accédez, partagez et traitez vos documents en toute simplicité.
            </p>
          </div>
          <div className="header-image">
            <img src="/accu.png" alt="Dashboard Illustration" />
          </div>
        </div>

        {/* Contenu principal */}
        <div className="dashboard-content">
          {/* Deux colonnes principales */}
          <div className="main-content">
            {/* Colonne gauche - Tâches assignées */}
            <div className="left-column">
              <div className="dashboard-card">
                <div className="card-header">
                  <h3>
                    <FontAwesomeIcon icon={faTasks} className="mr-2" />
                    Mes Tâches Assignées
                  </h3>
                  <button 
                    className="btn btn-link"
                    onClick={() => navigate("/mes-taches")}
                  >
                    Voir tout <FontAwesomeIcon icon={faChevronRight} />
                  </button>
                </div>
                <div className="card-body">
                  {assignedTasks.length > 0 ? (
                    <ul className="task-list">
                      {assignedTasks.map((task, index) => (
                        <li key={index} className="task-item" onClick={() => navigate(`/tasks/${task.id}`)}>
                          <div className="task-icon">
                            <FontAwesomeIcon 
                              icon={task.status === 'completed' ? faCheckCircle : faExclamationTriangle} 
                              className={task.status === 'completed' ? 'completed' : 'pending'} 
                            />
                          </div>
                          <div className="task-info">
                            <h4>{task.title}</h4>
                            <p className="text-muted">
                              <FontAwesomeIcon icon={faCalendarAlt} className="mr-1" />
                              {new Date(task.due_date).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="task-meta">
                            <span className={`task-status ${task.status}`}>
                              {task.status === 'completed' ? 'Terminée' : 'En cours'}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="empty-state">
                      <p>Aucune tâche assignée</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Colonne droite - Accès rapide (reste identique) */}
            <div className="right-column">
              <div className="dashboard-card">
                <div className="card-header">
                  <h3>Accès Rapide</h3>
                </div>
                <div className="card-body">
                  <div className="quick-links">
                    {quickLinks.map((link, index) => (
                      <button
                        key={index}
                        className="quick-link-btn"
                        onClick={() => navigate(link.path)}
                      >
                        <div className="link-icon">
                          <FontAwesomeIcon icon={link.icon} />
                        </div>
                        <span>{link.name}</span>
                        <FontAwesomeIcon icon={faChevronRight} className="chevron" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Accueil;