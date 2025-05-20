// src/components/OverdueAlert.js
import React, { useEffect, useState } from 'react';
import { Alert } from 'react-bootstrap';

const OverdueAlert = ({ tasks }) => {
  const [overdueTasks, setOverdueTasks] = useState([]);

  const currentUserId = parseInt(localStorage.getItem('userId'), 10);

  useEffect(() => {
    if (!tasks || !Array.isArray(tasks) || !currentUserId) return;

    const now = new Date();

    const overdue = tasks.filter(task => {
      const dueDate = new Date(task.due_date);
      const isOverdue = dueDate < now;
      const isNotCompleted = task.status !== 'completed';
      const isCreatedByUser = task.created_by === currentUserId;

      return isOverdue && isNotCompleted && isCreatedByUser;
    });

    setOverdueTasks(overdue);
  }, [tasks, currentUserId]);

  if (overdueTasks.length === 0) return null;

  return (
    <Alert variant="danger" className='me-4 ms-4'>
      <strong>⚠️ Tâches en retard (créées par vous) :</strong>{' '}
      {overdueTasks.map((t, i) => (
        <span key={i}>
          {t.title}{i < overdueTasks.length - 1 ? ', ' : ''}
        </span>
      ))}
    </Alert>
  );
};

export default OverdueAlert;
