const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware'); // Assurez-vous que le chemin est correct
const taskController = require('../controllers/taskController');
const { logActivity } = require("./historique");
const pool = new Pool({
  user: process.env.PG_USER || 'postgres',
  host: process.env.PG_HOST || 'localhost',
  database: process.env.PG_DATABASE || 'ged',
  password: process.env.PG_PASSWORD || 'hadjer',
  port: process.env.PG_PORT || 5432,
});

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

async function initialize() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255),
      description TEXT,
      due_date DATE,
      priority VARCHAR(50),
      file_path TEXT,
      notify BOOLEAN DEFAULT false,
      assigned_to INTEGER[],
      assigned_by INTEGER,
      assignment_note TEXT,
      assigned_at TIMESTAMP,
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW(),
      workflow_id INTEGER
    );
  `);
  console.log('Table tasks prête.');
}
initialize();


  const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// ⚠️ Ajoute le middleware d'authentification ici
router.post('/', authMiddleware, upload.single('file'), async (req, res) => {
  const { title, description, due_date, priority, notify, assigned_to, workflow_id } = req.body;
  const file_path = req.file ? `/uploads/${req.file.filename}` : null;
  const created_by = req.user.id; // ✅ Obtenu grâce à authMiddleware

  let userIds;
  try {
    userIds = JSON.parse(assigned_to);
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'assigned_to doit être un tableau JSON non vide.' });
    }
    userIds = userIds.map(Number);
  } catch (err) {
    return res.status(400).json({ error: 'assigned_to doit être un tableau JSON valide.' });
  }

  try {
    if (!userIds.every(id => Number.isInteger(id))) {
      return res.status(400).json({ error: 'Tous les IDs dans assigned_to doivent être des entiers.' });
    }

    // ✅ Insertion avec created_by
    const result = await pool.query(
      `INSERT INTO tasks 
        (title, description, due_date, priority, file_path, notify, assigned_to, created_by, workflow_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8,$9) RETURNING *`,
      [title, description, due_date, priority, file_path, notify === 'true', userIds, created_by, workflow_id]
    );

    const task = result.rows[0];

    if (notify === 'true') {
      const creator = req.user;
      await sendNotification(userIds, task, `${creator.name} ${creator.prenom}`);
    }

    res.status(201).json(task);

    // Ajoutez ceci après la création
    await logActivity(req.user.id, 'create', 'task', task.id, {
      task_title: title,
      assigned_to: userIds,
      workflow_id: workflow_id
    });

  } catch (err) {
    console.error('Error during task insertion:', err);
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: err.message });
  }
});



  // 📥 Récupérer les tâches créées par l'utilisateur connecté (ignorer celles juste assignées)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Obtenir uniquement les tâches créées par l'utilisateur
    const tasksResult = await pool.query(
      'SELECT * FROM tasks WHERE created_by = $1 ORDER BY id DESC',
      [userId]
    );
    const tasks = tasksResult.rows;

    // Extraire les IDs nécessaires : assignés + créateurs (ici juste userId)
    const assignedIds = tasks.flatMap(task => task.assigned_to || []);
    const allUserIds = [...new Set([...assignedIds, userId])];

    // Récupérer les noms depuis la table users
    let usersMap = {};
    if (allUserIds.length > 0) {
      const usersResult = await pool.query(
        'SELECT id, name, prenom FROM users WHERE id = ANY($1)',
        [allUserIds]
      );
      usersMap = Object.fromEntries(
        usersResult.rows.map(user => [user.id, `${user.name} ${user.prenom}`])
      );
    }

    // Enrichir les tâches avec noms assignés et créateur
    const enrichedTasks = tasks.map(task => ({
      ...task,
      assigned_names: (task.assigned_to || []).map(id => usersMap[id] || `ID ${id}`),
      created_by_name: usersMap[task.created_by] || `ID ${task.created_by}`
    }));

    res.json(enrichedTasks);
  } catch (err) {
    console.error('Erreur dans GET /tasks:', err.message);
    res.status(500).json({ error: err.message });
  }
});

  
// 📥 Récupérer uniquement les tâches assignées à l'utilisateur connecté
// 📥 Récupérer uniquement les tâches assignées à l'utilisateur connecté
router.get('/mes-taches', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Récupérer les tâches où l'utilisateur est dans le tableau assigned_to
    // avec une jointure LEFT JOIN pour inclure les informations du workflow
    const tasksResult = await pool.query(
      `SELECT t.*, w.name as workflow_name 
       FROM tasks t
       LEFT JOIN workflow w ON t.workflow_id = w.id
       WHERE $1 = ANY(t.assigned_to) 
       ORDER BY t.id DESC`,
      [userId]
    );
    const tasks = tasksResult.rows;

    // Récupérer les IDs utilisateurs nécessaires
    const assignedIds = tasks.flatMap(task => task.assigned_to || []);
    const creatorIds = tasks.map(task => task.created_by);
    const allUserIds = [...new Set([...assignedIds, ...creatorIds])];

    // Mapping utilisateurs
    let usersMap = {};
    if (allUserIds.length > 0) {
      const usersResult = await pool.query(
        'SELECT id, name, prenom FROM users WHERE id = ANY($1)',
        [allUserIds]
      );
      usersMap = Object.fromEntries(
        usersResult.rows.map(user => [user.id, `${user.name} ${user.prenom}`])
      );
    }

    // Enrichir les tâches
    const enrichedTasks = tasks.map(task => ({
      ...task,
      assigned_names: (task.assigned_to || []).map(id => usersMap[id] || `ID ${id}`),
      created_by_name: usersMap[task.created_by] || `ID ${task.created_by}`,
      workflow_name: task.workflow_name || '---' // Ajout du nom du workflow
    }));

    res.json(enrichedTasks);
  } catch (err) {
    console.error('Erreur dans GET /mes-taches:', err.message);
    res.status(500).json({ error: err.message });
  }
});


// ✏️ Modifier une tâche
/// ✏️ Modifier une tâche (et gérer assigned_to en optionnel)
router.put('/:id',authMiddleware, upload.single('file'), async (req, res) => {
    const taskId = parseInt(req.params.id, 10);
    const { title, description, due_date, priority, notify, assigned_to } = req.body;
    let file_path = null;
  
    try {
      // Récupérer l'ancienne tâche
      const oldTaskResult = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
      if (oldTaskResult.rowCount === 0) {
        logger.error(`Task not found for update: ${taskId}`);
        return res.status(404).json({ message: 'Tâche non trouvée' });
      }
      const oldTask = oldTaskResult.rows[0];
  
      // Gestion du fichier
      if (req.file) {
        file_path = `/uploads/${req.file.filename}`;
        if (oldTask.file_path) {
          const oldPath = path.join(__dirname, '../', oldTask.file_path);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
      } else {
        file_path = oldTask.file_path; // On conserve l’ancien si pas de nouveau fichier
      }
  
      // Traitement des utilisateurs assignés
      let userIds = oldTask.assigned_to; // Garder les anciens par défaut
      if (assigned_to !== undefined) {
        try {
          const parsed = JSON.parse(assigned_to);
          if (!Array.isArray(parsed) || parsed.length === 0) {
            return res.status(400).json({ error: 'assigned_to doit être un tableau JSON non vide.' });
          }
          userIds = parsed.map(Number);
          if (!userIds.every(id => Number.isInteger(id))) {
            return res.status(400).json({ error: 'Tous les IDs dans assigned_to doivent être des entiers.' });
          }
        } catch (err) {
          return res.status(400).json({ error: 'assigned_to doit être un tableau JSON valide.' });
        }
      }
  
      // Mise à jour dans la base
      const result = await pool.query(
        `UPDATE tasks 
         SET title = $1, description = $2, due_date = $3, priority = $4, file_path = $5, notify = $6, assigned_to = $7
         WHERE id = $8 RETURNING *`,
        [title, description, due_date, priority, file_path, notify === 'true', userIds, taskId]
      );
  
      logger.info(`Task updated: ${taskId}`);
      res.json(result.rows[0]);

      // Ajoutez ceci
    await logActivity(req.user.id, 'update', 'task', taskId, {
      changes: {
        title: title !== oldTask.title,
        description: description !== oldTask.description,
        assigned_to: JSON.stringify(assigned_to) !== JSON.stringify(oldTask.assigned_to)
      }
    });

    } catch (err) {
      logger.error(`Error updating task ${taskId}: ${err.message}`);
      if (req.file) fs.unlink(req.file.path, () => {});
      res.status(500).json({ error: err.message });
    }
  });
  
  
  
router.delete('/:id',authMiddleware, async (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  try {
    const result = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING *', [taskId]);
    if (result.rowCount === 0) {
      logger.error(`Task not found: ${taskId}`);
      return res.status(404).json({ message: 'Tâche non trouvée' });
    }
    logger.info(`Task deleted: ${taskId}`);
    res.json({ message: 'Tâche supprimée' });
    // Ajoutez ceci
    await logActivity(req.user.id, 'delete', 'task', taskId, {
      task_title: task.title,
      workflow_id: task.workflow_id
    });

  } catch (err) {
    logger.error(`Error deleting task: ${err.message}`);
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// 🔄 Mettre à jour uniquement le status
// 🔄 Mettre à jour le statut d'une tâche, avec gestion de rejet et déblocage
router.patch('/:id/status', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { status, rejection_reason } = req.body;

  const allowedStatuses = ['pending', 'completed', 'in_progress', 'blocked', 'rejected', 'cancelled'];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: 'Statut invalide' });
  }

  try {
    const taskId = parseInt(id);
    const userId = req.user.id;

    // Mise à jour principale de la tâche
    const result = await pool.query(
      `UPDATE tasks 
       SET status = $1::varchar(50),
           rejection_reason = $2,
           rejected_at = CASE WHEN $1 = 'rejected' THEN NOW() ELSE NULL END,
           rejected_by = CASE WHEN $1 = 'rejected' THEN $3 ELSE NULL END,
           completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END
       WHERE id = $4
       RETURNING *`,
      [status, rejection_reason, userId, taskId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Tâche non trouvée' });
    }

    // Si la tâche est complétée, débloquer les tâches suivantes
    if (status === 'completed') {
      await pool.query(
        `UPDATE tasks 
         SET status = 'pending'::varchar(50)
         WHERE depends_on = $1::integer
           AND status = 'blocked'::varchar(50)`,
        [taskId]
      );
    }

    res.json(result.rows[0]);

     // Ajoutez ceci
    await logActivity(req.user.id, 'status_change', 'task', taskId, {
      old_status: oldTask.status,
      new_status: status,
      rejection_reason: rejection_reason
    });
  } catch (err) {
    console.error('Erreur SQL:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});


  
  router.post('/notify', authMiddleware, async (req, res) => {
    const { assigned_to, title, description, due_date } = req.body;
  
    try {
      const usersResult = await pool.query('SELECT id, email, name FROM users WHERE id = ANY($1)', [assigned_to]);
      const users = usersResult.rows;
  
      for (const user of users) {
        await sendNotification(user.email, {
          subject: `Nouvelle tâche assignée : ${title}`,
          text: `Bonjour ${user.name},\n\nUne nouvelle tâche vous a été assignée :\n\nTitre : ${title}\nDescription : ${description}\nDate d'échéance : ${due_date}`
        });
      }
  
      res.status(200).json({ message: 'Notifications envoyées avec succès.' });
    } catch (err) {
      logger.error(`Erreur lors de l'envoi des notifications : ${err.message}`);
      res.status(500).json({ error: 'Erreur lors de l’envoi des notifications.' });
    }
  });
  

  const nodemailer = require('nodemailer');

  const sendNotification = async (toEmail, { subject, text }) => {
    if (!toEmail) {
      console.error('Adresse email invalide ou absente');
      return;
    }
  
    let transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'hadjerbachasais@gmail.com',
        pass: 'ruyf zukf fyhq otje'
      }
    });
  
    const mailOptions = {
      from: 'hadjerbachasais@gmail.com',
      to: toEmail,
      subject: subject,
      text: text
    };
  
    try {
      await transporter.sendMail(mailOptions);
      console.log('Notification envoyée à', toEmail);
    } catch (error) {
      console.error('Erreur envoi notification :', error);
    }
  };
  
  // PATCH /api/tasks/:id/comment
router.patch('/:id/comment', authMiddleware, async (req, res) => {
  const { assignment_note } = req.body;
  const { id } = req.params;
  const userId = req.user.id;
  try {
    // 1. Mettre à jour le commentaire
    const result = await pool.query(
      'UPDATE tasks SET assignment_note = $1 WHERE id = $2 RETURNING *',
      [assignment_note, id]
    );

    const task = result.rows[0];

    // 2. Envoyer une notification seulement si la tâche a un créateur différent de l'utilisateur actuel
    if (task.created_by !== userId) {
      await pool.query(
        `INSERT INTO notifications 
         (user_id, sender_id, message, type, related_task_id, is_read) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          task.created_by,
          userId,
          `Un nouveau commentaire a été ajouté à votre tâche "${task.title}"`,
          'task',
          id,
          false
        ]
      );
    }

    res.json(task);
    await logActivity(userId, 'comment', 'task', id, {
      task_title: task.title,
      comment_length: assignment_note.length,
      comment_changed: oldComment !== assignment_note,
      previous_comment_length: oldComment.length
    });
  } catch (err) {
    console.error('Erreur lors de l\'ajout du commentaire :', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Ajoutez cette route dans workflow.js
router.post('/:taskId/upload-response', authMiddleware, upload.single('responseFile'), async (req, res) => {
  const { taskId } = req.params;
  const userId = req.user.id;
  const { comment } = req.body;
  const file_path = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    // 1. Vérifier que la tâche existe et est assignée à l'utilisateur
    const taskRes = await pool.query(
      'SELECT * FROM tasks WHERE id = $1 AND $2 = ANY(assigned_to)',
      [taskId, userId]
    );

    if (taskRes.rowCount === 0) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(403).json({ error: 'Tâche non trouvée ou non assignée à vous' });
    }

    const task = taskRes.rows[0];

    // 2. Enregistrer la réponse
    const result = await pool.query(
      `INSERT INTO task_responses 
       (task_id, user_id, file_path, comment, submitted_at) 
       VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
      [taskId, userId, file_path, comment]
    );

    // 3. Mettre à jour le statut de la tâche
    await pool.query(
      'UPDATE tasks SET status = $1 WHERE id = $2',
      ['completed', taskId]
    );

    // 4. Envoyer une notification au créateur de la tâche
    await pool.query(
      `INSERT INTO notifications 
       (user_id, sender_id, message, type, related_task_id, is_read) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        task.created_by, // ID du créateur
        userId,          // ID de l'utilisateur qui répond
        `Une réponse a été ajoutée à votre tâche "${task.title}"`,
        'task',
        taskId,
        false
      ]
    );

    res.status(201).json(result.rows[0]);
    // Ajoutez ceci
    await logActivity(req.user.id, 'task_response', 'task', taskId, {
      has_file: !!file_path,
      comment_length: comment?.length || 0
    });
  } catch (err) {
    console.error('Erreur lors de l\'enregistrement de la réponse:', err);
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/:id/complete', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    // 1. Marquer la tâche comme complétée
    const result = await pool.query(
      `UPDATE tasks 
       SET status = 'completed', 
           completed_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Tâche non trouvée' });
    }

    const completedTask = result.rows[0];

    // 2. Trouver et débloquer les tâches qui dépendent de celle-ci
    const dependentTasks = await pool.query(
      `SELECT id FROM tasks 
       WHERE depends_on = $1 
       AND status = 'blocked'`,
      [id]
    );

    for (const task of dependentTasks.rows) {
      await pool.query(
        `UPDATE tasks 
         SET status = 'pending' 
         WHERE id = $1`,
        [task.id]
      );

      // Notifier les utilisateurs assignés aux tâches débloquées
      const taskWithAssignee = await pool.query(
        `SELECT assigned_to FROM tasks WHERE id = $1`,
        [task.id]
      );

      if (taskWithAssignee.rows[0]?.assigned_to?.length > 0) {
        await pool.query(
          `INSERT INTO notifications (
            user_id, 
            sender_id, 
            message, 
            type, 
            related_task_id,
            is_read
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            taskWithAssignee.rows[0].assigned_to[0],
            userId,
            `Une nouvelle tâche vous a été assignée :`,
            'task',
            task.id,
            false
          ]
        );
      }
    }

    res.json({ 
      success: true,
      message: 'Tâche complétée avec succès',
      unlockedTasks: dependentTasks.rowCount
    });
 await logActivity(req.user.id, 'complete', 'task', id, {
      unlocked_tasks_count: dependentTasks.rowCount
    });
  } catch (err) {
    console.error('Erreur lors de la complétion de la tâche:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Nouvelle route pour gérer les notifications de refus
router.post('/:id/notify-rejection', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  try {
    // 1. Récupérer les infos de la tâche
    const taskRes = await pool.query(
      `SELECT t.*, w.created_by as creator_id, 
       u.name as creator_name, u.prenom as creator_prenom
       FROM tasks t
       JOIN workflow w ON t.workflow_id = w.id
       JOIN users u ON w.created_by = u.id
       WHERE t.id = $1`,
      [id]
    );

    if (taskRes.rowCount === 0) {
      return res.status(404).json({ error: 'Tâche non trouvée' });
    }

    const task = taskRes.rows[0];

    // 2. Créer la notification
    await pool.query(
      `INSERT INTO notifications 
       (user_id, sender_id, message, type, related_task_id, is_read) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        task.creator_id,
        req.user.id,
        `Votre tâche "${task.title}" a été refusée. Raison: ${reason}`,
        'task_rejected',
        id,
        false
      ]
    );

    res.json({ success: true });
    // Ajoutez ceci
    await logActivity(req.user.id, 'task_rejection', 'task', id, {
      rejection_reason: reason
    });
  } catch (err) {
    console.error('Erreur notification de refus:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;