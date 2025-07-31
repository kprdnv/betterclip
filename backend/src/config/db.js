// db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file path
const dbPath = path.join(__dirname, 'db', 'betterclip.db');

// Create database connection
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('DATABASE CONNECTION ERROR:', err.message);
    process.exit(1); // Exit if DB connection fails
  }
  console.log('✅ Connected to SQLite database at:', dbPath);
  
  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON', (err) => {
    if (err) console.error('FOREIGN KEYS ERROR:', err);
    else console.log('✅ Foreign keys enabled');
  });
});

console.log('--- db.js loaded ---');

module.exports = db;