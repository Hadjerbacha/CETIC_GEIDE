const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

// Initialisation de Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

async function analyzeWorkflowWithGemini(logsText, workflowInfo) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const prompt = `
    Vous êtes un expert en analyse de workflows. Analysez les logs suivants et le contexte du workflow pour :
    1. Identifier les anomalies ou erreurs
    2. Proposer des optimisations
    3. Donner des recommandations spécifiques

    Informations du workflow :
    - Nom: ${workflowInfo.name}
    - Description: ${workflowInfo.description}
    - Statut: ${workflowInfo.status}
    - Nombre d'étapes: ${workflowInfo.stepsCount}

    Logs à analyser :
    ${logsText}

    Fournissez votre analyse sous forme de rapport structuré avec :
    - Un résumé exécutif
    - Les problèmes détectés (avec niveau de gravité)
    - Les recommandations d'amélioration
    - Une conclusion avec les actions prioritaires
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Erreur avec Gemini:", error);
    throw new Error("Échec de l'analyse avec Gemini");
  }
}

module.exports = { analyzeWorkflowWithGemini };