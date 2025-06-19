require("dotenv").config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pool = require("./config/db");
const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const tasksRoutes = require("./routes/workflow");
const docsRoutes = require("./routes/documents");
const collectionRoutes =require("./routes/collection");
const groupRoutes = require('./routes/groupe');
const listTasksRoutes = require('./routes/listTasks');
const workflowsRoutes = require("./routes/task");
const notifRoutes = require("./routes/notif");
const workRoutes = require("./routes/work");
const aiRoutes = require("./routes/ai");
const reclamationRoutes = require('./routes/reclamation');
const statsRoutes = require('./routes/stats');
const summarizeRoute = require('./routes/summarize');
const chatRoutes = require('./routes/chat');
const { router: activityRoutes, logActivity } = require('./routes/activite');
const folderRoutes = require('./routes/dossier');
const messageRoutes = require('./routes/messages');
const Logs = require('./routes/logs');
const app = express();
const PORT = process.env.PORT || 5000;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);


// Middleware
const corsOptions = {
    origin: "http://localhost:3000",  // Ton frontend React
  };
  app.use(cors(corsOptions));
  
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use(express.urlencoded({ extended: true }));
app.use('/api', statsRoutes);


// Routes
app.use('/api/messages', messageRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/documents", docsRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/collection",collectionRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/list-tasks', listTasksRoutes);
app.use('/api/workflows', workflowsRoutes);
app.use('/api/notifications', notifRoutes);
app.use('/api/workflow', workRoutes);
app.use('/api/reclamations', reclamationRoutes);
app.use('/api/', aiRoutes);
app.use('/api/summarize', summarizeRoute);
app.use('/api/activities', activityRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/activity-logs', Logs);


// Lancement du serveur
app.listen(PORT, () => console.log(`🚀 Serveur lancé sur le port ${PORT}`));

pool.connect()
  .then(() => console.log("✅ Connexion à la base de données réussie"))
  .catch((err) => console.error("❌ Erreur de connexion à la base de données :", err));