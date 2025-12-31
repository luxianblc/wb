/* ===========================
   登录管理器（修复版 - 完整版本）
   =========================== */

class LoginManager {
    constructor() {
        this.qrKey = null;
        this.checkTimer = null;
        this.isLoggedIn = false;
        this.userInfo = null;
        this.cookie = null;

        console.log('LoginManager 构造函数被调用');
        
        this.loadLoginStatus();
        this.setupGlobalCSS();
        this.updateUserDisplay();
        
        // 绑定全局事件
        this.bindGlobalEvents();
    }

    /* ---------- 绑定全局事件 ---------- */
    bindGlobalEvents() {
        // 确保登录按钮事件被正确绑定
        document.addEventListener('click', (e) => {
            if (e.target.closest('.login-btn') || e.target.closest('#userLoginBtn')) {
                e.preventDefault();
                e.stopPropagation();
                this.showLoginModal();
            }
        });
    }

    /* ---------- 本地状态 ---------- */

    loadLoginStatus() {
        const cookie = localStorage.getItem('netease_cookie');
        const userInfo = localStorage.getItem('netease_user_info');

        if (cookie) {
            this.cookie = cookie;
            this.isLoggedIn = true;
        }

        if (userInfo) {
            try {
                this.userInfo = JSON.parse(userInfo);
            } catch {
                this.userInfo = null;
            }
        }
    }

    saveLoginStatus() {
        if (this.cookie) {
            localStorage.setItem('netease_cookie', this.cookie);
        }
        if (this.userInfo) {
            localStorage.setItem(
                'netease_user_info',
                JSON.stringify(this.userInfo)
            );
        }
    }

    clearLoginStatus() {
        this.cookie = null;
        this.userInfo = null;
        this.isLoggedIn = false;

        localStorage.removeItem('netease_cookie');
        localStorage.removeItem('netease_user_info');

        this.stopQRLogin();
        this.updateUserDisplay();
    }

    /* ---------- UI ---------- */

    setupGlobalCSS() {
        if (document.getElementById('login-global-style')) return;

        const style = document.createElement('style');
        style.id = 'login-global-style';
        style.textContent = `
            .login-status-indicator::after {
                content: '';
                position: absolute;
                top: 2px;
                right: 2px;
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #28a745;
            }
        `;
        document.head.appendChild(style);
    }

    updateUserDisplay() {
        const btn = document.querySelector('.login-btn');
        if (!btn) {
            console.log('登录按钮未找到，等待 DOM 加载...');
            // 延迟重试
            setTimeout(() => this.updateUserDisplay(), 100);
            return;
        }

        btn.classList.toggle('login-status-indicator', this.isLoggedIn);

        if (this.isLoggedIn && this.userInfo?.profile) {
            const p = this.userInfo.profile;
            btn.innerHTML = `
                <div class="login-btn-content">
                    ${p.avatarUrl ? `<img src="${p.avatarUrl}?param=30y30" class="user-avatar" style="width:24px;height:24px;border-radius:50%;">` : `<i class="fas fa-user"></i>`}
                    <span class="login-btn-text" id="loginBtnText">${p.nickname || '用户'}</span>
                </div>
            `;
            btn.title = p.nickname;
        } else {
            btn.innerHTML = `
                <div class="login-btn-content">
                    <i class="fas fa-user"></i>
                    <span class="login-btn-text" id="loginBtnText">登录</span>
                </div>
            `;
            btn.title = '点击登录';
        }
    }

    /* ---------- 弹窗 ---------- */

    showLoginModal() {
        try {
            console.log('showLoginModal 被调用');
            console.log('this.isLoggedIn:', this.isLoggedIn);
            console.log('登录管理器状态:', window.loginManager ? '已初始化' : '未初始化');
            
            if (this.isLoggedIn) {
                console.log('用户已登录，显示用户菜单');
                this.showUserMenu();
                return;
            }

            let modal = document.getElementById('loginModal');
            if (!modal) {
                console.log('创建登录模态框');
                modal = document.createElement('div');
                modal.id = 'loginModal';
                modal.className = 'modal';
                modal.innerHTML = `
                    <div class="modal-content" style="max-width:350px;text-align:center;padding:25px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                            <h3 style="margin:0;">扫码登录</h3>
                            <button id="modalCloseBtn" style="background:none;border:none;font-size:20px;cursor:pointer;color:#666;">&times;</button>
                        </div>
                        
                        <div style="color:#666;margin-bottom:20px;font-size:14px;line-height:1.5;">
                            使用网易云音乐APP扫描二维码登录
                        </div>
                        
                        <div id="qrcodeContainer" style="display:none;">
                            <div id="qrcodeImage" style="width:200px;height:200px;margin:0 auto 15px;background:#fff;border-radius:8px;padding:10px;"></div>
                            <div id="qrcodeStatus" style="padding:10px;border-radius:6px;background:#f8f9fa;margin-bottom:10px;">
                                等待生成二维码...
                            </div>
                            <div id="qrTimestamp" style="font-size:12px;color:#999;"></div>
                        </div>
                        
                        <div style="margin-top:20px;">
                            <button class="btn-primary" id="qrStartBtn" style="padding:10px 20px;font-size:14px;">
                                <i class="fas fa-qrcode"></i> 生成二维码
                            </button>
                            <button class="btn-secondary" id="qrStopBtn" style="padding:10px 20px;font-size:14px;margin-left:10px;">
                                <i class="fas fa-stop"></i> 取消
                            </button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);

                // 重新绑定事件
                const startBtn = modal.querySelector('#qrStartBtn');
                const stopBtn = modal.querySelector('#qrStopBtn');
                const closeBtn = modal.querySelector('#modalCloseBtn');
                
                if (startBtn) {
                    startBtn.onclick = (e) => {
                        e.stopPropagation();
                        this.startQRLogin();
                    };
                }
                
                if (stopBtn) {
                    stopBtn.onclick = (e) => {
                        e.stopPropagation();
                        this.closeLoginModal();
                    };
                }
                
                if (closeBtn) {
                    closeBtn.onclick = (e) => {
                        e.stopPropagation();
                        this.closeLoginModal();
                    };
                }
                
                modal.onclick = (e) => {
                    if (e.target === modal) {
                        this.closeLoginModal();
                    }
                };
            }

            modal.classList.add('active');
            
        } catch (error) {
            console.error('显示登录模态框失败:', error);
            alert('登录功能暂时不可用，请刷新页面重试');
        }
    }

    closeLoginModal() {
        const modal = document.getElementById('loginModal');
        if (modal) {
            modal.classList.remove('active');
        }
        this.stopQRLogin();
    }

    /* ---------- API 调用 ---------- */

    api(endpoint, params = {}) {
        const base = localStorage.getItem('netease_api_base') || 
                    'https://neteaseapi-enhanced.vercel.app';
        
        const allParams = {
            ...params,
            timestamp: Date.now(),
            randomCNIP: true
        };
        
        const queryString = Object.keys(allParams)
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`)
            .join('&');
        
        return `${base}${endpoint}?${queryString}`;
    }

    /* ---------- 二维码登录 ---------- */

    async startQRLogin() {
        const box = document.getElementById('qrcodeContainer');
        const img = document.getElementById('qrcodeImage');
        const status = document.getElementById('qrcodeStatus');
        const timestamp = document.getElementById('qrTimestamp');
        const startBtn = document.getElementById('qrStartBtn');

        // 清理之前的定时器
        this.stopQRLogin();

        // 更新UI
        box.style.display = 'block';
        status.textContent = '获取二维码中...';
        status.style.background = '#e9ecef';
        status.style.color = '#495057';
        startBtn.disabled = true;
        startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 生成中...';

        try {
            // 1. 获取二维码key
            console.log('正在获取二维码key...');
            const keyUrl = this.api('/login/qr/key');
            console.log('Key API URL:', keyUrl);
            
            const keyRes = await fetch(keyUrl);
            if (!keyRes.ok) throw new Error(`HTTP ${keyRes.status}: 获取二维码key失败`);
            
            const keyData = await keyRes.json();
            console.log('Key API响应:', keyData);
            
            if (keyData.code !== 200) {
                throw new Error(keyData.message || '获取二维码key失败');
            }

            this.qrKey = keyData.data.unikey;
            console.log('获取到二维码key:', this.qrKey);

            // 2. 生成二维码图片
            console.log('正在生成二维码图片...');
            const qrUrl = this.api('/login/qr/create', {
                key: this.qrKey,
                qrimg: true
            });
            console.log('QR API URL:', qrUrl);
            
            const qrRes = await fetch(qrUrl);
            if (!qrRes.ok) throw new Error(`HTTP ${qrRes.status}: 生成二维码失败`);
            
            const qrData = await qrRes.json();
            console.log('QR API响应:', qrData);
            
            if (qrData.code !== 200) {
                throw new Error(qrData.message || '生成二维码失败');
            }

            // 显示二维码
            img.innerHTML = `<img src="${qrData.data.qrimg}" alt="登录二维码" style="width:100%;height:100%;">`;
            status.textContent = '请使用网易云音乐APP扫码';
            status.style.background = '#d1ecf1';
            status.style.color = '#0c5460';
            
            timestamp.textContent = `生成时间: ${new Date().toLocaleTimeString()}`;
            startBtn.innerHTML = '<i class="fas fa-redo"></i> 重新生成';
            startBtn.disabled = false;

            // 3. 开始轮询扫码状态
            this.pollQRStatus();

        } catch (error) {
            console.error('二维码登录失败:', error);
            status.textContent = `错误: ${error.message}`;
            status.style.background = '#f8d7da';
            status.style.color = '#721c24';
            startBtn.innerHTML = '<i class="fas fa-redo"></i> 重试';
            startBtn.disabled = false;
        }
    }

    async pollQRStatus() {
        if (!this.qrKey) return;
        
        // 清理旧的定时器
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
        }

        const status = document.getElementById('qrcodeStatus');
        
        this.checkTimer = setInterval(async () => {
            try {
                console.log('检查扫码状态...');
                const checkUrl = this.api('/login/qr/check', { key: this.qrKey });
                
                const checkRes = await fetch(checkUrl);
                if (!checkRes.ok) throw new Error(`HTTP ${checkRes.status}`);
                
                const checkData = await checkRes.json();
                console.log('扫码状态:', checkData);

                // 处理不同状态码
                switch (checkData.code) {
                    case 800:
                        // 二维码过期
                        status.textContent = '二维码已过期，请刷新重试';
                        status.style.background = '#fff3cd';
                        status.style.color = '#856404';
                        this.stopQRLogin();
                        break;
                        
                    case 801:
                        // 等待扫码
                        status.textContent = '等待扫码...';
                        status.style.background = '#d1ecf1';
                        status.style.color = '#0c5460';
                        break;
                        
                    case 802:
                        // 已扫码，等待确认
                        status.textContent = '已扫码，请在APP中确认登录';
                        status.style.background = '#fff3cd';
                        status.style.color = '#856404';
                        break;
                        
                    case 803:
                        // 登录成功
                        status.textContent = '登录成功！';
                        status.style.background = '#d4edda';
                        status.style.color = '#155724';
                        
                        this.cookie = checkData.cookie || checkData.cookies;
                        this.isLoggedIn = true;
                        
                        // 停止轮询
                        this.stopQRLogin();
                        
                        // 获取用户信息
                        await this.fetchUserInfo();
                        
                        // 保存登录状态
                        this.saveLoginStatus();
                        
                        // 更新显示
                        this.updateUserDisplay();
                        
                        // 关闭弹窗
                        setTimeout(() => {
                            this.closeLoginModal();
                            alert(`欢迎回来，${this.userInfo?.profile?.nickname || '用户'}！`);
                        }, 1000);
                        break;
                        
                    default:
                        console.warn('未知状态码:', checkData);
                }
                
            } catch (error) {
                console.error('检查扫码状态失败:', error);
                status.textContent = '状态检查失败，请重试';
                status.style.background = '#f8d7da';
                status.style.color = '#721c24';
            }
        }, 2000); // 每2秒检查一次
    }

    stopQRLogin() {
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
            console.log('已停止二维码轮询');
        }
    }

    /* ---------- 用户信息 ---------- */

    async fetchUserInfo() {
        if (!this.cookie) return;

        try {
            // 获取账户信息
            const accountUrl = this.api('/user/account', { cookie: this.cookie });
            const accountRes = await fetch(accountUrl);
            const accountData = await accountRes.json();
            
            console.log('账户信息:', accountData);

            if (accountData.account && accountData.profile) {
                this.userInfo = {
                    account: accountData.account,
                    profile: accountData.profile
                };
                
                // 如果有必要，获取更详细的用户信息
                if (accountData.profile.userId) {
                    const detailUrl = this.api('/user/detail', { 
                        uid: accountData.profile.userId,
                        cookie: this.cookie 
                    });
                    const detailRes = await fetch(detailUrl);
                    const detailData = await detailRes.json();
                    
                    if (detailData.code === 200) {
                        this.userInfo.detail = detailData;
                    }
                }
            }
        } catch (error) {
            console.error('获取用户信息失败:', error);
        }
    }

    /* ---------- 用户菜单 ---------- */

    showUserMenu() {
        if (!this.isLoggedIn || !this.userInfo?.profile) return;

        // 移除现有的用户菜单
        const existingMenu = document.getElementById('userMenu');
        if (existingMenu) {
            existingMenu.remove();
        }

        const user = this.userInfo.profile;
        const menu = document.createElement('div');
        menu.id = 'userMenu';
        menu.className = 'user-menu';
        
        menu.innerHTML = `
            <div class="user-menu-header" style="padding:20px;border-bottom:1px solid #dee2e6;display:flex;align-items:center;gap:15px;">
                ${user.avatarUrl 
                    ? `<img src="${user.avatarUrl}?param=50y50" class="user-avatar" style="width:50px;height:50px;border-radius:50%;" alt="头像">`
                    : `<div class="default-avatar" style="width:50px;height:50px;border-radius:50%;background:#ddd;display:flex;align-items:center;justify-content:center;"><i class="fas fa-user" style="font-size:24px;color:#666;"></i></div>`
                }
                <div class="user-info">
                    <div class="user-name" style="font-weight:bold;font-size:16px;">${user.nickname || '未命名用户'}</div>
                    <div class="user-uid" style="font-size:12px;color:#666;">
                        <i class="fas fa-id-card"></i>
                        ID: ${user.userId || '未知'}
                    </div>
                </div>
            </div>
            
            <div class="stats-grid" style="padding:15px;">
                <div class="stat-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">
                    <div class="stat-item" style="text-align:center;">
                        <div class="stat-value" style="font-size:18px;font-weight:bold;">${user.eventCount || 0}</div>
                        <div class="stat-label" style="font-size:12px;color:#666;">动态</div>
                    </div>
                    <div class="stat-item" style="text-align:center;">
                        <div class="stat-value" style="font-size:18px;font-weight:bold;">${user.follows || 0}</div>
                        <div class="stat-label" style="font-size:12px;color:#666;">关注</div>
                    </div>
                    <div class="stat-item" style="text-align:center;">
                        <div class="stat-value" style="font-size:18px;font-weight:bold;">${user.followeds || 0}</div>
                        <div class="stat-label" style="font-size:12px;color:#666;">粉丝</div>
                    </div>
                    <div class="stat-item" style="text-align:center;">
                        <div class="stat-value" style="font-size:18px;font-weight:bold;">${user.playlistCount || 0}</div>
                        <div class="stat-label" style="font-size:12px;color:#666;">歌单</div>
                    </div>
                </div>
            </div>
            
            <button onclick="window.loginManager.logout()" class="logout-btn" style="width:100%;padding:12px;background:none;border:none;border-top:1px solid #dee2e6;color:#dc3545;cursor:pointer;font-size:14px;">
                <i class="fas fa-sign-out-alt"></i> 退出登录
            </button>
        `;

        // 定位菜单
        const loginBtn = document.querySelector('.login-btn');
        if (loginBtn) {
            const rect = loginBtn.getBoundingClientRect();
            menu.style.position = 'fixed';
            menu.style.top = (rect.bottom + 5) + 'px';
            menu.style.right = (window.innerWidth - rect.right) + 'px';
            menu.style.zIndex = '1000';
            menu.style.background = '#fff';
            menu.style.borderRadius = '10px';
            menu.style.boxShadow = '0 5px 20px rgba(0,0,0,0.2)';
            menu.style.minWidth = '200px';
            menu.style.overflow = 'hidden';
        }

        document.body.appendChild(menu);

        // 点击其他地方关闭菜单
        setTimeout(() => {
            const closeHandler = (e) => {
                if (menu && !menu.contains(e.target) && 
                    !document.querySelector('.login-btn')?.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 100);
    }

    logout() {
        this.clearLoginStatus();
        
        // 移除用户菜单
        const menu = document.getElementById('userMenu');
        if (menu) menu.remove();
        
        alert('已退出登录');
    }

    /* ---------- 工具方法 ---------- */

    checkLogin() {
        return this.isLoggedIn && this.cookie;
    }

    getUserInfo() {
        return this.userInfo;
    }

    getCookie() {
        return this.cookie;
    }

    async fetchWithLogin(endpoint, params = {}) {
        if (!this.checkLogin()) {
            throw new Error('请先登录');
        }
        
        const url = this.api(endpoint, { ...params, cookie: this.cookie });
        const response = await fetch(url);
        return await response.json();
    }
}

/* ===========================
   全局初始化
   =========================== */

let loginManager = null;

function initLoginManager() {
    if (!loginManager) {
        loginManager = new LoginManager();
        window.loginManager = loginManager;
        console.log('登录管理器已初始化');
        
        // 确保全局函数可用
        window.login = () => loginManager.showLoginModal();
        window.logout = () => loginManager.logout();
    }
    return loginManager;
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded - 初始化登录管理器');
    initLoginManager();
});

// 如果DOM已经加载完成，立即初始化
if (document.readyState === 'interactive' || document.readyState === 'complete') {
    console.log('文档已加载 - 初始化登录管理器');
    initLoginManager();
}

// 添加重试机制
setTimeout(() => {
    if (!loginManager) {
        console.log('延迟初始化登录管理器');
        initLoginManager();
    }
}, 1000);

// 添加一个全局点击事件监听器，用于调试
document.addEventListener('click', function(e) {
    if (e.target.closest('.login-btn')) {
        console.log('登录按钮被点击');
        console.log('loginManager:', loginManager);
        console.log('window.login:', window.login);
    }
});