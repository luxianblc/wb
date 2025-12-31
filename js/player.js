// ===== 播放器状态管理 =====
let player = {
    isPlaying: false,
    isMuted: false,
    volume: 80,
    currentSongIndex: -1,
    playlist: [],
    currentSongId: null,
    lyrics: [],
    currentLyricIndex: -1
};

// ===== 歌词界面状态管理 =====
const lyricsUI = {
    uiHidden: false,
    exitBtn: null,
    isInitialized: false,
    fullscreenContainer: null,
    fullscreenLyricsContainer: null,
    isScrollingToLyric: false, // 防止滚动冲突
    lastLyricIndex: -1 // 记录上次歌词索引，避免重复滚动
};

// ===== 播放器核心功能 =====

// 初始化播放器
function initPlayer() {
    const audio = document.getElementById('audioElement');
    if (!audio) return;

    // 加载保存的音量
    const savedVolume = localStorage.getItem('netease_volume');
    if (savedVolume) {
        player.volume = parseInt(savedVolume);
        audio.volume = player.volume / 100;
        document.getElementById('volumeSlider').value = player.volume;
    }

    // 监听音频事件
    audio.addEventListener('play', () => {
        player.isPlaying = true;
        updatePlayButton();
    });

    audio.addEventListener('pause', () => {
        player.isPlaying = false;
        updatePlayButton();
    });

    audio.addEventListener('volumechange', () => {
        player.volume = audio.volume * 100;
        updateVolumeButton();
    });

    // 初始化歌词UI
    initLyricsUI();
}

// 播放音频
function playAudio(url, name = '未知歌曲', songId = null) {
    const audio = document.getElementById('audioElement');
    const coverImg = document.getElementById('currentSongCover');
    const songName = document.getElementById('currentSongName');
    const artistName = document.getElementById('currentArtist');
    
    // 记录当前歌曲ID
    player.currentSongId = songId;

    // 更新播放器显示
    songName.textContent = name;
    artistName.textContent = '加载中...';
    
    // 更新歌词页面信息
    updateLyricsPageInfo(name, coverImg ? coverImg.src : '');

    if (songId) {
        // 获取歌曲详情和歌词
        fetchSongDetails(songId);
        loadLyrics(songId);
    } else {
        player.lyrics = [];
        player.currentLyricIndex = -1;
        renderLyrics('无法获取歌词信息');
    }

    // 播放音频
    audio.src = url;
    audio.play().catch(error => {
        console.error('播放失败:', error);
        showNotification('播放失败，可能需要VIP权限', 'error');
    });
}

// 切换播放状态
function togglePlay() {
    const audio = document.getElementById('audioElement');
    if (!audio.src) return;

    if (player.isPlaying) {
        audio.pause();
    } else {
        audio.play().catch(error => {
            console.error('播放失败:', error);
        });
    }
}

// 更新播放按钮
function updatePlayButton() {
    const playBtn = document.getElementById('playBtn');
    if (!playBtn) return;

    const icon = playBtn.querySelector('i');
    icon.className = player.isPlaying ? 'fas fa-pause' : 'fas fa-play';
}

// 更新进度条
function updateProgress() {
    const audio = document.getElementById('audioElement');
    const progressFill = document.getElementById('progressFill');
    const currentTime = document.getElementById('currentTime');
    const durationTime = document.getElementById('durationTime');

    if (!audio.duration) return;

    const progress = (audio.currentTime / audio.duration) * 100;
    progressFill.style.width = `${progress}%`;

    // 更新时间显示
    currentTime.textContent = formatTime(audio.currentTime);
    durationTime.textContent = formatTime(audio.duration);

    // 同步歌词高亮
    updateLyricHighlight(audio.currentTime * 1000);
}

// 跳转播放位置
function seekAudio(event) {
    const audio = document.getElementById('audioElement');
    const progressBar = event.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;

    if (audio.duration) {
        audio.currentTime = audio.duration * percent;
    }
}

// 切换静音
function toggleMute() {
    const audio = document.getElementById('audioElement');
    player.isMuted = !player.isMuted;
    audio.muted = player.isMuted;
    updateVolumeButton();
}

// 改变音量
function changeVolume(value) {
    const audio = document.getElementById('audioElement');
    player.volume = parseInt(value);
    audio.volume = player.volume / 100;
    localStorage.setItem('netease_volume', player.volume);
    updateVolumeButton();
}

// 更新音量按钮
function updateVolumeButton() {
    const volumeBtn = document.getElementById('volumeBtn');
    if (!volumeBtn) return;

    const icon = volumeBtn.querySelector('i');

    if (player.isMuted || player.volume === 0) {
        icon.className = 'fas fa-volume-mute';
    } else if (player.volume < 50) {
        icon.className = 'fas fa-volume-down';
    } else {
        icon.className = 'fas fa-volume-up';
    }
}

// 上一首/下一首
function previousSong() {
    if (player.playlist.length > 0) {
        player.currentSongIndex = Math.max(0, player.currentSongIndex - 1);
        playSongFromPlaylist();
    }
}

function nextSong() {
    if (player.playlist.length > 0) {
        player.currentSongIndex = Math.min(player.playlist.length - 1, player.currentSongIndex + 1);
        playSongFromPlaylist();
    }
}

// 从播放列表播放
function playSongFromPlaylist() {
    if (player.currentSongIndex >= 0 && player.currentSongIndex < player.playlist.length) {
        const song = player.playlist[player.currentSongIndex];
        playAudio(song.url, song.name, song.id);
    }
}

// 格式化时间
function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// 获取歌曲详情
async function fetchSongDetails(songId) {
    try {
        const url = buildApiUrl('/song/detail', {
            ids: songId
        });
        const response = await fetch(url);
        const data = await response.json();

        if (data.code === 200 && data.songs && data.songs[0]) {
            const song = data.songs[0];
            const artists = song.ar ? song.ar.map(artist => artist.name).join(', ') : '未知';
            const album = song.al ? song.al.name : '未知';

            document.getElementById('currentArtist').textContent = `${artists} - ${album}`;

            // 更新封面
            const coverUrl = song.al && song.al.picUrl;
            if (coverUrl) {
                const coverImgUrl = `${coverUrl}?param=100y100`;
                const coverImg = document.getElementById('currentSongCover');
                if (coverImg) coverImg.src = coverImgUrl;

                // 更新歌词页面的封面
                const lyricCover = document.getElementById('lyricSongCover');
                if (lyricCover) {
                    lyricCover.src = coverImgUrl;
                }

                // 更新歌词页面的艺术家信息
                const lyricArtist = document.getElementById('lyricArtist');
                if (lyricArtist) {
                    lyricArtist.textContent = `${artists} - ${album}`;
                }

                // 如果有主题管理器且启用了封面背景，更新背景
                if (typeof themeManager !== 'undefined' &&
                    themeManager.currentThemeMode === 'cover-blur' &&
                    themeManager.settings.autoThemeSwitch) {
                    setTimeout(() => {
                        themeManager.updateBackgroundFromCurrentSong();
                    }, 300);
                }
            }
        }
    } catch (error) {
        console.error('获取歌曲详情失败:', error);
    }
}

// 跳转到歌词页面
function goToLyricsPage() {
    const cover = document.getElementById('currentSongCover');
    const songName = document.getElementById('currentSongName');
    const artist = document.getElementById('currentArtist');

    const lyricCover = document.getElementById('lyricSongCover');
    const lyricSongName = document.getElementById('lyricSongName');
    const lyricArtist = document.getElementById('lyricArtist');

    if (cover && lyricCover) lyricCover.src = cover.src;
    if (songName && lyricSongName) lyricSongName.textContent = songName.textContent;
    if (artist && lyricArtist) lyricArtist.textContent = artist.textContent;

    if (typeof switchSection === 'function') {
        switchSection('lyrics');
    }
}

// ===== 歌词界面增强功能 =====

// 初始化歌词界面
function initLyricsUI() {
    if (lyricsUI.isInitialized) return;
    
    console.log('初始化歌词UI...');
    
    // 创建退出全屏按钮
    const exitBtn = document.createElement('button');
    exitBtn.className = 'exit-fullscreen';
    exitBtn.innerHTML = '<i class="fas fa-times"></i>';
    exitBtn.title = '退出全屏歌词 (ESC)';
    exitBtn.onclick = exitUIHiddenMode;
    document.body.appendChild(exitBtn);
    
    lyricsUI.exitBtn = exitBtn;
    lyricsUI.exitBtn.style.display = 'none';
    
    // 添加键盘快捷键
    document.addEventListener('keydown', handleLyricsKeyboardShortcut);
    
    // 添加通知样式
    addNotificationStyles();
    
    lyricsUI.isInitialized = true;
}

// 处理键盘快捷键
function handleLyricsKeyboardShortcut(event) {
    // ESC键退出全屏模式
    if (event.key === 'Escape' && lyricsUI.uiHidden) {
        exitUIHiddenMode();
        event.preventDefault();
    }
    
    // F键切换全屏模式 (仅在歌词页面)
    if (event.key === 'f' && isLyricsPageActive()) {
        toggleUIHiddenMode();
        event.preventDefault();
    }
}

// 检查是否在歌词页面
function isLyricsPageActive() {
    const lyricsSection = document.getElementById('lyrics');
    return lyricsSection && lyricsSection.classList.contains('active');
}

// 切换全屏模式
function toggleUIHiddenMode() {
    if (!isLyricsPageActive()) return;
    
    lyricsUI.uiHidden = !lyricsUI.uiHidden;
    
    const btn = document.getElementById('uiToggleBtn');
    
    if (lyricsUI.uiHidden) {
        // 进入全屏模式
        enterFullscreenMode();
        
        if (btn) {
            btn.classList.add('active');
            btn.innerHTML = '<i class="fas fa-eye"></i><span>显示界面</span>';
            btn.title = '点击显示界面 (快捷键: F)';
        }
        
        // 显示退出按钮
        if (lyricsUI.exitBtn) {
            lyricsUI.exitBtn.style.display = 'flex';
        }
        
        showNotification('已进入全屏歌词模式 (ESC键退出)', 'info');
    } else {
        // 退出全屏模式
        exitUIHiddenMode();
    }
}

// 进入全屏模式
function enterFullscreenMode() {
    // 保存当前背景
    const currentBackground = document.getElementById('backgroundOverlay').style.backgroundImage;
    lyricsUI.originalBackground = currentBackground;
    
    // 创建全屏容器
    let fullscreenContainer = document.querySelector('.lyrics-fullscreen-container');
    if (!fullscreenContainer) {
        fullscreenContainer = document.createElement('div');
        fullscreenContainer.className = 'lyrics-fullscreen-container';
        document.body.appendChild(fullscreenContainer);
        lyricsUI.fullscreenContainer = fullscreenContainer;
    }
    
    // 获取封面图片
    const coverImg = document.getElementById('lyricSongCover');
    const songName = document.getElementById('lyricSongName').textContent;
    const artistName = document.getElementById('lyricArtist').textContent;
    
    // 设置全屏背景为封面
    fullscreenContainer.innerHTML = `
        <div class="fullscreen-background" style="background-image: url('${coverImg.src}')"></div>
        <div class="fullscreen-overlay"></div>
        <div class="fullscreen-content">
            <div class="fullscreen-header">
                <h2 class="fullscreen-song-name">${songName}</h2>
                <p class="fullscreen-artist">${artistName}</p>
            </div>
            <div class="fullscreen-lyrics" id="fullscreenLyricLines"></div>
            <div class="fullscreen-controls">
                <div class="fullscreen-time">
                    <span id="fullscreenCurrentTime">0:00</span>
                    <span>/</span>
                    <span id="fullscreenDurationTime">0:00</span>
                </div>
            </div>
        </div>
    `;
    
    // 显示全屏容器
    fullscreenContainer.style.display = 'block';
    document.body.classList.add('lyrics-fullscreen-active');
    
    // 获取歌词容器引用
    lyricsUI.fullscreenLyricsContainer = document.getElementById('fullscreenLyricLines');
    
    // 渲染全屏歌词
    renderFullscreenLyrics();
    
    // 更新全屏时间显示
    updateFullscreenTime();
    
    // 开始监听时间更新
    startFullscreenTimeUpdate();
    
    // 重置滚动状态
    lyricsUI.isScrollingToLyric = false;
    lyricsUI.lastLyricIndex = -1;
}

// 退出全屏模式
function exitUIHiddenMode() {
    lyricsUI.uiHidden = false;
    
    const btn = document.getElementById('uiToggleBtn');
    const fullscreenContainer = document.querySelector('.lyrics-fullscreen-container');
    
    if (fullscreenContainer) {
        fullscreenContainer.style.display = 'none';
    }
    
    document.body.classList.remove('lyrics-fullscreen-active');
    
    if (btn) {
        btn.classList.remove('active');
        btn.innerHTML = '<i class="fas fa-eye-slash"></i><span>全屏歌词</span>';
        btn.title = '点击进入全屏歌词模式 (快捷键: F)';
    }
    
    // 隐藏退出按钮
    if (lyricsUI.exitBtn) {
        lyricsUI.exitBtn.style.display = 'none';
    }
    
    // 恢复原始背景
    if (lyricsUI.originalBackground) {
        document.getElementById('backgroundOverlay').style.backgroundImage = lyricsUI.originalBackground;
    }
    
    showNotification('已退出全屏歌词模式', 'info');
    
    // 停止时间更新监听
    stopFullscreenTimeUpdate();
    
    // 重置滚动状态
    lyricsUI.isScrollingToLyric = false;
    lyricsUI.lastLyricIndex = -1;
}

// 渲染全屏歌词
function renderFullscreenLyrics(emptyText) {
    const container = lyricsUI.fullscreenLyricsContainer;
    if (!container) return;

    // 清空容器
    container.innerHTML = '';

    // 如果没有歌词
    if (!player.lyrics || player.lyrics.length === 0) {
        const emptyMsg = emptyText || '暂无歌词';
        const emptyElement = document.createElement('div');
        emptyElement.className = 'fullscreen-lyrics-empty';
        emptyElement.innerHTML = `
            <i class="fas fa-music"></i>
            <p>${emptyMsg}</p>
        `;
        container.appendChild(emptyElement);
        return;
    }

    // 构建歌词HTML
    let lyricsHTML = '';
    
    for (let i = 0; i < player.lyrics.length; i++) {
        const item = player.lyrics[i];
        const isActive = i === player.currentLyricIndex;
        
        lyricsHTML += `
            <div class="fullscreen-lyric-container" data-index="${i}" data-time="${item.time}">
                <p class="fullscreen-lyric-line${isActive ? ' active' : ''}">
                    ${escapeHtml(item.text)}
                </p>
            </div>
        `;
    }
    
    container.innerHTML = lyricsHTML;
    
    // 如果有当前歌词，滚动到合适位置
    if (player.currentLyricIndex >= 0) {
        setTimeout(() => {
            scrollToActiveFullscreenLyric();
        }, 100);
    }
}

// 滚动到当前歌词（全屏模式） - 修复版
function scrollToActiveFullscreenLyric() {
    const container = lyricsUI.fullscreenLyricsContainer;
    if (!container || !lyricsUI.uiHidden) return;
    
    // 防止重复滚动
    if (lyricsUI.isScrollingToLyric || player.currentLyricIndex < 0) return;
    
    // 避免相同歌词的重复滚动
    if (lyricsUI.lastLyricIndex === player.currentLyricIndex) return;
    
    const activeElement = container.querySelector('.fullscreen-lyric-line.active');
    if (!activeElement) return;
    
    const lyricContainer = activeElement.closest('.fullscreen-lyric-container');
    if (!lyricContainer) return;
    
    // 设置滚动状态
    lyricsUI.isScrollingToLyric = true;
    lyricsUI.lastLyricIndex = player.currentLyricIndex;
    
    // 计算完美的居中位置
    const containerHeight = container.clientHeight;
    const activeElementRect = activeElement.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    // 计算歌词行在容器中的相对位置
    const targetScrollTop = activeElement.offsetTop - (containerHeight / 2) + (activeElementRect.height / 2);
    
    // 平滑滚动到中心位置
    container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth'
    });
    
    // 重置滚动状态（延迟，避免快速滚动冲突）
    setTimeout(() => {
        lyricsUI.isScrollingToLyric = false;
    }, 500);
}

// 更新全屏时间显示
function updateFullscreenTime() {
    if (!lyricsUI.uiHidden) return;
    
    const audio = document.getElementById('audioElement');
    const currentTimeEl = document.getElementById('fullscreenCurrentTime');
    const durationTimeEl = document.getElementById('fullscreenDurationTime');
    
    if (currentTimeEl && audio) {
        currentTimeEl.textContent = formatTime(audio.currentTime);
    }
    
    if (durationTimeEl && audio) {
        durationTimeEl.textContent = formatTime(audio.duration);
    }
}

// 开始全屏时间更新监听
function startFullscreenTimeUpdate() {
    if (lyricsUI.timeUpdateInterval) {
        clearInterval(lyricsUI.timeUpdateInterval);
    }
    
    lyricsUI.timeUpdateInterval = setInterval(() => {
        if (lyricsUI.uiHidden) {
            updateFullscreenTime();
            
            // 同时更新歌词高亮
            const audio = document.getElementById('audioElement');
            if (audio) {
                updateLyricHighlight(audio.currentTime * 1000);
            }
        }
    }, 100);
}

// 停止全屏时间更新监听
function stopFullscreenTimeUpdate() {
    if (lyricsUI.timeUpdateInterval) {
        clearInterval(lyricsUI.timeUpdateInterval);
        lyricsUI.timeUpdateInterval = null;
    }
}

// 更新全屏歌词高亮
function updateFullscreenLyricHighlight() {
    if (!lyricsUI.uiHidden || !player.lyrics || player.lyrics.length === 0) return;
    
    const container = lyricsUI.fullscreenLyricsContainer;
    if (!container) return;
    
    // 移除所有歌词的高亮
    const allLines = container.querySelectorAll('.fullscreen-lyric-line');
    allLines.forEach(line => line.classList.remove('active'));
    
    // 高亮当前歌词行
    if (player.currentLyricIndex >= 0) {
        const currentLine = container.querySelector(`.fullscreen-lyric-container[data-index="${player.currentLyricIndex}"] .fullscreen-lyric-line`);
        if (currentLine) {
            currentLine.classList.add('active');
            
            // 滚动到合适位置（只在歌词变化时才滚动）
            if (lyricsUI.lastLyricIndex !== player.currentLyricIndex) {
                scrollToActiveFullscreenLyric();
            }
        }
    }
}

// ===== 歌词加载与渲染 =====

// 加载歌词
async function loadLyrics(songId) {
    if (!songId) {
        renderLyrics('请先播放歌曲');
        return;
    }
    
    try {
        // 显示加载状态
        renderLyrics('歌词加载中...');
        
        const url = buildApiUrl('/lyric', { id: songId });
        const response = await fetch(url);
        const data = await response.json();

        if (data.code === 200) {
            let lyricsText = '';
            
            // 获取原始歌词
            if (data.lrc && data.lrc.lyric) {
                lyricsText = data.lrc.lyric;
            }
            
            // 解析歌词
            if (lyricsText) {
                player.lyrics = parseLrc(lyricsText);
                player.currentLyricIndex = -1;
                lyricsUI.lastLyricIndex = -1; // 重置歌词索引
                renderLyrics();
                
                // 如果全屏模式开启，也更新全屏歌词
                if (lyricsUI.uiHidden) {
                    renderFullscreenLyrics();
                }
            } else {
                player.lyrics = [];
                renderLyrics('暂无歌词');
            }
        } else {
            player.lyrics = [];
            renderLyrics('歌词加载失败');
        }
    } catch (error) {
        console.error('获取歌词失败:', error);
        player.lyrics = [];
        renderLyrics('歌词加载失败，请检查网络连接');
    }
}

// 解析标准 LRC 歌词
function parseLrc(lrcText) {
    const lines = lrcText.split('\n');
    const result = [];
    const timeReg = /\[(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?]/g;

    lines.forEach(rawLine => {
        const line = rawLine.trim();
        if (!line) return;

        let match;
        const times = [];
        while ((match = timeReg.exec(line)) !== null) {
            const min = parseInt(match[1], 10);
            const sec = parseInt(match[2], 10);
            const ms = match[3] ? parseInt(match[3].padEnd(3, '0'), 10) : 0;
            const totalMs = min * 60 * 1000 + sec * 1000 + ms;
            times.push(totalMs);
        }

        const text = line.replace(timeReg, '').trim();
        if (!text || times.length === 0) return;

        times.forEach(t => {
            result.push({
                time: t,
                text
            });
        });
    });

    result.sort((a, b) => a.time - b.time);
    return result;
}

// 渲染歌词（普通模式）
function renderLyrics(emptyText) {
    const container = document.getElementById('lyricLines');
    if (!container) return;

    // 清空容器
    container.innerHTML = '';

    // 如果没有歌词
    if (!player.lyrics || player.lyrics.length === 0) {
        const emptyMsg = emptyText || '暂无歌词';
        const emptyElement = document.createElement('div');
        emptyElement.className = 'lyrics-empty';
        emptyElement.innerHTML = `
            <i class="fas fa-music"></i>
            <p>${emptyMsg}</p>
            <p class="lyrics-empty-hint">播放歌曲后歌词将自动加载</p>
        `;
        container.appendChild(emptyElement);
        return;
    }

    // 构建歌词HTML
    let lyricsHTML = '';
    
    for (let i = 0; i < player.lyrics.length; i++) {
        const item = player.lyrics[i];
        const isActive = i === player.currentLyricIndex;
        
        lyricsHTML += `
            <div class="lyric-container" data-index="${i}" data-time="${item.time}">
                <p class="lyric-line${isActive ? ' active' : ''}">
                    ${escapeHtml(item.text)}
                </p>
            </div>
        `;
    }
    
    container.innerHTML = lyricsHTML;
    
    // 如果当前有高亮的歌词行，确保它在视图中
    if (player.currentLyricIndex >= 0) {
        setTimeout(() => {
            scrollToActiveLyric();
        }, 50);
    }
}

// HTML转义函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 滚动到当前歌词（普通模式）
function scrollToActiveLyric() {
    const container = document.getElementById('lyricLines');
    if (!container) return;
    
    const activeElement = container.querySelector('.lyric-line.active');
    if (!activeElement) return;
    
    const lyricContainer = activeElement.closest('.lyric-container');
    if (!lyricContainer) return;
    
    // 将当前歌词滚动到容器1/3位置
    const offsetTop = activeElement.offsetTop;
    const containerHeight = container.clientHeight;
    
    container.scrollTo({
        top: Math.max(0, offsetTop - containerHeight / 3),
        behavior: 'smooth'
    });
}

// 更新歌词高亮（同时更新普通模式和全屏模式）
function updateLyricHighlight(currentMs) {
    if (!player.lyrics || player.lyrics.length === 0) return;

    let newIndex = player.currentLyricIndex;

    if (newIndex < 0 || currentMs < player.lyrics[newIndex].time || (newIndex < player.lyrics.length - 1 && currentMs >= player.lyrics[newIndex + 1].time)) {
        // 二分查找提高性能（歌词已按时间排序）
        let left = 0;
        let right = player.lyrics.length - 1;
        let found = -1;
        
        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const midTime = player.lyrics[mid].time;
            const nextTime = mid < player.lyrics.length - 1 ? player.lyrics[mid + 1].time : Number.MAX_SAFE_INTEGER;
            
            if (currentMs >= midTime && currentMs < nextTime) {
                found = mid;
                break;
            } else if (currentMs < midTime) {
                right = mid - 1;
            } else {
                left = mid + 1;
            }
        }
        
        if (found >= 0) {
            newIndex = found;
        }
    }

    if (newIndex === player.currentLyricIndex || newIndex < 0) return;

    player.currentLyricIndex = newIndex;
    
    // 更新普通模式DOM显示
    const normalContainer = document.getElementById('lyricLines');
    if (normalContainer) {
        // 移除所有歌词的高亮
        const allLines = normalContainer.querySelectorAll('.lyric-line');
        allLines.forEach(line => line.classList.remove('active'));
        
        // 高亮当前歌词行
        const currentLine = normalContainer.querySelector(`.lyric-container[data-index="${newIndex}"] .lyric-line`);
        if (currentLine) {
            currentLine.classList.add('active');
            
            // 自动滚动到合适位置
            scrollToActiveLyric();
        }
    }
    
    // 更新全屏模式歌词高亮
    if (lyricsUI.uiHidden) {
        updateFullscreenLyricHighlight();
    }
}

// 更新歌词页面信息
function updateLyricsPageInfo(songName, coverUrl) {
    const lyricSongName = document.getElementById('lyricSongName');
    const lyricCover = document.getElementById('lyricSongCover');
    
    if (lyricSongName) {
        lyricSongName.textContent = songName;
    }
    
    if (lyricCover && coverUrl) {
        lyricCover.src = coverUrl;
    }
}

// ===== 辅助功能 =====

// 显示通知
function showNotification(message, type = 'info') {
    // 移除现有的通知
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }
    
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'info' ? 'info-circle' : type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span>${message}</span>
    `;
    
    // 添加到页面
    document.body.appendChild(notification);
    
    // 显示通知
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // 自动隐藏
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 3000);
}

// 添加通知样式
function addNotificationStyles() {
    if (document.querySelector('#notification-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--card-bg);
            color: var(--text-color);
            padding: 15px 20px;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 10001;
            transform: translateX(120%);
            transition: transform 0.3s ease;
            border-left: 4px solid var(--primary-color);
            max-width: 350px;
        }
        
        .notification.show {
            transform: translateX(0);
        }
        
        .notification-info {
            border-left-color: #3498db;
        }
        
        .notification-success {
            border-left-color: #2ecc71;
        }
        
        .notification-error {
            border-left-color: #e74c3c;
        }
        
        .notification i {
            font-size: 18px;
        }
        
        .lyrics-empty {
            text-align: center;
            padding: 60px 20px;
            color: var(--text-secondary);
        }
        
        .lyrics-empty i {
            font-size: 48px;
            margin-bottom: 20px;
            opacity: 0.5;
        }
        
        .lyrics-empty p {
            margin: 10px 0;
            font-size: 16px;
        }
        
        .lyrics-empty-hint {
            font-size: 14px !important;
            opacity: 0.7;
        }
        
        /* 全屏歌词样式 */
        .lyrics-fullscreen-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 10000;
            display: none;
        }
        
        .fullscreen-background {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-size: cover;
            background-position: center;
            filter: blur(20px);
            transform: scale(1.1);
        }
        
        .fullscreen-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
        }
        
        .fullscreen-content {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px;
            box-sizing: border-box;
            z-index: 2;
        }
        
        .fullscreen-header {
            text-align: center;
            margin-bottom: 40px;
            color: white;
        }
        
        .fullscreen-song-name {
            font-size: 24px;
            margin: 0 0 10px 0;
            font-weight: 600;
        }
        
        .fullscreen-artist {
            font-size: 16px;
            opacity: 0.8;
            margin: 0;
        }
        
        .fullscreen-lyrics {
            flex: 1;
            width: 100%;
            max-width: 600px;
            overflow-y: auto;
            text-align: center;
            scroll-behavior: smooth;
            /* 允许用户滚动 */
            -webkit-overflow-scrolling: touch;
        }
        
        .fullscreen-lyric-container {
            margin: 20px 0;
            padding: 12px 0;
            transition: transform 0.3s ease;
        }
        
        .fullscreen-lyric-line {
            font-size: 20px;
            line-height: 1.6;
            color: rgba(255, 255, 255, 0.6);
            margin: 0;
            transition: all 0.3s ease;
            padding: 8px 16px;
            border-radius: 8px;
        }
        
        .fullscreen-lyric-line.active {
            color: white;
            font-size: 26px;
            font-weight: 600;
            background: rgba(255, 255, 255, 0.1);
            text-shadow: 0 2px 10px rgba(255, 255, 255, 0.3);
            transform: scale(1.05);
        }
        
        .fullscreen-controls {
            margin-top: 30px;
            color: white;
        }
        
        .fullscreen-time {
            font-size: 16px;
            opacity: 0.8;
        }
        
        .fullscreen-time span {
            margin: 0 5px;
        }
        
        .fullscreen-lyrics-empty {
            text-align: center;
            color: rgba(255, 255, 255, 0.7);
            padding: 60px 20px;
        }
        
        .fullscreen-lyrics-empty i {
            font-size: 48px;
            margin-bottom: 20px;
            opacity: 0.5;
        }
        
        .fullscreen-lyrics-empty p {
            margin: 10px 0;
            font-size: 18px;
        }
        
        .exit-fullscreen {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.1);
            border: none;
            color: white;
            font-size: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 10002;
            backdrop-filter: blur(10px);
            transition: all 0.3s ease;
        }
        
        .exit-fullscreen:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: scale(1.1);
        }
        
        .body.lyrics-fullscreen-active {
            overflow: hidden !important;
        }
        
        /* 隐藏滚动条但保持可滚动 */
        .fullscreen-lyrics::-webkit-scrollbar {
            width: 6px;
        }
        
        .fullscreen-lyrics::-webkit-scrollbar-track {
            background: transparent;
        }
        
        .fullscreen-lyrics::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 3px;
        }
        
        .fullscreen-lyrics::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.3);
        }
    `;
    document.head.appendChild(style);
}

// ===== 全局函数导出 =====
window.playAudio = playAudio;
window.goToLyricsPage = goToLyricsPage;
window.toggleUIHiddenMode = toggleUIHiddenMode;
window.exitUIHiddenMode = exitUIHiddenMode;
