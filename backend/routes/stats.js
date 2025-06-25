const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Global statistics
router.get('/global', async (req, res) => {
  try {
    const [
      users, 
      documents, 
      tasks, 
      workflows, 
      invoices,
      leaveRequests,
      cv,
      folders
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT COUNT(*) FROM documents'),
      pool.query('SELECT COUNT(*) FROM tasks'),
      pool.query('SELECT COUNT(*) FROM workflow'),
      pool.query('SELECT COUNT(*) FROM factures'),
      pool.query('SELECT COUNT(*) FROM demande_conges'),
      pool.query('SELECT COUNT(*) FROM cv'),
      pool.query('SELECT COUNT(*) FROM folders')
    ]);

    res.json({
      totalUsers: parseInt(users.rows[0].count),
      totalDocuments: parseInt(documents.rows[0].count),
      totalTasks: parseInt(tasks.rows[0].count),
      totalWorkflows: parseInt(workflows.rows[0].count),
      totalInvoices: parseInt(invoices.rows[0].count),
      totalLeaveRequests: parseInt(leaveRequests.rows[0].count),
      totalCVs: parseInt(cv.rows[0].count),
      totalFolders: parseInt(folders.rows[0].count)
    });
  } catch (error) {
    console.error('Error /stats/global:', error.stack);
    res.status(500).json({ error: 'Error fetching global stats.' });
  }
});

// Document statistics
router.get('/documents', async (req, res) => {
  try {
    const [byCategory, byPriority, versions] = await Promise.all([
      pool.query('SELECT category AS name, COUNT(*)::int AS value FROM documents GROUP BY category'),
      pool.query('SELECT priority AS name, COUNT(*)::int AS value FROM documents GROUP BY priority'),
      pool.query(`
        SELECT 
          TO_CHAR(date, 'YYYY-MM') AS month,
          COUNT(*)::int AS count
        FROM documents
        WHERE date >= NOW() - INTERVAL '6 months'
        GROUP BY month
        ORDER BY month
      `)
    ]);

    res.json({
      byCategory: byCategory.rows,
      byPriority: byPriority.rows,
      versions: versions.rows
    });
  } catch (error) {
    console.error('Error /stats/documents:', error.stack);
    res.status(500).json({ error: 'Error fetching document stats.' });
  }
});

// User statistics
router.get('/users', async (req, res) => {
  try {
    const [byRole, activity] = await Promise.all([
      pool.query('SELECT role AS name, COUNT(*)::int AS value FROM users GROUP BY role'),
      pool.query(`
        SELECT 
          DATE(login_time) AS date,
          COUNT(DISTINCT user_id)::int AS activeUsers
        FROM sessions
        WHERE login_time >= NOW() - INTERVAL '30 days'
        GROUP BY date
        ORDER BY date
      `)
    ]);

    res.json({
      byRole: byRole.rows,
      activity: activity.rows
    });
  } catch (error) {
    console.error('Error /stats/users:', error.stack);
    res.status(500).json({ error: 'Error fetching user stats.' });
  }
});

// Task statistics - Version améliorée
// Task statistics - Corrected version
router.get('/tasks', async (req, res) => {
  try {
    const [byStatus, completion, byPriority, timeStats, workflowStats] = await Promise.all([
      // Statistiques par statut
      pool.query(`
        SELECT 
          status AS name, 
          COUNT(*)::int AS value,
          ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 1) AS percentage
        FROM tasks 
        GROUP BY status
        ORDER BY value DESC
      `),
      
      // Taux de complétion
      pool.query(`
        SELECT 
          ROUND(100.0 * SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / COUNT(*), 1) AS completion_rate,
          ROUND(100.0 * SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) / COUNT(*), 1) AS rejection_rate
        FROM tasks
      `),
      
      // Statistiques par priorité
      pool.query(`
        SELECT 
          priority AS name, 
          COUNT(*)::int AS value,
          ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 1) AS percentage
        FROM tasks 
        WHERE priority IS NOT NULL
        GROUP BY priority
        ORDER BY value DESC
      `),
      
      // Statistiques temporelles - CORRECTED QUERY
      pool.query(`
        SELECT
          AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600) AS avg_completion_hours,
          AVG(EXTRACT(EPOCH FROM (rejected_at - created_at))/3600) AS avg_rejection_hours
        FROM tasks
        WHERE status IN ('completed', 'rejected')
      `),
      
      // Statistiques par workflow
      pool.query(`
        SELECT
          w.name AS workflow_name,
          COUNT(t.id) AS total_tasks,
          COUNT(t.id) FILTER (WHERE t.status = 'completed') AS completed_tasks,
          COUNT(t.id) FILTER (WHERE t.status = 'rejected') AS rejected_tasks,
          ROUND(100.0 * COUNT(t.id) FILTER (WHERE t.status = 'completed') / NULLIF(COUNT(t.id), 0), 1) AS completion_rate
        FROM tasks t
        JOIN workflow w ON t.workflow_id = w.id
        GROUP BY w.name
        ORDER BY total_tasks DESC
        LIMIT 5
      `)
    ]);

    res.json({
      byStatus: byStatus.rows,
      completionRate: parseFloat(completion.rows[0].completion_rate) || 0,
      rejectionRate: parseFloat(completion.rows[0].rejection_rate) || 0,
      byPriority: byPriority.rows,
      timeStats: {
        avgCompletionHours: parseFloat(timeStats.rows[0]?.avg_completion_hours) || 0,
        avgRejectionHours: parseFloat(timeStats.rows[0]?.avg_rejection_hours) || 0
      },
      byWorkflow: workflowStats.rows
    });
  } catch (error) {
    console.error('Error /stats/tasks:', error.stack);
    res.status(500).json({ error: 'Error fetching task stats.' });
  }
});

// Workflow statistics - Version améliorée
router.get('/workflows', async (req, res) => {
  try {
    const [byStatus, timeStats, taskStats, userStats] = await Promise.all([
      // Par statut
      pool.query(`
        SELECT 
          status AS name, 
          COUNT(*)::int AS value,
          ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 1) AS percentage
        FROM workflow 
        GROUP BY status
        ORDER BY value DESC
      `),
      
      // Statistiques temporelles
      pool.query(`
        SELECT
          AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600) AS avg_duration_hours,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (updated_at - created_at))/3600) AS median_duration_hours,
          MAX(EXTRACT(EPOCH FROM (updated_at - created_at))/3600) AS max_duration_hours
        FROM workflow
        WHERE status IN ('completed', 'rejected')
      `),
      
      // Statistiques des tâches dans les workflows
      pool.query(`
        SELECT
          AVG(task_count) AS avg_tasks_per_workflow,
          MAX(task_count) AS max_tasks_per_workflow,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY task_count) AS median_tasks_per_workflow
        FROM (
          SELECT w.id, COUNT(t.id) AS task_count
          FROM workflow w
          LEFT JOIN tasks t ON w.id = t.workflow_id
          GROUP BY w.id
        ) AS workflow_tasks
      `),
      
      // Statistiques par utilisateur
      pool.query(`
        SELECT
          u.name,
          u.prenom,
          COUNT(w.id) AS total_workflows,
          COUNT(w.id) FILTER (WHERE w.status = 'completed') AS completed_workflows,
          COUNT(w.id) FILTER (WHERE w.status = 'rejected') AS rejected_workflows,
          ROUND(100.0 * COUNT(w.id) FILTER (WHERE w.status = 'completed') / COUNT(w.id), 1) AS success_rate
        FROM workflow w
        JOIN users u ON w.created_by = u.id
        GROUP BY u.name, u.prenom
        ORDER BY total_workflows DESC
        LIMIT 5
      `)
    ]);

    res.json({
      byStatus: byStatus.rows,
      timeStats: {
        avgDurationHours: parseFloat(timeStats.rows[0].avg_duration_hours) || 0,
        medianDurationHours: parseFloat(timeStats.rows[0].median_duration_hours) || 0,
        maxDurationHours: parseFloat(timeStats.rows[0].max_duration_hours) || 0
      },
      taskStats: {
        avgTasksPerWorkflow: parseFloat(taskStats.rows[0].avg_tasks_per_workflow) || 0,
        maxTasksPerWorkflow: parseFloat(taskStats.rows[0].max_tasks_per_workflow) || 0,
        medianTasksPerWorkflow: parseFloat(taskStats.rows[0].median_tasks_per_workflow) || 0
      },
      byUser: userStats.rows
    });
  } catch (error) {
    console.error('Error /stats/workflows:', error.stack);
    res.status(500).json({ error: 'Error fetching workflow stats.' });
  }
});

module.exports = router;