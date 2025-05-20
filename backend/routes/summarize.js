const express = require('express');
const router = express.Router();
const axios = require('axios');
const authMiddleware = require('../middleware/authMiddleware');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Nouvelle route pour le résumé
router.post('/', authMiddleware, async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: "Texte requis pour le résumé." });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Prompt optimisé pour le résumé en français
    const prompt = `
      Tu es un expert en résumé de documents. Résume le texte suivant en français de manière concise (3-5 phrases max).
      Concentre-toi sur les idées principales et les données clés. Évite les détails superflus.
      
      Texte à résumer:
      ${text}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summary = response.text();

    // Nettoyage du résultat
    const cleanedSummary = summary
      .replace(/```/g, '')  // Supprime les backticks
      .trim();

    res.status(200).json({ summary: cleanedSummary });
  } catch (error) {
    console.error("Erreur Gemini:", error);
    res.status(500).json({ error: "Erreur lors de la génération du résumé." });
  }
});

module.exports = router;
