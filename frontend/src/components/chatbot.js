import React, { useState } from 'react';
import { Button, Modal } from 'react-bootstrap';
import axios from 'axios';

const Chatbot = () => {
  const [messages, setMessages] = useState([
    { from: 'bot', text: 'Bonjour ! Comment puis-je vous aider aujourd\'hui ?' }
  ]);
  const [showChat, setShowChat] = useState(false);

  const handleToggleChat = () => {
    setShowChat(!showChat);
  };

  const handleBotResponse = async (response) => {
    let newMessages = [];
    switch (response) {
      case 'showTasks':
        newMessages = [
          { from: 'bot', text: 'Affichage des tâches d\'aujourd\'hui...' }
        ];
        setMessages(prevMessages => [...prevMessages, ...newMessages]);

        // Appel API pour obtenir les tâches d'aujourd'hui
        try {
          const today = new Date().toISOString().split('T')[0]; // Formate la date au format YYYY-MM-DD
          const apiUrl = `http://localhost:5000/api/tasks?due_date=${today}`;
          const apiResponse = await axios.get(apiUrl);
          const tasks = apiResponse.data;

          if (tasks.length === 0) {
            setMessages(prevMessages => [
              ...prevMessages,
              { from: 'bot', text: 'Aucune tâche à afficher pour aujourd\'hui.' }
            ]);
          } else {
            const taskList = tasks.map(task => `${task.title} - Échéance: ${task.due_date}`).join('\n');
            setMessages(prevMessages => [
              ...prevMessages,
              { from: 'bot', text: `Voici vos tâches d'aujourd'hui :\n${taskList}` }
            ]);
          }
        } catch (error) {
          setMessages(prevMessages => [
            ...prevMessages,
            { from: 'bot', text: 'Désolé, il y a eu un problème lors de la récupération des tâches.' }
          ]);
        }
        break;
      case 'showHelp':
        newMessages = [
          { from: 'bot', text: 'Comment puis-je vous aider ? Vous pouvez demander "Afficher les tâches d\'aujourd\'hui", "Mes priorités", ou "Mon emploi du temps".' }
        ];
        setMessages(prevMessages => [...prevMessages, ...newMessages]);
        break;
      case 'showSchedule':
        newMessages = [
          { from: 'bot', text: 'Voici votre emploi du temps pour aujourd\'hui : 9h - Réunion, 11h - Appel, 14h - Formation.' }
        ];
        setMessages(prevMessages => [...prevMessages, ...newMessages]);
        break;
      default:
        newMessages = [{ from: 'bot', text: 'Je n\'ai pas compris. Pouvez-vous essayer autre chose ?' }];
        setMessages(prevMessages => [...prevMessages, ...newMessages]);
    }
  };

  return (
    <div>
      <Button 
        variant="info" 
        className="position-fixed bottom-0 end-0 m-3" 
        onClick={handleToggleChat}
      >
        💬 Chat
      </Button>

      <Modal 
        show={showChat} 
        onHide={handleToggleChat} 
        size="lg" 
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Chatbot</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div style={{ maxHeight: '400px', overflowY: 'scroll' }}>
            {messages.map((msg, index) => (
              <div key={index} className={`mb-3 ${msg.from === 'user' ? 'text-end' : ''}`}>
                <div className={`p-2 rounded ${msg.from === 'user' ? 'bg-primary text-white' : 'bg-light'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <div className="d-flex flex-column">
            <Button variant="primary" onClick={() => handleBotResponse('showTasks')}>Afficher les tâches d'aujourd'hui</Button>
            <Button variant="primary" onClick={() => handleBotResponse('showHelp')}>Aide</Button>
            <Button variant="primary" onClick={() => handleBotResponse('showSchedule')}>Mon emploi du temps</Button>
          </div>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Chatbot;
