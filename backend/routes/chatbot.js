const { Pool } = require('pg');

// Connexion à la base de données PostgreSQL
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'ged',
  password: 'hadjer',
  port: 5432,
});

// Fonction pour gérer la recherche dans la base
const searchDocuments = async (queryText) => {
  try {
    const result = await pool.query(
      `SELECT id, name, contenu 
       FROM documents 
       WHERE to_tsvector('french', contenu) @@ plainto_tsquery('french', $1)`,
      [queryText]
    );
    
    return result.rows;
  } catch (err) {
    console.error('❌ Erreur dans la recherche du document :', err.stack);
    return [];
  }
};

// Fonction pour gérer la logique du chatbot
const handleChatbotRequest = async (userInput) => {
  // Tu peux ajouter ici une logique pour analyser la question de l'utilisateur et la transformer avant la recherche
  console.log(`🧠 Entrée utilisateur: ${userInput}`);
  
  // Appelle la fonction de recherche
  const searchResults = await searchDocuments(userInput);

  // Si des documents sont trouvés, retourne les résultats
  if (searchResults.length > 0) {
    return searchResults.map(doc => ({
      name: doc.name,
      contentPreview: doc.contenu.substring(0, 100), // Affiche les 100 premiers caractères du contenu
      link: doc.id // lien vers le document (tu peux ajouter un lien complet ici)
    }));
  } else {
    return [{
      message: "Désolé, je n'ai pas trouvé de documents correspondant à votre demande."
    }];
  }
};

module.exports = {
  handleChatbotRequest
};
