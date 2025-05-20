import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Container } from 'react-bootstrap'; // Pour la mise en page
import Login from './components/Login';
import 'bootstrap/dist/css/bootstrap.min.css';
import Workflows from './components/Workflowss';
import Workflow from './components/Workflow';
import Workflowz from './components/Workflowz';
import Groupe from './components/Groupe';
import Doc from './components/Document';
import Document from './components/Doc';
import AdminUsers from './components/AdminUsers';
import ProtectedRoute from './ProtectedRoute'; // Importer le composant ProtectedRoute
import AssignedTasks from './components/AssignedTasks';
import Details from './components/Details';
import DetailsTache from './components/DetailsTasks';
import DetailsWorkflow from './components/WorkflowDetails';
import Accueil from './components/Accueil';
import Register from './components/Register';
import Folder from './components/Folder';
import DocumentDetails from './components/DocumentDetails';
import Test from './components/test'; // Importer le composant Test
import Test2 from './components/test2'; // Importer le composant Test2
import Test3 from './components/Test3'; // Importer le composant Test3
import Test4 from './components/Test4'; // Importer le composant Test4
import Notif from './components/Notification';
import Statistique from './components/Statistique';
import Reclamation from './components/Reclamation';
import ReclamationList from './components/ReclamationList';
import DocVoir from './components/DocVoir';
import DocumentVersion from './components/DocumentVersion'; 
import Archive from './components/Archive';
import 'bootstrap/dist/css/bootstrap.min.css';
import Activite from './components/historique';

function App() {
  return (
    <Router>
     <Container fluid style={{ minHeight: '100vh' }} className="g-0">
        <Routes>
          {/* Route non protégée */}
          <Route path="/" element={<Login />} />
          <Route path="/test/:id" element={<Test />} />
          <Route path="/test2" element={<Test2 />} />
          <Route path="/test3" element={<Test3 />} />
          <Route path="/test4" element={<Test4 />} />

          {/* Routes protégées */}
          <Route path="/accueil" element={<ProtectedRoute element={<Accueil />} />} />
          <Route path="/groupe" element={<ProtectedRoute element={<Groupe />} />} />
          <Route path="/AdminUsers" element={<ProtectedRoute element={<AdminUsers />} />} />
          <Route path="/document" element={<ProtectedRoute element={<Doc />} />} />
          <Route path="/documents" element={<ProtectedRoute element={<Document />} />} />
          <Route path="/folder" element={<ProtectedRoute element={<Folder/>} />} />      
          <Route path="/workflows" element={<ProtectedRoute element={<Workflows />} />} />
          <Route path="/workflow" element={<ProtectedRoute element={<Workflow />} />} />
          <Route path="/workflowz/:id" element={<ProtectedRoute element={<Workflowz />} />} />
          <Route path="/mes-taches" element={<ProtectedRoute element={<AssignedTasks />} />} />
          <Route path="/details/:id" element={<ProtectedRoute element={<Details />} />} />
          <Route path="/details_taches/:id" element={<ProtectedRoute element={<DetailsTache />} />} />
          <Route path="/details_workflow/:id" element={<ProtectedRoute element={<DetailsWorkflow />} />} />
          <Route path="/register" element={<ProtectedRoute element={<Register />} />} />
          <Route path="/Documents/:id" element={<ProtectedRoute element={<DocumentDetails />} />} />
          <Route path="/statistique" element={<ProtectedRoute element={<Statistique />} />} />
          <Route path="/notif" element={<ProtectedRoute element={<Notif />} />} />
          <Route path="/Reclamation" element={<ProtectedRoute element={<Reclamation />} />} />
          <Route path="/ReclamationList" element={<ProtectedRoute element={<ReclamationList />} />} />
          <Route path="/DocVoir" element={<ProtectedRoute element={<DocVoir />} />} />
          <Route path="/docvoir/:id" element={<ProtectedRoute element={<DocVoir />} />} />
         <Route path="/document/:id/versions" element={<ProtectedRoute element={<DocumentVersion />} />} />
          <Route path="/archive" element={<ProtectedRoute element={<Archive />} />} />
          <Route path="/activites" element={<ProtectedRoute element={<Activite />} />} />
        </Routes>
      </Container>
    </Router>
  );
}

export default App;
