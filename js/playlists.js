/* ===========================
   我的歌单管理器（优化版）- 集成播放列表
   =========================== */

class PlaylistManager {
    constructor() {
        this.userPlaylists = [];
        this.expandedPlaylistId = null; // 当前展开的歌单ID
        this.playlistCache = new Map(); // 歌单详情缓存 {playlistId: {songs, detail}}
        this.isLoading = false;
        
        this.init();
    }

    init() {
        this.bindEvents();
        
        // 监听登录状态变化
        document.addEventListener('loginStatusChanged', () => {
            this.loadUserPlaylists();
        });
        
        // 如果已经登录，加载歌单
        if (window.loginManager?.checkLogin()) {
            setTimeout(() => this.loadUserPlaylists(), 1000);
        }
    }

    bindEvents() {
        // 监听歌单页面切换
        const playlistsNav = document.querySelector('.nav-item[href="#playlists"]');
        if (playlistsNav) {
            playlistsNav.addEventListener('click', () => {
                this.onPlaylistsPageOpen();
            });
        }
    }

    // 歌单页面打开时的处理
    onPlaylistsPageOpen() {
        if (window.loginManager?.checkLogin()) {
            this.loadUserPlaylists();
        } else {
            this.showLoginPrompt();
        }
    }

    // 显示登录提示
    showLoginPrompt() {
        const playlistsContent = document.getElementById('playlistsContent');
        if (!playlistsContent) return;

        playlistsContent.innerHTML = `
            <div class="login-prompt">
                <div class="prompt-icon">
                    <i class="fas fa-music"></i>
                </div>
                <h3>查看我的歌单</h3>
                <p>登录后可以查看和管理您的网易云音乐歌单</p>
                <button onclick="window.login()" class="btn-primary">
                    <i class="fas fa-sign-in-alt"></i> 立即登录
                </button>
            </div>
        `;
    }

    // 加载用户歌单
    async loadUserPlaylists() {
        try {
            // 检查登录状态
            if (!window.loginManager?.checkLogin()) {
                this.showLoginPrompt();
                return;
            }

            const userInfo = window.loginManager.getUserInfo();
            if (!userInfo?.profile?.userId) {
                console.error('无法获取用户ID');
                return;
            }

            const userId = userInfo.profile.userId;
            this.showLoading();

            // 获取用户歌单
            const data = await this.fetchUserPlaylists(userId);
            
            if (data.code === 200 && data.playlist) {
                this.userPlaylists = data.playlist;
                this.renderPlaylists();
            } else {
                throw new Error(data.message || '获取歌单失败');
            }

        } catch (error) {
            console.error('加载用户歌单失败:', error);
            this.showError('加载歌单失败', error.message);
        } finally {
            this.hideLoading();
        }
    }

    // 获取用户歌单
    async fetchUserPlaylists(userId) {
        const params = {
            uid: userId,
            limit: 100,
            timestamp: Date.now()
        };

        if (typeof fetchWithAuth === 'function') {
            return await fetchWithAuth('/user/playlist', params);
        } else {
            const url = buildApiUrl('/user/playlist', params);
            const response = await fetch(url);
            return await response.json();
        }
    }

    // 渲染歌单列表（包含可能的展开详情）
    renderPlaylists() {
        const playlistsContent = document.getElementById('playlistsContent');
        if (!playlistsContent) return;

        if (!this.userPlaylists || this.userPlaylists.length === 0) {
            playlistsContent.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-list"></i>
                    <h3>暂无歌单</h3>
                    <p>您还没有创建任何歌单</p>
                </div>
            `;
            return;
        }

        let html = '<div class="playlists-container">';

        // 如果有展开的歌单，先显示这个歌单的详情
        if (this.expandedPlaylistId) {
            const expandedPlaylist = this.userPlaylists.find(p => p.id == this.expandedPlaylistId);
            if (expandedPlaylist) {
                html += this.renderExpandedPlaylist(expandedPlaylist);
            }
        }

        // 分离创建的歌单和收藏的歌单
        const createdPlaylists = this.userPlaylists.filter(p => !p.subscribed);
        const subscribedPlaylists = this.userPlaylists.filter(p => p.subscribed);

        // 显示其他歌单
        html += '<div class="other-playlists">';
        
        // 当前展开的歌单不显示在其他列表中
        const otherCreatedPlaylists = createdPlaylists.filter(p => p.id != this.expandedPlaylistId);
        const otherSubscribedPlaylists = subscribedPlaylists.filter(p => p.id != this.expandedPlaylistId);

        // 创建的歌单
        if (otherCreatedPlaylists.length > 0) {
            html += this.renderPlaylistSection('我创建的歌单', otherCreatedPlaylists);
        }

        // 收藏的歌单
        if (otherSubscribedPlaylists.length > 0) {
            html += this.renderPlaylistSection('我收藏的歌单', otherSubscribedPlaylists);
        }
        
        html += '</div>'; // 关闭 other-playlists
        html += '</div>'; // 关闭 playlists-container
        
        playlistsContent.innerHTML = html;

        // 绑定事件
        this.bindPlaylistEvents();
        
        // 如果当前有展开的歌单，显示它的歌曲列表
        if (this.expandedPlaylistId) {
            this.loadAndShowPlaylistSongs(this.expandedPlaylistId);
        }
    }

    // 渲染展开的歌单详情（大卡片样式）
    renderExpandedPlaylist(playlist) {
        const cachedData = this.playlistCache.get(playlist.id);
        const trackCount = cachedData ? cachedData.songs.length : (playlist.trackCount || 0);
        const creator = playlist.creator?.nickname || '未知';
        
        return `
            <div class="expanded-playlist" data-id="${playlist.id}">
                <div class="expanded-header">
                    <div class="expanded-cover">
                        <img src="${playlist.coverImgUrl || 'https://via.placeholder.com/200'}?param=200y200" 
                             alt="${playlist.name}">
                    </div>
                    <div class="expanded-info">
                        <div class="expanded-badge">当前查看</div>
                        <h2 class="expanded-name">${playlist.name}</h2>
                        <div class="expanded-meta">
                            <span><i class="fas fa-user"></i> ${creator}</span>
                            <span><i class="fas fa-music"></i> ${trackCount} 首歌曲</span>
                            <span><i class="fas fa-play-circle"></i> ${this.formatNumber(playlist.playCount || 0)} 次播放</span>
                        </div>
                        ${playlist.description ? `
                        <div class="expanded-desc">
                            <p>${playlist.description}</p>
                        </div>
                        ` : ''}
                        <div class="expanded-actions">
                            <button class="action-btn primary" onclick="playlistManager.playPlaylist(${playlist.id})">
                                <i class="fas fa-play"></i> 播放全部
                            </button>
                            <button class="action-btn" onclick="playlistManager.shufflePlay(${playlist.id})">
                                <i class="fas fa-random"></i> 随机播放
                            </button>
                            <button class="action-btn" onclick="playlistManager.addAllToQueue(${playlist.id})">
                                <i class="fas fa-plus-circle"></i> 全部添加到列表
                            </button>
                            <button class="action-btn" onclick="playlistManager.collapsePlaylist()">
                                <i class="fas fa-times"></i> 关闭
                            </button>
                        </div>
                    </div>
                </div>
                <div class="expanded-songs" id="expandedSongs_${playlist.id}">
                    <div class="songs-loading">
                        <div class="spinner small"></div>
                        <div>加载歌曲中...</div>
                    </div>
                </div>
            </div>
        `;
    }

    // 渲染歌单部分
    renderPlaylistSection(title, playlists) {
        return `
            <div class="playlist-section">
                <h3 class="section-title">
                    <i class="fas fa-folder"></i> ${title}
                    <span class="section-count">${playlists.length}</span>
                </h3>
                <div class="playlists-grid">
                    ${playlists.map(playlist => this.renderPlaylistCard(playlist)).join('')}
                </div>
            </div>
        `;
    }

    // 渲染单个歌单卡片
    renderPlaylistCard(playlist) {
        const trackCount = playlist.trackCount || 0;
        const playCount = playlist.playCount || 0;
        const creator = playlist.creator?.nickname || '未知';
        const subscribed = playlist.subscribed ? 'subscribed' : '';
        
        // 检查是否是当前展开的歌单
        const isExpanded = playlist.id == this.expandedPlaylistId ? 'expanded' : '';
        
        return `
            <div class="playlist-card ${subscribed} ${isExpanded}" data-id="${playlist.id}">
                <div class="playlist-cover">
                    <img src="${playlist.coverImgUrl || 'https://via.placeholder.com/200'}?param=200y200" 
                         alt="${playlist.name}"
                         onerror="this.src='https://via.placeholder.com/200?text=No+Cover'">
                    <div class="playlist-overlay">
                        <button class="play-btn" onclick="playlistManager.playPlaylist(${playlist.id})" title="播放歌单">
                            <i class="fas fa-play"></i>
                        </button>
                        <button class="view-btn" onclick="playlistManager.toggleExpandPlaylist(${playlist.id})" title="查看详情">
                            ${playlist.id == this.expandedPlaylistId ? '<i class="fas fa-compress"></i>' : '<i class="fas fa-expand"></i>'}
                        </button>
                    </div>
                    ${playlist.subscribed ? '<div class="subscribed-badge"><i class="fas fa-heart"></i></div>' : ''}
                </div>
                <div class="playlist-info">
                    <h4 class="playlist-name" title="${playlist.name}">${playlist.name}</h4>
                    <div class="playlist-stats">
                        <span class="stat-item">
                            <i class="fas fa-music"></i> ${trackCount}
                        </span>
                        <span class="stat-item">
                            <i class="fas fa-play-circle"></i> ${this.formatNumber(playCount)}
                        </span>
                    </div>
                    <div class="playlist-creator">
                        <i class="fas fa-user"></i> ${creator}
                    </div>
                </div>
            </div>
        `;
    }

    // 切换歌单展开/收起状态
    async toggleExpandPlaylist(playlistId) {
        if (this.expandedPlaylistId === playlistId) {
            // 如果点击的是当前已展开的歌单，则收起
            this.collapsePlaylist();
        } else {
            // 展开新的歌单
            this.expandedPlaylistId = playlistId;
            this.renderPlaylists(); // 重新渲染页面
            
            // 滚动到展开的歌单位置
            setTimeout(() => {
                const expandedElement = document.querySelector('.expanded-playlist');
                if (expandedElement) {
                    expandedElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 100);
        }
    }

    // 收起当前展开的歌单
    collapsePlaylist() {
        this.expandedPlaylistId = null;
        this.renderPlaylists();
    }

    // 加载并显示歌单歌曲
    async loadAndShowPlaylistSongs(playlistId) {
        try {
            const songsContainer = document.getElementById(`expandedSongs_${playlistId}`);
            if (!songsContainer) return;

            // 检查缓存
            if (this.playlistCache.has(playlistId)) {
                const cachedData = this.playlistCache.get(playlistId);
                this.renderSongsList(songsContainer, cachedData.songs);
                return;
            }

            // 显示加载状态
            songsContainer.innerHTML = `
                <div class="songs-loading">
                    <div class="spinner small"></div>
                    <div>加载歌曲中...</div>
                </div>
            `;

            // 获取歌单详情
            const detailData = await this.fetchPlaylistDetail(playlistId);
            
            if (detailData.code === 200 && detailData.playlist?.tracks) {
                const songs = detailData.playlist.tracks;
                
                // 缓存数据
                this.playlistCache.set(playlistId, {
                    songs: songs,
                    detail: detailData.playlist,
                    timestamp: Date.now()
                });
                
                // 渲染歌曲列表
                this.renderSongsList(songsContainer, songs);
            } else {
                throw new Error('获取歌单歌曲失败');
            }

        } catch (error) {
            console.error('加载歌单歌曲失败:', error);
            const songsContainer = document.getElementById(`expandedSongs_${playlistId}`);
            if (songsContainer) {
                songsContainer.innerHTML = `
                    <div class="error-state small">
                        <i class="fas fa-exclamation-circle"></i>
                        <div>加载失败: ${error.message}</div>
                        <button onclick="playlistManager.loadAndShowPlaylistSongs(${playlistId})" class="btn-text">
                            重试
                        </button>
                    </div>
                `;
            }
        }
    }

    // 渲染歌曲列表
    renderSongsList(container, songs) {
        if (!songs || songs.length === 0) {
            container.innerHTML = `
                <div class="empty-songs">
                    <i class="fas fa-music"></i>
                    <p>歌单中暂无歌曲</p>
                </div>
            `;
            return;
        }

        let html = `
            <div class="songs-list compact">
                <div class="list-header">
                    <div class="header-cell" style="width: 40px;">#</div>
                    <div class="header-cell" style="flex: 2;">歌曲标题</div>
                    <div class="header-cell" style="flex: 1;">歌手</div>
                    <div class="header-cell" style="width: 80px;">时长</div>
                    <div class="header-cell" style="width: 120px;">操作</div>
                </div>
                <div class="list-body">
                    ${songs.map((song, index) => this.renderCompactSongItem(song, index)).join('')}
                </div>
            </div>
        `;

        container.innerHTML = html;
        
        // 绑定歌曲事件
        this.bindCompactSongEvents(container);
    }

    // 渲染紧凑型歌曲项
    renderCompactSongItem(song, index) {
        const artists = song.ar ? song.ar.map(artist => artist.name).join(', ') : '未知';
        const duration = Math.floor((song.dt || 0) / 1000);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        
        return `
            <div class="song-item compact" data-id="${song.id}">
                <div class="song-cell" style="width: 40px;">
                    <span class="song-index">${index + 1}</span>
                </div>
                <div class="song-cell" style="flex: 2;">
                    <div class="song-info compact">
                        <div class="song-text">
                            <div class="song-name">${song.name}</div>
                            <div class="song-album">${song.al?.name || ''}</div>
                        </div>
                    </div>
                </div>
                <div class="song-cell" style="flex: 1;">
                    <div class="song-artists">${artists}</div>
                </div>
                <div class="song-cell" style="width: 80px;">
                    <div class="song-duration">${minutes}:${seconds.toString().padStart(2, '0')}</div>
                </div>
                <div class="song-cell" style="width: 120px;">
                    <div class="song-actions">
                        <button class="action-btn small" onclick="playlistManager.playSingleSong(${song.id}, '${song.name.replace(/'/g, "\\'")}', '${artists.replace(/'/g, "\\'")}')" title="播放">
                            <i class="fas fa-play"></i>
                        </button>
                        <button class="action-btn small" onclick="playlistManager.addSingleToQueue(${song.id}, '${song.name.replace(/'/g, "\\'")}', '${artists.replace(/'/g, "\\'")}')" title="添加到播放列表">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // 绑定紧凑型歌曲事件
    bindCompactSongEvents(container) {
        container.querySelectorAll('.song-item.compact').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.action-btn')) {
                    const songId = item.dataset.id;
                    const songName = item.querySelector('.song-name')?.textContent || '';
                    const artists = item.querySelector('.song-artists')?.textContent || '';
                    if (songId) {
                        this.playSingleSong(songId, songName, artists);
                    }
                }
            });
        });
    }

    // 绑定歌单事件
    bindPlaylistEvents() {
        // 点击歌单卡片（非按钮区域）
        document.querySelectorAll('.playlist-card:not(.expanded)').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.play-btn') && !e.target.closest('.view-btn')) {
                    const playlistId = card.dataset.id;
                    this.toggleExpandPlaylist(playlistId);
                }
            });
        });
    }

    // 获取歌单详情
    async fetchPlaylistDetail(playlistId) {
        const params = {
            id: playlistId,
            timestamp: Date.now()
        };

        if (typeof fetchWithAuth === 'function') {
            return await fetchWithAuth('/playlist/detail', params);
        } else {
            const url = buildApiUrl('/playlist/detail', params);
            const response = await fetch(url);
            return await response.json();
        }
    }

    // 播放单首歌曲
    async playSingleSong(songId, songName, artists = '') {
        try {
            // 获取歌曲URL
            const url = buildApiUrl('/song/url', { id: songId });
            const response = await fetch(url);
            const data = await response.json();

            if (data.code === 200 && data.data && data.data[0] && data.data[0].url) {
                const songUrl = data.data[0].url;
                
                // 调用全局的播放函数
                if (typeof playAudio === 'function') {
                    await playAudio(songUrl, songName, songId);
                } else {
                    // 如果全局播放函数不存在，直接播放音频
                    const audio = document.getElementById('audioElement');
                    if (audio) {
                        audio.src = songUrl;
                        audio.play();
                    }
                }

                // 显示播放通知
                this.showToast(`正在播放: ${songName}`, 'success');
                
            } else {
                throw new Error('获取播放链接失败');
            }
        } catch (error) {
            console.error('播放失败:', error);
            this.showToast('播放失败，可能需要VIP权限', 'error');
        }
    }

    // 播放歌单
    async playPlaylist(playlistId) {
        try {
            const playlist = this.userPlaylists.find(p => p.id == playlistId);
            if (!playlist) {
                throw new Error('未找到歌单');
            }

            let songs;
            
            // 检查缓存
            if (this.playlistCache.has(playlistId)) {
                songs = this.playlistCache.get(playlistId).songs;
            } else {
                // 获取歌单详情
                const detailData = await this.fetchPlaylistDetail(playlistId);
                if (detailData.code === 200 && detailData.playlist?.tracks) {
                    songs = detailData.playlist.tracks;
                    // 缓存结果
                    this.playlistCache.set(playlistId, {
                        songs: songs,
                        detail: detailData.playlist,
                        timestamp: Date.now()
                    });
                } else {
                    throw new Error('获取歌单歌曲失败');
                }
            }
            
            if (songs.length > 0) {
                // 播放第一首歌曲
                const firstSong = songs[0];
                const artists = firstSong.ar ? firstSong.ar.map(artist => artist.name).join(', ') : '未知';
                await this.playSingleSong(firstSong.id, firstSong.name, artists);
                
                // 设置播放列表（如果队列管理器已初始化）
                if (window.queueManager) {
                    // 清空当前队列
                    window.queueManager.queue = [];
                    window.queueManager.currentQueueIndex = -1;
                    
                    // 添加所有歌曲到队列
                    for (const song of songs) {
                        const songArtists = song.ar ? song.ar.map(artist => artist.name).join(', ') : '未知';
                        await window.queueManager.addToQueue(song.id, song.name, songArtists);
                    }
                    
                    // 设置当前播放索引
                    window.queueManager.currentQueueIndex = 0;
                    window.queueManager.saveQueueToStorage();
                    window.queueManager.updateQueueCount();
                }
                
                // 如果当前歌单没有展开，则展开它
                if (this.expandedPlaylistId !== playlistId) {
                    this.expandedPlaylistId = playlistId;
                    this.renderPlaylists();
                }
                
                this.showToast(`开始播放歌单 "${playlist.name}"，共 ${songs.length} 首歌曲`);
            } else {
                this.showToast('歌单中没有歌曲', 'warning');
            }

        } catch (error) {
            console.error('播放歌单失败:', error);
            this.showToast(`播放歌单失败: ${error.message}`, 'error');
        }
    }

    // 随机播放
    async shufflePlay(playlistId) {
        try {
            let songs;
            
            // 检查缓存
            if (this.playlistCache.has(playlistId)) {
                songs = this.playlistCache.get(playlistId).songs;
            } else {
                // 获取歌单详情
                const detailData = await this.fetchPlaylistDetail(playlistId);
                if (detailData.code === 200 && detailData.playlist?.tracks) {
                    songs = detailData.playlist.tracks;
                    // 缓存结果
                    this.playlistCache.set(playlistId, {
                        songs: songs,
                        detail: detailData.playlist,
                        timestamp: Date.now()
                    });
                } else {
                    throw new Error('获取歌单歌曲失败');
                }
            }
            
            if (songs.length > 0) {
                // 随机选择一首歌曲
                const randomIndex = Math.floor(Math.random() * songs.length);
                const randomSong = songs[randomIndex];
                const artists = randomSong.ar ? randomSong.ar.map(artist => artist.name).join(', ') : '未知';
                
                await this.playSingleSong(randomSong.id, randomSong.name, artists);
                
                // 设置播放列表（如果队列管理器已初始化）
                if (window.queueManager) {
                    // 清空当前队列
                    window.queueManager.queue = [];
                    window.queueManager.currentQueueIndex = -1;
                    
                    // 添加所有歌曲到队列
                    for (const song of songs) {
                        const songArtists = song.ar ? song.ar.map(artist => artist.name).join(', ') : '未知';
                        await window.queueManager.addToQueue(song.id, song.name, songArtists);
                    }
                    
                    // 设置当前播放索引
                    window.queueManager.currentQueueIndex = randomIndex;
                    window.queueManager.saveQueueToStorage();
                    window.queueManager.updateQueueCount();
                }
                
                // 如果当前歌单没有展开，则展开它
                if (this.expandedPlaylistId !== playlistId) {
                    this.expandedPlaylistId = playlistId;
                    this.renderPlaylists();
                }
                
                this.showToast(`随机播放: ${randomSong.name}`);
            } else {
                this.showToast('歌单中没有歌曲', 'warning');
            }

        } catch (error) {
            console.error('随机播放失败:', error);
            this.showToast('随机播放失败', 'error');
        }
    }

    // 添加单首歌曲到播放列表
    async addSingleToQueue(songId, songName = null, artists = null) {
        try {
            // 确保队列管理器已初始化
            if (!window.queueManager) {
                // 尝试初始化队列管理器
                if (typeof initQueueManager === 'function') {
                    initQueueManager();
                } else {
                    throw new Error('播放列表管理器未初始化');
                }
            }
            
            // 调用队列管理器的添加方法
            await window.queueManager.addToQueue(songId, songName, artists);
            
        } catch (error) {
            console.error('添加到播放列表失败:', error);
            this.showToast('添加到播放列表失败', 'error');
        }
    }

    // 添加歌单所有歌曲到播放列表
    async addAllToQueue(playlistId) {
        try {
            const playlist = this.userPlaylists.find(p => p.id == playlistId);
            if (!playlist) {
                throw new Error('未找到歌单');
            }

            let songs;
            
            // 检查缓存
            if (this.playlistCache.has(playlistId)) {
                songs = this.playlistCache.get(playlistId).songs;
            } else {
                // 获取歌单详情
                const detailData = await this.fetchPlaylistDetail(playlistId);
                if (detailData.code === 200 && detailData.playlist?.tracks) {
                    songs = detailData.playlist.tracks;
                    // 缓存结果
                    this.playlistCache.set(playlistId, {
                        songs: songs,
                        detail: detailData.playlist,
                        timestamp: Date.now()
                    });
                } else {
                    throw new Error('获取歌单歌曲失败');
                }
            }
            
            if (songs.length === 0) {
                this.showToast('歌单中没有歌曲', 'warning');
                return;
            }

            // 确保队列管理器已初始化
            if (!window.queueManager) {
                // 尝试初始化队列管理器
                if (typeof initQueueManager === 'function') {
                    initQueueManager();
                } else {
                    throw new Error('播放列表管理器未初始化');
                }
            }
            
            // 批量添加歌曲到播放列表
            let addedCount = 0;
            for (const song of songs) {
                const artists = song.ar ? song.ar.map(artist => artist.name).join(', ') : '未知';
                await window.queueManager.addToQueue(song.id, song.name, artists);
                addedCount++;
            }
            
            this.showToast(`已将 ${addedCount} 首歌曲添加到播放列表`, 'success');
            
        } catch (error) {
            console.error('批量添加到播放列表失败:', error);
            this.showToast(`批量添加失败: ${error.message}`, 'error');
        }
    }

    // 显示提示消息
    showToast(message, type = 'info') {
        // 如果页面中已经有toast容器，使用它
        let toastContainer = document.getElementById('toastContainer');
        
        if (!toastContainer) {
            // 创建toast容器
            toastContainer = document.createElement('div');
            toastContainer.id = 'toastContainer';
            toastContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
            `;
            document.body.appendChild(toastContainer);
        }

        // 创建toast元素
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas ${type === 'error' ? 'fa-exclamation-circle' : type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;

        toastContainer.appendChild(toast);

        // 3秒后自动移除
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    // 显示加载状态
    showLoading() {
        this.isLoading = true;
        const playlistsContent = document.getElementById('playlistsContent');
        if (playlistsContent) {
            playlistsContent.innerHTML = `
                <div class="loading-container">
                    <div class="spinner"></div>
                    <div class="loading-text">加载中...</div>
                </div>
            `;
        }
    }

    // 隐藏加载状态
    hideLoading() {
        this.isLoading = false;
    }

    // 显示错误
    showError(title, message) {
        const playlistsContent = document.getElementById('playlistsContent');
        if (playlistsContent) {
            playlistsContent.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <h3>${title}</h3>
                    <p>${message}</p>
                    <button onclick="playlistManager.loadUserPlaylists()" class="btn-primary">
                        <i class="fas fa-redo"></i> 重试
                    </button>
                </div>
            `;
        }
    }

    // 格式化数字
    formatNumber(num) {
        if (num >= 100000000) {
            return (num / 100000000).toFixed(1) + '亿';
        } else if (num >= 10000) {
            return (num / 10000).toFixed(1) + '万';
        }
        return num.toString();
    }
}

// 创建歌单管理器实例
let playlistManager = null;

// 初始化歌单管理器
function initPlaylistManager() {
    if (!playlistManager) {
        playlistManager = new PlaylistManager();
        window.playlistManager = playlistManager;
        console.log('歌单管理器已初始化');
    }
    return playlistManager;
}

// 页面加载时初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPlaylistManager);
} else {
    initPlaylistManager();
}

// 全局函数，供HTML中的onclick调用
window.playSong = function(songId, songName) {
    if (playlistManager) {
        playlistManager.playSingleSong(songId, songName);
    }
};

window.addToQueue = function(songId, songName, artists) {
    if (playlistManager) {
        playlistManager.addSingleToQueue(songId, songName, artists);
    }
};