const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("Dis-moi un secret de développeur !");
    const response = await result.response;
    console.log(response.text());
  } catch (err) {
    console.error("❌ Erreur Gemini :", err);
  }
}

run();
