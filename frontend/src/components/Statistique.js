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
  Tabs
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
  PolarRadiusAxis
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
    '#0088FE', '#00C49F', '#FFBB28', '#FF8042', 
    '#8884D8', '#82CA9D', '#FFC658', '#A4DE6C',
    '#D0ED57', '#FFA8A8', '#A28DFF', '#6C5B7B'
  ];

  useEffect(() => {
    const fetchAllStats = async () => {
      try {
        const endpoints = [
          '/api/stats/global',
          '/api/stats/tasks',
          '/api/stats/documents',
          '/api/stats/users',
          '/api/stats/workflows'
        ];
        
        const responses = await Promise.all(
          endpoints.map(endpoint => axios.get(endpoint))
        );

        setGlobalStats(responses[0].data);
        setTaskStats(responses[1].data);
        setDocStats(responses[2].data);
        setUserStats(responses[3].data);
        setWorkflowStats(responses[4].data);
      } catch (err) {
        console.error('Error fetching statistics:', err);
        setError('Failed to load statistics. Please try again later.');
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
      { name: 'Invoices', value: globalStats.totalInvoices, color: COLORS[4] },
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
        <Col key={index} xs={6} md={4} lg={2}>
          <Card className="h-100 shadow-sm stats-card">
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

  const renderGlobalStats = () => (
    <>
      <StatsSummary />
      
      <Row className="g-4 mb-4">
        <Col lg={8}>
          <Card className="shadow-sm h-100">
            <Card.Body>
              <Card.Title>Global Activity</Card.Title>
              <div style={{ height: '400px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={formatGlobalStats()}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" fill="#8884d8" radius={[4, 4, 0, 0]}>
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
          <Card className="shadow-sm h-100">
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
                    <Tooltip />
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
        <Col lg={4}>
          <Card className="shadow-sm h-100">
            <Card.Body>
              <Card.Title>Tasks by Status</Card.Title>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={taskStats.byStatus}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      innerRadius={50}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {taskStats.byStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card.Body>
          </Card>
        </Col>
        
        <Col lg={4}>
          <Card className="shadow-sm h-100">
            <Card.Body>
              <Card.Title>Tasks by Priority</Card.Title>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={taskStats.byPriority}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="name" />
                    <PolarRadiusAxis />
                    <Radar name="Tasks" dataKey="value" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </Card.Body>
          </Card>
        </Col>
        
        <Col lg={4}>
          <Card className="shadow-sm h-100">
            <Card.Body>
              <Card.Title>Tasks by Type</Card.Title>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={taskStats.byType}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8884d8">
                      {taskStats.byType.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card.Body>
          </Card>
        </Col>
        
        <Col lg={12}>
          <Card className="shadow-sm">
            <Card.Body>
              <Card.Title>Task Completion</Card.Title>
              <div className="text-center py-3">
                <div className="progress-circle" style={{ '--progress': taskStats.completionRate }}>
                  <span>{taskStats.completionRate}%</span>
                </div>
                <p className="mt-3">Overall completion rate</p>
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
          <Card className="shadow-sm h-100">
            <Card.Body>
              <Card.Title>Documents by Category</Card.Title>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={docStats.byCategory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8884d8">
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
          <Card className="shadow-sm h-100">
            <Card.Body>
              <Card.Title>Document Activity</Card.Title>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={docStats.versions}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="count" stroke="#8884d8" fill="#8884d8" />
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
    
    return (
      <Row className="g-4">
        <Col lg={6}>
          <Card className="shadow-sm h-100">
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
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card.Body>
          </Card>
        </Col>
        
        <Col lg={6}>
          <Card className="shadow-sm h-100">
            <Card.Body>
              <Card.Title>User Activity</Card.Title>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={userStats.activity}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="activeUsers" stroke="#8884d8" />
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
        <Col lg={6}>
          <Card className="shadow-sm h-100">
            <Card.Body>
              <Card.Title>Workflows by Status</Card.Title>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={workflowStats.byStatus}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8884d8">
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
        
        <Col lg={6}>
          <Card className="shadow-sm h-100">
            <Card.Body>
              <Card.Title>Workflow Steps</Card.Title>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={workflowStats.steps}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="name" />
                    <PolarRadiusAxis />
                    <Radar name="Steps" dataKey="count" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                    <Tooltip />
                  </RadarChart>
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
      <Container fluid className="my-4">
        {loading ? (
          <LoadingIndicator />
        ) : error ? (
          <ErrorMessage />
        ) : (
          <>
            <Tabs
              activeKey={activeTab}
              onSelect={(k) => setActiveTab(k)}
              className="mb-4"
              fill
            >
              <Tab eventKey="global" title="Global View">
                {renderGlobalStats()}
              </Tab>
              <Tab eventKey="tasks" title="Tasks">
                {renderTaskStats()}
              </Tab>
              <Tab eventKey="documents" title="Documents">
                {renderDocStats()}
              </Tab>
              <Tab eventKey="users" title="Users">
                {renderUserStats()}
              </Tab>
              <Tab eventKey="workflows" title="Workflows">
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