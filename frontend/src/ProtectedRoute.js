import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ element }) => {
  const token = localStorage.getItem('token'); // <-- directement ici

  if (!token) {
    console.log("Token manquant, redirection...");
    return <Navigate to="/" />;
  }

  return element;
};


export default ProtectedRoute;
