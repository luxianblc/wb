// 播放歌曲
async function playSong(songId, songName) {
    try {
        const params = {
            id: songId,
            level: 'exhigh'
        };

        const url = buildApiUrl('/song/url/v1', params);
        const response = await fetch(url);
        const data = await response.json();

        if (data.code === 200 && data.data) {
            const song = Array.isArray(data.data) ? data.data[0] : data.data;

            if (song.url && song.url.startsWith('http')) {
                // 调用播放器功能
                window.playAudio(song.url, songName, songId);
            } else {
                alert('无法播放此歌曲（可能需要VIP或登录）');
            }
        }
    } catch (error) {
        console.error('播放失败:', error);
        alert('播放失败');
    }
}

// 添加到播放列表
function addToPlaylist(songId) {
    alert(`歌曲 ${songId} 已添加到播放列表`);
    // 这里可以添加具体的播放列表逻辑
}