// WorkflowPage.js
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Button, Badge, Spinner } from 'react-bootstrap';
import { motion } from 'framer-motion';
import ReactFlow, { MiniMap, Controls } from 'reactflow';
import 'reactflow/dist/style.css';
import Navbar from './Navbar';
import Chatbot from './chatbot';

export default function WorkflowPage() {
  const { workflowId } = useParams();
  const location = useLocation();
  const document = location.state?.document;
  const [workflow, setWorkflow] = useState(null);
  const [steps, setSteps] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  // 1. Charger workflow + étapes
  const fetchWorkflow = useCallback(async () => {
    try {
      const res = await axios.get(
        `http://localhost:5000/api/workflows/${workflowId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setWorkflow(res.data.workflow);
      setSteps(res.data.steps);
    } catch (err) {
      console.error('Erreur chargement workflow', err);
    } finally {
      setLoading(false);
    }
  }, [workflowId, token]);

  useEffect(() => {
    fetchWorkflow();
  }, [fetchWorkflow]);

  // 2. Préparer ReactFlow nodes/edges
  useEffect(() => {
    if (!steps.length) return;
    const n = steps.map((step, idx) => ({
      id: String(step.id),
      type: idx === 0 ? 'input' : idx === steps.length - 1 ? 'output' : 'default',
      position: { x: 100 + idx * 200, y: 100 + (idx % 2) * 150 },
      data: { label: step.name }
    }));
    const e = steps
      .slice(1)
      .map((step, idx) => ({
        id: `e${steps[idx].id}-${step.id}`,
        source: String(steps[idx].id),
        target: String(step.id),
        animated: true
      }));
    setNodes(n);
    setEdges(e);
  }, [steps]);

  // 3. Handlers
  const handleNextStep = async (step) => {
    try {
      await axios.post(
        `http://localhost:5000/api/workflows/${workflowId}/steps/${step.id}/complete`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchWorkflow();
    } catch (err) {
      console.error('Erreur complétion étape', err);
    }
  };

  if (loading) {
    return (
      <div className="text-center mt-5">
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <Chatbot />
      <div className="p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
          <h2>Workflow pour : {document?.name || workflow.name}</h2>
          <p>Status : <Badge bg={workflow.status}>{workflow.status.toUpperCase()}</Badge></p>

          {/* Vue graphique du workflow */}
          <div style={{ height: 400, border: '1px solid #ddd', borderRadius: 8 }}>
            <ReactFlow nodes={nodes} edges={edges} fitView>
              <MiniMap />
              <Controls />
            </ReactFlow>
          </div>

          {/* Liste des étapes et actions */}
          <div className="mt-4">
            {steps.map(step => (
              <div key={step.id} className="d-flex align-items-center mb-2">
                <Badge pill bg={step.status === 'completed' ? 'success' : 'secondary'}>
                  {step.name}
                </Badge>
                <span className="ms-3">Statut : {step.status}</span>
                {step.status === 'pending' && (
                  <Button
                    size="sm"
                    className="ms-auto"
                    onClick={() => handleNextStep(step)}
                  >
                    Marquer comme terminé
                  </Button>
                )}
              </div>
            ))}
          </div>

          <Button variant="secondary" className="mt-3" onClick={() => navigate(-1)}>
            ← Retour aux documents
          </Button>
        </motion.div>
      </div>
    </>
  );
}
