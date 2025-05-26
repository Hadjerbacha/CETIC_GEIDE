// BPMNViewer.js
import React from 'react';
import { ReactFlow, Controls, Background } from 'reactflow';
import 'reactflow/dist/style.css';

const BPMNViewer = ({ steps, currentStep }) => {
  const nodes = steps.map((step, index) => ({
    id: `step-${step.step_number}`,
    type: 'default',
    data: { 
      label: (
        <div className={`p-2 ${step.step_number === currentStep ? 'bg-primary text-white' : 'bg-light'}`}>
          <strong>Étape {step.step_number}</strong>
          <div>{step.action_type}</div>
        </div>
      ) 
    },
    position: { x: index * 250, y: 0 }
  }));

  const edges = steps.slice(0, -1).map((step, index) => ({
    id: `edge-${step.step_number}`,
    source: `step-${step.step_number}`,
    target: `step-${steps[index + 1].step_number}`,
    animated: step.step_number === currentStep - 1
  }));

  return (
    <div style={{ height: 200, width: '100%' }}>
      <ReactFlow 
        nodes={nodes} 
        edges={edges}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
};

export default BPMNViewer;