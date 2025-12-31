// 搜索增强功能（简化版）
// 修改搜索中的播放按钮，针对VIP歌曲使用专门函数
window.playSongEnhanced = async function(songId, songName) {
    // 先检查歌曲类型
    try {
        const detailUrl = buildApiUrl('/song/detail', { ids: songId });
        const detailResponse = await fetch(detailUrl);
        const detailData = await detailResponse.json();
        
        if (detailData.code === 200 && detailData.songs && detailData.songs[0]) {
            const song = detailData.songs[0];
            
            if (song.fee === 1) {
                // VIP歌曲，使用专门函数
                console.log(`检测到VIP歌曲: ${songName}`);
                const success = await playVIPSong(songId, songName);
                
                if (!success) {
                    // 如果专门函数失败，回退到普通播放
                    await playSong(songId, songName);
                }
            } else {
                // 非VIP歌曲，使用普通播放
                await playSong(songId, songName);
            }
        } else {
            // 无法获取详情，使用普通播放
            await playSong(songId, songName);
        }
    } catch (error) {
        console.error('增强播放失败:', error);
        // 出错时回退到普通播放
        await playSong(songId, songName);
    }
};
class EnhancedSearch {
    constructor() {
        this.currentPage = 1;
        this.itemsPerPage = 30;
        this.totalResults = 0;
        this.totalPages = 1;
        this.currentView = 'grid'; // 'list' or 'grid'
        this.searchParams = {
            keywords: '',
            type: 1,
            order: 'hot',
            limit: 30,
            offset: 0,
            filters: {
                official: true,
                highQuality: false,
                excludeNoCopyright: false,
                timeRange: 'all'
            }
        };

        this.searchHistory = JSON.parse(localStorage.getItem('netease_search_history') || '[]');
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadSearchHistory();
        this.setupSearchSyntax();
    }

    bindEvents() {
        // 搜索输入事件
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleInput(e.target.value));
            searchInput.addEventListener('focus', () => this.showSuggestions());
        }

        // 点击其他地方关闭建议
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-box')) {
                this.hideSuggestions();
            }
        });

        // 监听高级搜索选项变化
        const checkboxes = ['chkOfficial', 'chkHQ', 'chkNoCopyright'];
        checkboxes.forEach(id => {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                checkbox.addEventListener('change', () => this.updateFilters());
            }
        });

        // 监听搜索类型变化
        const searchType = document.getElementById('searchType');
        if (searchType) {
            searchType.addEventListener('change', () => this.updateSearchType());
        }
    }

    // 处理搜索输入
    handleInput(value) {
        if (value.length === 0) {
            this.hideSuggestions();
            return;
        }

        if (value.length > 1) {
            this.showSearchSuggestions(value);
        }
    }

    // 显示搜索建议
    async showSearchSuggestions(query) {
        const suggestionsDiv = document.getElementById('searchSuggestions');
        if (!suggestionsDiv) return;

        suggestionsDiv.innerHTML = '';

        // 历史记录建议
        const historySuggestions = this.searchHistory
            .filter(item => item.keywords.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 5);

        // 热门搜索建议
        const hotSuggestions = [
            { type: 'hot', text: '周杰伦 最新歌曲', keywords: '周杰伦' },
            { type: 'hot', text: '抖音热门歌曲', keywords: '抖音 热门' },
            { type: 'hot', text: '工作学习纯音乐', keywords: '纯音乐 轻音乐' },
            { type: 'hot', text: '经典老歌回忆', keywords: '经典 老歌' },
            { type: 'hot', text: '英文歌曲推荐', keywords: '英文 歌曲' }
        ];

        // 构建建议列表
        let suggestionsHTML = '';

        // 历史记录
        if (historySuggestions.length > 0) {
            historySuggestions.forEach(item => {
                suggestionsHTML += `
                    <div class="suggestion-item" onclick="enhancedSearch.selectSuggestion('${item.keywords.replace(/'/g, "\\'")}')">
                        <i class="fas fa-history"></i>
                        <span>${this.highlightText(item.keywords, query)}</span>
                    </div>
                `;
            });
        }

        // 热门搜索
        hotSuggestions.forEach(item => {
            if (item.keywords.toLowerCase().includes(query.toLowerCase())) {
                suggestionsHTML += `
                    <div class="suggestion-item" onclick="enhancedSearch.selectSuggestion('${item.keywords.replace(/'/g, "\\'")}')">
                        <i class="fas fa-fire"></i>
                        <span>${this.highlightText(item.text, query)}</span>
                    </div>
                `;
            }
        });

        // 如果没有建议，显示提示
        if (!suggestionsHTML) {
            suggestionsHTML = `
                <div class="suggestion-item">
                    <i class="fas fa-info-circle"></i>
                    <span>输入更多关键词获取建议</span>
                </div>
            `;
        }

        suggestionsDiv.innerHTML = suggestionsHTML;
        suggestionsDiv.classList.add('show');
    }

    // 高亮匹配文本
    highlightText(text, query) {
        if (!query) return text;

        const regex = new RegExp(`(${this.escapeRegExp(query)})`, 'gi');
        return text.replace(regex, '<span class="suggestion-highlight">$1</span>');
    }

    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // 选择建议
    selectSuggestion(keywords) {
        document.getElementById('searchInput').value = keywords;
        this.hideSuggestions();
        this.performSearch();
    }

    // 隐藏建议
    hideSuggestions() {
        const suggestionsDiv = document.getElementById('searchSuggestions');
        if (suggestionsDiv) {
            suggestionsDiv.classList.remove('show');
        }
    }

    // 显示建议
    showSuggestions() {
        const input = document.getElementById('searchInput');
        if (input.value.length > 0) {
            this.showSearchSuggestions(input.value);
        }
    }

    // 执行搜索
    async performSearch() {
        const keywords = document.getElementById('searchInput').value.trim();
        if (!keywords) {
            alert('请输入搜索关键词');
            return;
        }

        // 保存到历史记录
        this.saveToHistory(keywords);

        // 更新搜索参数
        this.searchParams.keywords = keywords;
        this.searchParams.type = parseInt(document.getElementById('searchType').value);
        this.searchParams.order = document.getElementById('searchOrder').value;
        this.searchParams.limit = this.itemsPerPage;
        this.searchParams.offset = (this.currentPage - 1) * this.itemsPerPage;

        // 显示搜索界面
        switchSection('search');

        const resultsContainer = document.getElementById('searchResults');
        resultsContainer.innerHTML = `
            <div class="loading-container">
                <div class="spinner"></div>
                <div class="loading-text">正在搜索"${keywords}"...</div>
            </div>
        `;

        try {
            const startTime = Date.now();
            const data = await this.fetchSearchData();
            const endTime = Date.now();

            this.displaySearchResults(data, endTime - startTime);

        } catch (error) {
            console.error('搜索失败:', error);
            resultsContainer.innerHTML = `
                <div class="error">
                    <i class="fas fa-exclamation-circle"></i>
                    <h3>搜索失败</h3>
                    <p>${error.message || '请检查网络连接'}</p>
                </div>
            `;
        }
    }

    // 获取搜索数据
    async fetchSearchData() {
        const params = {
            keywords: this.searchParams.keywords,
            type: this.searchParams.type,
            limit: this.searchParams.limit,
            offset: this.searchParams.offset
        };

        if (this.searchParams.order !== 'hot') {
            params.order = this.searchParams.order;
        }

        const url = buildApiUrl('/cloudsearch', params);
        const response = await fetch(url);
        return await response.json();
    }

    // 显示搜索结果
    displaySearchResults(data, responseTime) {
        if (data.code !== 200) {
            throw new Error(data.message || '搜索失败');
        }

        const resultsContainer = document.getElementById('searchResults');
        const result = data.result || {};

        // 更新统计信息
        this.totalResults = result.songCount || result.albumCount || result.artistCount || result.playlistCount || 0;
        this.totalPages = Math.ceil(this.totalResults / this.itemsPerPage);

        // 构建结果HTML
        let html = this.buildResultsHeader(responseTime);

        if (this.totalResults === 0) {
            html += this.buildEmptyState();
        } else {
            html += this.buildResultsContent(result);
            html += this.buildPagination();
        }

        resultsContainer.innerHTML = html;

        // 更新视图切换按钮
        this.setupViewToggle();
    }

    // 构建结果头部
    buildResultsHeader(responseTime) {
        return `
            <div class="search-results-header">
                <div class="search-stats">
                    <div class="stat-item">
                        <div class="stat-value">${this.totalResults.toLocaleString()}</div>
                        <div class="stat-label">总数</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${responseTime}ms</div>
                        <div class="stat-label">耗时</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${this.currentPage}</div>
                        <div class="stat-label">页码</div>
                    </div>
                </div>
                
                <div class="view-toggle">
                    <button class="view-btn ${this.currentView === 'list' ? 'active' : ''}" onclick="enhancedSearch.switchView('list')">
                        <i class="fas fa-list"></i> 列表
                    </button>
                    <button class="view-btn ${this.currentView === 'grid' ? 'active' : ''}" onclick="enhancedSearch.switchView('grid')">
                        <i class="fas fa-th-large"></i> 网格
                    </button>
                </div>
            </div>
            
            <div class="results-view" id="resultsView">
        `;
    }

    // 构建结果内容
    buildResultsContent(result) {
        let content = '';

        switch (this.searchParams.type) {
            case 1: // 单曲
                content = this.buildSongsContent(result.songs || []);
                break;
            case 10: // 专辑
                content = this.buildAlbumsContent(result.albums || []);
                break;
            case 100: // 歌手
                content = this.buildArtistsContent(result.artists || []);
                break;
            case 1000: // 歌单
                content = this.buildPlaylistsContent(result.playlists || []);
                break;
            default:
                content = `<pre>${JSON.stringify(result, null, 2)}</pre>`;
        }

        return content;
    }

    // 构建歌曲内容
    buildSongsContent(songs) {
        if (this.currentView === 'list') {
            return this.buildSongsListView(songs);
        } else {
            return this.buildSongsGridView(songs);
        }
    }

    // 列表视图
    buildSongsListView(songs) {
        let html = '<div class="list-view">';

        songs.forEach((song, index) => {
            const artists = song.ar ? song.ar.map(artist => artist.name).join(', ') : '未知';
            const album = song.al ? song.al.name : '未知';
            const duration = Math.floor(song.dt / 1000);
            const minutes = Math.floor(duration / 60);
            const seconds = duration % 60;

            html += `
                <div class="song-item">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <span style="width: 30px; text-align: center; color: #666;">${index + 1}</span>
                        <img src="${song.al?.picUrl || 'https://via.placeholder.com/50'}?param=50y50" 
                             style="width: 50px; height: 50px; border-radius: 8px;">
                        <div style="flex: 1;">
                            <div class="song-card-title">${song.name}</div>
                            <div class="song-card-meta">${artists} · ${album}</div>
                        </div>
                        <span style="color: #666;">${minutes}:${seconds.toString().padStart(2, '0')}</span>
                        <div class="song-card-actions">
                            <button class="song-card-btn" onclick="playSong(${song.id}, '${song.name.replace(/'/g, "\\'")}')" title="播放">
                                <i class="fas fa-play"></i>
                            </button>
                            <button class="song-card-btn secondary" onclick="this.showSongDetails(${song.id})" title="详情">
                                <i class="fas fa-info-circle"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        return html;
    }

    // 网格视图
    buildSongsGridView(songs) {
        let html = '<div class="grid-view">';

        songs.forEach(song => {
            const artists = song.ar ? song.ar.map(artist => artist.name).join(', ') : '未知';

            html += `
                <div class="song-card">
                    <img src="${song.al?.picUrl || 'https://via.placeholder.com/300'}?param=300y200" alt="${song.name}">
                    <div class="song-card-content">
                        <div class="song-card-title">${song.name}</div>
                        <div class="song-card-meta">${artists}</div>
                        <div class="song-card-actions">
                            <button class="song-card-btn" onclick="playSong(${song.id}, '${song.name.replace(/'/g, "\\'")}')">
                                <i class="fas fa-play"></i> 播放
                            </button>
                            <button class="song-card-btn secondary" onclick="this.addToPlaylist(${song.id})">
                                <i class="fas fa-plus"></i> 收藏
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        return html;
    }

    // 构建专辑内容
    buildAlbumsContent(albums) {
        let html = '<div class="grid-view">';

        albums.forEach(album => {
            const artist = album.artist ? album.artist.name : '未知';
            const year = album.publishTime ? new Date(album.publishTime).getFullYear() : '未知';

            html += `
                <div class="song-card">
                    <img src="${album.picUrl || 'https://via.placeholder.com/300'}?param=300y200" alt="${album.name}">
                    <div class="song-card-content">
                        <div class="song-card-title">${album.name}</div>
                        <div class="song-card-meta">${artist} · ${year}</div>
                        <div class="song-card-actions">
                            <button class="song-card-btn" onclick="enhancedSearch.viewAlbum(${album.id})">
                                <i class="fas fa-eye"></i> 查看
                            </button>
                            <button class="song-card-btn secondary" onclick="enhancedSearch.playAlbum(${album.id})">
                                <i class="fas fa-play"></i> 播放
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        return html;
    }

    // 构建歌手内容
    buildArtistsContent(artists) {
        let html = '<div class="grid-view">';

        artists.forEach(artist => {
            const albumCount = artist.albumSize || 0;
            const musicCount = artist.musicSize || 0;

            html += `
                <div class="song-card">
                    <img src="${artist.picUrl || 'https://via.placeholder.com/300'}?param=300y200" alt="${artist.name}">
                    <div class="song-card-content">
                        <div class="song-card-title">${artist.name}</div>
                        <div class="song-card-meta">${albumCount}专辑 · ${musicCount}歌曲</div>
                        <div class="song-card-actions">
                            <button class="song-card-btn" onclick="enhancedSearch.viewArtist(${artist.id})">
                                <i class="fas fa-user"></i> 主页
                            </button>
                            <button class="song-card-btn secondary" onclick="enhancedSearch.playArtistTop(${artist.id})">
                                <i class="fas fa-play"></i> 热门
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        return html;
    }

    // 构建歌单内容
    buildPlaylistsContent(playlists) {
        let html = '<div class="grid-view">';

        playlists.forEach(playlist => {
            const creator = playlist.creator ? playlist.creator.nickname : '未知';
            const playCount = playlist.playCount ? this.formatNumber(playlist.playCount) : '0';

            html += `
                <div class="song-card">
                    <img src="${playlist.coverImgUrl || 'https://via.placeholder.com/300'}?param=300y200" alt="${playlist.name}">
                    <div class="song-card-content">
                        <div class="song-card-title">${playlist.name}</div>
                        <div class="song-card-meta">${creator} · ${playCount}播放</div>
                        <div class="song-card-actions">
                            <button class="song-card-btn" onclick="enhancedSearch.viewPlaylist(${playlist.id})">
                                <i class="fas fa-eye"></i> 查看
                            </button>
                            <button class="song-card-btn secondary" onclick="enhancedSearch.playPlaylist(${playlist.id})">
                                <i class="fas fa-play"></i> 播放
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        return html;
    }

    // 构建空状态
    buildEmptyState() {
        return `
            </div> <!-- 关闭 results-view -->
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>未找到相关结果</h3>
                <p>尝试使用不同的关键词或调整搜索类型</p>
            </div>
        `;
    }

    // 构建分页
    buildPagination() {
        return `
            </div> <!-- 关闭 results-view -->
            <div class="pagination">
                <button class="page-btn" onclick="enhancedSearch.previousPage()" ${this.currentPage <= 1 ? 'disabled' : ''}>
                    <i class="fas fa-chevron-left"></i> 上一页
                </button>
                
                ${this.buildPageNumbers()}
                
                <button class="page-btn" onclick="enhancedSearch.nextPage()" ${this.currentPage >= this.totalPages ? 'disabled' : ''}>
                    下一页 <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        `;
    }

    // 构建页码按钮
    buildPageNumbers() {
        let pagesHTML = '';
        const maxPages = 5;

        let startPage = Math.max(1, this.currentPage - Math.floor(maxPages / 2));
        let endPage = Math.min(this.totalPages, startPage + maxPages - 1);

        if (endPage - startPage + 1 < maxPages) {
            startPage = Math.max(1, endPage - maxPages + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            pagesHTML += `
                <button class="page-btn ${i === this.currentPage ? 'active' : ''}" onclick="enhancedSearch.goToPage(${i})">
                    ${i}
                </button>
            `;
        }

        return pagesHTML;
    }

    // 分页控制
    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.performSearch();
        }
    }

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.performSearch();
        }
    }

    goToPage(page) {
        if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
            this.currentPage = page;
            this.performSearch();
        }
    }

    // 切换视图
    switchView(view) {
        this.currentView = view;
        this.performSearch(); // 重新搜索以更新视图
    }

    setupViewToggle() {
        // 视图切换按钮已在 buildResultsHeader 中设置
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

    // 保存到历史记录
    saveToHistory(keywords) {
        // 移除重复
        this.searchHistory = this.searchHistory.filter(item => item.keywords !== keywords);

        // 添加到开头
        this.searchHistory.unshift({
            keywords: keywords,
            timestamp: Date.now(),
            type: this.searchParams.type
        });

        // 保持最多20条记录
        if (this.searchHistory.length > 20) {
            this.searchHistory.pop();
        }

        localStorage.setItem('netease_search_history', JSON.stringify(this.searchHistory));
        this.updateHistoryDisplay();
    }

    // 加载搜索历史
    loadSearchHistory() {
        this.updateHistoryDisplay();
    }

    // 更新历史显示
    updateHistoryDisplay() {
        const historyDiv = document.getElementById('searchHistory');
        if (!historyDiv) return;

        if (this.searchHistory.length === 0) {
            historyDiv.style.display = 'none';
            return;
        }

        let html = '<h4><i class="fas fa-history"></i> 搜索历史</h4><div class="history-tags">';

        this.searchHistory.slice(0, 10).forEach(item => {
            html += `
                <span class="history-tag" onclick="enhancedSearch.selectHistory('${item.keywords.replace(/'/g, "\\'")}')">
                    ${item.keywords}
                </span>
            `;
        });

        html += '</div>';
        historyDiv.innerHTML = html;
        historyDiv.style.display = 'block';
    }

    // 选择历史记录
    selectHistory(keywords) {
        document.getElementById('searchInput').value = keywords;
        this.performSearch();
    }

    // 设置搜索语法帮助
    setupSearchSyntax() {
        // 在搜索框添加语法提示
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.title = '搜索语法提示：\n' +
                'lyric:关键词 - 搜索歌词\n' +
                '-排除词 - 排除关键词\n' +
                '"精确匹配" - 精确搜索\n' +
                'artist:歌手名 - 按歌手搜索';
        }
    }

    // 更新搜索类型
    updateSearchType() {
        const type = parseInt(document.getElementById('searchType').value);
        this.searchParams.type = type;

        // 根据类型调整排序选项
        const orderSelect = document.getElementById('searchOrder');
        if (type === 1) { // 单曲
            orderSelect.innerHTML = `
                <option value="hot">按热度</option>
                <option value="time">按时间</option>
                <option value="score">按评分</option>
            `;
        } else { // 其他类型
            orderSelect.innerHTML = `
                <option value="hot">按热度</option>
                <option value="new">按最新</option>
            `;
        }
    }

    // 更新筛选器
    updateFilters() {
        this.searchParams.filters.official = document.getElementById('chkOfficial').checked;
        this.searchParams.filters.highQuality = document.getElementById('chkHQ').checked;
        this.searchParams.filters.excludeNoCopyright = document.getElementById('chkNoCopyright').checked;
    }

    // 设置时间筛选
    setTimeFilter(range) {
        this.searchParams.filters.timeRange = range;

        // 更新UI
        document.querySelectorAll('.time-filter').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
    }

    // 更新每页数量
    updateLimitValue() {
        const limitSlider = document.getElementById('searchLimit');
        const limitValue = document.getElementById('limitValue');
        const value = parseInt(limitSlider.value);

        limitValue.textContent = value;
        this.itemsPerPage = value;
        this.searchParams.limit = value;
    }

    // 应用高级筛选
    applyAdvancedFilters() {
        this.updateFilters();
        this.performSearch();
        this.toggleAdvancedSearch();
    }

    // 重置高级筛选
    resetAdvancedFilters() {
        document.getElementById('chkOfficial').checked = true;
        document.getElementById('chkHQ').checked = false;
        document.getElementById('chkNoCopyright').checked = false;

        document.querySelectorAll('.time-filter').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector('.time-filter').classList.add('active');

        this.searchParams.filters.timeRange = 'all';

        const limitSlider = document.getElementById('searchLimit');
        limitSlider.value = 30;
        this.updateLimitValue();
    }

    // 切换高级搜索面板
    toggleAdvancedSearch() {
        const panel = document.getElementById('advancedSearchPanel');
        panel.classList.toggle('show');
    }

    // 快速示例
    quickExamples() {
        const examples = [
            '周杰伦',
            'lyric:夏天',
            '陈奕迅 -live',
            '纯音乐 放松',
            '英文经典',
            '"Yesterday Once More"'
        ];

        const randomExample = examples[Math.floor(Math.random() * examples.length)];
        document.getElementById('searchInput').value = randomExample;
        this.performSearch();
    }

    // 清空搜索
    clearSearch() {
        document.getElementById('searchInput').value = '';
        document.getElementById('searchResults').innerHTML = '';
        this.hideSuggestions();
    }

    // 扩展功能方法
    showSongDetails(songId) {
        // 简单的详情显示
        alert(`歌曲ID: ${songId}\n点击播放按钮可以试听歌曲`);
    }

    addToPlaylist(songId) {
        alert(`歌曲ID: ${songId}\n已添加到播放列表（功能演示）`);
    }

    viewAlbum(albumId) {
        alert(`专辑ID: ${albumId}\n查看专辑详情（功能演示）`);
    }

    playAlbum(albumId) {
        alert(`播放专辑: ${albumId}\n（功能演示）`);
    }

    viewArtist(artistId) {
        alert(`歌手ID: ${artistId}\n查看歌手主页（功能演示）`);
    }

    playArtistTop(artistId) {
        alert(`播放歌手热门歌曲: ${artistId}\n（功能演示）`);
    }

    viewPlaylist(playlistId) {
        alert(`歌单ID: ${playlistId}\n查看歌单详情（功能演示）`);
    }

    playPlaylist(playlistId) {
        alert(`播放歌单: ${playlistId}\n（功能演示）`);
    }
}

// 创建增强搜索实例
let enhancedSearch;

// 初始化增强搜索
function initEnhancedSearch() {
    enhancedSearch = new EnhancedSearch();
}

// 在页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEnhancedSearch);
} else {
    initEnhancedSearch();
}

// 暴露全局函数
window.performSearch = () => enhancedSearch.performSearch();
window.clearSearch = () => enhancedSearch.clearSearch();
window.toggleAdvancedSearch = () => enhancedSearch.toggleAdvancedSearch();
window.quickExamples = () => enhancedSearch.quickExamples();
window.setTimeFilter = (range) => enhancedSearch.setTimeFilter(range);
window.updateLimitValue = () => enhancedSearch.updateLimitValue();
window.applyAdvancedFilters = () => enhancedSearch.applyAdvancedFilters();
window.resetAdvancedFilters = () => enhancedSearch.resetAdvancedFilters();
window.updateSearchType = () => enhancedSearch.updateSearchType();
