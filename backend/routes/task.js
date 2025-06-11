const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');
const { logWorkflowAction } = require('../utils/log');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { analyzeWorkflowWithGemini } = require('./gimini');
const { getWorkflowFromDB } = require('./service');
const { assignTasksAutomatically} = require('../controllers/authController');


// ➕ Ajouter un workflow
router.post('/', async (req, res) => {
  const { name, description, echeance, status, priorite, created_by, documentId } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO workflow (name, description, echeance, status, priorite, created_by, document_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, description, echeance, status, priorite, created_by, documentId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de l\'ajout du workflow' });
  }
});

// 🔁 Modifier un workflow
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, echeance, status, priorite } = req.body;
  try {
    const result = await pool.query(
      `UPDATE workflow
       SET name = $1, description = $2, echeance = $3, status = $4, priorite = $5
       WHERE id = $6 RETURNING *`,
      [name, description, echeance, status, priorite, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la modification du workflow' });
  }
});

// ❌ Supprimer un workflow
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM workflow WHERE id = $1', [id]);
    res.json({ message: 'Workflow supprimé avec succès' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la suppression du workflow' });
  }
});

// Dans task.js
router.get('/document/:documentId/versions', authMiddleware, async (req, res) => {
  const { documentId } = req.params;
  
  try {
    const result = await pool.query(`
      SELECT 
        w.*,
        d.version as document_version,
        COUNT(t.id) as task_count,
        COUNT(t.id) FILTER (WHERE t.status = 'completed') as completed_tasks
      FROM workflow w
      JOIN documents d ON w.document_id = d.id
      LEFT JOIN tasks t ON w.id = t.workflow_id
      WHERE d.original_id = $1 OR d.id = $1
      GROUP BY w.id, d.version
      ORDER BY d.version DESC
    `, [documentId]);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur récupération versions:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route pour 'mes-workflows'
router.get('/mes-workflows', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM workflow WHERE created_by = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 📄 Récupérer tous les workflows avec le nombre de tâches
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT w.*, COUNT(t.id) AS progression
      FROM workflow w
      LEFT JOIN tasks t ON w.id = t.workflow_id
      GROUP BY w.id
      ORDER BY w.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la récupération des workflows' });
  }
});

function escapeXml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

router.get('/:id/bpmn', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
  `SELECT t.*, u.role as user_role, t.depends_on
   FROM tasks t
   LEFT JOIN unnest(t.assigned_to) WITH ORDINALITY AS a(user_id, ord) ON true
   LEFT JOIN users u ON u.id = a.user_id
   WHERE t.workflow_id = $1 
   ORDER BY t.task_order ASC, t.due_date ASC, t.id ASC`,
  [id]
);

    const tasks = result.rows;
    if (tasks.length === 0) {
      return res.status(404).json({ error: 'Aucune tâche trouvée pour ce workflow.' });
    }

    // Positionnement des éléments
    let currentX = 200;
    const taskPositions = [];
    const gatewayPositions = [];
    const verticalSpacing = 150;
    const horizontalSpacing = 250; // Augmenté pour plus d'espace

    // Calcul des positions
    tasks.forEach((task, index) => {
      taskPositions.push(currentX);
      currentX += horizontalSpacing;
    });

    // XML de base
    let bpmnXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_${id}"
                  targetNamespace="http://bpmn.io/schema/bpmn">

  <bpmn:process id="workflow_${id}" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="Début"/>`;

    // Ajout des tâches avec rôle utilisateur
    tasks.forEach(task => {
      const taskTitle = escapeXml(task.title);
      const roleInfo = task.user_role ? ` (${task.user_role})` : '';
      bpmnXml += `\n    <bpmn:task id="Task_${task.id}" name="${taskTitle}${roleInfo}"/>`;
    });

    // Ajout des éléments de fin
    bpmnXml += `\n    <bpmn:task id="Task_Notify_Reject" name="Notifier le créateur de refus"/>`;
    bpmnXml += `\n    <bpmn:endEvent id="EndEvent_Reject" name="Fin (rejet)"/>`;
    bpmnXml += `\n    <bpmn:endEvent id="EndEvent_Success" name="Fin (succès)"/>`;

    // Ajout des gateways XOR après chaque tâche
    tasks.forEach((task, index) => {
      const gatewayId = `Gateway_${task.id}`;
      bpmnXml += `\n    <bpmn:exclusiveGateway id="${gatewayId}" name="accept?"/>`;
      
      // Flux d'approbation
      const nextTarget = index < tasks.length - 1 
        ? `Task_${tasks[index + 1].id}` 
        : 'EndEvent_Success';
      
      bpmnXml += `\n    <bpmn:sequenceFlow id="flow_${task.id}_approved" sourceRef="${gatewayId}" targetRef="${nextTarget}">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">\${approved == true}</bpmn:conditionExpression>
    </bpmn:sequenceFlow>`;
      
      // Flux de rejet
      bpmnXml += `\n    <bpmn:sequenceFlow id="flow_${task.id}_rejected" sourceRef="${gatewayId}" targetRef="Task_Notify_Reject">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">\${approved == false}</bpmn:conditionExpression>
    </bpmn:sequenceFlow>`;
    });

    // Flux de notification vers fin rejet
    bpmnXml += `\n    <bpmn:sequenceFlow id="flow_notify_end" sourceRef="Task_Notify_Reject" targetRef="EndEvent_Reject"/>`;

    // Flux de démarrage
    bpmnXml += `\n    <bpmn:sequenceFlow id="flow_start" sourceRef="StartEvent_1" targetRef="Task_${tasks[0].id}"/>`;

    // Flux entre tâches et leurs gateways
    tasks.forEach((task, index) => {
      bpmnXml += `\n    <bpmn:sequenceFlow id="flow_task_${task.id}_to_gateway" sourceRef="Task_${task.id}" targetRef="Gateway_${task.id}"/>`;
    });

    // Partie diagramme
    bpmnXml += `
  </bpmn:process>

  <bpmndi:BPMNDiagram id="BPMNDiagram_${id}">
    <bpmndi:BPMNPlane id="BPMNPlane_${id}" bpmnElement="workflow_${id}">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="100" y="100" width="36" height="36"/>
      </bpmndi:BPMNShape>`;

    // Positionnement des tâches
    tasks.forEach((task, i) => {
      const x = taskPositions[i];
      bpmnXml += `
      <bpmndi:BPMNShape id="Task_${task.id}_di" bpmnElement="Task_${task.id}">
        <dc:Bounds x="${x}" y="100" width="150" height="80"/> <!-- Largeur augmentée -->
      </bpmndi:BPMNShape>`;
      
      // Gateway après chaque tâche
      const gatewayX = x + 175;
      gatewayPositions.push({ x: gatewayX, taskId: task.id });
      bpmnXml += `
      <bpmndi:BPMNShape id="Gateway_${task.id}_di" bpmnElement="Gateway_${task.id}" isMarkerVisible="true">
        <dc:Bounds x="${gatewayX}" y="115" width="50" height="50"/>
      </bpmndi:BPMNShape>`;
    });

    // Notification et fins
    const notifyX = currentX - 150;
    bpmnXml += `
      <bpmndi:BPMNShape id="Task_Notify_Reject_di" bpmnElement="Task_Notify_Reject">
        <dc:Bounds x="${notifyX}" y="250" width="150" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_Reject_di" bpmnElement="EndEvent_Reject">
        <dc:Bounds x="${notifyX + 75}" y="350" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_Success_di" bpmnElement="EndEvent_Success">
        <dc:Bounds x="${currentX}" y="100" width="36" height="36"/>
      </bpmndi:BPMNShape>`;

    // Connexions avec des flèches plus longues
    bpmnXml += `
      <bpmndi:BPMNEdge id="flow_start_edge" bpmnElement="flow_start">
        <di:waypoint x="136" y="118"/>
        <di:waypoint x="${taskPositions[0]}" y="140"/>
      </bpmndi:BPMNEdge>`;

    // Connexions tâches -> gateways
    tasks.forEach((task, i) => {
      const taskX = taskPositions[i] + 150;
      const gatewayX = taskPositions[i] + 175;
      bpmnXml += `
      <bpmndi:BPMNEdge id="flow_task_${task.id}_edge" bpmnElement="flow_task_${task.id}_to_gateway">
        <di:waypoint x="${taskX}" y="140"/>
        <di:waypoint x="${gatewayX}" y="140"/>
      </bpmndi:BPMNEdge>`;
    });

    // Connexions gateways -> suites avec des flèches plus longues
    tasks.forEach((task, i) => {
      const gatewayX = taskPositions[i] + 200;
      
      // Approbation -> tâche suivante ou fin succès
      if (i < tasks.length - 1) {
        const nextTaskX = taskPositions[i+1];
        bpmnXml += `
      <bpmndi:BPMNEdge id="flow_${task.id}_approved_edge" bpmnElement="flow_${task.id}_approved">
        <di:waypoint x="${gatewayX}" y="140"/>
        <di:waypoint x="${nextTaskX}" y="140"/>
      </bpmndi:BPMNEdge>`;
      } else {
        // Dernière tâche -> fin succès
        bpmnXml += `
      <bpmndi:BPMNEdge id="flow_${task.id}_approved_edge" bpmnElement="flow_${task.id}_approved">
        <di:waypoint x="${gatewayX}" y="140"/>
        <di:waypoint x="${currentX}" y="118"/>
      </bpmndi:BPMNEdge>`;
      }
      
      // Rejet -> notification (flèche plus longue et courbée)
      bpmnXml += `
      <bpmndi:BPMNEdge id="flow_${task.id}_rejected_edge" bpmnElement="flow_${task.id}_rejected">
        <di:waypoint x="${gatewayX}" y="165"/>
        <di:waypoint x="${gatewayX}" y="220"/>
        <di:waypoint x="${notifyX + 75}" y="220"/>
        <di:waypoint x="${notifyX + 75}" y="250"/>
      </bpmndi:BPMNEdge>`;
    });

    // Notification -> fin rejet
    bpmnXml += `
      <bpmndi:BPMNEdge id="flow_notify_end_edge" bpmnElement="flow_notify_end">
        <di:waypoint x="${notifyX + 75}" y="330"/>
        <di:waypoint x="${notifyX + 75}" y="350"/>
      </bpmndi:BPMNEdge>`;

    bpmnXml += `
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

    res.set('Content-Type', 'application/xml');
    res.send(bpmnXml);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la génération BPMN.' });
  }
});

// Modifier la route de réassignation :
// Modifier la route comme ceci :
router.post('/:workflowId/tasks/:taskId/reassign', authMiddleware, async (req, res) => {
  const { workflowId, taskId } = req.params;
  const { newAssigneeId, reason } = req.body;
  const userId = req.user.id;

  try {
    // 1. Vérifier que la tâche existe et appartient au workflow
    const taskRes = await pool.query(
      'SELECT * FROM tasks WHERE id = $1 AND workflow_id = $2',
      [taskId, workflowId]
    );

    if (taskRes.rowCount === 0) {
      return res.status(404).json({ error: 'Tâche non trouvée dans ce workflow' });
    }

    // 2. Vérifier que le nouvel assigné existe
    const userRes = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [newAssigneeId]
    );

    if (userRes.rowCount === 0) {
      return res.status(400).json({ error: 'Utilisateur assigné non trouvé' });
    }

    // 3. Mettre à jour la tâche avec le nouveau statut
    await pool.query(
      `UPDATE tasks 
       SET 
         assigned_to = $1,
         status = 'pending', // Réinitialiser le statut
         assignment_note = COALESCE(assignment_note, '') || $2,
         updated_at = NOW()
       WHERE id = $3`,
      [[newAssigneeId], `\nRéassignée le ${new Date().toLocaleString()} par ${userId}. Raison: ${reason || 'non spécifiée'}\n`, taskId]
    );

    // 4. Journaliser l'action
    await logWorkflowAction(
      workflowId,
      `Tâche ${taskId} réassignée à ${newAssigneeId} par ${userId}`,
      'reassignment'
    );

    res.json({ success: true, message: 'Tâche réassignée avec succès' });

  } catch (err) {
    console.error('Erreur de réassignation:', err);
    res.status(500).json({ error: 'Erreur lors de la réassignation' });
  }
});

// GET /api/workflows/archives - Récupère tous les workflows archivés
router.get('/archives', authMiddleware, async (req, res) => {
  try {
    // Requête pour récupérer les archives avec des statistiques de base
    const result = await pool.query(`
      SELECT 
        wa.*,
        w.created_at as workflow_created_at,
        COUNT(t.id) as total_tasks,
        COUNT(t.id) FILTER (WHERE t.status = 'completed') as completed_tasks,
        u.name as creator_name,
        u.prenom as creator_prenom,
        d.name as document_title
      FROM 
        workflow_archive wa
        LEFT JOIN workflow w ON wa.workflow_id = w.id
        LEFT JOIN tasks t ON w.id = t.workflow_id
        LEFT JOIN users u ON wa.created_by = u.id
        LEFT JOIN documents d ON wa.document_id = d.id
      GROUP BY 
        wa.id, w.created_at, u.name, u.prenom, d.name
      ORDER BY 
        wa.completed_at DESC
    `);

    // Formater les données pour le frontend
    const archives = result.rows.map(archive => ({
      id: archive.id,
      workflow_id: archive.workflow_id,
      document_id: archive.document_id,
      document_title: archive.document_title,
      name: archive.name,
      description: archive.description,
      created_by: archive.created_by,
      creator: `${archive.creator_prenom} ${archive.creator_name}`,
      completed_at: archive.completed_at,
      validation_report: archive.validation_report,
      stats: {
        total_tasks: archive.total_tasks,
        completed_tasks: archive.completed_tasks,
        completion_rate: archive.total_tasks > 0 
          ? Math.round((archive.completed_tasks / archive.total_tasks) * 100) 
          : 0
      },
      workflow_created_at: archive.workflow_created_at,
      workflow_duration: archive.completed_at 
        ? Math.ceil((new Date(archive.completed_at) - new Date(archive.workflow_created_at)) / (1000 * 60 * 60 * 24))
        : null
    }));

    res.json(archives);
  } catch (err) {
    console.error('Erreur lors de la récupération des archives:', err);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des archives',
      details: err.message
    });
  }
});

// routes/workflow.js (extrait)
router.get('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    // 1) Récupère le workflow
    const wfRes = await pool.query(
      'SELECT * FROM workflow WHERE id = $1',
      [id]
    );
    if (!wfRes.rowCount) {
      return res.status(404).json({ error: 'Workflow non trouvé' });
    }
    const workflow = wfRes.rows[0];

    // 2) Récupère les étapes associées
    const stepsRes = await pool.query(
      'SELECT * FROM tasks WHERE workflow_id = $1 ORDER BY due_date ASC, id ASC',
      [id]
    );
    // mappe les champs pour qu’ils correspondent à { id, name, status, … }
    const steps = stepsRes.rows.map(row => ({
      id:        row.id,
      name:      row.title,
      status:    row.status,
      // ajoute ici tout autre champ que tu veux afficher
    }));

    // 3) Renvoie l’objet attendu par le front
    return res.json({ workflow, steps });
  } catch (err) {
    console.error('GET /api/workflows/:id error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// routes/workflow.js
router.post('/:id/steps/:stepId/complete', authMiddleware, async (req, res) => {
  const { id, stepId } = req.params;
  const userId = req.user.id;

  try {
    // Marquer l'étape comme complétée
    await pool.query(
      'UPDATE tasks SET status = $1, completed_at = NOW() WHERE id = $2 AND workflow_id = $3',
      ['completed', stepId, id]
    );

    // Enregistrer le log
    const message = `Étape ${stepId} complétée par l'utilisateur ${userId}`;
    await logWorkflowAction(id, message);

    // Mettre à jour le statut du workflow
    const workflowStatus = await updateWorkflowStatus(id);

    res.status(200).json({ 
      message: 'Étape complétée avec succès.',
      workflowStatus: workflowStatus || 'unchanged'
    });
  } catch (err) {
    console.error('Erreur lors de la complétion de l\'étape :', err);
    res.status(500).json({ error: 'Impossible de compléter l\'étape.' });
  }
});

// Après les autres imports
// On suppose que tu as une table `workflow_logs(workflow_id, message, timestamp)`
router.get('/:id/logs', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const logsRes = await pool.query(
      'SELECT message, timestamp FROM workflow_logs WHERE workflow_id = $1 ORDER BY timestamp DESC',
      [id]
    );
    return res.json(logsRes.rows);
  } catch (err) {
    console.error('GET /api/workflows/:id/logs error:', err);
    return res.status(500).json({ error: 'Impossible de récupérer les logs.' });
  }
});

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
// Exemple : POST /api/workflows/:id/generate-tasks
router.post("/:id/generate-tasks", authMiddleware, async (req, res) => {
  const workflowId = req.params.id;

  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt requis pour générer les tâches." });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Nettoyage du texte Gemini
    const cleanedText = text.replace(/```json|```/g, "").trim();

    let tasks = [];
    try {
      tasks = JSON.parse(cleanedText);
      
      // Corriger les dates passées
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      tasks.forEach(task => {
        // Marquer le type de tâche
        if (task.title.toLowerCase().includes('validation') || task.title.toLowerCase().includes('approval')) {
          task.type = 'validation';
        } else {
          task.type = 'operation';
        }
        
        // Corriger la date si elle est dans le passé
        if (task.due_date) {
          const dueDate = new Date(task.due_date);
          if (dueDate < today) {
            // Ajouter 7 jours à la date actuelle comme date par défaut
            const newDate = new Date();
            newDate.setDate(newDate.getDate() + 7);
            task.due_date = newDate.toISOString().split('T')[0];
          }
        } else {
          // Si pas de date, en ajouter une par défaut (7 jours dans le futur)
          const newDate = new Date();
          newDate.setDate(newDate.getDate() + 7);
          task.due_date = newDate.toISOString().split('T')[0];
        }
      });
    } catch (err) {
      console.error("Erreur de parsing JSON:", err);
      return res.status(500).json({ error: "Réponse mal formatée par Gemini." });
    }

    // Insertion dans la base PostgreSQL
    const insertedTasks = [];

    for (const task of tasks) {
      const { title, description, due_date, type } = task;

      const result = await pool.query(
        `INSERT INTO tasks (title, description, due_date, workflow_id, type)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [title, description || "", due_date || null, workflowId, type || 'operation']
      );

      insertedTasks.push(result.rows[0]);
    }

    res.status(201).json({ message: "Tâches générées et enregistrées avec succès.", tasks: insertedTasks });
  } catch (error) {
    console.error("Erreur lors de la génération ou insertion :", error);
    res.status(500).json({ error: "Erreur serveur lors de la génération de tâches." });
  }
});

// Route pour analyser les logs avec Gemini
  router.post('/:id/analyze-logs', authMiddleware, async (req, res) => {
    try {

      const { workflowId } = req.params; // Récupération depuis les paramètres d'URL
    const { prompt } = req.body;

    if (!workflowId) {
      return res.status(400).json({ 
        success: false, 
        message: "Workflow ID est requis" 
      });
    }
      
      // Récupération du workflow
      const workflow = await getWorkflowFromDB(workflowId);
  
      // Analyse avec Gemini
      const analysis = await analyzeWorkflowWithGemini(prompt, {
        name: workflow.name,
        description: workflow.description,
        status: workflow.status,
        stepsCount: workflow.steps.length
      });
  
      res.json({ 
        success: true,
        analysis: analysis
      });
      
    } catch (error) {
      console.error('Erreur analyse logs:', error);
      res.status(500).json({
        success: false,
        message: error.message || "Échec de l'analyse des logs"
      });
    }
  });

  router.patch('/:id/force-status', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const allowed = ['completed', 'rejected'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Statut non autorisé.' });
  }

  try {
    const result = await pool.query(
      `UPDATE workflow SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );
    res.json({ workflowStatus: result.rows[0].status });
  } catch (err) {
    console.error('Erreur mise à jour status workflow:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});


  // Fonction pour mettre à jour le statut du workflow en fonction des tâches
async function updateWorkflowStatus(workflowId) {
  try {
    console.log('⏳ Mise à jour du statut du workflow ID:', workflowId);

    const tasksRes = await pool.query(
      'SELECT status FROM tasks WHERE workflow_id = $1',
      [workflowId]
    );

    const tasks = tasksRes.rows;
    console.log('🧩 Statuts des tâches:', tasks);

    if (tasks.length === 0) {
      console.log('❌ Aucune tâche trouvée pour ce workflow');
      return;
    }

    const hasRejected = tasks.some(task => task.status === 'rejected');
    const allCompleted = tasks.every(task => task.status === 'completed');

    let newStatus = null;

    if (hasRejected) {
      newStatus = 'rejected';
    } else if (allCompleted) {
      newStatus = 'completed';
    }

    if (newStatus) {
      const updateRes = await pool.query(
        'UPDATE workflow SET status = $1 WHERE id = $2',
        [newStatus, workflowId]
      );
      console.log(`✅ Workflow mis à jour vers "${newStatus}". Lignes affectées:`, updateRes.rowCount);
    } else {
      console.log('📌 Aucune mise à jour nécessaire du workflow.');
    }

    return newStatus;

  } catch (err) {
    console.error('💥 Erreur dans updateWorkflowStatus:', err);
    throw err;
  }
}


  // Route pour mettre à jour le statut d'un workflow
router.patch('/:id/status', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const result = await pool.query(`
      UPDATE tasks
      SET status = $1,
          completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END,
          rejected_at = CASE WHEN $1 = 'rejected' THEN NOW() ELSE rejected_at END
      WHERE id = $2
      RETURNING *`, [status, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Tâche non trouvée' });
    }

    const workflowId = result.rows[0].workflow_id;
    const workflowStatus = await updateWorkflowStatus(workflowId); // ta fonction JS

    res.status(200).json({
      message: 'Tâche mise à jour avec succès',
      task: result.rows[0],
      workflowStatus: workflowStatus || 'unchanged'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});




router.get('/document/:documentId', authMiddleware, async (req, res) => {
  const { documentId } = req.params;
  
  try {
    // 1. D'abord vérifier le document lui-même
    const docResult = await pool.query(
      'SELECT id, original_id FROM documents WHERE id = $1',
      [documentId]
    );
    
    if (docResult.rowCount === 0) {
      return res.status(404).json({ message: 'Document non trouvé' });
    }
    
    const doc = docResult.rows[0];
    let workflowIdToCheck = doc.id;
    
    // 2. Si c'est une nouvelle version, vérifier le document original
    if (doc.original_id) {
      workflowIdToCheck = doc.original_id;
    }
    
    // 3. Vérifier le workflow
    const result = await pool.query(
      'SELECT * FROM workflow WHERE document_id = $1 LIMIT 1',
      [workflowIdToCheck]
    );
    
    if (result.rows.length > 0) {
      res.json({ 
        exists: true, 
        workflow: result.rows[0] 
      });
    } else {
      res.json({ exists: false });
    }
  } catch (err) {
    console.error('Erreur DB:', err);
    res.status(500).json({ 
      message: 'Erreur serveur',
      error: err.message
    });
  }
});

// GET /api/workflows/:id/tasks - Récupère toutes les tâches d'un workflow spécifique
// Récupérer toutes les tâches d'un workflow spécifique
    router.get('/:id/tasks', authMiddleware, async (req, res) => {
  const { id } = req.params;
  
  // Validation de l'ID
  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ 
      error: 'ID de workflow invalide',
      received: id
    });
  }

  try {
    // Le reste de votre code existant...
    const workflowRes = await pool.query(
      'SELECT id FROM workflow WHERE id = $1', 
      [parseInt(id)] // Conversion explicite en nombre
    );
    
  if (workflowRes.rowCount === 0) {
      return res.status(404).json({ error: 'Workflow non trouvé' });
    }
    // 2. Récupérer les tâches avec les informations des utilisateurs assignés
    const tasksRes = await pool.query(
      `SELECT 
        t.id,
        t.title,
        t.description,
        t.due_date,
        t.priority,
        t.status,
        t.file_path,
        t.assigned_to,
        t.created_at,
        t.assignment_note,
        jsonb_agg(
          jsonb_build_object(
            'id', u.id,
            'name', u.name,
            'prenom', u.prenom,
            'email', u.email
          )
        ) FILTER (WHERE u.id IS NOT NULL) as assigned_users
       FROM tasks t
       LEFT JOIN unnest(t.assigned_to) WITH ORDINALITY AS a(user_id, ord) ON true
       LEFT JOIN users u ON u.id = a.user_id
       WHERE t.workflow_id = $1
       GROUP BY t.id
       ORDER BY 
         CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
         t.due_date ASC,
         t.id ASC`,
      [id]
    );

    // 3. Formater la réponse
    const tasks = tasksRes.rows.map(task => ({
      ...task,
      due_date: task.due_date ? new Date(task.due_date).toISOString() : null,
      assigned_users: task.assigned_users || []
    }));

    res.json(tasks);
    
  } catch (err) {
    console.error('Erreur dans GET /api/workflows/:id/tasks:', err);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des tâches',
      details: err.message 
    });
  }
});

// Route PATCH pour mettre à jour partiellement un workflow
router.patch('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    // Vérifier d'abord si le workflow existe
    const checkRes = await pool.query(
      'SELECT * FROM workflow WHERE id = $1',
      [id]
    );
    
    if (checkRes.rowCount === 0) {
      return res.status(404).json({ error: 'Workflow non trouvé' });
    }

    // Construire dynamiquement la requête de mise à jour
    const fields = [];
    const values = [];
    let paramIndex = 1;

    // Liste des champs autorisés à être mis à jour
    const allowedFields = ['name', 'description', 'echeance', 'status', 'priorite'];
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    // Si aucun champ valide n'a été fourni
    if (fields.length === 0) {
      return res.status(400).json({ 
        error: 'Aucun champ valide fourni pour la mise à jour',
        allowedFields: allowedFields
      });
    }

    // Ajouter la date de mise à jour
    fields.push(`updated_at = NOW()`);

    // Construire et exécuter la requête finale
    const queryText = `
      UPDATE workflow
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    values.push(id);

    const result = await pool.query(queryText, values);
    
    // Enregistrer l'action dans les logs
    const user = req.user; // Récupéré depuis authMiddleware
    const message = `Workflow mis à jour par ${user.name} ${user.prenom}`;
    await logWorkflowAction(id, message);

    res.json({
      success: true,
      workflow: result.rows[0],
      message: 'Workflow mis à jour avec succès'
    });

  } catch (err) {
    console.error('Erreur lors de la mise à jour du workflow:', err);
    res.status(500).json({ 
      error: 'Erreur lors de la mise à jour du workflow',
      details: err.message 
    });
  }
});

// routes/task.js
router.post('/:id/archive', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { validation_report } = req.body;

  try {
     // Vérifier si déjà archivé
     const existingArchive = await pool.query(
      'SELECT * FROM workflow_archive WHERE workflow_id = $1',
      [id]
    );
    
    if (existingArchive.rowCount > 0) {
      return res.status(400).json({ error: 'Ce workflow est déjà archivé' });
    }
    
    // 1. Vérifier que le workflow est terminé
    const workflowRes = await pool.query(
      'SELECT * FROM workflow WHERE id = $1 AND status = $2',
      [id, 'completed']
    );

    if (workflowRes.rowCount === 0) {
      return res.status(400).json({ error: 'Le workflow doit être terminé pour être archivé' });
    }

    // 2. Créer l'archive
    const archiveRes = await pool.query(
      `INSERT INTO workflow_archive 
       (workflow_id, name, description, document_id, created_by, completed_at, validation_report)
       SELECT id, name, description, document_id, created_by, NOW(), $1
       FROM workflow WHERE id = $2 RETURNING *`,
      [validation_report, id]
    );

    // 3. Marquer le document comme archivé (optionnel)
    await pool.query(
      'UPDATE documents SET is_archived = true WHERE id = $1',
      [workflowRes.rows[0].document_id]
    );

    res.json(archiveRes.rows[0]);
  } catch (err) {
    console.error('Erreur lors de l\'archivage:', err);
    res.status(500).json({ error: 'Erreur lors de l\'archivage' });
  }
});


router.post("/:id/assign-tasks", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params; // ID du workflow
    const userId = req.user.id; // ID de l'utilisateur authentifié

    // 1. Vérifier que l'utilisateur a le droit d'assigner des tâches
    const userCheck = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [userId]
    );
    
    if (userCheck.rows.length === 0 || !['admin', 'manager'].includes(userCheck.rows[0].role)) {
      return res.status(403).json({ 
        success: false,
        message: "Permission refusée" 
      });
    }

    // 2. Récupérer les tâches non assignées de ce workflow
   const tasksResult = await pool.query(
  `SELECT * FROM tasks 
   WHERE workflow_id = $1 
   AND (assigned_to IS NULL OR cardinality(assigned_to) = 0)`,
  [id]
);

    
    const tasks = tasksResult.rows;
    
    if (!tasks || tasks.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: "Aucune tâche à assigner" 
      });
    }

    // 3. Récupérer les stats des utilisateurs
    const usersStats = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.prenom,
        u.role,
        COALESCE(SUM(s.duration), 0) as total_duration
      FROM users u
      LEFT JOIN sessions s ON u.id = s.user_id
      GROUP BY u.id
      ORDER BY total_duration ASC
    `);

    // 4. Préparer les utilisateurs disponibles par rôle
    const availableUsers = {
      employe: usersStats.rows.filter(u => u.role === 'employe'),
      directeur: usersStats.rows.find(u => u.role === 'directeur'),
      manager: usersStats.rows.filter(u => u.role === 'manager')
    };

    // 5. Assigner les tâches
    const assignments = [];
    
    for (const task of tasks) {
      try {
        let assignedUser = null;
        
        // Tâches de validation -> Directeur
        if (task.title.toLowerCase().includes('validation') || task.type === 'validation') {
          assignedUser = availableUsers.directeur;
        } 
        // Tâches de gestion -> Manager
        else if (task.title.toLowerCase().includes('gestion') || task.type === 'management') {
          assignedUser = availableUsers.manager.length > 0 
            ? availableUsers.manager[0] 
            : null;
        }
        // Tâches normales -> Employé le moins occupé
        else {
          assignedUser = availableUsers.employe.length > 0 
            ? availableUsers.employe[0] 
            : null;
        }

        if (assignedUser) {
          await pool.query(
  `UPDATE tasks SET assigned_to = $1 WHERE id = $2`,
  [[assignedUser.id], task.id]
);

          
          assignments.push({
            taskId: task.id,
            taskTitle: task.title,
            assignedTo: assignedUser.id,
            assignedName: `${assignedUser.prenom} ${assignedUser.name}`
          });

          // Mettre à jour la liste des disponibles (rotation)
          if (!['directeur', 'manager'].includes(assignedUser.role)) {
            availableUsers.employe.push(availableUsers.employe.shift());
          }
        }
      } catch (taskErr) {
        console.error(`Erreur sur la tâche ${task.id}:`, taskErr);
      }
    }

    // 6. Retourner le résultat
    if (assignments.length > 0) {
      return res.json({
        success: true,
        message: `${assignments.length}/${tasks.length} tâches assignées`,
        assignments
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Aucune tâche n'a pu être assignée"
      });
    }

  } catch (err) {
    console.error("Erreur dans l'assignation automatique:", err);
    return res.status(500).json({ 
      success: false,
      message: "Erreur serveur lors de l'assignation",
      error: err.message
    });
  }
}); 


// Dans task.js, ajoutez cette nouvelle route avant module.exports

// Route pour générer des tâches prédéfinies selon le type de document
router.post('/:id/generate-from-template', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { documentType } = req.body;
  const userId = req.user.id; // Récupère l'ID de l'utilisateur connecté

  // Templates améliorés avec plus de détails
  const templates = {
    contrat: {
      workflowName: "Workflow de Contrat",
      workflowDescription: "Processus complet pour la création et validation des contrats",
      tasks: [
        { 
          title: "Vérification légale du contrat",
          description: "Vérifier les clauses légales avec le service juridique",
          type: "validation",
          priority: "high",
          role: "juriste",
          order: 1,
          durationDays: 2
        },
        { 
          title: "Signature des parties",
          description: "Obtenir les signatures des deux parties",
          type: "validation",
          priority: "high",
          role: "responsable commercial",
          order: 2,
          durationDays: 3,
          depends_on: 1
        },
        { 
          title: "Archivage du contrat",
          description: "Archiver le contrat signé dans le système",
          type: "validation",
          priority: "medium",
          role: "admin",
          order: 3,
          durationDays: 1,
          depends_on: 2
        }
      ]
    },
    facture: {
      workflowName: "Workflow de Facturation",
      workflowDescription: "Processus de validation et paiement des factures",
      tasks: [
        { 
          title: "Vérification de la facture",
          description: "Vérifier les montants et les références",
          type: "validation",
          priority: "medium",
          role: "comptable",
          order: 1,
          durationDays: 2
        },
        { 
          title: "Approbation de paiement",
          description: "Approbation par le responsable financier",
          type: "validation",
          priority: "high",
          role: "directeur financier",
          order: 2,
          durationDays: 2,
          depends_on: 1
        },
        { 
          title: "Enregistrement comptable",
          description: "Enregistrer la facture dans le système comptable",
          type: "validation",
          priority: "medium",
          role: "comptable",
          order: 3,
          durationDays: 1,
          depends_on: 2
        }
      ]
    },
    demande_conge: {
      workflowName: "Workflow de Demande de Congé",
      workflowDescription: "Processus de validation des demandes de congé",
      tasks: [
        { 
          title: "Vérification des droits",
          description: "Vérifier les droits à congé disponibles",
          type: "validation",
          priority: "low",
          role: "gestionnaire RH",
          order: 1,
          durationDays: 1
        },
        { 
          title: "Validation hiérarchique",
          description: "Validation par le manager direct",
          type: "validation",
          priority: "medium",
          role: "manager",
          order: 2,
          durationDays: 3,
          depends_on: 1
        },
        { 
          title: "Notification au service RH",
          description: "Notification finale au service RH",
          type: "validation",
          priority: "low",
          role: "gestionnaire RH",
          order: 3,
          durationDays: 1,
          depends_on: 2
        }
      ]
    },
  cv: {
  workflowName: "Workflow de Traitement de CV",
  workflowDescription: "Processus de réception, analyse et décision sur les CV des candidats",
  tasks: [
    {
        title: 'Analyse et évaluation du CV',
        description: 'Extraire les informations clés (compétences, expérience, etc.) et évaluer la pertinence du profil par rapport aux postes ouverts',
        type: 'validation',
        priority: "high",
        role: 'manager',
        order: 1,
        durationDays: 3 // tu peux ajuster selon ton estimation
      },
    {
      title: "Décision et archivage",
      description: "Décider d’une suite (entretien, réserve, rejet) et archiver le CV",
      type: "validation",
      priority: "medium",
      role: "gestionnaire RH",
      order: 2,
      durationDays: 1,
      depends_on: 1
    }
  ]
}
  };

  try {
    // 1. Vérifier que le workflow existe et appartient à l'utilisateur
    const workflowRes = await pool.query(
      'SELECT * FROM workflow WHERE id = $1 AND created_by = $2',
      [id, userId]
    );
    
    if (workflowRes.rowCount === 0) {
      return res.status(404).json({ 
        error: 'Workflow non trouvé ou non autorisé' 
      });
    }

    const workflow = workflowRes.rows[0];

    // 2. Mettre à jour les infos du workflow avec le template
    await pool.query(
      'UPDATE workflow SET name = $1, description = $2 WHERE id = $3',
       [
        `${templates[documentType].workflowName} #${id}`, // Ajout de l'ID du workflow au nom
        templates[documentType].workflowDescription,
        id
      ]
    );

    // 3. Récupérer les utilisateurs par rôle
    const usersByRole = {};
    const roles = [...new Set(templates[documentType].tasks.map(t => t.role))];
    
    for (const role of roles) {
      const usersRes = await pool.query(
        'SELECT id, name, prenom FROM users WHERE role = $1',
        [role]
      );
      usersByRole[role] = usersRes.rows;
    }

    // 4. Créer les tâches avec dépendances
    const insertedTasks = [];
    const taskMap = {}; 
    const today = new Date();
    
    function sortTasksWithDependencies(tasks) {
  const sorted = [];
  const visited = new Set();

  const taskMap = new Map(tasks.map(t => [t.order, t]));

  function visit(task) {
    if (visited.has(task.order)) return;
    if (task.depends_on) {
      const depTask = taskMap.get(task.depends_on);
      if (depTask) visit(depTask);
    }
    visited.add(task.order);
    sorted.push(task);
  }

  for (const task of tasks) {
    visit(task);
  }

  return sorted;
}

const sortedTemplates = sortTasksWithDependencies(templates[documentType].tasks);

    
    for (const taskTemplate of sortedTemplates) {
      const dueDate = new Date(today);
      dueDate.setDate(dueDate.getDate() + taskTemplate.durationDays);
      
      const availableUsers = usersByRole[taskTemplate.role];
      if (!availableUsers || availableUsers.length === 0) {
        console.error(`Aucun utilisateur trouvé pour le rôle: ${taskTemplate.role}`);
        continue;
      }

      const selectedUser = availableUsers[Math.floor(Math.random() * availableUsers.length)];
      const assignedTo = [selectedUser.id];

      // Déterminer le statut initial
      let initialStatus = 'pending';
      if (taskTemplate.depends_on) {
        initialStatus = 'blocked';
      }

      // Créer la tâche
      const result = await pool.query(
        `INSERT INTO tasks (
          title, 
          description, 
          due_date, 
          workflow_id, 
          type, 
          priority,
          assigned_to,
          status,
          depends_on,
          task_order,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [
          taskTemplate.title,
          taskTemplate.description,
          dueDate.toISOString().split('T')[0],
          id,
          taskTemplate.type,
          taskTemplate.priority,
          assignedTo,
          initialStatus,
          taskTemplate.depends_on ? taskMap[taskTemplate.depends_on] : null,
          taskTemplate.order,
          userId
        ]
      );

      const newTask = result.rows[0];
      taskMap[taskTemplate.order] = newTask.id;
      insertedTasks.push(newTask);

      // Envoyer une notification seulement si la tâche n'est pas bloquée
      if (initialStatus !== 'blocked') {
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
            selectedUser.id,
            userId,
            `Une nouvelle tâche vous a été assignée: "${taskTemplate.title}"`,
            'task',
            newTask.id,
            false
          ]
        );
      }
    }

    res.status(201).json({
      message: `Workflow "${templates[documentType].workflowName}" créé avec succès`,
      workflowId: id,
      tasks: insertedTasks.map(t => ({
        id: t.id,
        title: t.title,
        assigned_to: t.assigned_to,
        status: t.status,
        due_date: t.due_date
      }))
    });

  } catch (err) {
    console.error('Erreur génération workflow:', err);
    res.status(500).json({ 
      error: 'Erreur lors de la génération du workflow',
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

router.get('/:workflowId/responses', authMiddleware, async (req, res) => {
  try {
    const { workflowId } = req.params;

    const result = await pool.query(
      `SELECT tr.*
       FROM task_responses tr
       JOIN tasks t ON tr.task_id = t.id
       WHERE t.workflow_id = $1 
       ORDER BY tr.submitted_at DESC`,
      [workflowId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Erreur lors de la récupération des réponses du workflow:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


module.exports = router;