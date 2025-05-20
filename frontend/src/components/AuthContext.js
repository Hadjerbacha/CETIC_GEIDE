// AuthContext.js
import { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const decoded = jwtDecode(token);
      fetch(`http://localhost:5000/api/auth/users`)
        .then(res => res.json())
        .then(data => {
          const user = data.find(u => u.id === decoded.id);
          setCurrentUser(user);
        })
        .catch(err => console.error("Erreur AuthContext :", err));
    }
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
