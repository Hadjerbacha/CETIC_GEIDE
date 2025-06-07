const { exec } = require('child_process');
const path = require('path');

module.exports = function transcribeWithPython(filePath) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'transcribe.py');
    exec(`python3 "${scriptPath}" "${filePath}"`, (error, stdout, stderr) => {
      if (error) {
        reject(stderr || error.message);
      } else {
        resolve(stdout.trim());
      }
    });
  });
};
