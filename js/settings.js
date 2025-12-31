// 设置管理模块
class SettingsManager {
    constructor() {
        this.defaultSettings = {
            // 外观设置
            dynamicBackground: true,
            visualization: false,
            animations: true,
            themeEffect: 'blur',

            // 播放设置
            autoplay: true,
            hqAudio: false,
            lyricsSync: true,
            fadeEffect: true,
            volumeMemory: true,
            loopPlaylist: false,

            // 音频质量
            audioQuality: 'exhigh',

            // 缓存设置
            cacheEnabled: true,
            cacheSize: 100,

            // 快捷键设置
            enableShortcuts: true
        };

        this.settings = {...this.defaultSettings };
        this.pendingAction = null;
        this.init();
    }

    // 初始化设置管理器
    init() {
        this.loadSettings();
        this.bindEvents();
        this.renderSettings();
    }

    // 加载保存的设置
    loadSettings() {
        try {
            const savedSettings = localStorage.getItem('netease_settings');
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                this.settings = {...this.defaultSettings, ...parsed };
            }
        } catch (error) {
            console.error('加载设置失败:', error);
            this.settings = {...this.defaultSettings };
        }

        this.applySettings();
    }

    // 保存设置
    saveSettings() {
        try {
            localStorage.setItem('netease_settings', JSON.stringify(this.settings));
            this.showSaveIndicator('设置已保存');
            this.applySettings();
        } catch (error) {
            console.error('保存设置失败:', error);
            this.showSaveIndicator('保存失败', 'error');
        }
    }

    // 应用设置
    applySettings() {
        // 动态背景
        const dynamicBg = document.getElementById('dynamicBackground');
        if (dynamicBg) {
            if (this.settings.dynamicBackground && this.settings.themeEffect !== 'none') {
                dynamicBg.classList.add('active');
            } else {
                dynamicBg.classList.remove('active');
            }
        }

        // 可视化效果
        const visualization = document.getElementById('visualizationContainer');
        if (visualization) {
            visualization.classList.toggle('active', this.settings.visualization);
        }

        // 动画效果
        if (!this.settings.animations) {
            document.documentElement.style.setProperty('--transition-speed', '0s');
        } else {
            document.documentElement.style.setProperty('--transition-speed', '0.3s');
        }

        // 更新播放器设置
        if (window.player) {
            window.player.hqAudio = this.settings.hqAudio;
        }

        // 音频元素设置
        const audio = document.getElementById('audioElement');
        if (audio) {
            audio.autoplay = this.settings.autoplay;
        }

        // 应用主题效果到动态背景
        this.applyThemeEffect();
    }

    // 应用主题效果
    applyThemeEffect() {
        const dynamicBg = document.getElementById('dynamicBackground');
        if (!dynamicBg) return;

        switch (this.settings.themeEffect) {
            case 'blur':
                dynamicBg.style.filter = 'blur(20px) brightness(0.7)';
                break;
            case 'particles':
                dynamicBg.style.filter = 'blur(10px) brightness(0.8) saturate(1.5)';
                break;
            case 'waves':
                dynamicBg.style.filter = 'blur(15px) brightness(0.6) hue-rotate(90deg)';
                break;
            case 'none':
                dynamicBg.style.filter = 'none';
                break;
            default:
                dynamicBg.style.filter = 'blur(20px) brightness(0.7)';
        }
    }

    // 更新歌曲背景
    updateSongBackground(coverUrl) {
        if (!this.settings.dynamicBackground || this.settings.themeEffect === 'none') {
            const dynamicBg = document.getElementById('dynamicBackground');
            if (dynamicBg) {
                dynamicBg.style.backgroundImage = 'none';
            }
            return;
        }

        const dynamicBg = document.getElementById('dynamicBackground');
        if (!dynamicBg || !coverUrl) return;

        // 添加时间戳避免缓存
        const timestamp = new Date().getTime();
        const bgUrl = `${coverUrl}?param=1920y1080&t=${timestamp}`;

        dynamicBg.style.backgroundImage = `url('${bgUrl}')`;
        this.applyThemeEffect();
    }

    // 渲染设置界面
    renderSettings() {
        // 更新所有开关状态
        const settingsMap = {
            'dynamicBgToggle': 'dynamicBackground',
            'visualizationToggle': 'visualization',
            'animationsToggle': 'animations',
            'autoplayToggle': 'autoplay',
            'hqAudioToggle': 'hqAudio',
            'lyricsSyncToggle': 'lyricsSync',
            'fadeToggle': 'fadeEffect',
            'volumeMemoryToggle': 'volumeMemory',
            'loopPlaylistToggle': 'loopPlaylist'
        };

        for (const [toggleId, settingKey] of Object.entries(settingsMap)) {
            const toggle = document.getElementById(toggleId);
            if (toggle) {
                toggle.checked = this.settings[settingKey];
            }
        }

        // 更新主题效果选择
        document.querySelectorAll('.effect-option').forEach(option => {
            option.classList.remove('active');
            const onclickAttr = option.getAttribute('onclick');
            if (onclickAttr) {
                const match = onclickAttr.match(/'([^']+)'/);
                if (match && match[1]) {
                    const effect = match[1];
                    if (effect === this.settings.themeEffect) {
                        option.classList.add('active');
                    }
                }
            }
        });
    }

    // 绑定事件
    bindEvents() {
        // 绑定所有切换开关
        document.addEventListener('change', (e) => {
            if (e.target.matches('input[type="checkbox"]')) {
                const settingMap = {
                    'dynamicBgToggle': 'dynamicBackground',
                    'visualizationToggle': 'visualization',
                    'animationsToggle': 'animations',
                    'autoplayToggle': 'autoplay',
                    'hqAudioToggle': 'hqAudio',
                    'lyricsSyncToggle': 'lyricsSync',
                    'fadeToggle': 'fadeEffect',
                    'volumeMemoryToggle': 'volumeMemory',
                    'loopPlaylistToggle': 'loopPlaylist'
                };

                const settingKey = settingMap[e.target.id];
                if (settingKey) {
                    this.settings[settingKey] = e.target.checked;

                    // 特殊处理：如果选择了无效果，自动关闭动态背景
                    if (settingKey === 'themeEffect' && e.target.value === 'none') {
                        this.settings.dynamicBackground = false;
                        document.getElementById('dynamicBgToggle').checked = false;
                    }

                    // 自动保存重要设置
                    if (['dynamicBackground', 'animations', 'autoplay', 'lyricsSync'].includes(settingKey)) {
                        this.saveSettings();
                    }
                }
            }
        });
    }

    // 显示保存提示
    showSaveIndicator(message, type = 'success') {
        const indicator = document.getElementById('saveIndicator');
        const messageSpan = document.getElementById('saveMessage');
        if (!indicator || !messageSpan) return;

        // 更新消息和样式
        messageSpan.textContent = message;
        indicator.className = 'save-indicator';
        indicator.classList.add(type);
        indicator.classList.add('show');

        // 隐藏提示
        setTimeout(() => {
            indicator.classList.remove('show');
        }, 2000);
    }

    // 显示确认对话框
    showConfirmDialog(message, callback) {
        this.pendingAction = callback;
        const dialog = document.getElementById('confirmDialog');
        const messageElement = document.getElementById('confirmMessage');

        if (dialog && messageElement) {
            messageElement.textContent = message;
            dialog.classList.add('active');
        }
    }

    // 确认操作
    confirmAction(confirmed) {
        const dialog = document.getElementById('confirmDialog');
        if (dialog) {
            dialog.classList.remove('active');
        }

        if (confirmed && this.pendingAction) {
            this.pendingAction();
        }

        this.pendingAction = null;
    }

    // 重置设置
    resetSettings() {
        this.showConfirmDialog('确定要恢复所有设置为默认值吗？此操作不可撤销。', () => {
            this.settings = {...this.defaultSettings };
            this.renderSettings();
            this.saveSettings();
            this.showSaveIndicator('设置已恢复为默认值');
        });
    }

    // 清除搜索历史
    clearSearchHistory() {
        this.showConfirmDialog('确定要清除所有搜索历史吗？', () => {
            localStorage.removeItem('netease_search_history');
            if (window.enhancedSearch) {
                window.enhancedSearch.searchHistory = [];
                window.enhancedSearch.updateHistoryDisplay();
            }
            this.showSaveIndicator('搜索历史已清除');
        });
    }

    // 清空播放列表
    clearPlaylist() {
        this.showConfirmDialog('确定要清空播放列表吗？', () => {
            if (window.player) {
                window.player.playlist = [];
                window.player.currentSongIndex = -1;
                window.player.currentSongId = null;
            }
            this.showSaveIndicator('播放列表已清空');
        });
    }

    // 清除所有数据
    clearAllData() {
        this.showConfirmDialog('确定要清除所有本地数据吗？包括设置、历史记录、播放列表等。此操作不可撤销！', () => {
            // 清除所有相关数据
            const keys = [
                'netease_settings',
                'netease_search_history',
                'netease_volume',
                'netease_api_base',
                'netease_theme'
            ];

            keys.forEach(key => localStorage.removeItem(key));

            // 重置设置
            this.settings = {...this.defaultSettings };
            this.renderSettings();
            this.applySettings();

            // 重置播放器
            if (window.player) {
                window.player = {
                    isPlaying: false,
                    isMuted: false,
                    volume: 80,
                    currentSongIndex: -1,
                    playlist: [],
                    currentSongId: null,
                    lyrics: [],
                    currentLyricIndex: -1
                };

                // 重置播放器UI
                const audio = document.getElementById('audioElement');
                if (audio) {
                    audio.src = '';
                    audio.pause();
                }

                document.getElementById('currentSongName').textContent = '未选择歌曲';
                document.getElementById('currentArtist').textContent = '--';
                document.getElementById('currentSongCover').src = 'https://via.placeholder.com/50';
            }

            this.showSaveIndicator('所有数据已清除');
        });
    }

    // 获取设置值
    get(settingKey) {
        return this.settings[settingKey];
    }

    // 设置值
    set(settingKey, value) {
        this.settings[settingKey] = value;
        this.renderSettings();
        this.applySettings();
    }
}

// 创建全局设置管理器实例
let settingsManager;

// 初始化设置管理器
function initSettingsManager() {
    if (!window.settingsManager) {
        window.settingsManager = new SettingsManager();
    }
    return window.settingsManager;
}

// 暴露全局函数
window.toggleDynamicBackground = function() {
    const toggle = document.getElementById('dynamicBgToggle');
    if (toggle && window.settingsManager) {
        window.settingsManager.set('dynamicBackground', toggle.checked);
        window.settingsManager.saveSettings();
    }
};

window.toggleVisualization = function() {
    const toggle = document.getElementById('visualizationToggle');
    if (toggle && window.settingsManager) {
        window.settingsManager.set('visualization', toggle.checked);
        window.settingsManager.saveSettings();
    }
};

window.toggleAnimations = function() {
    const toggle = document.getElementById('animationsToggle');
    if (toggle && window.settingsManager) {
        window.settingsManager.set('animations', toggle.checked);
        window.settingsManager.saveSettings();
    }
};

window.toggleAutoplay = function() {
    const toggle = document.getElementById('autoplayToggle');
    if (toggle && window.settingsManager) {
        window.settingsManager.set('autoplay', toggle.checked);
        window.settingsManager.saveSettings();
    }
};

window.toggleHQAudio = function() {
    const toggle = document.getElementById('hqAudioToggle');
    if (toggle && window.settingsManager) {
        window.settingsManager.set('hqAudio', toggle.checked);
        window.settingsManager.saveSettings();
    }
};

window.toggleLyricsSync = function() {
    const toggle = document.getElementById('lyricsSyncToggle');
    if (toggle && window.settingsManager) {
        window.settingsManager.set('lyricsSync', toggle.checked);
        window.settingsManager.saveSettings();
    }
};

window.toggleFadeEffect = function() {
    const toggle = document.getElementById('fadeToggle');
    if (toggle && window.settingsManager) {
        window.settingsManager.set('fadeEffect', toggle.checked);
        window.settingsManager.saveSettings();
    }
};

window.toggleVolumeMemory = function() {
    const toggle = document.getElementById('volumeMemoryToggle');
    if (toggle && window.settingsManager) {
        window.settingsManager.set('volumeMemory', toggle.checked);
        window.settingsManager.saveSettings();
    }
};

window.toggleLoopPlaylist = function() {
    const toggle = document.getElementById('loopPlaylistToggle');
    if (toggle && window.settingsManager) {
        window.settingsManager.set('loopPlaylist', toggle.checked);
        window.settingsManager.saveSettings();
    }
};

window.selectEffect = function(effect) {
    if (window.settingsManager) {
        window.settingsManager.set('themeEffect', effect);

        // 如果选择了无效果，自动关闭动态背景
        if (effect === 'none') {
            window.settingsManager.set('dynamicBackground', false);
            const toggle = document.getElementById('dynamicBgToggle');
            if (toggle) {
                toggle.checked = false;
            }
        }

        window.settingsManager.saveSettings();
    }
};

window.saveSettings = function() {
    if (window.settingsManager) {
        window.settingsManager.saveSettings();
    }
};

window.resetSettings = function() {
    if (window.settingsManager) {
        window.settingsManager.resetSettings();
    }
};

window.clearSearchHistory = function() {
    if (window.settingsManager) {
        window.settingsManager.clearSearchHistory();
    }
};

window.clearPlaylist = function() {
    if (window.settingsManager) {
        window.settingsManager.clearPlaylist();
    }
};

window.clearAllData = function() {
    if (window.settingsManager) {
        window.settingsManager.clearAllData();
    }
};

window.confirmAction = function(confirmed) {
    if (window.settingsManager) {
        window.settingsManager.confirmAction(confirmed);
    }
};

// 更新歌曲背景的全局函数
window.updateSongBackground = function(coverUrl) {
    if (window.settingsManager) {
        window.settingsManager.updateSongBackground(coverUrl);
    }
};

// 在页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSettingsManager);
} else {
    initSettingsManager();
}