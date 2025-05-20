// src/utils/workflowUtils.js

/**
 * Détermine le statut global d'un workflow à partir de ses tâches.
 */
const getWorkflowStatus = (tasks, workflowId) => {
    const workflowTasks = tasks.filter(task => task.workflow_id === workflowId);
    if (workflowTasks.length === 0) return 'pending';
  
    const statuses = workflowTasks.map(task => task.status);
  
    if (statuses.every(status => status === 'completed')) return 'completed';
    if (statuses.includes('cancelled')) return 'cancelled';
    if (statuses.includes('in_progress')) return 'in_progress';
    if (statuses.includes('pending')) return 'pending';
  
    return 'pending'; // par défaut
  };
  
  /**
   * Retourne la couleur Bootstrap associée à un statut de workflow.
   */
  const getStatusColor = (status) => {
    const colors = {
      pending: 'secondary',
      in_progress: 'primary',
      completed: 'success',
      cancelled: 'danger'
    };
    return colors[status] || 'secondary';
  };
  
  /**
   * Retourne une icône Unicode pour un statut donné.
   */
  const getStatusIcon = (status) => {
    const icons = {
      pending: '⏳',
      in_progress: '🔧',
      completed: '✅',
      cancelled: '❌'
    };
    return icons[status] || '';
  };
  
  /**
   * Retourne un label textuel (en français) pour un statut donné.
   */
  const getStatusLabel = (status) => {
    const labels = {
      pending: 'En attente',
      in_progress: 'En cours',
      completed: 'Terminée',
      cancelled: 'Annulée'
    };
    return labels[status] || '';
  };
  
  /**
   * Formate une date ISO pour un champ input type="date".
   */
  const formatDateForInput = (dateStr) => {
    const date = new Date(dateStr);
    const timezoneOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10);
  };
  
  // Export groupé à la fin
  export {
    getWorkflowStatus,
    getStatusColor,
    getStatusIcon,
    getStatusLabel,
    formatDateForInput
  };
  