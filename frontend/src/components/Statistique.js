import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { 
  Container, 
  Row, 
  Col, 
  Spinner, 
  Card, 
  Alert,
  Badge
} from 'react-bootstrap';
import axios from 'axios';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell,
  ResponsiveContainer 
} from 'recharts';
import Navbar from './Navbar';
import '../style/Statistique.css'; // Fichier CSS pour les styles personnalisés

const Statistique = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Couleurs personnalisées pour les graphiques
  const CHART_COLORS = {
    users: '#6366f1',
    documents: '#10b981',
    tasks: '#f59e0b',
    workflows: '#ef4444',
    notifications: '#ec4899'
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await axios.get('/api/stats');
        setStats(data);
      } catch (err) {
        console.error('Erreur lors de la récupération des statistiques :', err);
        setError('Impossible de charger les statistiques. Veuillez réessayer plus tard.');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Préparation des données pour les graphiques
  const chartData = stats ? [
    { 
      name: 'Utilisateurs', 
      value: stats.totalUsers,
      color: CHART_COLORS.users 
    },
    { 
      name: 'Documents', 
      value: stats.totalDocuments,
      color: CHART_COLORS.documents 
    },
    { 
      name: 'Tâches', 
      value: stats.totalTasks,
      color: CHART_COLORS.tasks 
    },
    { 
      name: 'Workflows', 
      value: stats.totalWorkflows,
      color: CHART_COLORS.workflows 
    }
  ] : [];

  // Composant de chargement
  const LoadingIndicator = () => (
    <div className="text-center py-5">
      <Spinner animation="border" variant="primary" role="status">
        <span className="visually-hidden">Chargement...</span>
      </Spinner>
      <p className="mt-3 text-muted">Chargement des statistiques...</p>
    </div>
  );

  // Composant d'erreur
  const ErrorMessage = () => (
    <Alert variant="danger" className="mt-4">
      <Alert.Heading>Erreur de chargement</Alert.Heading>
      <p>{error}</p>
    </Alert>
  );

  // Composant de statistiques résumées
  const StatsSummary = () => (
    <Row fluid className="m-4 ">
      {chartData.map((item, index) => (
        <Col key={index} xs={6} md={4} lg={2}>
          <Card className="h-100 shadow-sm border-0 stats-card">
            <Card.Body className="text-center">
              <Badge bg="light" className="mb-2" style={{ color: item.color }}>
                {item.name}
              </Badge>
              <h3 className="fw-bold">{item.value}</h3>
            </Card.Body>
          </Card>
        </Col>
      ))}
    </Row>
  );

  return (
    <>
      <Navbar />
      <Container fluid className="my-4">
        
        {loading ? (
          <LoadingIndicator />
        ) : error ? (
          <ErrorMessage />
        ) : stats && (
          <>
            
            <Row className="g-4">
              {/* Graphique en Barres */}
              <Col lg={8}>
                <Card className="shadow-sm h-100">
                  <Card.Body>
                    <Card.Title className="d-flex justify-content-between align-items-center">
                      <span>Statistiques par Catégorie</span>
                      <small className="text-muted">Nombre total</small>
                    </Card.Title>
                    <div style={{ height: '400px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={chartData}
                          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis 
                            dataKey="name" 
                            tick={{ fill: '#6c757d' }}
                            axisLine={false}
                          />
                          <YAxis 
                            tick={{ fill: '#6c757d' }}
                            axisLine={false}
                          />
                          <Tooltip 
                            contentStyle={{
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                            }}
                          />
                          <Legend />
                          <Bar 
                            dataKey="value" 
                            radius={[4, 4, 0, 0]}
                          >
                            {chartData.map((entry, index) => (
                              <Cell key={`bar-cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card.Body>
                </Card>
              </Col>

              {/* Graphique en Camembert */}
              <Col lg={4}>
                <Card className="shadow-sm h-100">
                  <Card.Body>
                    <Card.Title>Répartition des Données</Card.Title>
                    <div style={{ height: '400px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={120}
                            innerRadius={60}
                            paddingAngle={2}
                            label={({ name, percent }) => 
                              `${name}: ${(percent * 100).toFixed(0)}%`
                            }
                            labelLine={false}
                          >
                            {chartData.map((entry, index) => (
                              <Cell key={`pie-cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value) => [value, 'Total']}
                            contentStyle={{
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </>
        )}
      </Container>
    </>
  );
};



export default Statistique;