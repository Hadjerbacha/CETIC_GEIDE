import React, { useEffect, useState } from "react";
import axios from "axios";
import Navbar from './Navbar';
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import "bootstrap/dist/css/bootstrap.min.css";
import './Dashboard.css';
import docImage from './img/doc.jpg';
import workflowImage from './img/workflow.png';
import notifImage from './img/notif.jpg';
import todoImage from './img/todo.jpg';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers } from '@fortawesome/free-solid-svg-icons';
import { 
  faFileAlt, 
  faTasks, 
  faBell, 
  faClock, 
  faChevronRight,
  faCheckCircle,
  faExclamationTriangle,
  faCalendarAlt
} from '@fortawesome/free-solid-svg-icons';
import { Chart, registerables } from 'chart.js';

// Enregistrement des composants Chart.js
Chart.register(...registerables);

const Accueil = () => {
  const [recentDocuments, setRecentDocuments] = useState([]);
  const [lateWorkflows, setLateWorkflows] = useState([]);
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [userId, setUserId] = useState(null);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isChartLoading, setIsChartLoading] = useState(true);
  const [allTasks, setAllTasks] = useState([]);
  const [stats, setStats] = useState({
    documents: 0,
    workflows: 0,
    tasks: 0
  });
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  // Décoder le token pour récupérer userId
  useEffect(() => {
    if (token) {
      const decoded = jwtDecode(token);
      setUserId(decoded.id);
    }
  }, [token]);

  // Récupérer la liste des utilisateurs
  useEffect(() => {
    fetch('http://localhost:5000/api/auth/users')
      .then(res => res.json())
      .then(data => setUsers(data))
      .catch(err => console.error('Erreur utilisateurs :', err));
  }, []);

  // Déterminer l'utilisateur actuel
  useEffect(() => {
    if (userId && users.length > 0) {
      const found = users.find(u => u.id === userId);
      if (found) setCurrentUser(found);
    }
  }, [userId, users]);

  useEffect(() => {
    if (!token || !currentUser) return;

    const config = { headers: { Authorization: `Bearer ${token}` } };

    // Récupérer les statistiques
    // Dans le useEffect où vous récupérez les stats, changez :
// Dans le useEffect où vous récupérez les stats :
axios.get("http://localhost:5000/api/documents/stats", config)
  .then(res => {
    if (currentUser?.role === 'admin') {
      setStats({
        documents: res.data.totalDocuments,
        workflows: res.data.totalWorkflows,
        tasks: res.data.totalTasks,
        users: res.data.totalUsers
      });
    } else {
      setStats({
        documents: res.data.userDocuments,
        workflows: res.data.userWorkflows,
        tasks: res.data.userTasks
      });
    }
  })
  .catch(err => console.error("Erreur stats :", err));

    // Récupérer les documents récents
    // Pour les documents récents :
axios.get(`http://localhost:5000/api/documents/${currentUser.role === 'admin' ? '' : 'mes-documents'}`, config)
  .then(res => setRecentDocuments(res.data.slice(0, 5)))
  .catch(err => console.error("Erreur documents :", err));

// Pour les workflows :
axios.get(`http://localhost:5000/api/workflows/${currentUser.role === 'admin' ? '' : 'mes-workflows'}`, config)
  .then(res => {
    const data = currentUser.role === 'admin' ? 
      res.data : 
      res.data.filter(workflow => workflow.created_by === currentUser.id);
    setLateWorkflows(data.slice(0, 5));
  })
  .catch(err => console.error("Erreur workflows :", err));

    // Récupérer les tâches assignées
  axios.get("http://localhost:5000/api/tasks/mes-taches", config)
    .then(res => {
      const tasks = res.data.filter(task => {
        const ids = Array.isArray(task.assigned_to) 
          ? task.assigned_to 
          : (task.assigned_to?.replace(/[{}]/g, '').split(',').map(Number) || []);
        return ids.includes(currentUser.id);
      });
      
      setAllTasks(tasks); // Pour le graphique
      
      // Filtre pour les tâches non terminées (affichage liste)
      const pendingTasks = tasks.filter(task => task.status !== "completed");
      setAssignedTasks(pendingTasks.slice(0, 5));
    });
    // Récupérer les notifications
    axios.get(`http://localhost:5000/api/notifications/${currentUser.id}`, config)
  .then(res => {
    const formattedNotifications = res.data.slice(0, 5).map(notification => ({
      ...notification,
      message: notification.message,
    }));
    setNotifications(formattedNotifications);
  })
      .catch(err => console.error("Erreur notifications :", err));

  }, [currentUser, token]);


useEffect(() => {
  if (allTasks.length > 0) {
    initTaskChart();
  }
}, [allTasks]); // Déclenché quand allTasks change

const initEmptyChart = () => {
  const ctx = document.getElementById('taskChart');
  if (!ctx) return;
  
  if (ctx.chart) ctx.chart.destroy();

  ctx.chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Aucune donnée'],
      datasets: [{
        data: [1],
        backgroundColor: ['#f8f9fa'],
      }]
    },
    options: chartOptions
  });
};

const initTaskChart = () => {
  const ctx = document.getElementById('taskChart');
  if (!ctx) return;

  if (ctx.chart) {
    ctx.chart.destroy();
  }

  // Statuts avec couleurs
  const statusConfig = {
    'pending': { label: 'En attente', color: '#f6c23e' },
    'in_progress': { label: 'En cours', color: '#36b9cc' },
    'completed': { label: 'Terminé', color: '#1cc88a' },
    'overdue': { label: 'En retard', color: '#e74a3b' }
  };

  // Comptage
  const statusCounts = allTasks.reduce((acc, task) => {
    const statusKey = task.status.toLowerCase();
    const status = statusConfig[statusKey] || { label: statusKey, color: '#4e73df' };
    acc[status.label] = (acc[status.label] || 0) + 1;
    return acc;
  }, {});

  // Préparation données
  const chartData = {
    labels: Object.keys(statusCounts),
    datasets: [{
      data: Object.values(statusCounts),
      backgroundColor: Object.keys(statusCounts).map(label => 
        Object.values(statusConfig).find(s => s.label === label)?.color || '#4e73df'
      ),
    }],
  };

  // Création graphique
  ctx.chart = new Chart(ctx, {
    type: 'doughnut',
    data: chartData,
    options: chartOptions
  });
};

const chartOptions = {
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        padding: 20,
        font: {
          size: 12
        }
      }
    },
    tooltip: {
      callbacks: {
        label: function(context) {
          const label = context.label || '';
          const value = context.raw || 0;
          const total = context.dataset.data.reduce((a, b) => a + b, 0);
          const percentage = Math.round((value / total) * 100);
          return `${label}: ${value} (${percentage}%)`;
        }
      }
    }
  },
  cutout: '70%',
};

  return (
    <>
      <Navbar />
      <div className="container-fluid mt-4">

        {/* Cartes de statistiques */}
        <div className="row mb-3">
          <StatCard 
            title="Documents" 
            value={stats.documents} 
            icon={faFileAlt} 
            color="primary" 
            onClick={() => navigate("/documents")}
          />
          <StatCard 
            title="Workflows" 
            value={stats.workflows} 
            icon={faTasks} 
            color="success" 
            onClick={() => navigate("/workflow")}
          />
          <StatCard 
            title="Tâches" 
            value={stats.tasks} 
            icon={faCheckCircle} 
            color="info" 
            onClick={() => navigate("/mes-taches")}
          />
  {currentUser?.role === 'admin' && (
    <StatCard 
      title="Utilisateurs" 
      value={stats.users || 0} 
      icon={faUsers} 
      color="warning" 
      onClick={() => navigate("/users")}
    />
  )}
</div>
        {/* Graphique et cartes principales */}
        <div className="row">
          {/* Graphique */}
          <div className="col-xl-4 col-lg-5">
            <div className="card shadow mb-4">
              <div className="card-header py-3 d-flex flex-row align-items-center justify-content-between">
                <h6 className="m-0 font-weight-bold text-primary">Répartition des tâches</h6>
              </div>
              <div className="card-body">
   <div className="chart-pie pt-4 pb-2">
          <canvas id="taskChart" style={{ height: '250px' }}></canvas>
        </div>
</div>
            </div>
             
          </div>
          {/* Cartes principales */}
          <div className="col-xl-8 col-lg-7">
            <div className="row">
              <EnhancedCard
                title="Documents Récents"
                items={recentDocuments}
                onClick={() => navigate("/documents")}
                type="doc"
                icon={faFileAlt}
                color="#4e73df"
                emptyMessage="Aucun document récent"
              />

              <EnhancedCard
                title="Tâches Assignées"
                items={assignedTasks}
                onClick={() => navigate("/mes-taches")}
                type="task"
                icon={faTasks}
                color="#1cc88a"
                emptyMessage="Aucune tâche assignée"
              />
            </div>
          </div>
        </div>

        {/* Deuxième ligne de cartes */}
        <div className="row mt-4">
          <EnhancedCard
            title="Workflows en Retard"
            items={lateWorkflows}
            onClick={() => navigate("/workflow")}
            type="workflow"
            icon={faClock}
            color="#e74a3b"
            emptyMessage="Aucun workflow en retard"
            isUrgent={true}
          />

          <EnhancedCard
  title="Notifications"
  items={notifications}
  onClick={() => navigate("/notif")}
  type="notification"  // Ce prop active l'affichage spécifique
  icon={faBell}
  color="#f6c23e"
  emptyMessage="Aucune notification"
/>
        </div>
      </div>
    </>
  );
};

// Composant de carte de statistiques
const StatCard = ({ title, value, icon, color, onClick }) => (
  <div className="col-xl-3 col-md-6 mb-4" onClick={onClick} style={{ cursor: 'pointer' }}>
    <div className={`card border-left-${color} shadow h-100 py-2`}>
      <div className="card-body">
        <div className="row no-gutters align-items-center">
          <div className="col mr-2">
            <div className={`text-xs font-weight-bold text-${color} text-uppercase mb-1`}>
              {title}
            </div>
            <div className="h5 mb-0 font-weight-bold text-gray-800">{value}</div>
          </div>
          <div className="col-auto">
            <FontAwesomeIcon icon={icon} className={`fa-2x text-gray-300`} />
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Composant Card amélioré
const EnhancedCard = ({ title, items, onClick, type, icon, color, emptyMessage, isUrgent }) => (
  <div className="col-md-6 mb-4">
    <div className="card shadow h-100">
      <div 
        className="card-header py-3 d-flex flex-row align-items-center justify-content-between"
        style={{ borderLeft: `4px solid ${color}` }}
      >
        <h6 className="m-0 font-weight-bold" style={{ color }}>
          <FontAwesomeIcon icon={icon} className="mr-2" />
          {title}
        </h6>
        <button 
          className="btn btn-sm btn-link" 
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          style={{ color }}
        >
          Voir tout <FontAwesomeIcon icon={faChevronRight} />
        </button>
      </div>
      <div className="card-body">
        {items?.length > 0 ? (
          <ul className="list-group list-group-flush">
            {items.map(item => (
              <li 
                key={item.id} 
                className="list-group-item d-flex justify-content-between align-items-center px-0 py-2"
              >
                <div>
                  {/* Affichage spécifique pour les notifications */}
                  {type === 'notification' ? (
                    <>
                      <strong>{item.message}</strong>
                      {item.created_at && (
                        <div className="text-muted small mt-1">
                          <FontAwesomeIcon icon={faCalendarAlt} className="mr-1" />
                          {new Date(item.created_at).toLocaleDateString()}
                        </div>
                      )}
                    </>
                  ) : (
                    /* Affichage standard pour les autres types */
                    <>
                      <strong>{item.name || item.title || item.message?.substring(0, 30)}</strong>
                      {item.due_date && (
                        <div className="text-muted small mt-1">
                          <FontAwesomeIcon icon={faCalendarAlt} className="mr-1" />
                          {new Date(item.due_date).toLocaleDateString()}
                          {new Date(item.due_date) < new Date() && (
                            <span className="badge badge-danger ml-2">
                              <FontAwesomeIcon icon={faExclamationTriangle} /> En retard
                            </span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
                {isUrgent && (
                  <span className="badge badge-danger">
                    <FontAwesomeIcon icon={faExclamationTriangle} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-3 text-muted">
            {emptyMessage}
          </div>
        )}
      </div>
    </div>
  </div>
);

export default Accueil;