// 全局变量
let API_BASE = 'https://neteaseapi-enhanced.vercel.app';
let currentTheme = 'auto';
// 在 netease.js 中添加或修改以下函数

async function getSongUrl(songId) {
    try {
        console.log(`开始获取歌曲URL: ${songId}`);
        
        // 先获取歌曲详情，检查是否为VIP歌曲
        const detailUrl = buildApiUrl('/song/detail', { ids: songId });
        const detailResponse = await fetch(detailUrl);
        const detailData = await detailResponse.json();
        
        let isVIP = false;
        let songInfo = null;
        
        if (detailData.code === 200 && detailData.songs && detailData.songs[0]) {
            songInfo = detailData.songs[0];
            isVIP = songInfo.fee === 1; // fee=1 表示VIP歌曲
            console.log(`歌曲信息: ${songInfo.name}, VIP: ${isVIP}, 费用类型: ${songInfo.fee}`);
        }
        
        // 如果是VIP歌曲，优先尝试解灰
        if (isVIP) {
            console.log('检测到VIP歌曲，优先尝试解灰...');
            
            // 尝试方法1: 使用解灰接口
            const unblockUrl = buildApiUrl('/song/url/match', { id: songId });
            const unblockResponse = await fetch(unblockUrl);
            const unblockData = await unblockResponse.json();
            
            if (unblockData.code === 200 && unblockData.data && unblockData.data.url) {
                console.log('VIP歌曲解灰成功');
                return {
                    url: unblockData.data.url,
                    br: unblockData.data.br || 0,
                    size: unblockData.data.size || 0,
                    level: 'standard',
                    source: 'unblock',
                    isVIP: true,
                    originalFee: songInfo?.fee || 0
                };
            }
            
            console.log('VIP歌曲解灰失败，尝试其他方法...');
        }
        
        // 检查歌曲是否可用（非VIP检查）
        const checkUrl = buildApiUrl('/check/music', { id: songId });
        const checkResponse = await fetch(checkUrl);
        const checkData = await checkResponse.json();
        
        console.log('歌曲可用性检查:', checkData);
        
        if (!checkData.success && !isVIP) {
            console.warn(`歌曲 ${songId} 不可用: ${checkData.message}`);
            return null;
        }

        // 尝试使用新版API获取高质量URL
        const params = {
            id: songId,
            level: 'standard', // 使用标准音质，兼容性更好
            timestamp: Date.now()
        };

        // 添加cookie参数（如果已登录）
        if (window.loginManager?.checkLogin()) {
            const cookie = window.loginManager.getCookie();
            if (cookie) {
                params.cookie = cookie;
            }
        }

        const url = buildApiUrl('/song/url/v1', params);
        console.log('获取歌曲URL:', url);
        
        const response = await fetch(url);
        const data = await response.json();
        
        console.log('歌曲URL响应:', data);

        if (data.code === 200 && data.data) {
            const song = Array.isArray(data.data) ? data.data[0] : data.data;
            
            if (song.url && song.url.startsWith('http')) {
                console.log(`成功获取歌曲URL: ${song.url.substring(0, 50)}...`);
                return {
                    url: song.url,
                    br: song.br || 0,
                    size: song.size || 0,
                    md5: song.md5 || '',
                    level: song.level || 'standard',
                    source: 'netease_v1',
                    isVIP: isVIP,
                    originalFee: songInfo?.fee || 0
                };
            }
        }

        // 如果新版API失败，尝试旧版API
        console.log('尝试使用旧版API获取歌曲URL');
        const oldUrl = buildApiUrl('/song/url', { 
            id: songId,
            br: 128000  // 降低码率，提高成功率
        });
        
        const oldResponse = await fetch(oldUrl);
        const oldData = await oldResponse.json();
        
        if (oldData.code === 200 && oldData.data) {
            const song = Array.isArray(oldData.data) ? oldData.data[0] : oldData.data;
            if (song.url && song.url.startsWith('http')) {
                console.log(`使用旧版API获取歌曲URL成功`);
                return {
                    url: song.url,
                    br: song.br || 0,
                    size: song.size || 0,
                    md5: song.md5 || '',
                    level: 'standard',
                    source: 'netease',
                    isVIP: isVIP,
                    originalFee: songInfo?.fee || 0
                };
            }
        }

        // 如果不是VIP歌曲，最后尝试解灰
        if (!isVIP) {
            console.log('尝试解灰歌曲');
            const finalUnblockUrl = buildApiUrl('/song/url/match', { id: songId });
            const finalUnblockResponse = await fetch(finalUnblockUrl);
            const finalUnblockData = await finalUnblockResponse.json();
            
            if (finalUnblockData.code === 200 && finalUnblockData.data && finalUnblockData.data.url) {
                console.log('解灰歌曲成功');
                return {
                    url: finalUnblockData.data.url,
                    br: finalUnblockData.data.br || 0,
                    size: finalUnblockData.data.size || 0,
                    level: 'standard',
                    source: 'unblock_fallback',
                    isVIP: false,
                    originalFee: songInfo?.fee || 0
                };
            }
        }

        console.warn('所有获取歌曲URL的方法都失败了');
        return null;

    } catch (error) {
        console.error('获取歌曲URL失败:', error);
        return null;
    }
}

// 修改 playSong 函数
async function playSong(songId, songName) {
    try {
        console.log(`开始播放: ${songName} (ID: ${songId})`);
        
        // 获取歌曲URL
        const songData = await getSongUrl(songId);
        
        if (!songData || !songData.url) {
            // 获取歌曲详情以显示更具体的错误信息
            const detailData = await fetchWithAuth('/song/detail', { ids: songId });
            
            if (detailData.code === 200 && detailData.songs && detailData.songs[0]) {
                const song = detailData.songs[0];
                const fee = song.fee || 0;
                
                if (fee === 1) {
                    // VIP歌曲 - 提示但允许重试
                    const retry = confirm(`"${songName}" 是VIP歌曲\n尝试解灰播放失败，是否重试其他方法？\n\n点击"确定"重试，点击"取消"跳过`);
                    if (retry) {
                        // 清除可能的缓存，强制重试
                        await playSong(songId, songName);
                    }
                } else if (fee === 4) {
                    // 付费歌曲
                    alert(`"${songName}" 是付费歌曲，需要购买才能播放`);
                } else {
                    // 普通歌曲但无法播放
                    alert(`"${songName}" 暂时无法播放，可能是版权限制或服务器问题\n请稍后重试或选择其他歌曲`);
                }
            } else {
                alert(`"${songName}" 暂时无法播放，请重试`);
            }
            return;
        }

        // 检查URL是否有效（防止"该资源无法播放"的音频）
        if (songData.url.includes('该资源暂时无法播放') || 
            songData.url.includes('unavailable') ||
            songData.url.includes('error')) {
            
            console.warn(`获取到无效URL: ${songData.url.substring(0, 100)}...`);
            
            // 如果是VIP歌曲且来自解灰，显示特定提示
            if (songData.isVIP && songData.source === 'unblock') {
                const retry = confirm(`"${songName}" 播放失败\n可能是解灰源不稳定，是否重试其他方法？`);
                if (retry) {
                    // 清除当前结果，重新获取
                    await playSong(songId, songName);
                }
                return;
            }
            
            alert(`"${songName}" 的播放链接无效，系统将尝试其他方式\n请稍后重试`);
            return;
        }

        console.log(`播放歌曲: ${songName}, 来源: ${songData.source}, 码率: ${songData.br}kbps`);
        
        // 调用播放器功能
        window.playAudio(songData.url, songName, songId);
        
        // 显示音质信息
        if (songData.isVIP && songData.source === 'unblock') {
            console.log(`正在播放VIP歌曲 (通过解灰): ${songName}`);
            // 可以在这里添加一个小提示，但不要干扰播放
            setTimeout(() => {
                const player = document.querySelector('.netease-player');
                if (player) {
                    const tip = document.createElement('div');
                    tip.className = 'vip-tip';
                    tip.innerHTML = `<i class="fas fa-music"></i> 正在播放VIP歌曲`;
                    tip.style.cssText = `
                        position: absolute;
                        top: -30px;
                        left: 0;
                        right: 0;
                        background: linear-gradient(45deg, #ffd700, #ffa500);
                        color: #000;
                        padding: 5px 10px;
                        border-radius: 15px;
                        font-size: 12px;
                        text-align: center;
                        z-index: 100;
                        animation: slideDown 0.5s ease;
                    `;
                    player.style.position = 'relative';
                    player.appendChild(tip);
                    
                    // 3秒后自动消失
                    setTimeout(() => {
                        tip.style.animation = 'slideUp 0.5s ease';
                        setTimeout(() => tip.remove(), 500);
                    }, 3000);
                }
            }, 1000);
        }

    } catch (error) {
        console.error('播放失败:', error);
        
        // 根据错误类型显示不同的提示
        if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
            alert(`网络连接失败，请检查网络后重试播放 "${songName}"`);
        } else {
            alert(`播放 "${songName}" 失败，请重试\n错误: ${error.message}`);
        }
    }
}

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
@keyframes slideDown {
    from { transform: translateY(-20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}

@keyframes slideUp {
    from { transform: translateY(0); opacity: 1; }
    to { transform: translateY(-20px); opacity: 0; }
}
`;
document.head.appendChild(style);

// 添加一个专门处理VIP歌曲播放的函数
async function playVIPSong(songId, songName) {
    console.log(`专门处理VIP歌曲: ${songName}`);
    
    try {
        // 优先使用解灰接口
        const unblockUrl = buildApiUrl('/song/url/match', { id: songId });
        console.log('使用VIP专用解灰接口:', unblockUrl);
        
        const response = await fetch(unblockUrl);
        const data = await response.json();
        
        if (data.code === 200 && data.data && data.data.url) {
            console.log('VIP歌曲解灰成功');
            
            // 验证URL
            if (data.data.url.includes('该资源暂时无法播放')) {
                throw new Error('解灰源返回无效URL');
            }
            
            window.playAudio(data.data.url, songName, songId);
            
            // 显示解灰成功提示
            setTimeout(() => {
                const player = document.querySelector('.netease-player');
                if (player) {
                    const tip = document.createElement('div');
                    tip.className = 'unblock-tip';
                    tip.innerHTML = `<i class="fas fa-unlock-alt"></i> 已解锁VIP歌曲`;
                    tip.style.cssText = `
                        position: absolute;
                        top: -30px;
                        left: 0;
                        right: 0;
                        background: linear-gradient(45deg, #28a745, #20c997);
                        color: white;
                        padding: 5px 10px;
                        border-radius: 15px;
                        font-size: 12px;
                        text-align: center;
                        z-index: 100;
                        animation: slideDown 0.5s ease;
                    `;
                    player.style.position = 'relative';
                    player.appendChild(tip);
                    
                    setTimeout(() => {
                        tip.style.animation = 'slideUp 0.5s ease';
                        setTimeout(() => tip.remove(), 500);
                    }, 3000);
                }
            }, 1000);
            
            return true;
        }
        
        return false;
        
    } catch (error) {
        console.error('VIP歌曲专用播放失败:', error);
        return false;
    }
}


// 增强的API请求函数
async function fetchWithAuth(endpoint, params = {}) {
    // 获取登录状态
    const isLoggedIn = window.loginManager?.checkLogin();
    const cookie = window.loginManager?.getCookie();
    
    // 构建基础参数
    const baseParams = {
        ...params,
        timestamp: Date.now(),
        randomCNIP: true
    };
    
    // 如果已登录，添加cookie
    if (isLoggedIn && cookie) {
        baseParams.cookie = cookie;
    }
    
    // 构建URL
    const queryString = new URLSearchParams();
    Object.keys(baseParams).forEach(key => {
        if (baseParams[key] !== null && baseParams[key] !== undefined) {
            queryString.append(key, baseParams[key]);
        }
    });
    
    const url = `${API_BASE}${endpoint}?${queryString}`;
    console.log(`API请求: ${url.substring(0, 100)}...`);
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        // 检查是否需要重新登录
        if (data.code === 301 && data.message?.includes('需要登录')) {
            console.log('需要重新登录');
            if (window.loginManager) {
                window.loginManager.clearLoginStatus();
                window.loginManager.updateUserDisplay();
            }
        }
        
        return data;
    } catch (error) {
        console.error('API请求失败:', error);
        throw error;
    }
}



// 检查VIP状态
async function checkVIPStatus() {
    const isLoggedIn = window.loginManager?.checkLogin();
    if (!isLoggedIn) {
        return {
            isVIP: false,
            message: '未登录'
        };
    }
    
    try {
        const data = await fetchWithAuth('/user/account', {});
        
        if (data.code === 200 && data.account) {
            const isVIP = data.account.vipType > 0;
            const vipInfo = {
                isVIP: isVIP,
                vipType: data.account.vipType || 0,
                nickname: data.profile?.nickname || '用户',
                expireTime: data.account.vipExpireTime || 0,
                message: isVIP ? 'VIP用户' : '普通用户'
            };
            
            console.log('VIP状态:', vipInfo);
            
            // 更新UI显示VIP状态
            updateVIPDisplay(vipInfo);
            
            return vipInfo;
        }
        
        return {
            isVIP: false,
            message: '获取VIP状态失败'
        };
    } catch (error) {
        console.error('检查VIP状态失败:', error);
        return {
            isVIP: false,
            message: '检查失败'
        };
    }
}

// 更新VIP显示
function updateVIPDisplay(vipInfo) {
    const loginBtn = document.querySelector('.login-btn');
    if (!loginBtn) return;
    
    // 添加或更新VIP标识
    let vipBadge = loginBtn.querySelector('.vip-badge');
    
    if (vipInfo.isVIP) {
        if (!vipBadge) {
            vipBadge = document.createElement('span');
            vipBadge.className = 'vip-badge';
            vipBadge.innerHTML = '<i class="fas fa-crown"></i>';
            vipBadge.style.cssText = `
                position: absolute;
                top: -5px;
                right: -5px;
                background: linear-gradient(45deg, #ffd700, #ffa500);
                color: #000;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                z-index: 10;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            `;
            loginBtn.style.position = 'relative';
            loginBtn.appendChild(vipBadge);
        }
        
        // 更新提示文字
        loginBtn.title = `${vipInfo.nickname} (VIP)`;
        
        // 添加VIP样式
        loginBtn.classList.add('vip-user');
    } else {
        // 移除VIP标识
        if (vipBadge) {
            vipBadge.remove();
        }
        loginBtn.classList.remove('vip-user');
    }
}

// 检查歌曲是否可播放（VIP歌曲检查）
async function checkSongPlayable(songId) {
    try {
        // 获取歌曲详情
        const detailData = await fetchWithAuth('/song/detail', {
            ids: songId
        });
        
        if (detailData.code === 200 && detailData.songs && detailData.songs[0]) {
            const song = detailData.songs[0];
            const isVIP = song.fee === 1; // fee=1 表示VIP歌曲
            
            // 获取歌曲URL测试
            const urlData = await getSongUrl(songId);
            const canPlay = urlData && urlData.url;
            
            return {
                songId: songId,
                name: song.name,
                isVIP: isVIP,
                canPlay: canPlay,
                fee: song.fee,
                message: isVIP ? (canPlay ? 'VIP歌曲（可播放）' : 'VIP歌曲（需要VIP）') : '普通歌曲'
            };
        }
        
        return {
            songId: songId,
            canPlay: false,
            message: '获取歌曲信息失败'
        };
    } catch (error) {
        console.error('检查歌曲可播放性失败:', error);
        return {
            songId: songId,
            canPlay: false,
            message: '检查失败'
        };
    }
}



// 获取VIP专属歌曲
async function getVIPPlaylist() {
    try {
        // 检查登录状态
        const isLoggedIn = window.loginManager?.checkLogin();
        if (!isLoggedIn) {
            alert('请先登录查看VIP专属内容');
            window.login();
            return [];
        }
        
        // 获取VIP推荐歌单
        const data = await fetchWithAuth('/top/playlist', {
            cat: '华语',
            limit: 20,
            order: 'hot'
        });
        
        if (data.code === 200 && data.playlists) {
            return data.playlists;
        }
        
        return [];
    } catch (error) {
        console.error('获取VIP歌单失败:', error);
        return [];
    }
}

// 显示VIP专属内容
async function showVIPContent() {
    try {
        // 检查VIP状态
        const vipInfo = await checkVIPStatus();
        
        if (!vipInfo.isVIP) {
            alert('此功能需要VIP会员');
            return;
        }
        
        // 切换到搜索页面显示VIP内容
        switchSection('search');
        
        const resultsContainer = document.getElementById('searchResults');
        resultsContainer.innerHTML = `
            <div class="loading-container">
                <div class="spinner"></div>
                <div class="loading-text">正在加载VIP专属内容...</div>
            </div>
        `;
        
        // 获取VIP歌单
        const playlists = await getVIPPlaylist();
        
        if (playlists.length === 0) {
            resultsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-crown"></i>
                    <h3>VIP专属内容</h3>
                    <p>暂无可用的VIP专属内容</p>
                </div>
            `;
            return;
        }
        
        // 显示VIP歌单
        let html = `
            <div class="search-results-header">
                <h2><i class="fas fa-crown"></i> VIP专属内容</h2>
                <p>${vipInfo.nickname} 的专属推荐</p>
            </div>
            <div class="grid-view">
        `;
        
        playlists.forEach(playlist => {
            html += `
                <div class="song-card vip-card">
                    <img src="${playlist.coverImgUrl || 'https://via.placeholder.com/300'}?param=300y200" alt="${playlist.name}">
                    <div class="vip-badge-overlay">
                        <i class="fas fa-crown"></i> VIP
                    </div>
                    <div class="song-card-content">
                        <div class="song-card-title">${playlist.name}</div>
                        <div class="song-card-meta">${playlist.trackCount}首歌曲</div>
                        <div class="song-card-actions">
                            <button class="song-card-btn vip-btn" onclick="viewPlaylist(${playlist.id})">
                                <i class="fas fa-eye"></i> 查看
                            </button>
                            <button class="song-card-btn secondary" onclick="playPlaylist(${playlist.id})">
                                <i class="fas fa-play"></i> 播放
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        resultsContainer.innerHTML = html;
        
        // 添加VIP卡片样式
        const style = document.createElement('style');
        style.textContent = `
            .vip-card {
                position: relative;
                border: 2px solid rgba(255,215,0,0.3);
            }
            
            .vip-badge-overlay {
                position: absolute;
                top: 10px;
                right: 10px;
                background: linear-gradient(45deg, #ffd700, #ffa500);
                color: #000;
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: bold;
                display: flex;
                align-items: center;
                gap: 4px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            }
            
            .vip-btn {
                background: linear-gradient(45deg, #ffd700, #ffa500) !important;
                color: #000 !important;
                border: none !important;
            }
        `;
        document.head.appendChild(style);
        
    } catch (error) {
        console.error('显示VIP内容失败:', error);
        alert('加载VIP内容失败');
    }
}

// 控制VIP导航显示
function updateVIPNavigation() {
    const vipNavItem = document.getElementById('vipNavItem');
    if (!vipNavItem) return;
    
    const isLoggedIn = window.loginManager?.checkLogin();
    vipNavItem.style.display = isLoggedIn ? 'flex' : 'none';
}

// 登录状态变化回调
function onLoginStatusChanged() {
    updateVIPNavigation();
    checkVIPStatus();
}

// 初始化应用
function initApp() {
    loadSettings();
    setupTheme();
    loadRecommendations();
    setupSearch();
    
    // 检查VIP状态并更新导航
    setTimeout(() => {
        checkVIPStatus();
        updateVIPNavigation();
    }, 2000);
}

// 设置主题
function setupTheme() {
    const savedTheme = localStorage.getItem('netease_theme') || 'auto';
    currentTheme = savedTheme;
    
    if (savedTheme === 'auto') {
        // 自动检测系统主题
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
        document.documentElement.setAttribute('data-theme', savedTheme);
    }
}

// 切换主题
function toggleTheme() {
    const themes = ['auto', 'light', 'dark'];
    const currentIndex = themes.indexOf(currentTheme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    
    currentTheme = nextTheme;
    localStorage.setItem('netease_theme', nextTheme);
    
    if (nextTheme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
        document.documentElement.setAttribute('data-theme', nextTheme);
    }
    
    // 更新主题按钮图标
    const themeBtn = document.querySelector('.theme-toggle');
    if (themeBtn) {
        const icon = themeBtn.querySelector('i');
        if (nextTheme === 'dark') {
            icon.className = 'fas fa-sun';
        } else if (nextTheme === 'light') {
            icon.className = 'fas fa-moon';
        } else {
            // auto - 显示系统图标
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            icon.className = prefersDark ? 'fas fa-adjust' : 'fas fa-adjust';
        }
    }
}

// 切换页面
function switchSection(sectionId) {
    // 更新导航
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`.nav-item[href="#${sectionId}"]`).classList.add('active');
    
    // 显示对应内容
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
}

// 加载推荐内容
async function loadRecommendations() {
    const playlistsGrid = document.getElementById('playlistsGrid');
    if (!playlistsGrid) return;
    
    playlistsGrid.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const url = buildApiUrl('/top/playlist', { limit: 6 });
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.code === 200 && data.playlists) {
            let html = '';
            data.playlists.forEach(playlist => {
                html += `
                    <div class="playlist-card">
                        <img src="${playlist.coverImgUrl}?param=200y200" alt="${playlist.name}">
                        <div class="playlist-info">
                            <h4>${playlist.name}</h4>
                            <p>${playlist.trackCount}首歌曲</p>
                        </div>
                    </div>
                `;
            });
            playlistsGrid.innerHTML = html;
        }
    } catch (error) {
        console.error('加载推荐失败:', error);
        playlistsGrid.innerHTML = '<div class="error">加载失败</div>';
    }
}

// 加载热门歌曲
async function loadHotSongs() {
    switchSection('search');
    const searchInput = document.getElementById('searchInput');
    searchInput.value = '热门歌曲';
    performSearch();
}

// 在netease.js中添加这些函数
function setupSearch() {
    // 确保搜索输入框获得焦点时显示建议
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('focus', function() {
            if (this.value.length > 0 && enhancedSearch) {
                enhancedSearch.showSearchSuggestions(this.value);
            }
        });
    }
    
    // 监听搜索类型变化
    const searchType = document.getElementById('searchType');
    if (searchType && enhancedSearch) {
        searchType.addEventListener('change', () => enhancedSearch.updateSearchType());
    }
}

// 加载设置
function loadSettings() {
    const savedApiBase = localStorage.getItem('netease_api_base');
    if (savedApiBase) {
        API_BASE = savedApiBase;
    }
}

// 构建API URL
function buildApiUrl(endpoint, params = {}) {
    const timestamp = Date.now();
    const baseParams = `timestamp=${timestamp}&randomCNIP=true`;
    const queryParams = new URLSearchParams();
    
    Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
            queryParams.append(key, params[key]);
        }
    });
    
    const queryString = queryParams.toString();
    return `${API_BASE}${endpoint}?${baseParams}${queryString ? '&' + queryString : ''}`;
}

// 构建带时间戳的API URL（用于二维码登录）
function buildApiUrlWithTimestamp(endpoint, params = {}) {
    const timestamp = Date.now();
    return buildApiUrl(endpoint, { ...params, timestamp });
}

// API配置相关
function toggleApiConfig() {
    const modal = document.getElementById('apiConfigModal');
    modal.classList.toggle('active');
    
    const input = document.getElementById('apiBaseUrl');
    input.value = API_BASE;
}

function updateApiBase() {
    const newApiBase = document.getElementById('apiBaseUrl').value.trim();
    if (!newApiBase) {
        alert('请输入API地址');
        return;
    }
    
    API_BASE = newApiBase;
    localStorage.setItem('netease_api_base', newApiBase);
    toggleApiConfig();
    alert('API地址已更新');
}

// 检查登录状态的函数
function checkLoginStatus() {
    return window.loginManager ? window.loginManager.checkLogin() : false;
}

// 获取用户信息
function getUserInfo() {
    return window.loginManager ? window.loginManager.getUserInfo() : null;
}

// 需要登录的API调用
async function fetchWithLogin(endpoint, params = {}) {
    if (window.loginManager && window.loginManager.checkLogin()) {
        return window.loginManager.fetchWithLogin(endpoint, params);
    } else {
        // 未登录时使用普通API
        const url = buildApiUrl(endpoint, params);
        const response = await fetch(url);
        return await response.json();
    }
}

// 确保登录函数指向新的登录管理器
window.login = () => {
    if (window.loginManager) {
        window.loginManager.showLoginModal();
    } else {
        console.error('登录管理器未初始化');
        // 尝试重新初始化
        if (typeof initLoginManager === 'function') {
            initLoginManager();
            if (window.loginManager) {
                window.loginManager.showLoginModal();
            }
        }
    }
};

// 暴露全局函数
window.playSong = playSong;
window.showVIPContent = showVIPContent;
window.checkVIPStatus = checkVIPStatus;
window.fetchWithAuth = fetchWithAuth;
window.onLoginStatusChanged = onLoginStatusChanged;

// 兼容旧版本
window.getSongUrl = getSongUrl;
window.fetchWithLogin = fetchWithLogin;
window.checkLoginStatus = checkLoginStatus;
window.getUserInfo = getUserInfo;