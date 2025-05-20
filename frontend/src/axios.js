import axios from 'axios';
const token = localStorage.getItem('token');
const instance = axios.create({
  baseURL: 'http://localhost:5000/api/tasks', // Remplace par l'URL de ton serveur
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`, // Remplace par le token JWT de l'utilisateur
  },
});

export default instance;
