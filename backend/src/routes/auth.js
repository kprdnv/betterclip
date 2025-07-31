// auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const router = express.Router();

// User registration
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert into database
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', 
      [username, hashedPassword], 
      function(err) {
        if (err) {
          console.error('REGISTRATION ERROR:', err);
          return res.status(500).json({ error: 'Registration failed' });
        }
        res.status(201).json({ id: this.lastID, username });
      }
    );
  } catch (error) {
    console.error('REGISTRATION EXCEPTION:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Find user in database
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
      if (err) {
        console.error('LOGIN ERROR:', err);
        return res.status(500).json({ error: 'Login failed' });
      }
      
      // Check if user exists
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Verify password
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Generate JWT token
      const token = jwt.sign({ id: user.id }, 'your_jwt_secret', { expiresIn: '1h' });
      res.json({ token });
    });
  } catch (error) {
    console.error('LOGIN EXCEPTION:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;