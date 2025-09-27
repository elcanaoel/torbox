const express = require('express');
const cors = require('cors');
const path = require('path');
const WebTorrent = require('webtorrent');
const parseTorrent = require('parse-torrent');
const rangeParser = require('range-parser');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Initialize WebTorrent client
const client = new WebTorrent();

// Store active torrents
const activeTorrents = new Map();

// Helper function to get torrent info without circular references
function getTorrentInfo(torrent) {
  return {
    infoHash: torrent.infoHash,
    name: torrent.name,
    files: torrent.files.map(file => ({
      name: file.name,
      length: file.length,
      path: file.path,
      type: file.type
    })),
    length: torrent.length,
    downloaded: torrent.downloaded,
    uploaded: torrent.uploaded,
    progress: torrent.progress,
    downloadSpeed: torrent.downloadSpeed,
    uploadSpeed: torrent.uploadSpeed,
    timeRemaining: torrent.timeRemaining,
    numPeers: torrent.numPeers,
    ready: torrent.ready
  };
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Parse magnet link and get torrent info
app.post('/api/parse-magnet', (req, res) => {
  const { magnetLink } = req.body;
  
  if (!magnetLink) {
    return res.status(400).json({ error: 'Magnet link is required' });
  }

  try {
    const parsed = parseTorrent(magnetLink);
    res.json({
      infoHash: parsed.infoHash,
      name: parsed.name,
      files: parsed.files || [],
      length: parsed.length
    });
  } catch (error) {
    res.status(400).json({ error: 'Invalid magnet link' });
  }
});

// Start torrent download
app.post('/api/start-torrent', (req, res) => {
  const { magnetLink } = req.body;
  
  if (!magnetLink) {
    return res.status(400).json({ error: 'Magnet link is required' });
  }

  // Check if torrent is already active
  const parsed = parseTorrent(magnetLink);
  const infoHash = parsed.infoHash;
  
  if (activeTorrents.has(infoHash)) {
    return res.json({ 
      infoHash,
      status: 'already_active',
      torrent: activeTorrents.get(infoHash)
    });
  }

  // Add torrent to client with streaming configuration
  const torrent = client.add(magnetLink, {
    // Don't store files locally, stream directly
    store: false,
    // Prioritize streaming over downloading
    strategy: 'sequential',
    // Add options for better audio support
    preload: true,
    // Try to download pieces in order for better streaming
    pieceLength: 262144 // 256KB pieces for better streaming
  }, (torrent) => {
    console.log('Torrent ready for streaming:', torrent.name);
    console.log('Torrent files:', torrent.files.map(f => ({ name: f.name, length: f.length })));
    activeTorrents.set(infoHash, getTorrentInfo(torrent));
  });

  // Handle torrent events
  torrent.on('download', (bytes) => {
    // Note: Socket.io won't work in serverless, so we'll use polling instead
    console.log('Download progress:', torrent.progress);
  });

  torrent.on('done', () => {
    console.log('Torrent finished:', torrent.name);
  });

  res.json({ 
    infoHash,
    status: 'starting',
    message: 'Torrent download started'
  });
});

// Get torrent status
app.get('/api/torrent/:infoHash', (req, res) => {
  const { infoHash } = req.params;
  const torrent = activeTorrents.get(infoHash);
  
  if (!torrent) {
    return res.status(404).json({ error: 'Torrent not found' });
  }

  // Update torrent info with current data
  const actualTorrent = client.torrents.find(t => t.infoHash === infoHash);
  if (actualTorrent) {
    const updatedInfo = getTorrentInfo(actualTorrent);
    activeTorrents.set(infoHash, updatedInfo);
    res.json(updatedInfo);
  } else {
    res.json(torrent);
  }
});

// Stream video file
app.get('/api/stream/:infoHash/:fileIndex', (req, res) => {
  const { infoHash, fileIndex } = req.params;
  
  // Find the actual torrent in WebTorrent client
  const actualTorrent = client.torrents.find(t => t.infoHash === infoHash);
  if (!actualTorrent) {
    return res.status(404).json({ error: 'Torrent not found in client' });
  }

  const file = actualTorrent.files[fileIndex];
  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  // Determine content type based on file extension
  const getContentType = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    const types = {
      'mp4': 'video/mp4',
      'avi': 'video/x-msvideo',
      'mkv': 'video/x-matroska',
      'mov': 'video/quicktime',
      'wmv': 'video/x-ms-wmv',
      'flv': 'video/x-flv',
      'webm': 'video/webm',
      'm4v': 'video/x-m4v',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'flac': 'audio/flac',
      'aac': 'audio/aac',
      'ogg': 'audio/ogg',
      'm4a': 'audio/mp4'
    };
    return types[ext] || 'application/octet-stream';
  };

  // Check if file is a video with audio
  const isVideoWithAudio = (filename) => {
    const videoExts = ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v'];
    const ext = filename.split('.').pop().toLowerCase();
    return videoExts.includes(ext);
  };

  // Set appropriate headers for streaming
  res.setHeader('Content-Type', getContentType(file.name));
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Content-Length', file.length);
  
  // Add CORS headers for better browser compatibility
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Range, Content-Length, Content-Type');
  
  // Add headers to help with audio/video playback
  if (isVideoWithAudio(file.name)) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  }

  // Handle range requests for seeking
  const range = req.headers.range;
  if (range) {
    const ranges = rangeParser(file.length, range);
    if (ranges === -1) {
      res.status(416).send('Requested range not satisfiable');
      return;
    }

    const start = ranges[0].start;
    const end = ranges[0].end;
    const chunkSize = (end - start) + 1;

    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${file.length}`);
    res.setHeader('Content-Length', chunkSize);

    console.log(`Streaming range: ${start}-${end} of ${file.length} bytes`);

    // Create stream with range for seeking
    const stream = file.createReadStream({ 
      start, 
      end,
      // Add options for better streaming
      highWaterMark: 64 * 1024 // 64KB buffer
    });
    
    stream.on('error', (err) => {
      console.error('Stream error:', err);
      if (!res.headersSent) {
        res.status(500).send('Stream error');
      }
    });
    
    stream.pipe(res);
  } else {
    // Stream entire file
    console.log(`Streaming entire file: ${file.length} bytes`);
    const stream = file.createReadStream({
      // Add options for better streaming
      highWaterMark: 64 * 1024 // 64KB buffer
    });
    
    stream.on('error', (err) => {
      console.error('Stream error:', err);
      if (!res.headersSent) {
        res.status(500).send('Stream error');
      }
    });
    
    stream.pipe(res);
  }
});

// Get file info
app.get('/api/file/:infoHash/:fileIndex', (req, res) => {
  const { infoHash, fileIndex } = req.params;
  const torrent = activeTorrents.get(infoHash);
  
  if (!torrent) {
    return res.status(404).json({ error: 'Torrent not found' });
  }

  const actualTorrent = client.torrents.find(t => t.infoHash === infoHash);
  if (!actualTorrent) {
    return res.status(404).json({ error: 'Torrent not found in client' });
  }

  const file = actualTorrent.files[fileIndex];
  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.json({
    name: file.name,
    length: file.length,
    path: file.path,
    type: file.type
  });
});

// Export for Vercel
module.exports = app;
