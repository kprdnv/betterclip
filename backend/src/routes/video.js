// video.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('./db');

const router = express.Router();

// Configure file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Initialize upload middleware
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Upload video
router.post('/upload', upload.single('video'), (req, res) => {
  try {
    const { title, description, userId } = req.body;
    const filePath = req.file.path;

    // Validate input
    if (!title || !filePath || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Insert into database
    db.run(
      'INSERT INTO videos (title, description, filePath, userId) VALUES (?, ?, ?, ?)',
      [title, description, filePath, userId],
      function(err) {
        if (err) {
          console.error('UPLOAD ERROR:', err);
          return res.status(500).json({ error: 'Video upload failed' });
        }
        res.status(201).json({ 
          id: this.lastID, 
          title, 
          filePath,
          message: 'Video uploaded successfully'
        });
      }
    );
  } catch (error) {
    console.error('UPLOAD EXCEPTION:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all videos
router.get('/', (req, res) => {
  db.all('SELECT * FROM videos', (err, videos) => {
    if (err) {
      console.error('VIDEO FETCH ERROR:', err);
      return res.status(500).json({ error: 'Failed to fetch videos' });
    }
    res.json(videos);
  });
});

module.exports = router;