const db = require('../config/db');

async function getWorkflowFromDB(workflowId) {
  const client = await db.connect(); // Obtient une connexion du pool
  
  try {
    // Début de la transaction
    await client.query('BEGIN');

    // 1. Récupération du workflow principal
    const workflowQuery = `
      SELECT *
      FROM workflow 
      WHERE id = $1
      FOR UPDATE`; // FOR UPDATE pour verrouiller la ligne
    
    const workflowResult = await client.query(workflowQuery, [workflowId]);
    
    if (workflowResult.rowCount === 0) {
      throw new Error(`Workflow avec l'ID ${workflowId} non trouvé`);
    }

    const workflow = workflowResult.rows[0];

    // 2. Récupération des tâches/étapes associées
    const stepsQuery = `
      SELECT 
        id, title, description, 
        due_date, priority, status,
        assigned_to, created_at
      FROM tasks
      WHERE workflow_id = $1
      ORDER BY 
        CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,
        due_date ASC,
        CASE priority
          WHEN 'haute' THEN 1
          WHEN 'moyenne' THEN 2
          WHEN 'basse' THEN 3
          ELSE 4
        END
    `;

    const stepsResult = await client.query(stepsQuery, [workflowId]);
    workflow.tasks = stepsResult.rows;

    // 3. Récupération des métadonnées supplémentaires si nécessaire
    const metaQuery = `
      SELECT COUNT(*) as total_tasks,
             SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks
      FROM tasks
      WHERE workflow_id = $1
    `;

    const metaResult = await client.query(metaQuery, [workflowId]);
    workflow.metadata = metaResult.rows[0];

    await client.query('COMMIT'); // Validation de la transaction
    
    return workflow;

  } catch (error) {
    await client.query('ROLLBACK'); // Annulation en cas d'erreur
    console.error('[WorkflowService] Erreur:', error.message);
    
    // Enrichissement de l'erreur pour le frontend
    error.statusCode = error.statusCode || 500;
    error.details = {
      workflowId,
      timestamp: new Date().toISOString()
    };
    
    throw error;
  } finally {
    client.release(); // Libération de la connexion
  }
}

module.exports = {
  getWorkflowFromDB
};