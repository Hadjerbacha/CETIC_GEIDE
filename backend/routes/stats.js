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

// Task statistics
router.get('/tasks', async (req, res) => {
  try {
    const [byStatus, completion] = await Promise.all([
      pool.query('SELECT status AS name, COUNT(*)::int AS value FROM tasks GROUP BY status'),
      pool.query(`
        SELECT 
          ROUND(100.0 * SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / COUNT(*), 1) AS rate 
        FROM tasks
      `)
    ]);

    res.json({
      byStatus: byStatus.rows,
      completionRate: parseFloat(completion.rows[0].rate)
    });
  } catch (error) {
    console.error('Error /stats/tasks:', error.stack);
    res.status(500).json({ error: 'Error fetching task stats.' });
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

// Workflow statistics
router.get('/workflows', async (req, res) => {
  try {
    const [byStatus] = await Promise.all([
      pool.query('SELECT status AS name, COUNT(*)::int AS value FROM workflow GROUP BY status')
    ]);

    res.json({
      byStatus: byStatus.rows
    });
  } catch (error) {
    console.error('Error /stats/workflows:', error.stack);
    res.status(500).json({ error: 'Error fetching workflow stats.' });
  }
});

module.exports = router;