const express = require('express');
const router = express.Router();
const { execFile } = require('child_process');

router.post('/generate-workflow', async (req, res) => {
  const { description } = req.body;

  execFile('python', ['python.py', description], (error, stdout, stderr) => {
    if (error) {
      console.error('Erreur Python:', error);
      return res.status(500).json({ message: 'Erreur génération workflow local.' });
    }
    try {
      const workflow = JSON.parse(stdout);
      res.status(200).json(workflow);
    } catch (parseError) {
      console.error('Erreur parsing:', parseError);
      res.status(500).json({ message: 'Erreur parsing JSON.' });
    }
  });
});


module.exports = router;
