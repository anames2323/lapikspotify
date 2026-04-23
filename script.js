const SUPABASE_URL = 'https://axocscfyyrtcegxvwal.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4b2NzY2Z5eXJ0Y2VneHZ3YWwiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc0NTQ0MjE2MSwiZXhwIjoyMDYxMDE4MTYxfQ.LhT5jBx2RjGpGZqP9ZBjY8Z3lBmWk1iA2zFkV8ZQf1s';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let audio = new Audio();
let currentPlaylist = [];
let isPlaying = false;

// Проверка авторизации
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
    currentUser = session.user;
    updateUserUI();
    loadTracks();
}
checkAuth();

function updateUserUI() {
    if (!currentUser) return;
    const name = currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || 'User';
    const avatar = currentUser.user_metadata?.avatar_url || `https://i.pravatar.cc/150?u=${currentUser.email}`;
    document.getElementById('user-display-name').textContent = name;
    document.getElementById('user-avatar').src = avatar;
}

// Загрузка треков
async function loadTracks() {
    const { data, error } = await supabase.from('tracks').select('*').order('created_at', { ascending: false });
    if (error) return;
    
    currentPlaylist = data || [];
    const container = document.getElementById('tracks-container');
    container.innerHTML = '';
    
    if (currentPlaylist.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-music"></i><p>Нет треков</p></div>';
        return;
    }
    
    currentPlaylist.forEach((track, i) => {
        const div = document.createElement('div');
        div.className = 'track-item';
        div.innerHTML = `
            <span class="play-icon"><i class="far fa-play-circle"></i></span>
            <img src="${track.cover_url || 'https://via.placeholder.com/40/1db954/ffffff?text=♪'}">
            <span class="track-name">${track.title}</span>
            <span>${track.artist}</span>
            <span><i class="fas fa-headphones"></i> ${track.plays || 0}</span>
        `;
        div.addEventListener('click', () => playTrack(i));
        container.appendChild(div);
    });
}

// Плеер
function playTrack(index) {
    const track = currentPlaylist[index];
    document.getElementById('player-title').textContent = track.title;
    document.getElementById('player-artist').textContent = track.artist;
    document.getElementById('player-cover').src = track.cover_url || 'https://via.placeholder.com/40/1db954/ffffff?text=♪';
    
    audio.src = track.audio_url;
    audio.play();
    isPlaying = true;
    document.getElementById('play-btn').innerHTML = '<i class="fas fa-pause"></i>';
    
    supabase.from('tracks').update({ plays: (track.plays || 0) + 1 }).eq('id', track.id).then(() => loadTracks());
}

document.getElementById('play-btn').addEventListener('click', () => {
    if (!audio.src) return;
    if (isPlaying) {
        audio.pause();
        document.getElementById('play-btn').innerHTML = '<i class="fas fa-play"></i>';
    } else {
        audio.play();
        document.getElementById('play-btn').innerHTML = '<i class="fas fa-pause"></i>';
    }
    isPlaying = !isPlaying;
});

audio.addEventListener('ended', () => {
    document.getElementById('play-btn').innerHTML = '<i class="fas fa-play"></i>';
    isPlaying = false;
});

// Громкость
document.getElementById('volume-slider').addEventListener('input', (e) => {
    audio.volume = e.target.value / 100;
});

// Навигация
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(item.dataset.page + '-page').classList.add('active');
    });
});

// Меню профиля
document.getElementById('profile-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('profile-menu').classList.toggle('hidden');
});
document.addEventListener('click', () => document.getElementById('profile-menu').classList.add('hidden'));

// Выход
document.getElementById('logout-btn').addEventListener('click', async (e) => {
    e.preventDefault();
    await supabase.auth.signOut();
    window.location.href = 'login.html';
});

// Загрузка трека
document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('track-title').value;
    const artist = document.getElementById('track-artist').value;
    const audioFile = document.getElementById('track-file').files[0];
    const coverFile = document.getElementById('track-cover').files[0];
    
    if (!audioFile) return alert('Выберите файл');
    
    const progressDiv = document.getElementById('upload-progress');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    
    progressDiv.style.display = 'block';
    
    try {
        const fileName = `${currentUser.id}/${Date.now()}_${audioFile.name}`;
        await supabase.storage.from('music').upload(fileName, audioFile);
        const audioUrl = supabase.storage.from('music').getPublicUrl(fileName).data.publicUrl;
        
        progressFill.style.width = '50%';
        progressText.textContent = '50%';
        
        let coverUrl = null;
        if (coverFile) {
            const coverName = `${currentUser.id}/covers/${Date.now()}_${coverFile.name}`;
            await supabase.storage.from('music').upload(coverName, coverFile);
            coverUrl = supabase.storage.from('music').getPublicUrl(coverName).data.publicUrl;
        }
        
        await supabase.from('tracks').insert({
            title, artist, artist_id: currentUser.id,
            audio_url: audioUrl, cover_url: coverUrl, plays: 0
        });
        
        progressFill.style.width = '100%';
        progressText.textContent = '100%';
        
        setTimeout(() => {
            alert('Трек загружен!');
            document.getElementById('upload-form').reset();
            progressDiv.style.display = 'none';
            progressFill.style.width = '0%';
            document.querySelector('[data-page="home"]').click();
            loadTracks();
        }, 500);
        
    } catch (error) {
        alert('Ошибка: ' + error.message);
        progressDiv.style.display = 'none';
    }
});
