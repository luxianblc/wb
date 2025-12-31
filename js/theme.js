// 主题管理
class ThemeManager {
    constructor() {
        this.currentThemeMode = 'default'; // default, cover-blur, minimal
        this.settings = {
            blurIntensity: 30,
            backgroundOpacity: 40,
            autoThemeSwitch: true
        };

        this.currentCoverUrl = null;
        this.backgroundOverlay = document.getElementById('backgroundOverlay');

        this.loadThemeSettings();
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateUI();
        this.applyThemeMode();
    }

    loadThemeSettings() {
        const savedSettings = localStorage.getItem('netease_theme_settings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            this.settings = {...this.settings, ...settings };
        }

        const savedThemeMode = localStorage.getItem('netease_theme_mode');
        if (savedThemeMode) {
            this.currentThemeMode = savedThemeMode;
        }
    }

    saveThemeSettings() {
        localStorage.setItem('netease_theme_settings', JSON.stringify(this.settings));
        localStorage.setItem('netease_theme_mode', this.currentThemeMode);
    }

    setupEventListeners() {
        // 监听歌曲变化
        const audio = document.getElementById('audioElement');
        if (audio) {
            audio.addEventListener('play', () => {
                if (this.currentThemeMode === 'cover-blur' && this.settings.autoThemeSwitch) {
                    setTimeout(() => {
                        this.updateBackgroundFromCurrentSong();
                    }, 500); // 延迟一点确保封面已加载
                }
            });
        }
    }

    switchThemeMode(mode) {
        this.currentThemeMode = mode;

        // 更新HTML类
        document.body.className = '';
        if (mode === 'cover-blur') {
            document.body.classList.add('theme-cover-blur');
        } else if (mode === 'minimal') {
            document.body.classList.add('theme-minimal');
        }

        // 更新UI
        this.updateThemeOptions();
        this.updateCurrentSettings();

        // 应用主题
        this.applyThemeMode();

        // 保存设置
        this.saveThemeSettings();
    }

    applyThemeMode() {
        if (this.currentThemeMode === 'cover-blur' && this.settings.autoThemeSwitch) {
            this.updateBackgroundFromCurrentSong();
        } else {
            this.clearBackground();
        }

        // 更新CSS变量
        this.updateBackgroundOverlay();
    }

    updateBackgroundFromCurrentSong() {
        if (this.currentThemeMode !== 'cover-blur' || !this.settings.autoThemeSwitch) {
            return;
        }

        const coverImg = document.getElementById('currentSongCover');
        if (!coverImg || !coverImg.src || coverImg.src.includes('placeholder')) {
            this.clearBackground();
            return;
        }

        // 获取封面URL并移除尺寸参数
        let coverUrl = coverImg.src;
        coverUrl = coverUrl.replace(/\?param=\d+y\d+$/, '');

        if (coverUrl !== this.currentCoverUrl) {
            this.currentCoverUrl = coverUrl;
            this.updateBackgroundOverlay();
        }
    }

    updateBackgroundOverlay() {
        if (!this.backgroundOverlay) return;

        if (this.currentThemeMode === 'cover-blur' && this.currentCoverUrl) {
            // 应用模糊效果
            this.backgroundOverlay.style.backgroundImage = `url(${this.currentCoverUrl})`;
            this.backgroundOverlay.style.filter = `blur(${this.settings.blurIntensity}px) brightness(0.7)`;
            this.backgroundOverlay.style.opacity = (this.settings.backgroundOpacity / 100).toString();
            this.backgroundOverlay.classList.add('active', 'blur');
        } else {
            this.clearBackground();
        }
    }

    clearBackground() {
        if (this.backgroundOverlay) {
            this.backgroundOverlay.style.backgroundImage = '';
            this.backgroundOverlay.classList.remove('active', 'blur');
            this.currentCoverUrl = null;
        }
    }

    updateBlurIntensity(value) {
        this.settings.blurIntensity = parseInt(value);
        document.getElementById('blurValue').textContent = value;
        document.getElementById('currentBlurValue').textContent = value + 'px';
        this.updateBackgroundOverlay();
        this.saveThemeSettings();
    }

    updateBackgroundOpacity(value) {
        this.settings.backgroundOpacity = parseInt(value);
        document.getElementById('opacityValue').textContent = value;
        document.getElementById('currentOpacityValue').textContent = value + '%';
        this.updateBackgroundOverlay();
        this.saveThemeSettings();
    }

    toggleAutoThemeSwitch(enabled) {
        this.settings.autoThemeSwitch = enabled;
        document.getElementById('currentAutoSwitch').textContent = enabled ? '开启' : '关闭';

        if (enabled && this.currentThemeMode === 'cover-blur') {
            this.updateBackgroundFromCurrentSong();
        } else if (!enabled) {
            this.clearBackground();
        }

        this.saveThemeSettings();
    }

    updateThemeOptions() {
        // 更新主题选项的选中状态
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('active');
        });

        // 根据当前模式激活对应选项
        const options = document.querySelectorAll('.theme-option');
        const optionIndex = {
            'default': 0,
            'cover-blur': 1,
            'minimal': 2
        };

        const index = optionIndex[this.currentThemeMode];
        if (options[index]) {
            options[index].classList.add('active');
        }
    }

    updateCurrentSettings() {
        // 更新当前设置显示
        const modeNames = {
            'default': '默认主题',
            'cover-blur': '专辑封面背景',
            'minimal': '极简模式'
        };

        document.getElementById('currentThemeMode').textContent = modeNames[this.currentThemeMode] || this.currentThemeMode;
        document.getElementById('currentBlurValue').textContent = this.settings.blurIntensity + 'px';
        document.getElementById('currentOpacityValue').textContent = this.settings.backgroundOpacity + '%';
        document.getElementById('currentAutoSwitch').textContent = this.settings.autoThemeSwitch ? '开启' : '关闭';
    }

    updateUI() {
        // 更新滑块值
        const blurSlider = document.getElementById('blurIntensity');
        const opacitySlider = document.getElementById('backgroundOpacity');
        const autoSwitch = document.getElementById('autoThemeSwitch');

        if (blurSlider) blurSlider.value = this.settings.blurIntensity;
        if (document.getElementById('blurValue')) {
            document.getElementById('blurValue').textContent = this.settings.blurIntensity;
        }
        if (opacitySlider) opacitySlider.value = this.settings.backgroundOpacity;
        if (document.getElementById('opacityValue')) {
            document.getElementById('opacityValue').textContent = this.settings.backgroundOpacity;
        }
        if (autoSwitch) autoSwitch.checked = this.settings.autoThemeSwitch;

        // 更新选项和当前设置
        this.updateThemeOptions();
        this.updateCurrentSettings();
    }
}

// 创建主题管理器实例
let themeManager;

// 初始化主题管理器
function initThemeManager() {
    themeManager = new ThemeManager();
}

// 暴露全局函数
window.switchThemeMode = (mode) => themeManager.switchThemeMode(mode);
window.updateBlurIntensity = (value) => themeManager.updateBlurIntensity(value);
window.updateBackgroundOpacity = (value) => themeManager.updateBackgroundOpacity(value);
window.toggleAutoThemeSwitch = (enabled) => themeManager.toggleAutoThemeSwitch(enabled);

// 在页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThemeManager);
} else {
    initThemeManager();
}