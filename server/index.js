const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const db = require('./db');
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const eventRoutes = require('./routes/events');
const attendanceRoutes = require('./routes/attendance');
const penaltyRoutes = require('./routes/penalties');
const spoofRoutes = require('./routes/spoof');
const checkpointRoutes = require('./routes/checkpoints');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  path: '/socket.io',
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Serve uploaded task photos
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Attach Socket.io instance to Express app for route access
app.set('io', io);

// Socket.io Connection Logic
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  socket.on('join_event', (eventId) => {
    socket.join(`event_${eventId}`);
    console.log(`[Socket.io] Client ${socket.id} joined room event_${eventId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/penalties', penaltyRoutes);
app.use('/api/spoof', spoofRoutes);
app.use('/api/checkpoints', checkpointRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), system: 'TapIn Backend API' });
});

// Serve frontend static build if built
const clientDist = path.join(__dirname, '../client/dist');
app.use(express.static(clientDist));

app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/socket.io')) {
    return next();
  }
  const indexPath = path.join(clientDist, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send('TapIn Backend API is running. Vite Dev server running on http://localhost:5173');
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n===============================================================`);
  console.log(`   TAPIN BACKEND SERVER IS RUNNING ON PORT ${PORT}              `);
  console.log(`===============================================================`);
  console.log(`   API Endpoint : http://localhost:${PORT}/api/health           `);
  console.log(`   Socket.io    : ws://localhost:${PORT}                       `);
  console.log(`===============================================================\n`);
});
