// utils/log.js
const pool = require('../config/db'); // Assurez-vous que le chemin est correct

async function logWorkflowAction(workflowId, message) {
  try {
    await pool.query(
      'INSERT INTO workflow_logs (workflow_id, message, timestamp) VALUES ($1, $2, NOW())',
      [workflowId, message]
    );
  } catch (err) {
    console.error('Erreur lors de l\'enregistrement du log :', err);
  }
}

module.exports = { logWorkflowAction };
