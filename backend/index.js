const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const ffmpeg = require('fluent-ffmpeg');
const app = express();
const authRoutes = require('./src/routes/auth');

const PORT = 5050;
const JWT_SECRET = 'supersecretkey';

// Database setup
const db = new sqlite3.Database(path.join(__dirname, 'betterclip.db'));

// Ensure tables exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT,
      path TEXT,
      user_id INTEGER,
      originalname TEXT,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);
});

app.use(cors({ origin: '*' }));
app.use(express.json());

// Log every request
app.use((req, res, next) => {
  console.log(new Date().toISOString(), req.method, req.url);
  next();
});

// Simple GET route
app.get('/', (req, res) => {
  res.send('OK');
});

// Configure multer for file uploads
const uploadsDir = path.join(__dirname, 'uploads');
const upload = multer({ dest: uploadsDir });

// Make sure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// JWT authentication middleware
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: 'No token' });
  const token = auth.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}

// File upload endpoint (JWT protected)
app.post('/api/upload', authMiddleware, upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { filename, path: filepath, originalname } = req.file;
  const user_id = req.user.userId;
  const thumbName = filename + '.jpg';
  const thumbPath = path.join(uploadsDir, thumbName);

  // Generate thumbnail
  ffmpeg(filepath)
    .on('end', () => {
      db.run(
        'INSERT INTO videos (filename, path, user_id, originalname) VALUES (?, ?, ?, ?)',
        [filename, filepath, user_id, originalname],
        function (err) {
          if (err) return res.status(500).json({ error: 'DB error' });
          res.json({ ok: true, id: this.lastID, filename, originalname, thumbnail: thumbName });
        }
      );
    })
    .on('error', (err) => {
      res.status(500).json({ error: 'Thumbnail error', details: err.message });
    })
    .screenshots({
      count: 1,
      folder: uploadsDir,
      filename: thumbName,
      size: '320x180'
    });
});

// List uploaded files (JWT protected)
app.get('/api/files', authMiddleware, (req, res) => {
  const user_id = req.user.userId;
  db.all(
    'SELECT id, filename, originalname, uploaded_at FROM videos WHERE user_id = ? ORDER BY uploaded_at DESC',
    [user_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json(rows);
    }
  );
});

// Delete a file (JWT protected)
app.delete('/api/files/:id', authMiddleware, (req, res) => {
  const user_id = req.user.userId;
  const fileId = req.params.id;
  db.get('SELECT * FROM videos WHERE id = ? AND user_id = ?', [fileId, user_id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'File not found' });
    fs.unlink(row.path, () => {
      db.run('DELETE FROM videos WHERE id = ?', [fileId], (err) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json({ ok: true });
      });
    });
  });
});

// Change password endpoint (JWT protected)
app.post('/api/change-password', authMiddleware, async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: "Missing password" });
  const hash = await bcrypt.hash(password, 10);
  db.run('UPDATE users SET password = ? WHERE id = ?', [hash, req.user.userId], function (err) {
    if (err) return res.status(500).json({ error: "DB error" });
    res.json({ success: true });
  });
});

// Register endpoint
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });

  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, row) => {
    if (row) return res.status(409).json({ error: 'User already exists' });
    const hash = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash], function (err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ success: true, userId: this.lastID });
    });
  });
});

// Login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });

  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  });
});

// Serve static files from the uploads directory
app.use('/uploads', express.static(uploadsDir));

// Always return JSON for errors
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Fallback for anything else (THIS MUST BE LAST)
app.all('*', (req, res) => {
  console.log('⚠️ Unhandled route:', req.method, req.url);
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
});
