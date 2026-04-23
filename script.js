// ==================== КОНФИГУРАЦИЯ SUPABASE ====================
const SUPABASE_URL = 'https://axocscfyyrtcegxvwal.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4b2NzY2Z5eXJ0Y2VneHZ3YWwiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc0NTQ0MjE2MSwiZXhwIjoyMDYxMDE4MTYxfQ.LhT5jBx2RjGpGZqP9ZBjY8Z3lBmWk1iA2zFkV8ZQf1s';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let currentUser = null;
let audio = new Audio();
let currentPlaylist = [];
let currentTrackIndex = 0;
let isPlaying = false;
let viewedUserId = null;

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    setupAuthListener();
    setupPlayerEvents();
    setupMenu();
    setupNavigation();
    setupUpload();
    setupProfileEdit();
});

// ==================== АВТОРИЗАЦИЯ ====================
function initAuth() {
    document.getElementById('tab-login').addEventListener('click', () => switchAuthTab('login'));
    document.getElementById('tab-register').addEventListener('click', () => switchAuthTab('register'));
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
}

function switchAuthTab(tab) {
    const loginTab = document.getElementById('tab-login');
    const regTab = document.getElementById('tab-register');
    const loginForm = document.getElementById('login-form');
    const regForm = document.getElementById('register-form');
    const loginError = document.getElementById('login-error');
    const regError = document.getElementById('reg-error');
    
    if (tab === 'login') {
        loginTab.classList.add('active');
        regTab.classList.remove('active');
        loginForm.classList.add('active');
        regForm.classList.remove('active');
    } else {
        regTab.classList.add('active');
        loginTab.classList.remove('active');
        regForm.classList.add('active');
        loginForm.classList.remove('active');
    }
    
    // Очищаем ошибки
    loginError.innerText = '';
    regError.innerText = '';
}

async function handleRegister(e) {
    e.preventDefault();
    
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const errorEl = document.getElementById('reg-error');
    const submitBtn = document.querySelector('#register-form .btn-primary');
    
    // Показываем загрузку
    submitBtn.disabled = true;
    submitBtn.innerText = 'Загрузка...';
    errorEl.innerText = '';
    
    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { 
                    name: name,
                    avatar_url: `https://i.pravatar.cc/150?u=${email}`
                }
            }
        });
        
        if (error) throw error;
        
        if (data.user) {
            // Если email подтверждение отключено в Supabase
            if (data.session) {
                // Автоматический вход
                currentUser = data.user;
                updateUIWithUser();
                showMainScreen();
                loadAllTracks();
                updateFollowStats();
            } else {
                alert('Регистрация успешна! Теперь войдите.');
                switchAuthTab('login');
                document.getElementById('login-email').value = email;
            }
        }
    } catch (error) {
        errorEl.innerText = error.message;
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Зарегистрироваться';
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    const submitBtn = document.querySelector('#login-form .btn-primary');
    
    // Показываем загрузку
    submitBtn.disabled = true;
    submitBtn.innerText = 'Вход...';
    errorEl.innerText = '';
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({ 
            email, 
            password 
        });
        
        if (error) throw error;
        
        if (data.user) {
            currentUser = data.user;
            updateUIWithUser();
            showMainScreen();
            loadAllTracks();
            updateFollowStats();
        }
    } catch (error) {
        errorEl.innerText = 'Неверный email или пароль';
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Войти';
    }
}

async function setupAuthListener() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
        currentUser = session.user;
        updateUIWithUser();
        showMainScreen();
        loadAllTracks();
        updateFollowStats();
    }
    
    supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
            currentUser = session.user;
            updateUIWithUser();
            showMainScreen();
            loadAllTracks();
            updateFollowStats();
        } else {
            currentUser = null;
            document.getElementById('auth-screen').classList.add('active');
            document.getElementById('main-screen').classList.remove('active');
            audio.pause();
        }
    });
}

async function logout() {
    await supabase.auth.signOut();
}

function showMainScreen() {
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('main-screen').classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('profile-page').classList.add('active');
}

function updateUIWithUser() {
    if (!currentUser) return;
    
    const name = currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || 'User';
    const avatar = currentUser.user_metadata?.avatar_url || `https://i.pravatar.cc/150?u=${currentUser.email}`;
    
    document.getElementById('user-display-name').innerText = name;
    document.getElementById('user-avatar').src = avatar;
    document.getElementById('profile-name-large').innerText = name;
    document.getElementById('profile-email-large').innerText = currentUser.email;
    document.getElementById('profile-avatar-large').src = avatar;
}

// ==================== НАВИГАЦИЯ ====================
function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            
            if (page === 'home') {
                document.getElementById('profile-page').classList.add('active');
                loadAllTracks();
            } else if (page === 'upload') {
                document.getElementById('upload-page').classList.add('active');
            } else if (page === 'search') {
                document.getElementById('profile-page').classList.add('active');
            } else if (page === 'library') {
                document.getElementById('profile-page').classList.add('active');
            }
        });
    });
}

// ==================== ЗАГРУЗКА ТРЕКОВ ====================
async function loadAllTracks() {
    try {
        const { data: tracks, error } = await supabase
            .from('tracks')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        currentPlaylist = tracks || [];
        renderMyTracks(currentPlaylist);
        renderAllTracks(currentPlaylist);
    } catch (error) {
        console.error('Ошибка загрузки треков:', error);
    }
}

function renderMyTracks(allTracks) {
    if (!currentUser) return;
    const myTracks = allTracks.filter(t => t.artist_id === currentUser.id);
    const container = document.getElementById('my-tracks-container');
    renderTrackList(container, myTracks, true);
}

function renderAllTracks(tracks) {
    const container = document.getElementById('all-tracks-container');
    renderTrackList(container, tracks, false);
}

function renderTrackList(container, tracks, showDelete) {
    container.innerHTML = '';
    
    if (!tracks || tracks.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-music"></i><p>Нет треков</p></div>';
        return;
    }
    
    tracks.forEach((track, index) => {
        const div = document.createElement('div');
        div.className = 'track-item';
        
        div.innerHTML = `
            <span class="play-icon"><i class="far fa-play-circle"></i></span>
            <img src="${track.cover_url || 'https://via.placeholder.com/40/1db954/ffffff?text=Music'}" alt="${track.title}">
            <span class="track-name">${track.title}</span>
            <span class="artist-name" data-artist-id="${track.artist_id}">${track.artist}</span>
            <span class="plays-count"><i class="fas fa-headphones"></i> ${track.plays || 0}</span>
            ${showDelete ? '<button class="delete-btn"><i class="fas fa-trash"></i></button>' : '<span></span>'}
        `;
        
        div.addEventListener('click', async (e) => {
            if (e.target.closest('.artist-name')) {
                e.stopPropagation();
                const artistId = e.target.closest('.artist-name').dataset.artistId;
                await viewUserProfile(artistId);
                return;
            }
            if (e.target.closest('.delete-btn')) {
                e.stopPropagation();
                await deleteTrack(track.id);
                return;
            }
            playTrackFromList(tracks, index);
        });
        
        container.appendChild(div);
    });
}

async function deleteTrack(trackId) {
    if (!confirm('Удалить трек?')) return;
    
    try {
        const { error } = await supabase
            .from('tracks')
            .delete()
            .eq('id', trackId);
            
        if (error) throw error;
        
        await loadAllTracks();
    } catch (error) {
        console.error('Ошибка удаления:', error);
        alert('Не удалось удалить трек');
    }
}

// ==================== ЗАГРУЗКА ФАЙЛОВ ====================
function setupUpload() {
    const fileInput = document.getElementById('track-file');
    const coverInput = document.getElementById('track-cover');
    const audioPreview = document.getElementById('audio-preview');
    const coverPreview = document.getElementById('cover-preview');
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            audioPreview.src = URL.createObjectURL(file);
            audioPreview.style.display = 'block';
        }
    });
    
    coverInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                coverPreview.src = e.target.result;
                coverPreview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });
    
    document.getElementById('upload-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!currentUser) {
            alert('Необходимо авторизоваться');
            return;
        }
        
        const title = document.getElementById('track-title').value.trim();
        const artist = document.getElementById('track-artist').value.trim();
        const audioFile = document.getElementById('track-file').files[0];
        const coverFile = document.getElementById('track-cover').files[0];
        
        if (!audioFile) {
            alert('Выберите аудио файл');
            return;
        }
        
        const uploadBtn = document.getElementById('upload-btn');
        const progressDiv = document.getElementById('upload-progress');
        const progressBar = document.getElementById('upload-progress-bar');
        const percentSpan = document.getElementById('upload-percent');
        
        uploadBtn.disabled = true;
        uploadBtn.innerText = 'Загрузка...';
        progressDiv.style.display = 'flex';
        
        try {
            // 1. Загружаем аудио
            const audioFileName = `${currentUser.id}/${Date.now()}_${audioFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            const { error: audioError } = await supabase.storage
                .from('music')
                .upload(audioFileName, audioFile, {
                    cacheControl: '3600',
                    upsert: false
                });
                
            if (audioError) throw audioError;
            
            const { data: audioUrlData } = supabase.storage
                .from('music')
                .getPublicUrl(audioFileName);
                
            progressBar.style.width = '50%';
            percentSpan.innerText = '50%';
            
            // 2. Загружаем обложку (если есть)
            let coverUrl = null;
            if (coverFile) {
                const coverFileName = `${currentUser.id}/covers/${Date.now()}_${coverFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
                const { error: coverError } = await supabase.storage
                    .from('music')
                    .upload(coverFileName, coverFile);
                    
                if (!coverError) {
                    const { data: coverUrlData } = supabase.storage
                        .from('music')
                        .getPublicUrl(coverFileName);
                    coverUrl = coverUrlData.publicUrl;
                }
            }
            
            progressBar.style.width = '80%';
            percentSpan.innerText = '80%';
            
            // 3. Сохраняем в базу данных
            const { error: dbError } = await supabase
                .from('tracks')
                .insert({
                    title,
                    artist,
                    artist_id: currentUser.id,
                    audio_url: audioUrlData.publicUrl,
                    cover_url: coverUrl,
                    plays: 0
                });
                
            if (dbError) throw dbError;
            
            progressBar.style.width = '100%';
            percentSpan.innerText = '100%';
            
            setTimeout(() => {
                alert('Трек успешно загружен!');
                document.getElementById('upload-form').reset();
                audioPreview.style.display = 'none';
                coverPreview.style.display = 'none';
                
                document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
                document.getElementById('profile-page').classList.add('active');
                document.querySelector('[data-page="home"]').classList.add('active');
                
                loadAllTracks();
            }, 500);
            
        } catch (error) {
            console.error('Ошибка загрузки:', error);
            alert('Ошибка загрузки: ' + error.message);
        } finally {
            uploadBtn.disabled = false;
            uploadBtn.innerText = 'Загрузить трек';
            progressDiv.style.display = 'none';
            progressBar.style.width = '0%';
            percentSpan.innerText = '0%';
        }
    });
    
    document.getElementById('show-upload-modal').addEventListener('click', () => {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('upload-page').classList.add('active');
        document.querySelector('[data-page="upload"]').classList.add('active');
    });
}

// ==================== ПРОСМОТР ПРОФИЛЯ ПОЛЬЗОВАТЕЛЯ ====================
async function viewUserProfile(userId) {
    try {
        viewedUserId = userId;
        
        const { data: tracks, error } = await supabase
            .from('tracks')
            .select('*')
            .eq('artist_id', userId)
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        const userName = tracks.length > 0 ? tracks[0].artist : 'Пользователь';
        
        document.getElementById('view-avatar-large').src = `https://i.pravatar.cc/150?u=${userId}`;
        document.getElementById('view-name-large').innerText = userName;
        document.getElementById('view-email-large').innerText = '';
        
        const { data: followers } = await supabase
            .from('follows')
            .select('*')
            .eq('following_id', userId);
            
        const { data: following } = await supabase
            .from('follows')
            .select('*')
            .eq('follower_id', userId);
            
        document.getElementById('view-followers-count').innerHTML = `<strong>${followers?.length || 0}</strong> подписчиков`;
        document.getElementById('view-following-count').innerHTML = `<strong>${following?.length || 0}</strong> подписок`;
        
        if (currentUser) {
            const { data: isFollowing } = await supabase
                .from('follows')
                .select('*')
                .eq('follower_id', currentUser.id)
                .eq('following_id', userId)
                .single();
                
            const followBtn = document.getElementById('follow-btn');
            followBtn.innerText = isFollowing ? 'Отписаться' : 'Подписаться';
            followBtn.onclick = () => toggleFollow(userId);
        }
        
        renderTrackList(document.getElementById('user-tracks-container'), tracks, false);
        
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('user-page').classList.add('active');
        
    } catch (error) {
        console.error('Ошибка просмотра профиля:', error);
    }
}

async function toggleFollow(userId) {
    if (!currentUser) {
        alert('Необходимо войти');
        return;
    }
    
    try {
        const { data: existing } = await supabase
            .from('follows')
            .select('*')
            .eq('follower_id', currentUser.id)
            .eq('following_id', userId)
            .single();
            
        if (existing) {
            await supabase
                .from('follows')
                .delete()
                .eq('follower_id', currentUser.id)
                .eq('following_id', userId);
        } else {
            await supabase
                .from('follows')
                .insert({
                    follower_id: currentUser.id,
                    following_id: userId
                });
        }
        
        await viewUserProfile(userId);
        await updateFollowStats();
        
    } catch (error) {
        console.error('Ошибка подписки:', error);
    }
}

async function updateFollowStats() {
    if (!currentUser) return;
    
    try {
        const { data: followers } = await supabase
            .from('follows')
            .select('*')
            .eq('following_id', currentUser.id);
            
        const { data: following } = await supabase
            .from('follows')
            .select('*')
            .eq('follower_id', currentUser.id);
            
        document.getElementById('followers-count').inne
