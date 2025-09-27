const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Basic API endpoints (simplified for Vercel)
app.post('/api/parse-magnet', (req, res) => {
  res.json({ 
    error: 'TorBox requires a full Node.js server environment. Please deploy to a platform that supports WebTorrent like Heroku, DigitalOcean, or Railway.' 
  });
});

app.post('/api/start-torrent', (req, res) => {
  res.json({ 
    error: 'TorBox requires a full Node.js server environment. Please deploy to a platform that supports WebTorrent like Heroku, DigitalOcean, or Railway.' 
  });
});

app.get('/api/torrent/:infoHash', (req, res) => {
  res.json({ 
    error: 'TorBox requires a full Node.js server environment. Please deploy to a platform that supports WebTorrent like Heroku, DigitalOcean, or Railway.' 
  });
});

app.get('/api/stream/:infoHash/:fileIndex', (req, res) => {
  res.json({ 
    error: 'TorBox requires a full Node.js server environment. Please deploy to a platform that supports WebTorrent like Heroku, DigitalOcean, or Railway.' 
  });
});

app.get('/api/file/:infoHash/:fileIndex', (req, res) => {
  res.json({ 
    error: 'TorBox requires a full Node.js server environment. Please deploy to a platform that supports WebTorrent like Heroku, DigitalOcean, or Railway.' 
  });
});

// Export for Vercel
module.exports = app;
