const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authenticateToken, requireRole, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// Admin Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const admin = db.prepare(`SELECT * FROM admins WHERE username = ?`).get(username);
  if (!admin) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isValid = bcrypt.compareSync(password, admin.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: admin.id, username: admin.username, role: admin.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: {
      id: admin.id,
      username: admin.username,
      role: admin.role
    }
  });
});

// Verify current session token
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// Superadmin: List all admins
router.get('/admins', authenticateToken, requireRole(['superadmin']), (req, res) => {
  const admins = db.prepare(`SELECT id, username, role, created_at FROM admins ORDER BY id ASC`).all();
  res.json(admins);
});

// Superadmin: Create new admin
router.post('/admins', authenticateToken, requireRole(['superadmin']), (req, res) => {
  const { username, password, role = 'admin' } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const existing = db.prepare(`SELECT id FROM admins WHERE username = ?`).get(username);
  if (existing) {
    return res.status(400).json({ error: 'Username already exists' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO admins (username, password_hash, role)
    VALUES (?, ?, ?)
  `).run(username, hash, role);

  res.status(201).json({
    message: 'Admin account created successfully',
    admin: {
      id: result.lastInsertRowid,
      username,
      role
    }
  });
});

// Superadmin: Edit admin account
router.put('/admins/:id', authenticateToken, requireRole(['superadmin']), (req, res) => {
  const { id } = req.params;
  const { username, password, role } = req.body;

  const admin = db.prepare(`SELECT * FROM admins WHERE id = ?`).get(id);
  if (!admin) {
    return res.status(404).json({ error: 'Admin account not found' });
  }

  let updateQuery = `UPDATE admins SET username = ?, role = ?`;
  const params = [username || admin.username, role || admin.role];

  if (password && password.trim() !== '') {
    updateQuery += `, password_hash = ?`;
    params.push(bcrypt.hashSync(password, 10));
  }

  updateQuery += ` WHERE id = ?`;
  params.push(id);

  db.prepare(updateQuery).run(...params);

  res.json({ message: 'Admin account updated successfully' });
});

// Superadmin: Delete admin account
router.delete('/admins/:id', authenticateToken, requireRole(['superadmin']), (req, res) => {
  const { id } = req.params;

  const admin = db.prepare(`SELECT * FROM admins WHERE id = ?`).get(id);
  if (!admin) {
    return res.status(404).json({ error: 'Admin account not found' });
  }

  if (admin.role === 'superadmin' && req.user.id === parseInt(id)) {
    return res.status(400).json({ error: 'Cannot delete your own superadmin account' });
  }

  db.prepare(`DELETE FROM admins WHERE id = ?`).run(id);
  res.json({ message: 'Admin account deleted successfully' });
});

module.exports = router;
