import React, { useState, useEffect } from 'react';
import * as FaIcons from 'react-icons/fa';
import * as AiIcons from 'react-icons/ai';
import { Link, useNavigate } from 'react-router-dom';
import '../style/Navbar.css';
import { IconContext } from 'react-icons';
import { jwtDecode } from 'jwt-decode';
import Dropdown from 'react-bootstrap/Dropdown';
import axios from 'axios';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';


const Navbar = () => {
  const [sidebar, setSidebar] = useState(false);
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0); // Nouvel état pour compter les notifications non lues
  const navigate = useNavigate();

  const showSidebar = () => setSidebar(!sidebar);

  // Dans Navbar.js
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

  // Décoder JWT pour récupérer userId
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const decoded = jwtDecode(token);
      setUserId(decoded.id); // ici tu fixes le problème
    }
  }, []);

  // Récupérer la liste des utilisateurs
  useEffect(() => {
    fetch('http://localhost:5000/api/auth/users')
      .then(res => res.json())
      .then(data => setUsers(data))
      .catch(err => console.error('Erreur chargement utilisateurs :', err));
  }, []);

  // Associer userId au user courant
  useEffect(() => {
    if (userId && users.length > 0) {
      const found = users.find(u => u.id === userId);
      if (found) setCurrentUser(found);
    }
  }, [userId, users]);

  useEffect(() => {
    if (currentUser) {
      // Récupérer les notifications non lues
      axios.get(`http://localhost:5000/api/notifications/${currentUser.id}`)
        .then(res => {
          const unreadCount = res.data.filter(notification => !notification.is_read).length;
          setUnreadNotificationsCount(unreadCount); // Mettre à jour le nombre de notifications non lues
        })
        .catch(err => console.error("Erreur notifications :", err));
    }
  }, [currentUser]);

  // Menu selon rôle
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
      icon: <FaIcons.FaPlus />,
    },
     {
      title: 'Folders',
      path: '/folder',
      icon: <FaIcons.FaFolderOpen />,
    },
    /*{
      title: 'Workflows',
      path: '/workflow',
      icon: <FaIcons.FaClipboardList />,
    },*/
    {
      title: 'Mes tâches',
      path: '/mes-taches',
      icon: <FaIcons.FaUserCheck />,
    },
    {
      title: 'Notifications',
      path: '/notif',
      icon: (
          <FaIcons.FaBell />
      )
    },
    {
      title: 'Tableau de bord',
      path: '/Statistique',
      icon: <FaIcons.FaChartBar />,
    },
    {
      title: 'Journal d\'activité',
      path: '/activites',
      icon: <FaIcons.FaHistory />,
    },
    currentUser?.role === 'admin' && {
      title: 'Archive',
      path: '/archive',
      icon: <FaIcons.FaArchive />,
    },
    currentUser?.role === 'admin' && {
      title: 'Archive Documents',
      path: '/archives',
      icon: <FaIcons.FaArchive />,
    },
    currentUser?.role === 'admin' && {
      title: 'Reclamation',
      path: '/ReclamationList',
      icon: <FaIcons.FaInbox />,
    },
  ];

  return (
    <IconContext.Provider value={{ color: '#000' }}>
      <div className="navbar">
        <div className="navbar-content">
          <Link to="#" className="menu-bars">
            <FaIcons.FaBars onClick={showSidebar} />
          </Link>



          <Link to="/accueil" style={{ marginLeft: 'auto', marginRight: 'auto' }}>
  <img
    src="/11.png"
    alt="Logo"
    width="100"
    height="50"
    className="logo-hover"
    style={{ cursor: 'pointer' }}
  />
</Link>

<OverlayTrigger
  placement="bottom"
  overlay={<Tooltip id="tooltip-bottom">Voir notifications</Tooltip>}
>
  <Link
    to="/notif"
    style={{
      position: 'relative',
      marginRight: '5px',
      marginLeft: '-10px',
      display: 'inline-block',
    }}
  >
    <FaIcons.FaBell size={20} color="#174193" />
    {unreadNotificationsCount > 0 && (
      <span
        style={{
          position: 'absolute',
          top: '-5px',
          right: '-10px',
          backgroundColor: 'red',
          color: 'white',
          borderRadius: '50%',
          padding: '2px 6px',
          fontSize: '12px',
          zIndex: 10,
        }}
      >
        {unreadNotificationsCount}
      </span>
    )}
  </Link>
</OverlayTrigger>

          {currentUser ? (
            <Dropdown>
              <Dropdown.Toggle variant="light" id="dropdown-basic" className="text-success fw-bold">
                {currentUser.name} {currentUser.prenom}
              </Dropdown.Toggle>

              <Dropdown.Menu>
                <Dropdown.Item href="/reclamation">Aide</Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item onClick={handleLogout} className="text-danger">
                  Déconnexion
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          ) : (
            <div className="text-danger">Aucun utilisateur connecté</div>
          )}
        </div>
      </div>


      <nav className={sidebar ? 'nav-menu active' : 'nav-menu'} style={{ zIndex: 200 }}>
        <ul className="nav-menu-items shine-hover" onClick={showSidebar}>
          <li className="navbar-toggle">
            <Link to="#" className="menu-bars shine-hover" >
              <AiIcons.AiOutlineClose />
            </Link>
          </li>

          {sidebarItems
            .filter(Boolean)
            .map((item, index) => (
              <li key={index} className="nav-text">
                <Link to={item.path}>
                  {item.icon}
                  <span className="ms-2">{item.title}</span>
                </Link>
              </li>
            ))}
        </ul>
      </nav>
    </IconContext.Provider>
  );
};

export default Navbar;
