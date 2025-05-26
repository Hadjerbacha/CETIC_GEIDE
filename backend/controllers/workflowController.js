const Workflow = require('../models/Workflow');
const { sendNotification } = require('../services/notificationService');

// Démarrer un nouveau workflow
exports.startWorkflow = async (req, res) => {
  const { documentId, type } = req.body;
  
  try {
    // Modèles prédéfinis pour chaque type
    const workflowTemplates = {
      demande_conge: {
        steps: [
          { step_number: 1, role_required: 'manager', action_type: 'validation' },
          { step_number: 2, role_required: 'director', action_type: 'final_approval' }
        ]
      },
      facture: {
        steps: [
          { step_number: 1, role_required: 'comptabilite', action_type: 'verification' },
          { step_number: 2, role_required: 'finance', action_type: 'paiement' }
        ]
      }
    };

    const workflow = await Workflow.create({
      document_id: documentId,
      type,
      status: 'pending',
      created_by: req.user.id
    });

    // Créer les étapes
    const steps = await Promise.all(
      workflowTemplates[type].steps.map(async step => {
        const assignedUser = await getAssignee(step.role_required);
        return Workflow.createStep({
          ...step,
          workflow_id: workflow.id,
          assigned_to: assignedUser.id,
          status: step.step_number === 1 ? 'pending' : 'waiting'
        });
      })
    );

    // Notifier le premier acteur
    await sendNotification({
      userId: steps[0].assigned_to,
      message: `Nouvelle tâche de workflow (${type}) vous attend`,
      type: 'workflow_action'
    });

    res.status(201).json({ workflow, steps });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Suivi du workflow
exports.getWorkflowDetails = async (req, res) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    const steps = await Workflow.getSteps(workflow.id);
    const history = await Workflow.getHistory(workflow.id);
    
    res.json({
      ...workflow,
      steps,
      history,
      progress: (workflow.current_step / steps.length) * 100
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Traiter une étape
exports.processStep = async (req, res) => {
  const { action, comment } = req.body;
  
  try {
    const workflow = await Workflow.findById(req.params.workflowId);
    const currentStep = await Workflow.getCurrentStep(workflow.id);

    // Enregistrer l'action
    await Workflow.addHistory({
      workflow_id: workflow.id,
      step_id: currentStep.id,
      user_id: req.user.id,
      action,
      comment
    });

    // Mettre à jour le statut
    await Workflow.updateStep(currentStep.id, { 
      status: action === 'approve' ? 'approved' : 'rejected',
      completed_at: new Date()
    });

    if (action === 'approve') {
      // Passer à l'étape suivante
      const nextStep = await Workflow.getNextStep(workflow.id, currentStep.step_number);
      
      if (nextStep) {
        await Workflow.update(workflow.id, { current_step: nextStep.step_number });
        await Workflow.updateStep(nextStep.id, { status: 'pending' });
        
        // Notifier le prochain acteur
        await sendNotification({
          userId: nextStep.assigned_to,
          message: `Action requise pour le workflow ${workflow.name}`,
          type: 'workflow_action'
        });
      } else {
        // Workflow complet
        await Workflow.update(workflow.id, { 
          status: 'completed',
          current_step: null
        });
      }
    } else {
      // Workflow rejeté
      await Workflow.update(workflow.id, { status: 'rejected' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};