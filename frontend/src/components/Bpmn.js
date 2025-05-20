import React, { useEffect } from 'react';
import BpmnViewer from 'bpmn-js/lib/NavigatedViewer';

const BpmnDiagram = ({ workflowId }) => {
  useEffect(() => {
    const viewer = new BpmnViewer({ container: '#canvas' });

    const token = localStorage.getItem('token');

    fetch(`http://localhost:5000/api/workflows/${workflowId}/bpmn`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
      .then(async (res) => {
        const contentType = res.headers.get('Content-Type');
        const responseText = await res.text();

        // Vérifie si la réponse est bien du XML
        if (!res.ok || !contentType || !contentType.includes('xml')) {
          console.error('❌ Contenu non XML ou erreur HTTP :', responseText);
          throw new Error('Erreur : Le serveur n’a pas renvoyé un XML valide');
        }

        // Validation XML côté client
        const parser = new DOMParser();
        const doc = parser.parseFromString(responseText, 'text/xml');
        const parseError = doc.getElementsByTagName('parsererror');
        if (parseError.length > 0) {
          console.error('❌ XML mal formé :', responseText);
          throw new Error('Le fichier BPMN est mal formé.');
        }

        // Import du diagramme dans le viewer
        viewer.importXML(responseText)
          .then(() => {
            console.log('✅ Diagramme BPMN chargé avec succès.');
          })
          .catch((err) => {
            console.error('❌ Erreur d’importation BPMN :', err);
            console.log('🧾 XML problématique :', responseText);
          });
      })
      .catch((err) => {
        console.error('❌ Erreur lors du chargement BPMN :', err.message);
      });

    return () => {
      viewer.destroy();
    };
  }, [workflowId]);

  return (
    <div
      id="canvas"
      style={{ width: '100%', height: '500px', border: '1px solid #ccc' }}
    />
  );
};

export default BpmnDiagram;
