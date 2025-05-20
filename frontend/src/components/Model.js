// models.js

export const WorkflowStatus = ['Pending', 'InProgress', 'Completed', 'Cancelled'];
export const TaskPriority = ['Low', 'Medium', 'High'];
export const TaskStatus = ['Open', 'InProgress', 'Done'];

// Exemple d'un template de workflow
export const sampleWorkflowTemplate = {
  id: 1,
  name: "Demande d'achat",
  description: "Processus de validation pour les achats",
  version: "v1.0",
  color: "#3498db"
};

// Exemple d'une instance de workflow
export const sampleWorkflowInstance = {
  id: "wf-001",
  templateId: 1,
  initiator: "utilisateur1",
  startDate: "2025-04-30",
  dueDate: "2025-05-07",
  status: "Pending",
  assignees: ["utilisateur2", "utilisateur3"],
  slaDeadline: "2025-05-05"
};

// Exemple d'une tâche
export const sampleTask = {
  id: "task-001",
  instanceId: "wf-001",
  title: "Validation du devis",
  description: "Valider le devis reçu du fournisseur",
  dueDate: "2025-05-02",
  priority: "High",
  assignedTo: ["utilisateur2"],
  status: "Open",
  comments: [
    {
      id: "comment-001",
      author: "utilisateur2",
      message: "En attente de signature du manager",
      timestamp: "2025-04-30T10:00:00Z"
    }
  ],
  attachments: [], // À gérer dans le frontend comme tableau de fichiers
  tags: ["achat", "urgent"],
  createdAt: "2025-04-30T09:00:00Z",
  updatedAt: "2025-04-30T10:30:00Z"
};
