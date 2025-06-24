import React, { useEffect, useState } from 'react';
import { 
  Container, 
  Row, 
  Col, 
  Spinner, 
  Card, 
  Alert,
  Badge,
  Tab,
  Tabs,
  ProgressBar
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
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  RadialBarChart,
  RadialBar
} from 'recharts';
import Navbar from './Navbar';
import '../style/Statistique.css';

const Statistique = () => {
  const [globalStats, setGlobalStats] = useState(null);
  const [taskStats, setTaskStats] = useState(null);
  const [docStats, setDocStats] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [workflowStats, setWorkflowStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('global');

  const COLORS = [
    '#3f51b5', '#2196f3', '#00bcd4', '#4caf50', 
    '#8bc34a', '#ffc107', '#ff9800', '#ff5722',
    '#e91e63', '#9c27b0', '#673ab7', '#607d8b'
  ];

 useEffect(() => {
  const fetchAllStats = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Utiliser Promise.allSettled pour éviter que toute la requête échoue si une seule API échoue
      const results = await Promise.allSettled([
        axios.get('/api/stats/global'),
        axios.get('/api/stats/tasks'),
        axios.get('/api/stats/documents'),
        axios.get('/api/stats/users'),
        axios.get('/api/stats/workflows')
      ]);

      // Traiter chaque résultat individuellement
      setGlobalStats(results[0].status === 'fulfilled' ? results[0].value.data : null);
      setTaskStats(results[1].status === 'fulfilled' ? results[1].value.data : null);
      setDocStats(results[2].status === 'fulfilled' ? results[2].value.data : null);
      setUserStats(results[3].status === 'fulfilled' ? results[3].value.data : null);
      setWorkflowStats(results[4].status === 'fulfilled' ? results[4].value.data : null);

      // Vérifier si toutes les requêtes ont échoué
      if (results.every(r => r.status === 'rejected')) {
        throw new Error('All API requests failed');
      }
    } catch (err) {
      console.error('Error fetching statistics:', err);
      setError('Failed to load some statistics. Partial data may be displayed.');
    } finally {
      setLoading(false);
    }
  };

  fetchAllStats();
}, []);

  const formatGlobalStats = () => {
    if (!globalStats) return [];
    
    return [
      { name: 'Users', value: globalStats.totalUsers, color: COLORS[0] },
      { name: 'Documents', value: globalStats.totalDocuments, color: COLORS[1] },
      { name: 'Tasks', value: globalStats.totalTasks, color: COLORS[2] },
      { name: 'Workflows', value: globalStats.totalWorkflows, color: COLORS[3] },
      { name: 'factures', value: globalStats.totalInvoices, color: COLORS[4] },
      { name: 'contrats', value: globalStats.totalContractRequests, color: COLORS[8] },
      { name: 'demande_conge', value: globalStats.totalLeaveRequests, color: COLORS[6] },
      { name: 'CVs', value: globalStats.totalCVs, color: COLORS[7] },
      { name: 'rapport', value: globalStats.totalPurchaseRequests, color: COLORS[9] },
      { name: 'Folders', value: globalStats.totalFolders, color: COLORS[5] }
    ];
  };

  const LoadingIndicator = () => (
    <div className="text-center py-5">
      <Spinner animation="border" variant="primary" role="status">
        <span className="visually-hidden">Loading...</span>
      </Spinner>
      <p className="mt-3 text-muted">Loading statistics...</p>
    </div>
  );

  const ErrorMessage = () => (
    <Alert variant="danger" className="mt-4">
      <Alert.Heading>Loading Error</Alert.Heading>
      <p>{error}</p>
    </Alert>
  );

  const StatsSummary = () => (
    <Row className="g-4 mb-4">
      {formatGlobalStats().map((item, index) => (
        <Col key={index} xs={6} sm={2} md={2} lg={2} xl={2}>
          <Card className="h-100 stats-card-hover">
            <Card.Body className="text-center py-3">
              <div className="stats-icon mb-2" style={{ backgroundColor: `${item.color}20` }}>
                <i className="bi bi-collection" style={{ color: item.color }}></i>
              </div>
              <h5 className="text-muted mb-1">{item.name}</h5>
              <h3 className="fw-bold mb-0" style={{ color: item.color }}>{item.value}</h3>
            </Card.Body>
          </Card>
        </Col>
      ))}
    </Row>
  );

  const renderGlobalStats = () => (
    <>
      <StatsSummary />
      
      <Row className="g-4 mb-4">
        <Col lg={8}>
          <Card className="h-100 chart-card">
            <Card.Body>
              <Card.Title className="d-flex justify-content-between align-items-center">
                <span>Global Activity</span>
                <Badge bg="light" className="text-primary">Last 6 months</Badge>
              </Card.Title>
              <div style={{ height: '400px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={formatGlobalStats()}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fill: '#6c757d' }} />
                    <YAxis tick={{ fill: '#6c757d' }} />
                    <Tooltip 
                      contentStyle={{
                        background: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {formatGlobalStats().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card.Body>
          </Card>
        </Col>
        
        <Col lg={4}>
          <Card className="h-100 chart-card">
            <Card.Body>
              <Card.Title>Global Distribution</Card.Title>
              <div style={{ height: '400px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={formatGlobalStats()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={120}
                      innerRadius={60}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {formatGlobalStats().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{
                        background: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
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
  );

  const renderTaskStats = () => {
    if (!taskStats) return null;
    
    return (
      <Row className="g-4">
        <Col lg={6}>
          <Card className="h-100 chart-card">
            <Card.Body>
              <Card.Title>Tasks by Status</Card.Title>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart 
                    innerRadius="20%" 
                    outerRadius="100%" 
                    data={taskStats.byStatus.map((item, index) => ({
                      ...item,
                      fill: COLORS[index % COLORS.length]
                    }))}
                  >
                    <br/>
                    <PolarAngleAxis 
                      type="number" 
                      domain={[0, 100]} 
                      angleAxisId={0} 
                      tick={{ fill: '#6c757d' }}
                    />
                    <br/>
                    <RadialBar
                      background
                      dataKey="value"
                      cornerRadius={10}
                    />
                    <br/>
                    <br/>
                    <Legend />
                    <br/>
                    <br/>
                    <Tooltip 
                      contentStyle={{
                        background: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }}
                    />
                    <br/>
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
            </Card.Body>
          </Card>
        </Col>
        
        <Col lg={6}>
          <Card className="h-100 chart-card">
            <Card.Body>
              <Card.Title>Task Completion</Card.Title>
              <div className="d-flex flex-column align-items-center justify-content-center" style={{ height: '300px' }}>
                <div className="position-relative" style={{ width: '200px', height: '200px' }}>
                  <svg viewBox="0 0 36 36" className="circular-chart">
                    <path
                      className="circle-bg"
                      d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="circle-fill"
                      strokeDasharray={`${taskStats.completionRate}, 100`}
                      d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                      style={{ stroke: COLORS[3] }}
                    />
                    <text x="18" y="20" className="percentage">{taskStats.completionRate}%</text>
                    <text x="18" y="25" className="label">Completed</text>
                  </svg>
                </div>
                <div className="w-75 mt-4">
                  <ProgressBar now={taskStats.completionRate} 
                    variant="success" 
                    className="progress-lg"
                    label={`${taskStats.completionRate}%`} 
                  />
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    );
  };

  const renderDocStats = () => {
    if (!docStats) return null;
    
    return (
      <Row className="g-4">
        <Col lg={6}>
          <Card className="h-100 chart-card">
            <Card.Body>
              <Card.Title>Documents by Category</Card.Title>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={docStats.byCategory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fill: '#6c757d' }} />
                    <YAxis tick={{ fill: '#6c757d' }} />
                    <Tooltip 
                      contentStyle={{
                        background: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {docStats.byCategory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card.Body>
          </Card>
        </Col>
        
        <Col lg={6}>
          <Card className="h-100 chart-card">
            <Card.Body>
              <Card.Title>Document Activity</Card.Title>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={docStats.versions}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fill: '#6c757d' }} />
                    <YAxis tick={{ fill: '#6c757d' }} />
                    <Tooltip 
                      contentStyle={{
                        background: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="count" 
                      stroke={COLORS[1]} 
                      fill={COLORS[1]} 
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    );
  };

  const renderUserStats = () => {
  if (!userStats) return null;
  
  // Formatage des dates pour un affichage plus lisible
  const formattedActivity = userStats.activity.map(item => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: 'short' 
    })
  }));

  return (
    <Row className="g-4">
      <Col lg={6}>
          <Card className="h-100 chart-card">
            <Card.Body>
              <Card.Title>Users by Role</Card.Title>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={userStats.byRole}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      innerRadius={50}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {userStats.byRole.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{
                        background: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card.Body>
          </Card>
        </Col>
      
      <Col lg={6}>
        <Card className="h-100 chart-card">
          <Card.Body>
            <Card.Title>User Activity (Last 30 Days)</Card.Title>
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={formattedActivity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: '#6c757d' }}
                  />
                  <YAxis 
                    tick={{ fill: '#6c757d' }}
                    label={{ 
                      value: 'Active Users', 
                      angle: -90, 
                      position: 'insideLeft',
                      fill: '#6c757d'
                    }}
                  />
                  <Tooltip 
                    contentStyle={{
                      background: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="activeUsers" 
                    stroke={COLORS[0]} 
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Active Users"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
};
  const renderWorkflowStats = () => {
    if (!workflowStats) return null;
    
    return (
      <Row className="g-4">
        <Col lg={12}>
          <Card className="chart-card">
            <Card.Body>
              <Card.Title>Workflows by Status</Card.Title>
              <div style={{ height: '400px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={workflowStats.byStatus}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fill: '#6c757d' }} />
                    <YAxis tick={{ fill: '#6c757d' }} />
                    <Tooltip 
                      contentStyle={{
                        background: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {workflowStats.byStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    );
  };

  return (
    <>
      <Navbar />
      <Container fluid className="stat-container">
        {loading ? (
          <LoadingIndicator />
        ) : error ? (
          <ErrorMessage />
        ) : (
          <>
            
            <Tabs
  activeKey={activeTab}
  onSelect={(k) => setActiveTab(k)}
  className="nav nav-pills nav-fill modern-tabs mb-4 shadow-sm rounded-3 bg-white"
  mountOnEnter
  unmountOnExit
>

              <Tab eventKey="global" title={
                <span className="d-flex align-items-center">
                  <i className="bi bi-globe me-2"></i> Global
                </span>
              }>
                {renderGlobalStats()}
              </Tab>
              <Tab eventKey="tasks" title={
                <span className="d-flex align-items-center">
                  <i className="bi bi-list-task me-2"></i> Tasks
                </span>
              }>
                {renderTaskStats()}
              </Tab>
              <Tab eventKey="documents" title={
                <span className="d-flex align-items-center">
                  <i className="bi bi-file-earmark-text me-2"></i> Documents
                </span>
              }>
                {renderDocStats()}
              </Tab>
              <Tab eventKey="users" title={
                <span className="d-flex align-items-center">
                  <i className="bi bi-people me-2"></i> Users
                </span>
              }>
                {renderUserStats()}
              </Tab>
              <Tab eventKey="workflows" title={
                <span className="d-flex align-items-center">
                  <i className="bi bi-diagram-3 me-2"></i> Workflows
                </span>
              }>
                {renderWorkflowStats()}
              </Tab>
            </Tabs>
          </>
        )}
      </Container>
    </>
  );
};

export default Statistique;