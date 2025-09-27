class TorBox {
    constructor() {
        this.socket = io();
        this.currentTorrent = null;
        this.currentFile = null;
        this.video = document.getElementById('videoElement');
        this.recentVideos = this.loadRecentVideos();
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupSocketListeners();
        this.displayRecentVideos();
    }

    initializeElements() {
        this.magnetInput = document.getElementById('magnetInput');
        this.parseBtn = document.getElementById('parseBtn');
        this.torrentInfo = document.getElementById('torrentInfo');
        this.torrentName = document.getElementById('torrentName');
        this.torrentSize = document.getElementById('torrentSize');
        this.torrentFiles = document.getElementById('torrentFiles');
        this.startDownloadBtn = document.getElementById('startDownloadBtn');
        this.downloadProgress = document.getElementById('downloadProgress');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.downloadSpeed = document.getElementById('downloadSpeed');
        this.timeRemaining = document.getElementById('timeRemaining');
        this.fileList = document.getElementById('fileList');
        this.filesContainer = document.getElementById('filesContainer');
        this.videoPlayer = document.getElementById('videoPlayer');
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.fullscreenBtn = document.getElementById('fullscreenBtn');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.activeTorrents = document.getElementById('activeTorrents');
        this.recentVideosSection = document.getElementById('recentVideos');
        this.recentVideosList = document.getElementById('recentVideosList');
        this.clearRecentBtn = document.getElementById('clearRecentBtn');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumeDisplay = document.getElementById('volumeDisplay');
        this.unmuteBtn = document.getElementById('unmuteBtn');
        this.testAudioBtn = document.getElementById('testAudioBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
    }

    setupEventListeners() {
        this.parseBtn.addEventListener('click', () => this.parseMagnet());
        this.startDownloadBtn.addEventListener('click', () => this.startDownload());
        this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        this.clearRecentBtn.addEventListener('click', () => this.clearRecentVideos());
        this.volumeSlider.addEventListener('input', () => this.updateVolume());
        this.unmuteBtn.addEventListener('click', () => this.unmuteVideo());
        this.testAudioBtn.addEventListener('click', () => this.testAudio());
        this.downloadBtn.addEventListener('click', () => this.downloadCurrentVideo());
        
        this.magnetInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.parseMagnet();
            }
        });

        this.video.addEventListener('play', () => {
            this.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';
        });

        this.video.addEventListener('pause', () => {
            this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i> Play';
        });
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            this.connectionStatus.textContent = 'Connected';
            this.connectionStatus.style.color = '#4CAF50';
        });

        this.socket.on('disconnect', () => {
            this.connectionStatus.textContent = 'Disconnected';
            this.connectionStatus.style.color = '#f44336';
        });

        this.socket.on('torrent-progress', (data) => {
            this.updateProgress(data);
        });

        this.socket.on('torrent-complete', (data) => {
            this.showNotification('Torrent download completed!', 'success');
            this.loadFileList();
        });
    }

    async parseMagnet() {
        const magnetLink = this.magnetInput.value.trim();
        
        if (!magnetLink) {
            this.showNotification('Please enter a magnet link', 'error');
            return;
        }

        if (!magnetLink.startsWith('magnet:')) {
            this.showNotification('Please enter a valid magnet link', 'error');
            return;
        }

        this.setLoading(true);

        try {
            const response = await fetch('/api/parse-magnet', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ magnetLink })
            });

            const data = await response.json();

            if (response.ok) {
                this.displayTorrentInfo(data);
                this.currentTorrent = data;
            } else {
                this.showNotification(data.error || 'Failed to parse magnet link', 'error');
            }
        } catch (error) {
            this.showNotification('Network error: ' + error.message, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    displayTorrentInfo(data) {
        this.torrentName.textContent = data.name || 'Unknown';
        this.torrentSize.textContent = this.formatBytes(data.length || 0);
        this.torrentFiles.textContent = data.files ? data.files.length : 0;
        
        this.torrentInfo.classList.remove('hidden');
    }

    async startDownload() {
        if (!this.currentTorrent) {
            this.showNotification('Please parse a magnet link first', 'error');
            return;
        }

        this.setLoading(true);

        try {
            const response = await fetch('/api/start-torrent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ magnetLink: this.magnetInput.value })
            });

            const data = await response.json();

            if (response.ok) {
                this.showNotification('Torrent ready for streaming!', 'success');
                this.downloadProgress.classList.remove('hidden');
                this.startPolling(data.infoHash);
                
                // Add to recent videos
                this.addToRecentVideos(this.currentTorrent);
            } else {
                this.showNotification(data.error || 'Failed to start torrent', 'error');
            }
        } catch (error) {
            this.showNotification('Network error: ' + error.message, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    startPolling(infoHash) {
        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`/api/torrent/${infoHash}`);
                const data = await response.json();

                if (response.ok) {
                    this.updateProgress(data);
                    
                    if (data.ready && data.files) {
                        clearInterval(pollInterval);
                        this.loadFileList();
                    }
                } else {
                    clearInterval(pollInterval);
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, 1000);
    }

    updateProgress(data) {
        const progress = Math.round(data.progress * 100);
        this.progressFill.style.width = `${progress}%`;
        this.progressText.textContent = `${progress}%`;
        this.downloadSpeed.textContent = this.formatBytes(data.downloadSpeed || 0) + '/s';
        
        if (data.timeRemaining !== Infinity && data.timeRemaining > 0) {
            this.timeRemaining.textContent = this.formatTime(data.timeRemaining || 0);
        } else {
            this.timeRemaining.textContent = 'Streaming...';
        }
    }

    async loadFileList() {
        if (!this.currentTorrent) return;

        try {
            const response = await fetch(`/api/torrent/${this.currentTorrent.infoHash}`);
            const data = await response.json();

            if (response.ok && data.files) {
                this.displayFileList(data.files);
            }
        } catch (error) {
            console.error('Error loading file list:', error);
        }
    }

    displayFileList(files) {
        this.filesContainer.innerHTML = '';
        
        files.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <div class="file-info">
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${this.formatBytes(file.length)}</div>
                </div>
                <div class="file-type">${this.getFileType(file.name)}</div>
            `;
            
            fileItem.addEventListener('click', () => this.playFile(index));
            this.filesContainer.appendChild(fileItem);
        });

        this.fileList.classList.remove('hidden');
    }

    async playFile(fileIndex) {
        if (!this.currentTorrent) return;

        this.currentFile = fileIndex;
        const streamUrl = `/api/stream/${this.currentTorrent.infoHash}/${fileIndex}`;
        
        // Always try browser player first with better audio handling
        this.playInBrowser(streamUrl, fileIndex);
    }

    async tryExternalPlayer(streamUrl, fileIndex) {
        console.log('Attempting to open in external player...');
        
        // Get file info for better external player support
        try {
            const response = await fetch(`/api/file/${this.currentTorrent.infoHash}/${fileIndex}`);
            const fileInfo = await response.json();
            
            console.log('File info:', fileInfo);
            
            // Show external player interface immediately
            this.showExternalPlayerInfo(streamUrl, fileInfo);
            
            // Try direct download approach
            this.tryDirectDownload(streamUrl, fileInfo);
            
        } catch (error) {
            console.error('Error getting file info:', error);
            this.tryBrowserPlayer(streamUrl, fileIndex);
        }
    }

    tryDirectDownload(streamUrl, fileInfo) {
        const fullUrl = `${window.location.origin}${streamUrl}`;
        console.log('Trying direct download approach:', fullUrl);
        
        // Create a download link that should trigger external player
        const link = document.createElement('a');
        link.href = fullUrl;
        link.download = fileInfo.name || 'video';
        link.target = '_blank';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showNotification('Attempting to download/open in external player...', 'info');
    }

    async tryVLCProtocol(url) {
        try {
            const vlcUrl = `vlc://${url}`;
            console.log('Trying VLC protocol:', vlcUrl);
            
            // Method 1: Direct window.open
            window.open(vlcUrl, '_blank');
            
            // Method 2: Create link and click
            const link = document.createElement('a');
            link.href = vlcUrl;
            link.target = '_blank';
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Method 3: Iframe fallback
            setTimeout(() => {
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                iframe.src = vlcUrl;
                document.body.appendChild(iframe);
                setTimeout(() => {
                    if (iframe.parentNode) {
                        document.body.removeChild(iframe);
                    }
                }, 2000);
            }, 500);
            
        } catch (error) {
            console.log('VLC protocol failed:', error);
        }
    }

    async tryMPCProtocol(url) {
        try {
            const mpcUrl = `mpc://${url}`;
            console.log('Trying MPC-HC protocol:', mpcUrl);
            
            // Method 1: Direct window.open
            window.open(mpcUrl, '_blank');
            
            // Method 2: Create link and click
            const link = document.createElement('a');
            link.href = mpcUrl;
            link.target = '_blank';
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
        } catch (error) {
            console.log('MPC-HC protocol failed:', error);
        }
    }

    async trySystemPlayer(url) {
        try {
            console.log('Trying system default player for:', url);
            
            // Method 1: Direct window.open
            window.open(url, '_blank');
            
            // Method 2: Create link and click
            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
        } catch (error) {
            console.log('System player failed:', error);
        }
    }

    async tryCustomPlayers(url, fileInfo) {
        try {
            // Try PotPlayer
            const potPlayerUrl = `potplayer://${url}`;
            console.log('Trying PotPlayer:', potPlayerUrl);
            
            // Method 1: Direct window.open
            window.open(potPlayerUrl, '_blank');
            
            // Method 2: Create link and click
            const link = document.createElement('a');
            link.href = potPlayerUrl;
            link.target = '_blank';
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
        } catch (error) {
            console.log('Custom players failed:', error);
        }
    }

    showExternalPlayerInfo(streamUrl, fileInfo) {
        this.videoPlayer.classList.remove('hidden');
        const fullUrl = `${window.location.origin}${streamUrl}`;
        
        this.video.innerHTML = `
            <div style="text-align: center; padding: 40px; color: white;">
                <h3><i class="fas fa-download"></i> Download & Play</h3>
                <p>Click download to open in your default media player</p>
                <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>File:</strong> ${fileInfo.name}</p>
                    <p><strong>Size:</strong> ${this.formatBytes(fileInfo.length)}</p>
                    <p><strong>Stream URL:</strong></p>
                    <input type="text" value="${fullUrl}" 
                           style="width: 100%; padding: 8px; margin: 10px 0; background: rgba(0,0,0,0.3); color: white; border: 1px solid #666; border-radius: 4px;" 
                           readonly onclick="this.select()" />
                </div>
                <div style="margin-top: 20px;">
                    <button onclick="torBox.downloadAndPlay('${fullUrl}', '${fileInfo.name}')" 
                            style="background: #ff6b35; color: white; border: none; padding: 15px 30px; border-radius: 8px; margin: 10px; cursor: pointer; font-size: 16px; font-weight: bold;">
                        <i class="fas fa-download"></i> Download & Play
                    </button>
                    <button onclick="torBox.copyStreamUrl('${fullUrl}')" 
                            style="background: #667eea; color: white; border: none; padding: 10px 20px; border-radius: 6px; margin: 5px; cursor: pointer;">
                        <i class="fas fa-copy"></i> Copy URL
                    </button>
                    <button onclick="torBox.tryBrowserPlayer('${streamUrl}', ${this.currentFile})" 
                            style="background: #56ab2f; color: white; border: none; padding: 10px 20px; border-radius: 6px; margin: 5px; cursor: pointer;">
                        <i class="fas fa-globe"></i> Browser Player
                    </button>
                </div>
                <div style="margin-top: 20px; font-size: 0.9rem; opacity: 0.8;">
                    <p><strong>Instructions:</strong></p>
                    <p>1. Click "Download & Play" to open in your default media player</p>
                    <p>2. Or copy the URL and paste it in VLC/MPC-HC "Open Network Stream"</p>
                    <p>3. Or use "Browser Player" for in-browser playback</p>
                </div>
            </div>
        `;
        
        this.videoPlayer.scrollIntoView({ behavior: 'smooth' });
    }

    copyStreamUrl(url) {
        navigator.clipboard.writeText(url).then(() => {
            this.showNotification('Stream URL copied to clipboard!', 'success');
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = url;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showNotification('Stream URL copied to clipboard!', 'success');
        });
    }

    openVLC(url) {
        console.log('Opening VLC with URL:', url);
        const vlcUrl = `vlc://${url}`;
        
        // Try multiple methods
        window.open(vlcUrl, '_blank');
        
        const link = document.createElement('a');
        link.href = vlcUrl;
        link.target = '_blank';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showNotification('Attempting to open VLC...', 'info');
    }

    downloadAndPlay(url, filename) {
        console.log('Downloading and playing:', url, filename);
        
        // Create download link
        const link = document.createElement('a');
        link.href = url;
        link.download = filename || 'video';
        link.target = '_blank';
        link.style.display = 'none';
        document.body.appendChild(link);
        
        // Trigger download
        link.click();
        document.body.removeChild(link);
        
        // Also try to open in new tab for streaming
        setTimeout(() => {
            window.open(url, '_blank');
        }, 500);
        
        this.showNotification('Downloading and attempting to open in media player...', 'success');
    }

    playInBrowser(streamUrl, fileIndex) {
        console.log('Playing in browser:', streamUrl);
        
        // Show loading state
        this.video.innerHTML = 'Loading stream...';
        this.videoPlayer.classList.remove('hidden');
        
        // Clear any existing event listeners
        this.video.removeEventListener('loadstart', this.handleLoadStart);
        this.video.removeEventListener('canplay', this.handleCanPlay);
        this.video.removeEventListener('error', this.handleVideoError);
        this.video.removeEventListener('loadedmetadata', this.handleLoadedMetadata);
        this.video.removeEventListener('canplaythrough', this.handleCanPlayThrough);
        
        // Add event listeners
        this.video.addEventListener('loadstart', this.handleLoadStart.bind(this));
        this.video.addEventListener('canplay', this.handleCanPlay.bind(this));
        this.video.addEventListener('error', this.handleVideoError.bind(this));
        this.video.addEventListener('loadedmetadata', this.handleLoadedMetadata.bind(this));
        this.video.addEventListener('canplaythrough', this.handleCanPlayThrough.bind(this));
        
        // Reset video element completely
        this.video.removeAttribute('src');
        this.video.load();
        
        // Set video source with proper attributes for audio
        this.video.src = streamUrl;
        this.video.controls = true;
        this.video.preload = 'auto';
        this.video.muted = false;
        this.video.volume = 1.0;
        this.video.autoplay = false; // Don't autoplay to avoid browser restrictions
        
        // Add attributes for better compatibility
        this.video.setAttribute('playsinline', 'true');
        this.video.setAttribute('webkit-playsinline', 'true');
        this.video.setAttribute('x-webkit-airplay', 'allow');
        
        // Force reload
        this.video.load();
        
        // Multiple attempts to ensure audio works
        setTimeout(() => {
            this.video.muted = false;
            this.video.volume = 1.0;
            console.log('Audio settings applied - muted:', this.video.muted, 'volume:', this.video.volume);
        }, 500);
        
        setTimeout(() => {
            this.video.muted = false;
            this.video.volume = 1.0;
            console.log('Audio settings re-applied - muted:', this.video.muted, 'volume:', this.video.volume);
        }, 2000);
        
        // Scroll to video player
        this.videoPlayer.scrollIntoView({ behavior: 'smooth' });
    }

    handleCanPlayThrough() {
        console.log('Video can play through completely');
        this.video.innerHTML = ''; // Clear loading message
        
        // Ensure audio is enabled
        this.video.muted = false;
        this.video.volume = 1.0;
        
        // Try to play automatically
        this.video.play().then(() => {
            console.log('Video started playing automatically');
        }).catch(err => {
            console.log('Auto-play failed, user needs to click play:', err);
        });
    }

    tryAlternativeStreaming(fileIndex) {
        console.log('Attempting alternative streaming method...');
        
        // Try without range requests by adding a cache-busting parameter
        const streamUrl = `/api/stream/${this.currentTorrent.infoHash}/${fileIndex}?nocache=${Date.now()}`;
        
        // Create a new video element to test
        const testVideo = document.createElement('video');
        testVideo.controls = true;
        testVideo.muted = false;
        testVideo.volume = 1.0;
        testVideo.preload = 'auto';
        testVideo.style.width = '100%';
        testVideo.style.maxHeight = '500px';
        testVideo.style.borderRadius = '8px';
        
        testVideo.addEventListener('canplay', () => {
            console.log('Alternative streaming successful!');
            // Replace the original video with the working one
            this.video.parentNode.replaceChild(testVideo, this.video);
            this.video = testVideo;
            this.showNotification('Stream loaded with alternative method', 'success');
        });
        
        testVideo.addEventListener('error', (e) => {
            console.error('Alternative streaming also failed:', e);
            this.showNotification('Both streaming methods failed. Try a different video file.', 'error');
        });
        
        testVideo.src = streamUrl;
        testVideo.load();
    }

    handleLoadStart() {
        console.log('Stream loading started');
        this.video.innerHTML = 'Loading stream...';
    }

    handleLoadedMetadata() {
        console.log('Stream metadata loaded');
        console.log('Video duration:', this.video.duration);
        console.log('Video dimensions:', this.video.videoWidth + 'x' + this.video.videoHeight);
        console.log('Audio tracks:', this.video.audioTracks ? this.video.audioTracks.length : 'N/A');
        console.log('Video muted:', this.video.muted);
        console.log('Video volume:', this.video.volume);
        
        // Check if video has audio
        if (this.video.mozHasAudio !== undefined) {
            console.log('Has audio (Firefox):', this.video.mozHasAudio);
        }
        
        // Check for audio in Chrome/Edge
        if (this.video.webkitAudioDecodedByteCount !== undefined) {
            console.log('Audio decoded bytes:', this.video.webkitAudioDecodedByteCount);
        }
        
        // Force unmute and set volume
        this.video.muted = false;
        this.video.volume = 1.0;
        console.log('Forced audio settings - muted:', this.video.muted, 'volume:', this.video.volume);
        
        // Try to detect audio in other browsers
        this.video.addEventListener('loadeddata', () => {
            console.log('Stream data loaded');
            console.log('Video ready state:', this.video.readyState);
            
            // Check for audio by trying to play and immediately pause
            const wasPlaying = !this.video.paused;
            this.video.play().then(() => {
                console.log('Video can play with audio');
                console.log('Audio playing:', !this.video.paused && !this.video.muted);
                if (!wasPlaying) this.video.pause();
            }).catch(err => {
                console.log('Video play error (might be audio codec issue):', err);
                this.showNotification('Audio codec not supported. Try a different video file.', 'error');
            });
        });
    }

    handleCanPlay() {
        console.log('Stream ready to play');
        this.video.innerHTML = ''; // Clear loading message
    }

    handleVideoError(e) {
        console.error('Stream error:', e);
        console.error('Video error details:', {
            code: this.video.error ? this.video.error.code : 'unknown',
            message: this.video.error ? this.video.error.message : 'unknown'
        });
        
        const errorCode = this.video.error ? this.video.error.code : 'unknown';
        
        if (errorCode === 4) {
            this.showNotification('Media format not supported. This might be an audio codec issue. Trying alternative method...', 'error');
            // Try alternative streaming
            if (this.currentFile !== null) {
                this.tryAlternativeStreaming(this.currentFile);
            }
        } else if (errorCode === 3) {
            this.showNotification('Network error. Check your connection and try again.', 'error');
        } else {
            this.showNotification('Error loading stream. This might be due to audio codec issues. Try a different file.', 'error');
        }
    }

    togglePlayPause() {
        if (this.video.paused) {
            this.video.play();
        } else {
            this.video.pause();
        }
    }

    toggleFullscreen() {
        if (this.video.requestFullscreen) {
            this.video.requestFullscreen();
        } else if (this.video.webkitRequestFullscreen) {
            this.video.webkitRequestFullscreen();
        } else if (this.video.msRequestFullscreen) {
            this.video.msRequestFullscreen();
        }
    }

    updateVolume() {
        const volume = parseFloat(this.volumeSlider.value);
        this.video.volume = volume;
        this.volumeDisplay.textContent = Math.round(volume * 100) + '%';
        
        // Update unmute button state
        if (volume > 0) {
            this.unmuteBtn.innerHTML = '<i class="fas fa-volume-up"></i> Mute';
        } else {
            this.unmuteBtn.innerHTML = '<i class="fas fa-volume-mute"></i> Unmute';
        }
    }

    unmuteVideo() {
        if (this.video.muted || this.video.volume === 0) {
            this.video.muted = false;
            this.video.volume = 1.0;
            this.volumeSlider.value = 1.0;
            this.volumeDisplay.textContent = '100%';
            this.unmuteBtn.innerHTML = '<i class="fas fa-volume-up"></i> Mute';
            this.showNotification('Audio unmuted', 'success');
        } else {
            this.video.muted = true;
            this.unmuteBtn.innerHTML = '<i class="fas fa-volume-mute"></i> Unmute';
            this.showNotification('Audio muted', 'info');
        }
    }

    testAudio() {
        console.log('=== AUDIO DEBUG INFO ===');
        console.log('Video element:', this.video);
        console.log('Video src:', this.video.src);
        console.log('Video muted:', this.video.muted);
        console.log('Video volume:', this.video.volume);
        console.log('Video readyState:', this.video.readyState);
        console.log('Video networkState:', this.video.networkState);
        console.log('Video duration:', this.video.duration);
        
        // Check browser audio support
        console.log('Audio context support:', typeof AudioContext !== 'undefined');
        console.log('Web Audio API support:', typeof webkitAudioContext !== 'undefined');
        
        // Try to play video and check for audio
        if (this.video.paused) {
            this.video.play().then(() => {
                console.log('Video started playing');
                console.log('Audio playing:', !this.video.muted && this.video.volume > 0);
                
                // Check if audio is actually playing
                setTimeout(() => {
                    console.log('After 2 seconds - Video playing:', !this.video.paused);
                    console.log('After 2 seconds - Audio muted:', this.video.muted);
                    console.log('After 2 seconds - Volume:', this.video.volume);
                    
                    if (this.video.muted || this.video.volume === 0) {
                        this.showNotification('Audio is muted or volume is 0. Check volume controls.', 'error');
                    } else if (this.video.paused) {
                        this.showNotification('Video is paused. Click play to test audio.', 'info');
                    } else {
                        this.showNotification('Video is playing. Check if you can hear audio.', 'success');
                    }
                }, 2000);
            }).catch(err => {
                console.error('Error playing video:', err);
                this.showNotification('Error playing video: ' + err.message, 'error');
            });
        } else {
            console.log('Video is already playing');
            this.showNotification('Video is already playing. Check if you can hear audio.', 'info');
        }
        
        // Show debug info in notification
        this.showNotification('Audio debug info logged to console (F12)', 'info');
        
        // Test browser audio with Web Audio API
        this.testBrowserAudio();
    }

    testBrowserAudio() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                const audioContext = new AudioContext();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
                
                oscillator.start();
                oscillator.stop(audioContext.currentTime + 0.5);
                
                console.log('Browser audio test: Generated 440Hz tone for 0.5 seconds');
                this.showNotification('Browser audio test: Listen for a beep sound', 'info');
            } else {
                console.log('Web Audio API not supported');
                this.showNotification('Web Audio API not supported in this browser', 'error');
            }
        } catch (error) {
            console.error('Browser audio test failed:', error);
            this.showNotification('Browser audio test failed: ' + error.message, 'error');
        }
    }

    downloadCurrentVideo() {
        if (!this.currentTorrent || this.currentFile === null) {
            this.showNotification('No video selected for download', 'error');
            return;
        }

        const streamUrl = `/api/stream/${this.currentTorrent.infoHash}/${this.currentFile}`;
        const fullUrl = `${window.location.origin}${streamUrl}`;
        
        // Get file info for proper filename
        fetch(`/api/file/${this.currentTorrent.infoHash}/${this.currentFile}`)
            .then(response => response.json())
            .then(fileInfo => {
                const link = document.createElement('a');
                link.href = fullUrl;
                link.download = fileInfo.name || 'video';
                link.target = '_blank';
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                this.showNotification('Download started!', 'success');
            })
            .catch(error => {
                console.error('Error getting file info:', error);
                // Download without proper filename
                const link = document.createElement('a');
                link.href = fullUrl;
                link.download = 'video';
                link.target = '_blank';
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                this.showNotification('Download started!', 'success');
            });
    }

    setLoading(loading) {
        if (loading) {
            this.parseBtn.classList.add('loading');
            this.startDownloadBtn.classList.add('loading');
        } else {
            this.parseBtn.classList.remove('loading');
            this.startDownloadBtn.classList.remove('loading');
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;

        // Set background color based on type
        switch (type) {
            case 'success':
                notification.style.backgroundColor = '#4CAF50';
                break;
            case 'error':
                notification.style.backgroundColor = '#f44336';
                break;
            default:
                notification.style.backgroundColor = '#2196F3';
        }

        document.body.appendChild(notification);

        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }

    getFileType(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const videoExts = ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v'];
        const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'];
        
        if (videoExts.includes(ext)) return 'Video';
        if (audioExts.includes(ext)) return 'Audio';
        return 'File';
    }

    // Recent Videos functionality
    loadRecentVideos() {
        try {
            const stored = localStorage.getItem('torbox-recent-videos');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error loading recent videos:', error);
            return [];
        }
    }

    saveRecentVideos() {
        try {
            localStorage.setItem('torbox-recent-videos', JSON.stringify(this.recentVideos));
        } catch (error) {
            console.error('Error saving recent videos:', error);
        }
    }

    addToRecentVideos(torrentInfo) {
        if (!torrentInfo) return;

        const recentItem = {
            id: torrentInfo.infoHash,
            name: torrentInfo.name || 'Unknown',
            size: torrentInfo.length || 0,
            files: torrentInfo.files ? torrentInfo.files.length : 0,
            magnetLink: this.magnetInput.value,
            addedAt: new Date().toISOString()
        };

        // Remove if already exists
        this.recentVideos = this.recentVideos.filter(item => item.id !== recentItem.id);
        
        // Add to beginning
        this.recentVideos.unshift(recentItem);
        
        // Keep only last 10 items
        this.recentVideos = this.recentVideos.slice(0, 10);
        
        this.saveRecentVideos();
        this.displayRecentVideos();
    }

    displayRecentVideos() {
        if (this.recentVideos.length === 0) {
            this.recentVideosSection.classList.add('hidden');
            return;
        }

        this.recentVideosSection.classList.remove('hidden');
        this.recentVideosList.innerHTML = '';

        this.recentVideos.forEach((item, index) => {
            const recentItem = document.createElement('div');
            recentItem.className = 'recent-video-item';
            recentItem.innerHTML = `
                <div class="recent-video-info">
                    <div class="recent-video-name">${this.truncateText(item.name, 50)}</div>
                    <div class="recent-video-details">
                        <span><i class="fas fa-hdd"></i> ${this.formatBytes(item.size)}</span>
                        <span><i class="fas fa-file"></i> ${item.files} files</span>
                        <span><i class="fas fa-clock"></i> ${this.formatDate(item.addedAt)}</span>
                    </div>
                </div>
                <div class="recent-video-actions">
                    <button class="recent-video-play-btn" onclick="torBox.loadRecentVideo(${index})">
                        <i class="fas fa-play"></i> Load
                    </button>
                    <button class="recent-video-remove-btn" onclick="torBox.removeRecentVideo(${index})">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            this.recentVideosList.appendChild(recentItem);
        });
    }

    loadRecentVideo(index) {
        const item = this.recentVideos[index];
        if (item) {
            this.magnetInput.value = item.magnetLink;
            this.parseMagnet();
            this.showNotification('Loading recent video...', 'info');
        }
    }

    removeRecentVideo(index) {
        this.recentVideos.splice(index, 1);
        this.saveRecentVideos();
        this.displayRecentVideos();
        this.showNotification('Removed from recent videos', 'info');
    }

    clearRecentVideos() {
        if (confirm('Are you sure you want to clear all recent videos?')) {
            this.recentVideos = [];
            this.saveRecentVideos();
            this.displayRecentVideos();
            this.showNotification('Recent videos cleared', 'info');
        }
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
        
        if (diffInHours < 1) return 'Just now';
        if (diffInHours < 24) return `${diffInHours}h ago`;
        if (diffInHours < 48) return 'Yesterday';
        return date.toLocaleDateString();
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.torBox = new TorBox();
});
