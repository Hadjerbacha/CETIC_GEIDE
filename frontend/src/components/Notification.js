import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, Button, ButtonGroup, Badge } from 'react-bootstrap';
import { jwtDecode } from 'jwt-decode';
import Navbar from './Navbar';
import '../style/Notif.css'; // Nous créerons ce fichier CSS

const NotificationsPage = () => {
  const [reminders, setReminders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("");
  const [userRole, setUserRole] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [activeTab, setActiveTab] = useState('notifications'); // Pour la navigation par onglets

  const handleDecision = async (id, decision, userId, senderId) => {
    try {
      await axios.put(`http://localhost:5000/api/documents/${id}/access`, {
        access: decision,
      });

      alert(`Accès ${decision ? 'approuvé' : 'refusé'} pour le document ${id}`);

      if (decision) {
        await axios.post('http://localhost:5000/api/notifications', {
          user_id: userId,
          sender_id: senderId,
          message: `Votre demande d'accés au document ${id} a été approuvée.`,
          type: 'info',
          document_id: id,
          decision : true ,
          is_read : true
        });
      }
    } catch (error) {
      console.error("Erreur lors de la mise à jour ou de l'envoi de la notification :", error);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const decoded = jwtDecode(token);
      setUserId(decoded.id);
      setUserRole(decoded.role);
    }
  }, []);

  useEffect(() => {
    if (userId) {
      fetchNotifications();
      fetchReminders();
    }
  }, [userId]);

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

  const fetchReminders = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/tasks', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const tasks = res.data;
      const today = new Date();

      const upcomingTasks = tasks
        .filter(task => {
          if (!task.due_date || !task.assigned_to) return false;
          const isAssignedToUser = task.assigned_to.includes(userId);
          if (!isAssignedToUser) return false;
          const dueDate = new Date(task.due_date);
          const diffDays = (dueDate - today) / (1000 * 60 * 60 * 24);
          return diffDays >= 0 && diffDays <= 10;
        })
        .map(task => ({
          id: task.id,
          title: task.title,
          message: `La tâche "${task.title}" est prévue pour le ${new Date(task.due_date).toLocaleDateString()}.`,
          deadline: task.due_date,
        }));

      setReminders(upcomingTasks);
    } catch (error) {
      console.error('Erreur lors de la récupération des rappels:', error);
    }
  };

  const markAsRead = async (notificationId) => {
  try {
    const response = await axios.put(`http://localhost:5000/api/notifications/read/${notificationId}`);

    // Ici, tu mets à jour l'état local des notifications pour qu'elles soient actualisées
    setNotifications((prevNotifications) =>
      prevNotifications.map((notif) =>
        notif.id === notificationId ? { ...notif, is_read: true } : notif
      )
    );
    
    console.log(`Notification ${notificationId} marquée comme lue`);
  } catch (error) {
    console.error("Erreur lors du marquage comme lue :", error);
  }
};



  useEffect(() => {
    fetch('http://localhost:5000/api/auth/users')
      .then(res => res.json())
      .then(data => setUsers(data))
      .catch(err => console.error('Erreur chargement utilisateurs :', err));
  }, []);

  useEffect(() => {
    if (userId && users.length > 0) {
      const found = users.find(u => u.id === userId);
      if (found) setCurrentUser(found);
    }
  }, [userId, users]);

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
    <div className="notifications-container">
      <div className="notifications-header">
        <div className="tabs">
          <button 
            className={`tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            Système
            {unreadNotificationsCount > 0 && (
              <Badge pill bg="danger" className="ms-2">
                {unreadNotificationsCount}
              </Badge>
            )}
          </button>
          <button 
            className={`tab-btn ${activeTab === 'reminders' ? 'active' : ''}`}
            onClick={() => setActiveTab('reminders')}
          >
            Rappels
          </button>
        </div>
      </div>

      {activeTab === 'notifications' && (
        <div className="notifications-section">
          {notifications.length === 0 ? (
            <div className="empty-state">
              <i className="bi bi-bell-slash"></i>
              <p>Aucune notification système</p>
            </div>
          ) : (
            notifications.map(notif => (
              <Card key={notif.id} className={`notification-card ${!notif.is_read ? 'unread' : ''}`}>
                <Card.Body>
                  <div className="notification-content">
                    <div className="notification-icon">
                      {notif.type === 'task' ? (
                        <i className="bi bi-clipboard-check"></i>
                      ) : (
                        <i className="bi bi-info-circle"></i>
                      )}
                    </div>
                    <div className="notification-details">
                      <Card.Title>{notif.type === 'task' ? 'Tâche' : 'Information'}</Card.Title>
                      <Card.Text>{notif.message}</Card.Text>
                      <div className="notification-meta">
                        <small>{new Date(notif.created_at).toLocaleString()}</small>
                        {currentUser?.role === 'admin' && (
                          <>
                            <small>Envoyée par: {notif.sender_id || 'N/A'}</small>
                            <small>Document: {notif.document_id || 'N/A'}</small>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="notification-actions">
                      {notif.type === 'task' && notif.related_task_id && (
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="action-btn"
                          href={`/details_taches/${notif.related_task_id}`}
                        >
                          <i className="bi bi-eye"></i>
                        </Button>
                      )}
                      {!notif.is_read && (
                        <Button
                          variant="outline-success"
                          size="sm"
                          className="action-btn"
                          onClick={() => markAsRead(notif.id)}
                        >
                          <i className="bi bi-check2"></i>
                        </Button>
                      )}
                    </div>
                  </div>
                  {currentUser?.role === 'admin' && (
                    <div className="admin-actions">
                      <ButtonGroup>
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() =>
                            handleDecision(
                              notif.document_id,
                              true,
                              notif.sender_id,
                              currentUser?.id
                            )
                          }
                        >
                          <i className="bi bi-check-lg"></i> Approuver
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() =>
                            handleDecision(
                              notif.document_id,
                              false,
                              notif.user_id,
                              currentUser?.id
                            )
                          }
                        >
                          <i className="bi bi-x-lg"></i> Refuser
                        </Button>
                      </ButtonGroup>
                    </div>
                  )}
                </Card.Body>
              </Card>
            ))
          )}
        </div>
      )}

      {activeTab === 'reminders' && (
        <div className="reminders-section">
          {reminders.length === 0 ? (
            <div className="empty-state">
              <i className="bi bi-calendar-x"></i>
              <p>Aucun rappel de tâche à venir</p>
            </div>
          ) : (
            reminders.map(reminder => (
              <Card key={reminder.id} className="reminder-card">
                <Card.Body>
                  <div className="reminder-content">
                    <div className="reminder-icon">
                      <i className="bi bi-alarm"></i>
                    </div>
                    <div className="reminder-details">
                      <Card.Title>{reminder.title}</Card.Title>
                      <Card.Text>{reminder.message}</Card.Text>
                      <div className="reminder-meta">
                        <small>Échéance: {new Date(reminder.deadline).toLocaleDateString()}</small>
                      </div>
                    </div>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      className="action-btn"
                      href={`/details_taches/${reminder.id}`}
                    >
                      <i className="bi bi-eye"></i>
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
    </>
  );
};

export default NotificationsPage;