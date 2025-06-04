// whisperTranscribe.js
const fs = require('fs');
const { pipeline } = require('@xenova/transformers'); // ou autre lib Whisper si tu en utilises une
const path = require('path');

(async () => {
  const filePath = process.argv[2]; // Chemin reçu en argument
  if (!filePath || !fs.existsSync(filePath)) {
    console.error('Fichier introuvable');
    process.exit(1);
  }

  try {
    const transcriber = await pipeline('automatic-speech-recognition', 'openai/whisper-small');
    const result = await transcriber(filePath);
    console.log(result.text);
  } catch (err) {
    console.error('Erreur Whisper:', err);
    process.exit(1);
  }
})();
