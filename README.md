# TorBox - Torrent Streaming Application

A modern web application that allows you to stream torrents directly from magnet links in your browser.

## Features

- 🔗 **Magnet Link Support**: Paste any magnet link to start streaming
- 📺 **Video Streaming**: Stream video files directly in the browser
- 📊 **Real-time Progress**: Live download progress and speed monitoring
- 🎮 **Video Controls**: Full video player with play/pause and fullscreen
- 📁 **File Selection**: Choose from multiple files in a torrent
- 🎨 **Modern UI**: Beautiful, responsive interface
- ⚡ **Real-time Updates**: Live progress updates via WebSocket

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

1. Start the server:
   ```bash
   npm start
   ```
   Or for development with auto-restart:
   ```bash
   npm run dev
   ```

2. Open your browser and go to `http://localhost:3000`

3. Paste a magnet link in the input field and click "Parse Magnet"

4. Click "Start Download" to begin downloading the torrent

5. Once files are available, click on any file to start streaming

## How It Works

1. **Magnet Parsing**: The application parses magnet links to extract torrent metadata
2. **Torrent Download**: Uses WebTorrent to download torrents in the browser
3. **Streaming**: Creates streaming endpoints for video files with range request support
4. **Real-time Updates**: WebSocket connections provide live progress updates

## Supported File Types

- **Video**: MP4, AVI, MKV, MOV, WMV, FLV, WebM, M4V
- **Audio**: MP3, WAV, FLAC, AAC, OGG, M4A
- **Other**: Any file type can be downloaded

## API Endpoints

- `POST /api/parse-magnet` - Parse magnet link and get torrent info
- `POST /api/start-torrent` - Start downloading a torrent
- `GET /api/torrent/:infoHash` - Get torrent status
- `GET /api/stream/:infoHash/:fileIndex` - Stream a specific file
- `GET /api/file/:infoHash/:fileIndex` - Get file information

## Technical Details

- **Backend**: Node.js with Express
- **Torrent Client**: WebTorrent
- **Real-time**: Socket.io
- **Frontend**: Vanilla JavaScript with modern CSS
- **Streaming**: HTTP range requests for seeking support

## Security Note

This application is for educational purposes. Please ensure you have the right to download and stream the content you're accessing. Always respect copyright laws and terms of service.

## Browser Compatibility

- Chrome (recommended)
- Firefox
- Safari
- Edge

## Troubleshooting

- Make sure all dependencies are installed
- Check that port 3000 is available
- Ensure your browser supports WebRTC (required for WebTorrent)
- Some torrents may take time to connect to peers

## License

MIT License - feel free to modify and distribute.
