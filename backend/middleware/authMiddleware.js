const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];  // Récupérer le token (format 'Bearer token')

  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);  // Vérifier le token
    req.user = decoded;  // Décoder et attacher les données de l'utilisateur à la requête
    next();  // Passer au prochain middleware ou à la route
  } catch (err) {
    console.error('Erreur de vérification du token:', err);
    res.status(401).json({ error: 'Token invalide' });
  }
};

module.exports = authMiddleware;
