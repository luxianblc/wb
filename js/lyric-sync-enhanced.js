// ===================== 歌词同步增强版 =====================

// 全局变量
let sync = {
    isSyncing: false,
    isPlaying: false,
    pollInterval: null,
    syncInterval: null,
    currentSongId: null,
    lastSongId: null,
    currentLyrics: [],
    currentLyricIndex: -1,
    lastLyricIndex: -1,
    currentTime: 12, // 默认从12秒开始
    totalTime: 180, // 默认3分钟
    offset: 0, // 歌词偏移
    syncIntervalMs: 2000, // 默认2秒同步一次
    autoScroll: true,
    lyricSize: 18,
    isFullscreen: false
};

// DOM元素
let dom = {};

// 初始化
function initLyricSync() {
    console.log('初始化歌词同步...');
    
    // 收集DOM元素
    dom = {
        statusDot: document.getElementById('statusDot'),
        statusText: document.getElementById('statusText'),
        startBtn: document.getElementById('startSyncBtn'),
        stopBtn: document.getElementById('stopSyncBtn'),
        songCover: document.getElementById('songCover'),
        songTitle: document.getElementById('songTitle'),
        songArtist: document.getElementById('songArtist'),
        songAlbum: document.getElementById('songAlbum'),
        lyricsContainer: document.getElementById('lyricsContainer'),
        emptyState: document.getElementById('emptyState'),
        progressFill: document.getElementById('progressFill'),
        progressBar: document.getElementById('progressBar'),
        currentTime: document.getElementById('currentTime'),
        totalTime: document.getElementById('totalTime'),
        playBtn: document.getElementById('playBtn'),
        fullscreenMode: document.getElementById('fullscreenMode'),
        fullscreenLyrics: document.getElementById('fullscreenLyrics'),
        fullscreenSongName: document.getElementById('fullscreenSongName'),
        fullscreenSongArtist: document.getElementById('fullscreenSongArtist'),
        fullscreenCurrentTime: document.getElementById('fullscreenCurrentTime'),
        fullscreenTotalTime: document.getElementById('fullscreenTotalTime'),
        loadingOverlay: document.getElementById('loadingOverlay'),
        loadingText: document.getElementById('loadingText'),
        lyricsCount: document.getElementById('lyricsCount'),
        syncTime: document.getElementById('syncTime'),
        syncInfo: document.getElementById('syncInfo')
    };

    // 绑定事件
    bindEvents();
    
    // 检查登录状态
    checkLoginStatus();
    
    // 初始化UI
    updateStatus('ready');
    
    // 设置键盘快捷键
    setupKeyboardShortcuts();
    
    // 更新UI数值显示
    updateUIValues();
    
    console.log('歌词同步初始化完成');
}

// 绑定事件
function bindEvents() {
    // 控制按钮
    dom.startBtn.addEventListener('click', startSync);
    dom.stopBtn.addEventListener('click', stopSync);
    
    // 播放控制
    dom.playBtn.addEventListener('click', togglePlayback);
    
    // 进度条
    dom.progressBar.addEventListener('click', seekProgress);
    
    // 歌词容器
    dom.lyricsContainer.addEventListener('mousemove', handleMouseMove);
    dom.lyricsContainer.addEventListener('mouseleave', hideTimeTooltip);
    
    // 页面可见性变化
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // ESC键退出全屏
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sync.isFullscreen) {
            exitFullscreenMode();
        }
    });
}

// 检查登录状态
function checkLoginStatus() {
    const cookie = localStorage.getItem('netease_cookie');
    if (!cookie) {
        showNotification('请先登录网易云音乐账号', 'warning');
    }
}

// ===================== 同步控制 =====================

// 开始同步
async function startSync() {
    if (sync.isSyncing) return;
    
    // 检查登录
    if (!localStorage.getItem('netease_cookie')) {
        showNotification('请先登录网易云音乐账号', 'error');
        return;
    }
    
    showLoading('正在连接到网易云音乐...');
    updateStatus('connecting');
    
    try {
        // 获取最近播放的歌曲
        const recentSong = await getMostRecentSong();
        if (!recentSong) {
            showNotification('未检测到正在播放的歌曲', 'warning');
            updateStatus('no_song');
            hideLoading();
            return;
        }
        
        // 显示歌曲信息
        updateSongInfo(recentSong);
        
        // 获取歌词
        await fetchAndDisplayLyrics(recentSong.id);
        
        // 开始轮询
        startPolling();
        sync.isSyncing = true;
        
        // 开始模拟播放
        startPlayback();
        
        updateStatus('connected');
        hideLoading();
        
        showNotification('同步已开始，正在实时获取歌词', 'success');
        
    } catch (error) {
        console.error('开始同步失败:', error);
        showNotification('同步失败: ' + error.message, 'error');
        updateStatus('error');
        hideLoading();
    }
}

// 停止同步
function stopSync() {
    if (!sync.isSyncing) return;
    
    stopPolling();
    stopPlayback();
    sync.isSyncing = false;
    
    updateStatus('ready');
    showNotification('同步已停止', 'info');
}

// 开始轮询
function startPolling() {
    if (sync.pollInterval) {
        clearInterval(sync.pollInterval);
    }
    
    // 立即检查一次
    checkRecentSong();
    
    // 设置轮询间隔
    sync.pollInterval = setInterval(checkRecentSong, sync.syncIntervalMs);
}

// 停止轮询
function stopPolling() {
    if (sync.pollInterval) {
        clearInterval(sync.pollInterval);
        sync.pollInterval = null;
    }
}

// 检查最近播放的歌曲
async function checkRecentSong() {
    try {
        const recentSong = await getMostRecentSong();
        if (!recentSong) return;
        
        const songId = recentSong.id;
        
        // 检查歌曲是否变化
        if (songId !== sync.lastSongId) {
            console.log('检测到新歌曲:', recentSong.name);
            sync.lastSongId = songId;
            
            // 更新歌曲信息
            updateSongInfo(recentSong);
            
            // 重置播放进度
            sync.currentTime = 12;
            updateProgress();
            
            // 获取新歌词
            await fetchAndDisplayLyrics(songId);
            
            showNotification(`切换到: ${recentSong.name}`, 'info');
        }
        
    } catch (error) {
        console.error('检查最近播放失败:', error);
    }
}

// ===================== 歌曲信息处理 =====================

// 获取最近播放的歌曲
async function getMostRecentSong() {
    try {
        const cookie = localStorage.getItem('netease_cookie');
        if (!cookie) throw new Error('未登录');
        
        const apiBase = localStorage.getItem('netease_api_base') || 'https://neteaseapi-enhanced.vercel.app';
        const timestamp = Date.now();
        
        const url = `${apiBase}/record/recent/song?limit=1&cookie=${encodeURIComponent(cookie)}&timestamp=${timestamp}&randomCNIP=true`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.code === 200 && data.data && data.data.list && data.data.list.length > 0) {
            const song = data.data.list[0];
            const songData = song.data || song;
            
            return {
                id: songData.id,
                name: songData.name || '未知歌曲',
                artists: songData.ar ? songData.ar.map(a => a.name).join(', ') : '未知歌手',
                album: songData.al ? songData.al.name : '未知专辑',
                coverUrl: songData.al && songData.al.picUrl ? `${songData.al.picUrl}?param=300y300` : '',
                duration: songData.dt || 180000
            };
        }
        
        return null;
        
    } catch (error) {
        console.error('获取最近播放失败:', error);
        return null;
    }
}

// 更新歌曲信息
function updateSongInfo(songInfo) {
    dom.songTitle.textContent = songInfo.name;
    dom.songArtist.textContent = songInfo.artists;
    dom.songAlbum.textContent = songInfo.album;
    dom.songCover.src = songInfo.coverUrl || 'https://via.placeholder.com/300?text=专辑封面';
    
    // 更新全屏模式
    dom.fullscreenSongName.textContent = songInfo.name;
    dom.fullscreenSongArtist.textContent = `${songInfo.artists} · ${songInfo.album}`;
    
    // 更新背景
    updateFullscreenBackground(songInfo.coverUrl);
    
    sync.totalTime = songInfo.duration / 1000;
    dom.totalTime.textContent = formatTime(sync.totalTime);
    dom.fullscreenTotalTime.textContent = formatTime(sync.totalTime);
}

// ===================== 歌词处理 =====================

// 获取并显示歌词
async function fetchAndDisplayLyrics(songId) {
    try {
        const lyrics = await fetchLyrics(songId);
        if (lyrics && lyrics.length > 0) {
            sync.currentLyrics = lyrics;
            dom.lyricsCount.textContent = `${lyrics.length}行`;
            displayLyrics();
        } else {
            showNoLyrics();
        }
    } catch (error) {
        console.error('获取歌词失败:', error);
        showNoLyrics();
    }
}

// 获取歌词
async function fetchLyrics(songId) {
    try {
        const apiBase = localStorage.getItem('netease_api_base') || 'https://neteaseapi-enhanced.vercel.app';
        const timestamp = Date.now();
        const url = `${apiBase}/lyric?id=${songId}&timestamp=${timestamp}&randomCNIP=true`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.code === 200 && data.lrc && data.lrc.lyric) {
            return parseLrc(data.lrc.lyric);
        }
        
        return [];
        
    } catch (error) {
        console.error('获取歌词失败:', error);
        return [];
    }
}

// 解析歌词
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
                text: text
            });
        });
    });

    result.sort((a, b) => a.time - b.time);
    return result;
}

// 显示歌词
function displayLyrics() {
    if (sync.currentLyrics.length === 0) {
        showNoLyrics();
        return;
    }
    
    dom.emptyState.style.display = 'none';
    
    let html = '';
    sync.currentLyrics.forEach((lyric, index) => {
        const timeStr = formatTime(lyric.time / 1000);
        html += `
            <div class="lyric-line" 
                 data-index="${index}" 
                 data-time="${lyric.time}"
                 data-timestr="${timeStr}"
                 onclick="lyricClick(${index})"
                 title="点击跳转到 ${timeStr}"
                 style="font-size: ${sync.lyricSize}px">
                ${escapeHtml(lyric.text)}
            </div>
        `;
    });
    
    dom.lyricsContainer.innerHTML = html;
    
    // 更新全屏歌词
    displayFullscreenLyrics();
}

// 歌词点击事件
function lyricClick(index) {
    if (!sync.isSyncing || index >= sync.currentLyrics.length) return;
    
    const lyricTime = sync.currentLyrics[index].time;
    
    sync.currentTime = Math.max(0, Math.min(sync.totalTime, (lyricTime / 1000) + sync.offset));
    updateProgress();
    updateLyricHighlight(true);
    
    console.log(`跳转到 ${formatTime(sync.currentTime)}`);
}

// ===================== 播放控制 =====================

// 开始播放
function startPlayback() {
    if (sync.syncInterval) {
        clearInterval(sync.syncInterval);
    }
    
    sync.currentTime = 12; // 从12秒开始
    sync.isPlaying = true;
    updatePlayButton();
    updateProgress();
    
    // 模拟播放进度
    sync.syncInterval = setInterval(() => {
        if (sync.currentTime >= sync.totalTime) {
            sync.currentTime = sync.totalTime;
            sync.isPlaying = false;
            updatePlayButton();
            clearInterval(sync.syncInterval);
        }
        
        if (sync.isPlaying) {
            sync.currentTime += 1;
            updateProgress();
            updateLyricHighlight();
            
            // 更新同步时间
            updateSyncTime();
        }
        
    }, 1000);
}

// 停止播放
function stopPlayback() {
    if (sync.syncInterval) {
        clearInterval(sync.syncInterval);
        sync.syncInterval = null;
    }
    
    sync.isPlaying = false;
    updatePlayButton();
}

// 切换播放状态
function togglePlayback() {
    sync.isPlaying = !sync.isPlaying;
    updatePlayButton();
    
    if (sync.isPlaying) {
        showNotification('播放已继续', 'info');
    } else {
        showNotification('播放已暂停', 'info');
    }
}

// 跳转播放位置
function seekProgress(event) {
    if (!sync.isSyncing) return;
    
    const rect = dom.progressBar.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    
    sync.currentTime = Math.max(0, Math.min(sync.totalTime, percent * sync.totalTime));
    updateProgress();
    updateLyricHighlight(true);
}

// 快退5秒
function skipBackward() {
    if (!sync.isSyncing) return;
    
    sync.currentTime = Math.max(0, sync.currentTime - 5);
    updateProgress();
    updateLyricHighlight(true);
    
    showNotification('后退5秒', 'info');
}

// 快进5秒
function skipForward() {
    if (!sync.isSyncing) return;
    
    sync.currentTime = Math.min(sync.totalTime, sync.currentTime + 5);
    updateProgress();
    updateLyricHighlight(true);
    
    showNotification('前进5秒', 'info');
}

// 更新播放按钮
function updatePlayButton() {
    const icon = dom.playBtn.querySelector('i');
    icon.className = sync.isPlaying ? 'fas fa-pause' : 'fas fa-play';
}

// 更新进度显示
function updateProgress() {
    const percent = (sync.currentTime / sync.totalTime) * 100;
    dom.progressFill.style.width = `${percent}%`;
    
    dom.currentTime.textContent = formatTime(sync.currentTime);
    dom.fullscreenCurrentTime.textContent = formatTime(sync.currentTime);
}

// ===================== 歌词高亮和滚动 =====================

// 更新歌词高亮
function updateLyricHighlight(force = false) {
    const currentMs = (sync.currentTime - sync.offset) * 1000;
    
    // 二分查找提高性能
    let left = 0;
    let right = sync.currentLyrics.length - 1;
    let found = -1;
    
    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const midTime = sync.currentLyrics[mid].time;
        const nextTime = mid < sync.currentLyrics.length - 1 ? sync.currentLyrics[mid + 1].time : Number.MAX_SAFE_INTEGER;
        
        if (currentMs >= midTime && currentMs < nextTime) {
            found = mid;
            break;
        } else if (currentMs < midTime) {
            right = mid - 1;
        } else {
            left = mid + 1;
        }
    }
    
    if (found < 0 || found === sync.currentLyricIndex) return;
    
    sync.currentLyricIndex = found;
    sync.lastLyricIndex = found;
    
    // 更新普通模式
    updateNormalLyricsHighlight();
    
    // 更新全屏模式
    if (sync.isFullscreen) {
        updateFullscreenLyricsHighlight();
    }
    
    // 自动滚动
    if (sync.autoScroll) {
        scrollToActiveLyric();
    }
}

// 更新普通歌词高亮
function updateNormalLyricsHighlight() {
    const allLines = dom.lyricsContainer.querySelectorAll('.lyric-line');
    allLines.forEach(line => line.classList.remove('active'));
    
    if (sync.currentLyricIndex >= 0) {
        const currentLine = dom.lyricsContainer.querySelector(`.lyric-line[data-index="${sync.currentLyricIndex}"]`);
        if (currentLine) {
            currentLine.classList.add('active');
        }
    }
}

// 滚动到当前歌词
function scrollToActiveLyric() {
    if (!sync.autoScroll || sync.currentLyricIndex < 0) return;
    
    const activeLine = dom.lyricsContainer.querySelector('.lyric-line.active');
    if (!activeLine) return;
    
    const container = dom.lyricsContainer;
    const lineTop = activeLine.offsetTop;
    const lineHeight = activeLine.offsetHeight;
    const containerHeight = container.clientHeight;
    
    // 滚动到使当前歌词在容器中间
    const targetScroll = lineTop - (containerHeight / 2) + (lineHeight / 2);
    
    container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth'
    });
}

// ===================== 全屏模式 =====================

// 切换全屏模式
function toggleFullscreenMode() {
    sync.isFullscreen = !sync.isFullscreen;
    
    if (sync.isFullscreen) {
        enterFullscreenMode();
    } else {
        exitFullscreenMode();
    }
}

// 进入全屏模式
function enterFullscreenMode() {
    dom.fullscreenMode.style.display = 'block';
    document.body.classList.add('fullscreen-active');
    sync.isFullscreen = true;
    
    // 更新全屏歌词
    displayFullscreenLyrics();
    updateFullscreenLyricsHighlight();
    
    showNotification('已进入全屏模式 (ESC键退出)', 'info');
}

// 退出全屏模式
function exitFullscreenMode() {
    dom.fullscreenMode.style.display = 'none';
    document.body.classList.remove('fullscreen-active');
    sync.isFullscreen = false;
    
    showNotification('已退出全屏模式', 'info');
}

// 更新全屏背景
function updateFullscreenBackground(coverUrl) {
    const background = dom.fullscreenMode.querySelector('.fullscreen-background');
    if (background && coverUrl) {
        background.style.backgroundImage = `url('${coverUrl}')`;
    }
}

// 显示全屏歌词
function displayFullscreenLyrics() {
    if (!sync.isFullscreen || sync.currentLyrics.length === 0) return;
    
    let html = '';
    sync.currentLyrics.forEach((lyric, index) => {
        html += `
            <div class="fullscreen-lyric-line" 
                 data-index="${index}"
                 data-time="${lyric.time}">
                ${escapeHtml(lyric.text)}
            </div>
        `;
    });
    
    dom.fullscreenLyrics.innerHTML = html;
}

// 更新全屏歌词高亮
function updateFullscreenLyricsHighlight() {
    if (!sync.isFullscreen) return;
    
    const allLines = dom.fullscreenLyrics.querySelectorAll('.fullscreen-lyric-line');
    allLines.forEach(line => line.classList.remove('active'));
    
    if (sync.currentLyricIndex >= 0) {
        const currentLine = dom.fullscreenLyrics.querySelector(`.fullscreen-lyric-line[data-index="${sync.currentLyricIndex}"]`);
        if (currentLine) {
            currentLine.classList.add('active');
            
            // 滚动到合适位置
            scrollFullscreenToActiveLyric();
        }
    }
}

// 滚动全屏歌词
function scrollFullscreenToActiveLyric() {
    const activeLine = dom.fullscreenLyrics.querySelector('.fullscreen-lyric-line.active');
    if (!activeLine) return;
    
    const container = dom.fullscreenLyrics;
    const lineTop = activeLine.offsetTop;
    const lineHeight = activeLine.offsetHeight;
    const containerHeight = container.clientHeight;
    
    const targetScroll = lineTop - (containerHeight / 2) + (lineHeight / 2);
    
    container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth'
    });
}

// ===================== UI更新 =====================

// 更新状态
function updateStatus(status) {
    dom.statusDot.className = 'status-dot';
    dom.statusText.textContent = '准备就绪';
    
    dom.startBtn.disabled = false;
    dom.stopBtn.disabled = true;
    
    switch (status) {
        case 'ready':
            dom.statusDot.classList.add('ready');
            dom.statusText.textContent = '准备就绪';
            break;
            
        case 'connecting':
            dom.statusDot.classList.add('connecting');
            dom.statusText.textContent = '连接中...';
            dom.startBtn.disabled = true;
            break;
            
        case 'connected':
            dom.statusDot.classList.add('connected');
            dom.statusText.textContent = '已连接';
            dom.startBtn.disabled = true;
            dom.stopBtn.disabled = false;
            break;
            
        case 'no_song':
            dom.statusText.textContent = '无播放歌曲';
            break;
            
        case 'error':
            dom.statusText.textContent = '连接错误';
            break;
    }
    
    // 更新底部信息
    updateSyncInfo();
}

// 更新同步信息
function updateSyncInfo() {
    if (sync.isSyncing) {
        dom.syncInfo.textContent = `正在同步 - 上次同步: ${new Date().toLocaleTimeString()}`;
    } else {
        dom.syncInfo.textContent = '尚未开始同步';
    }
}

// 更新同步时间
function updateSyncTime() {
    dom.syncTime.textContent = new Date().toLocaleTimeString();
}

// 显示无歌词状态
function showNoLyrics() {
    dom.lyricsContainer.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">
                <i class="fas fa-music"></i>
            </div>
            <h3>暂无歌词</h3>
            <p>该歌曲可能没有提供歌词</p>
        </div>
    `;
}

// 显示加载状态
function showLoading(text) {
    dom.loadingText.textContent = text;
    dom.loadingOverlay.style.display = 'flex';
}

// 隐藏加载状态
function hideLoading() {
    dom.loadingOverlay.style.display = 'none';
}

// ===================== 设置控制 =====================

// 更新同步间隔
function updateSyncInterval(value) {
    sync.syncIntervalMs = value * 1000;
    document.getElementById('intervalValue').textContent = `${value}秒`;
    
    if (sync.isSyncing) {
        stopPolling();
        startPolling();
    }
}

// 更新歌词偏移
function updateLyricOffset(value) {
    sync.offset = parseInt(value);
    document.getElementById('offsetValue').textContent = `${value}秒`;
}

// 更新歌词大小
function updateLyricSize(value) {
    sync.lyricSize = parseInt(value);
    document.getElementById('sizeValue').textContent = `${value}px`;
    
    // 重新应用歌词大小
    const lines = dom.lyricsContainer.querySelectorAll('.lyric-line');
    lines.forEach(line => {
        line.style.fontSize = `${value}px`;
    });
}

// 更新UI数值
function updateUIValues() {
    document.getElementById('intervalValue').textContent = `${sync.syncIntervalMs / 1000}秒`;
    document.getElementById('offsetValue').textContent = `${sync.offset}秒`;
    document.getElementById('sizeValue').textContent = `${sync.lyricSize}px`;
}

// ===================== 工具函数 =====================

// 格式化时间
function formatTime(seconds) {
    if (seconds === undefined || seconds === null) return '0:00';
    
    const mins = Math.floor(Math.abs(seconds) / 60);
    const secs = Math.floor(Math.abs(seconds) % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// HTML转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 鼠标移动处理
function handleMouseMove(event) {
    const target = event.target;
    if (target.classList.contains('lyric-line')) {
        const timeStr = target.getAttribute('data-timestr');
        if (timeStr) {
            showTimeTooltip(event.clientX, event.clientY, timeStr);
        }
    } else {
        hideTimeTooltip();
    }
}

// 显示时间提示
function showTimeTooltip(x, y, timeStr) {
    let tooltip = document.getElementById('timeTooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'timeTooltip';
        tooltip.className = 'time-tooltip';
        document.body.appendChild(tooltip);
    }
    
    tooltip.textContent = `跳转到 ${timeStr}`;
    tooltip.style.left = (x + 15) + 'px';
    tooltip.style.top = (y - 40) + 'px';
    tooltip.style.display = 'block';
}

// 隐藏时间提示
function hideTimeTooltip() {
    const tooltip = document.getElementById('timeTooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
    }
}

// 页面可见性变化处理
function handleVisibilityChange() {
    if (document.hidden) {
        // 页面隐藏时暂停
        if (sync.isPlaying) {
            sync.isPlaying = false;
            updatePlayButton();
        }
    } else {
        // 页面显示时更新时间
        updateSyncTime();
    }
}

// 设置键盘快捷键
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // 空格键：播放/暂停
        if (e.code === 'Space') {
            e.preventDefault();
            togglePlayback();
        }
        
        // F键：全屏
        if (e.code === 'KeyF') {
            e.preventDefault();
            toggleFullscreenMode();
        }
        
        // 左右方向键：快进/快退
        if (e.code === 'ArrowLeft') {
            e.preventDefault();
            skipBackward();
        }
        
        if (e.code === 'ArrowRight') {
            e.preventDefault();
            skipForward();
        }
    });
}

// 显示通知
function showNotification(message, type = 'info') {
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
function addNotificationStyle() {
    const style = document.createElement('style');
    style.textContent = `
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 10000;
            transform: translateX(120%);
            transition: transform 0.3s ease;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
        }
        
        .notification.show {
            transform: translateX(0);
        }
        
        .notification-info {
            border-left: 4px solid #3498db;
        }
        
        .notification-success {
            border-left: 4px solid #2ecc71;
        }
        
        .notification-warning {
            border-left: 4px solid #f39c12;
        }
        
        .notification-error {
            border-left: 4px solid #e74c3c;
        }
        
        .notification i {
            font-size: 18px;
        }
    `;
    document.head.appendChild(style);
}

// 导出函数
function exportLyrics() {
    if (sync.currentLyrics.length === 0) {
        showNotification('没有歌词可以导出', 'warning');
        return;
    }
    
    let lrcText = '';
    sync.currentLyrics.forEach(item => {
        const minutes = Math.floor(item.time / 60000);
        const seconds = Math.floor((item.time % 60000) / 1000);
        const milliseconds = item.time % 1000;
        lrcText += `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}]${item.text}\n`;
    });
    
    const blob = new Blob([lrcText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dom.songTitle.textContent || '歌词'}.lrc`;
    a.click();
    URL.revokeObjectURL(url);
    
    showNotification('歌词导出成功', 'success');
}

function clearLyrics() {
    sync.currentLyrics = [];
    sync.currentLyricIndex = -1;
    dom.lyricsContainer.innerHTML = '';
    dom.emptyState.style.display = 'flex';
    dom.lyricsCount.textContent = '0行';
    
    showNotification('歌词已清除', 'info');
}

function goBack() {
    window.history.back();
}

function openLogin() {
    window.open('../index.html', '_blank');
}

function playCurrentSong() {
    if (!sync.isSyncing) {
        startSync();
    } else {
        togglePlayback();
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initLyricSync();
    addNotificationStyle();
});

// 导出全局函数
window.toggleFullscreenMode = toggleFullscreenMode;
window.exitFullscreenMode = exitFullscreenMode;
window.togglePlayback = togglePlayback;
window.skipBackward = skipBackward;
window.skipForward = skipForward;
window.seekProgress = seekProgress;
window.lyricClick = lyricClick;
window.exportLyrics = exportLyrics;
window.clearLyrics = clearLyrics;
window.goBack = goBack;
window.openLogin = openLogin;
window.playCurrentSong = playCurrentSong;
window.updateSyncInterval = updateSyncInterval;
window.updateLyricOffset = updateLyricOffset;
window.updateLyricSize = updateLyricSize;