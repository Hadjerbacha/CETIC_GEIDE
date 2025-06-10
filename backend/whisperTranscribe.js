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
      reject(data.toString());
    });

    pythonProcess.on("close", (code) => {
      if (code === 0) {
        try {
          // Le script Python devrait maintenant renvoyer du JSON
          const result = JSON.parse(output);
          resolve(result.text || "");
        } catch (e) {
          console.error("Erreur parsing sortie Python:", e);
          reject("Format de sortie invalide");
        }
      } else {
        reject(`Processus Python terminé avec code ${code}`);
      }
    });
  });
}

module.exports = { transcribeAudio };