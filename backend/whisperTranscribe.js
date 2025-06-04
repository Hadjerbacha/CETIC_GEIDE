const { spawn } = require("child_process");
const path = require("path");

function transcribeAudio(filePath) {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn("python", [
      path.join(__dirname, "transcribe.py"),
      filePath
    ]);

    let output = "";
    pythonProcess.stdout.on("data", (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      console.error(`Erreur Python: ${data}`);
    });

    pythonProcess.on("close", (code) => {
      if (code === 0) {
        // Récupérer uniquement la transcription
        const transcription = output.split("Transcription :")[1]?.trim();
        resolve(transcription);
      } else {
        reject("Erreur de transcription.");
      }
    });
  });
}

module.exports = { transcribeAudio };
