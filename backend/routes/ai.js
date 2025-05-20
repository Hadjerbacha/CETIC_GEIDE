// routes/gemini.js
const express = require("express");
const router = express.Router();
const dotenv = require("dotenv");
const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

router.post("/gemini", async (req, res) => {
  try {
    const { prompt } = req.body;
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    res.json({ output: text });
  } catch (error) {
    console.error("Erreur Gemini API:", error);
    res.status(500).json({ error: "Erreur lors de la génération." });
  }
});

module.exports = router;
