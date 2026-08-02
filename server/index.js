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

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), system: 'TapIn Backend API' });
});

// Serve frontend static build if built
const clientDist = path.join(__dirname, '../client/dist');
app.use(express.static(clientDist));

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
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
