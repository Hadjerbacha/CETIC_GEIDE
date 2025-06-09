import React, { useState, useEffect } from 'react';
import * as FaIcons from 'react-icons/fa';
import * as AiIcons from 'react-icons/ai';
import * as HiIcons from 'react-icons/hi';
import { Link, useNavigate } from 'react-router-dom';
import '../style/Navbar.css';
import { IconContext } from 'react-icons';
import { jwtDecode } from 'jwt-decode';
import { Dropdown, Avatar, Badge } from 'antd';
import axios from 'axios';
import { motion } from 'framer-motion';

const Navbar = () => {
  const [sidebar, setSidebar] = useState(false);
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const navigate = useNavigate();

  const showSidebar = () => setSidebar(!sidebar);

  const handleLogout = async () => {
    try {
      await axios.post('http://localhost:5000/api/auth/logout', {}, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      localStorage.removeItem("token");
      navigate('/');
    } catch (err) {
      console.error("Erreur lors de la déconnexion:", err);
      localStorage.removeItem("token");
      navigate('/');
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const decoded = jwtDecode(token);
      setUserId(decoded.id);
    }
  }, []);

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

  const sidebarItems = [
    {
      title: 'Accueil',
      path: '/accueil',
      icon: <AiIcons.AiFillHome />,
    },
    currentUser?.role === 'admin' && {
      title: 'Ajouter utilisateur',
      path: '/AdminUsers',
      icon: <FaIcons.FaUserPlus />,
    },
    {
      title: 'Documents',
      path: '/documents',
      icon: <HiIcons.HiDocumentAdd />,
    },
    {
      title: 'Dossiers',
      path: '/folder',
      icon: <HiIcons.HiFolderOpen />,
    },
    {
      title: 'Mes tâches',
      path: '/mes-taches',
      icon: <FaIcons.FaTasks />,
    },
    {
      title: 'Notifications',
      path: '/notif',
      icon: (
        <Badge count={unreadNotificationsCount} offset={[-5, 5]}>
          <FaIcons.FaBell />
        </Badge>
      )
    },
    {
      title: 'Tableau de bord',
      path: '/Statistique',
      icon: <FaIcons.FaChartLine />,
    },
    {
      title: 'Journal d\'activité',
      path: '/activites',
      icon: <FaIcons.FaHistory />,
    },
    {
      title: 'Archive',
      path: currentUser?.role === 'admin' ? '/archive' : '/archive',
      icon: <FaIcons.FaArchive />,
    },
    currentUser?.role === 'admin' && {
      title: 'Reclamation',
      path: '/ReclamationList',
      icon: <FaIcons.FaInbox />,
    },
  ];

  const userMenu = (
    <div className="user-dropdown-menu">
      <div className="user-info">
        <Avatar 
          size={40} 
          style={{ 
            backgroundColor: '#174193',
            color: '#fff',
            fontWeight: 'bold'
          }}
        >
          {currentUser?.name?.charAt(0)}{currentUser?.prenom?.charAt(0)}
        </Avatar>
        <div className="user-details">
          <span className="user-name">{currentUser?.name} {currentUser?.prenom}</span>
          <span className="user-role">{currentUser?.role}</span>
        </div>
      </div>
      <div className="dropdown-divider"></div>
      <Link to="/profile" className="dropdown-item">
        <FaIcons.FaUser /> Mon profil
      </Link>
      <Link to="/settings" className="dropdown-item">
        <FaIcons.FaCog /> Paramètres
      </Link>
      <Link to="/reclamation" className="dropdown-item">
        <FaIcons.FaQuestionCircle /> Aide
      </Link>
      <div className="dropdown-divider"></div>
      <button onClick={handleLogout} className="dropdown-item logout">
        <FaIcons.FaSignOutAlt /> Déconnexion
      </button>
    </div>
  );

  return (
    <>
    <IconContext.Provider value={{ color: '#174193' }}>
      <header className="modern-navbar">
        <div className="navbar-container">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="menu-toggle"
          >
            <FaIcons.FaBars onClick={showSidebar} />
          </motion.div>


          <div className="navbar-logo">
  <img 
    src="/logo4.png" // Remplace par le chemin réel de ton logo
    alt="CETIC Logo" 
    style={{
      height: '60px',
      marginLeft: '-400px'
    }}
  />
</div>


          <div className="navbar-right">
           <motion.div 
  whileHover={{ scale: 1.05 }}
  className="notification-icon"
  style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 0,
    padding: '6px 20px',
    backgroundColor: '#1890ff',
    borderRadius: '30px',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
    cursor: 'pointer',
    minWidth: '170px' // pour donner plus de largeur
  }}
>
  <Link
    to="/notif"
    style={{
      color: '#fff',
      textDecoration: 'none',
      display: 'flex',
      alignItems: 'center',
      gap: '10px' // espace entre l'icône et le texte
    }}
  >
    <Badge count={unreadNotificationsCount} offset={[-5, 5]}>
      <FaIcons.FaBell size={22} style={{ color: '#fff' }} />
    </Badge>
    <h6 style={{ color: '#fff', margin: 0 }}>Notifications</h6>
  </Link>
</motion.div>


            <Dropdown overlay={userMenu} trigger={['click']}>
              <div className="user-avatar">
                <Avatar 
                  size={40} 
                  style={{ 
                    backgroundColor: '#174193',
                    color: '#fff',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  {currentUser?.name?.charAt(0)}{currentUser?.prenom?.charAt(0)}
                </Avatar>
                <span className="user-name-short">
                  {currentUser?.name} {currentUser?.prenom}
                </span>
                <FaIcons.FaChevronDown className="dropdown-arrow" />
              </div>
            </Dropdown>
          </div>
        </div>
      </header>

      <motion.nav 
  initial={{ x: -300 }}
  animate={{ x: sidebar ? 0 : -300 }}
  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
  className="modern-sidebar"
>
  <div className="sidebar-header">
    <motion.div 
      whileHover={{ rotate: 90 }}
      className="close-btn"
      onClick={showSidebar}
    >
      <AiIcons.AiOutlineClose />
    </motion.div>
  </div>

  <ul className="sidebar-items">
    {sidebarItems
      .filter(Boolean)
      .map((item, index) => (
        <motion.li 
          key={index}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="nav-item"
        >
          <Link to={item.path}>
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-title">{item.title}</span>
          </Link>
        </motion.li>
      ))}
  </ul>
</motion.nav>
    </IconContext.Provider>
    <br/>
    <br/>
    <br/>
    <br/>
    </>
  );
};

export default Navbar;