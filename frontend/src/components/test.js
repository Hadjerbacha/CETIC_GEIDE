// WorkflowEditor.js
import React, { useEffect, useState } from "react";
import { Card } from "react-bootstrap";
import { motion } from "framer-motion";
import ReactFlow, { MiniMap, Controls } from "reactflow";
import "reactflow/dist/style.css";
import "bootstrap/dist/css/bootstrap.min.css"; // Si pas déjà importé dans ton projet

export default function WorkflowEditor() {
  const [documentTitle, setDocumentTitle] = useState("Document Démo.pdf");
  const [summary, setSummary] = useState("");
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  useEffect(() => {
    // Simule un résumé IA
    setSummary("Ce document doit être validé par les services RH et signé par la direction.");

    // Exemple simple de workflow (graphique)
    setNodes([
      { id: "1", type: "input", position: { x: 100, y: 100 }, data: { label: "📥 Début" } },
      { id: "2", position: { x: 300, y: 200 }, data: { label: "👤 Validation RH" } },
      { id: "3", position: { x: 500, y: 100 }, data: { label: "✍️ Signature Direction" } },
      { id: "4", type: "output", position: { x: 700, y: 200 }, data: { label: "📤 Fin" } },
    ]);
    setEdges([
      { id: "e1-2", source: "1", target: "2", animated: true },
      { id: "e2-3", source: "2", target: "3", animated: true },
      { id: "e3-4", source: "3", target: "4", animated: true },
    ]);
  }, []);

  return (
    <div className="p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Card className="mb-4 shadow">
          <Card.Body>
            <h2 className="text-xl fw-bold mb-2">Workflow : {documentTitle}</h2>
            <p className="text-muted fst-italic">Résumé IA : {summary}</p>
          </Card.Body>
        </Card>

        <div className="border border-light rounded p-2" style={{ height: 500 }}>
          <ReactFlow nodes={nodes} edges={edges} fitView>
            <MiniMap />
            <Controls />
          </ReactFlow>
        </div>
      </motion.div>
    </div>
  );
}
