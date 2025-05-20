import React, { useEffect, useState } from 'react';
import { Alert } from 'react-bootstrap';

const OverdueAlertWorkflow = ({ workflows }) => {
  const [overdueWorkflows, setOverdueWorkflows] = useState([]);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const storedId = localStorage.getItem('token');
    if (storedId) {
      try {
        const decoded = JSON.parse(atob(storedId.split('.')[1]));
        setUserId(decoded.id);
      } catch (error) {
        console.error('Erreur de décodage du token', error);
      }
    }
  }, []);

  useEffect(() => {
    if (!workflows || !Array.isArray(workflows) || !userId) return;

    const now = new Date();

    const overdue = workflows.filter(wf => {
      const dueDate = new Date(wf.echeance);
      const isOverdue = dueDate < now;
      const isNotCompleted = wf.status !== 'completed';
      const isCreatedByUser = wf.created_by === userId;

      return isOverdue && isNotCompleted && isCreatedByUser;
    });

    setOverdueWorkflows(overdue);
  }, [workflows, userId]);

  if (overdueWorkflows.length === 0) return null;

  return (
    <Alert variant="danger" className='me-4 ms-4'>
      <strong>⚠️ Workflows en retard (créés par vous) :</strong>{' '}
      {overdueWorkflows.map((wf, i) => (
        <span key={i}>
          {wf.name}{i < overdueWorkflows.length - 1 ? ', ' : ''}
        </span>
      ))}
    </Alert>
  );
};

export default OverdueAlertWorkflow;
