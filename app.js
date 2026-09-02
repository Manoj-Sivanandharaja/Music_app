/* ==========================================
   ZMUSIC CORE JAVASCRIPT APP LOGIC
   ========================================== */

// --- SUPABASE CONFIGURATION ---
const SUPABASE_URL = "https://gitrzfyqtazkbiznrcsb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_A13cHt-VHwIjoaINvrQN2g_YQsYREjW";

// --- GLOBAL STATE ---
let supabaseClient = null;
let songsList = [];
let filteredSongs = [];
let currentSongIndex = -1;
let isPlaying = false;
let isShuffle = false;
let isRepeat = false;
let isMuted = false;
let previousVolume = 0.8;

// User & Auth State
let currentUser = null; // { name, email, role: 'user'|'admin'|'guest', id }
let currentAuthTab = 'signin';

// Fallback Sample Songs for Instant Out-of-the-Box Preview
const DEMO_FALLBACK_SONGS = [
    {
        id: 'demo-1',
        title: 'Let Me Go',
        artist: 'JayJen',
        album: 'Cyber Vibes',
        cover_url: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=600&auto=format&fit=crop',
        audio_url: 'https://res.cloudinary.com/yttor7j5/video/upload/v1787637315/jayjen-let-me-go.mp3',
        created_at: new Date().toISOString()
    },
    {
        id: 'demo-2',
        title: 'Midnight City Grooves',
        artist: 'Aura Beats',
        album: 'Nightfall Sessions',
        cover_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600&auto=format&fit=crop',
        audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        created_at: new Date().toISOString()
    },
    {
        id: 'demo-3',
        title: 'Neon Horizon',
        artist: 'Pulse Synthetics',
        album: 'Retro Synthwave',
        cover_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600&auto=format&fit=crop',
        audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
        created_at: new Date().toISOString()
    }
];

// HTML Audio Element Reference
const audioPlayer = document.getElementById('audio-player');

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
    initUserSession();
    setupAudioEventListeners();
    fetchSongsFromSupabase();

    // Trigger animated intro timer if starting on intro page
    const viewIntro = document.getElementById('view-intro');
    if (viewIntro && viewIntro.classList.contains('active')) {
        initIntroAutoTimer();
    }
});

/**
 * Initialize Supabase Client using hardcoded credentials, localStorage, or environment
 */
function initSupabase() {
    const savedUrl = SUPABASE_URL || localStorage.getItem('audionix_sb_url');
    const savedKey = SUPABASE_ANON_KEY || localStorage.getItem('audionix_sb_key');

    const statusBadge = document.getElementById('db-status-badge');
    const configUrlInput = document.getElementById('config-url');
    const configKeyInput = document.getElementById('config-key');

    if (savedUrl && savedKey) {
        if (configUrlInput) configUrlInput.value = savedUrl;
        if (configKeyInput) configKeyInput.value = savedKey;
        try {
            supabaseClient = window.supabase.createClient(savedUrl, savedKey);
            statusBadge.className = 'badge badge-connected';
            statusBadge.textContent = 'CONNECTED';
        } catch (err) {
            console.error('Supabase Init Error:', err);
            statusBadge.className = 'badge badge-warning';
            statusBadge.textContent = 'ERROR';
        }
    } else {
        statusBadge.className = 'badge badge-warning';
        statusBadge.textContent = 'DEMO MODE';
    }
}

/**
 * Save Supabase Credentials from Modal Form
 */
function handleSaveConfig(e) {
    e.preventDefault();
    const url = document.getElementById('config-url').value.trim();
    const key = document.getElementById('config-key').value.trim();

    if (!url || !key) {
        showToast('Please enter both Supabase URL and Key', 'error');
        return;
    }

    localStorage.setItem('audionix_sb_url', url);
    localStorage.setItem('audionix_sb_key', key);

    initSupabase();
    closeModal('modal-config');
    showToast('Supabase connected! Fetching database songs...', 'success');
    fetchSongsFromSupabase();
}

/**
 * Fetch Songs from Supabase (or Fallback to Demo Data)
 */
async function fetchSongsFromSupabase() {
    showLoader(true);

    if (supabaseClient) {
        try {
            const { data, error } = await supabaseClient
                .from('songs')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.warn('Supabase fetch error, using fallback:', error.message);
                if (error.code === 'PGRST205' || error.message.includes('songs')) {
                    showToast('Table "songs" not created yet. Run the SQL script in Supabase!', 'error');
                } else {
                    showToast(`Supabase Error: ${error.message}`, 'error');
                }
                songsList = [...DEMO_FALLBACK_SONGS];
            } else if (data && data.length > 0) {
                songsList = data;
            } else {
                // Table is empty
                songsList = [];
            }
        } catch (err) {
            console.error('Fetch Failed:', err);
            songsList = [...DEMO_FALLBACK_SONGS];
        }
    } else {
        // Demo Mode Fallback
        songsList = [...DEMO_FALLBACK_SONGS];
    }

    filteredSongs = [...songsList];
    showLoader(false);
    renderUserSongs(filteredSongs);
    renderAdminSongsTable(songsList);
}

// --- USER AUTHENTICATION & SESSION MANAGEMENT ---

function initUserSession() {
    // Check saved user session in localStorage
    const savedUser = localStorage.getItem('zmusic_user') || localStorage.getItem('audionix_user');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
        } catch (e) {
            currentUser = null;
        }
    }

    // Check Supabase Auth Session if client exists
    if (supabaseClient && supabaseClient.auth) {
        supabaseClient.auth.getSession().then(({ data: { session } }) => {
            if (session && session.user) {
                currentUser = {
                    name: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
                    email: session.user.email,
                    role: session.user.user_metadata?.role || 'user',
                    id: session.user.id
                };
                localStorage.setItem('zmusic_user', JSON.stringify(currentUser));
                renderUserProfileHeader();
            }
        }).catch(err => console.log('Supabase Auth Session check:', err));
    }

    renderUserProfileHeader();
}

function renderUserProfileHeader() {
    const container = document.getElementById('header-user-container');
    const navLoginLabel = document.getElementById('nav-login-label');

    if (!container) return;

    if (currentUser) {
        const initial = (currentUser.name || currentUser.email || 'U').charAt(0).toUpperCase();
        const roleLabel = currentUser.role === 'admin' ? 'Admin' : 'VIP Member';

        container.innerHTML = `
            <div class="user-pill" title="Logged in as ${currentUser.email}">
                <div class="user-avatar">${initial}</div>
                <div class="user-info">
                    <span class="user-name">${currentUser.name || currentUser.email.split('@')[0]}</span>
                    <span class="user-role-badge">${roleLabel}</span>
                </div>
            </div>
            <button class="btn-icon" title="Logout" onclick="handleLogout()" style="color: #ef4444; border-color: rgba(239,68,68,0.2);">
                <i class="ri-logout-box-r-line"></i>
            </button>
        `;

        if (navLoginLabel) navLoginLabel.textContent = 'My Account';
    } else {
        container.innerHTML = `
            <button class="btn-header-login" onclick="switchView('login')">
                <i class="ri-user-3-line"></i> Sign In
            </button>
        `;

        if (navLoginLabel) navLoginLabel.textContent = 'Login / Account';
    }
}

function switchAuthTab(tab) {
    currentAuthTab = tab;
    const tabSignin = document.getElementById('tab-signin');
    const tabSignup = document.getElementById('tab-signup');
    const groupName = document.getElementById('group-name');
    const authTitle = document.getElementById('auth-title-text');
    const authSubtitle = document.getElementById('auth-subtitle-text');
    const btnSubmit = document.getElementById('btn-auth-submit');
    const authOptions = document.getElementById('auth-options');

    if (!tabSignin || !tabSignup) return;

    if (tab === 'signin') {
        tabSignin.classList.add('active');
        tabSignup.classList.remove('active');
        if (groupName) groupName.style.display = 'none';
        if (authTitle) authTitle.textContent = 'Welcome to Zmusic';
        if (authSubtitle) authSubtitle.textContent = 'Sign in to your account to unlock full streaming experience';
        if (btnSubmit) btnSubmit.innerHTML = '<i class="ri-login-circle-line"></i> Sign In to Zmusic';
        if (authOptions) authOptions.style.display = 'flex';
    } else {
        tabSignin.classList.remove('active');
        tabSignup.classList.add('active');
        if (groupName) groupName.style.display = 'block';
        if (authTitle) authTitle.textContent = 'Create your Zmusic Account';
        if (authSubtitle) authSubtitle.textContent = 'Join millions streaming high-quality music anywhere';
        if (btnSubmit) btnSubmit.innerHTML = '<i class="ri-user-add-line"></i> Create Account';
        if (authOptions) authOptions.style.display = 'none';
    }
}

function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('i');
    if (!input || !icon) return;

    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'ri-eye-line';
    } else {
        input.type = 'password';
        icon.className = 'ri-eye-off-line';
    }
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    const nameInput = document.getElementById('auth-name');
    const name = nameInput ? nameInput.value.trim() : '';

    if (!email || !password) {
        showToast('Please enter your email and password.', 'error');
        return;
    }

    if (currentAuthTab === 'signup' && !name) {
        showToast('Please enter your full name.', 'error');
        return;
    }

    showToast(currentAuthTab === 'signin' ? 'Authenticating...' : 'Creating account...', 'info');

    // Attempt Supabase Auth if initialized
    if (supabaseClient && supabaseClient.auth) {
        try {
            if (currentAuthTab === 'signin') {
                const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
                if (error) throw error;
                currentUser = {
                    name: data.user.user_metadata?.full_name || email.split('@')[0],
                    email: data.user.email,
                    role: data.user.user_metadata?.role || 'user',
                    id: data.user.id
                };
            } else {
                const { data, error } = await supabaseClient.auth.signUp({
                    email,
                    password,
                    options: { data: { full_name: name, role: 'user' } }
                });
                if (error) throw error;
                currentUser = {
                    name: name || email.split('@')[0],
                    email,
                    role: 'user',
                    id: data.user?.id || 'sb-' + Date.now()
                };
            }
        } catch (err) {
            console.warn('Supabase Auth warning, fallback to session state:', err.message);
            currentUser = {
                name: name || email.split('@')[0],
                email: email,
                role: email.includes('admin') ? 'admin' : 'user',
                id: 'local-' + Date.now()
            };
        }
    } else {
        // Fallback Local Auth
        currentUser = {
            name: name || email.split('@')[0],
            email: email,
            role: email.includes('admin') ? 'admin' : 'user',
            id: 'local-' + Date.now()
        };
    }

    localStorage.setItem('zmusic_user', JSON.stringify(currentUser));
    renderUserProfileHeader();
    showToast(`Welcome to Zmusic, ${currentUser.name}! 🎵`, 'success');

    // Reset Form
    document.getElementById('auth-form').reset();
    switchView('user');
}

function quickLoginDemo(role) {
    if (role === 'admin') {
        currentUser = {
            name: 'Zmusic Admin',
            email: 'admin@zmusic.com',
            role: 'admin',
            id: 'demo-admin-123'
        };
        showToast('Logged in as Demo Admin 🛡️', 'success');
    } else {
        currentUser = {
            name: 'Manoj Kumar',
            email: 'manoj@zmusic.com',
            role: 'user',
            id: 'demo-user-456'
        };
        showToast('Logged in as Demo User 🎧', 'success');
    }

    localStorage.setItem('zmusic_user', JSON.stringify(currentUser));
    renderUserProfileHeader();
    switchView('user');
}

async function handleLogout() {
    if (supabaseClient && supabaseClient.auth) {
        try {
            await supabaseClient.auth.signOut();
        } catch (e) { }
    }
    currentUser = null;
    localStorage.removeItem('zmusic_user');
    renderUserProfileHeader();
    showToast('You have logged out. Please sign in to continue.', 'info');
    switchView('login');
}

// --- VIEW NAVIGATION & INTRO SEQUENCING ---

let introAutoTimer = null;

function initIntroAutoTimer() {
    const timerFill = document.getElementById('intro-timer-fill');
    if (timerFill) {
        timerFill.classList.remove('running');
        void timerFill.offsetWidth; // force reflow to restart animation
        timerFill.classList.add('running');
    }

    if (introAutoTimer) clearTimeout(introAutoTimer);
    introAutoTimer = setTimeout(() => {
        const viewIntro = document.getElementById('view-intro');
        if (viewIntro && viewIntro.classList.contains('active')) {
            proceedFromIntroToLogin(true);
        }
    }, 4500);
}

function proceedFromIntroToLogin(isAuto = false) {
    if (introAutoTimer) {
        clearTimeout(introAutoTimer);
        introAutoTimer = null;
    }

    if (currentUser) {
        switchView('user');
        showToast(`Welcome back to Zmusic, ${currentUser.name}! 🎵`, 'success');
    } else {
        switchView('login');
        if (isAuto) {
            showToast('Welcome! Please sign in with your credentials to unlock Zmusic.', 'info');
        } else {
            showToast('Please sign in or use Demo login to unlock the app.', 'info');
        }
    }
}

function switchView(viewName) {
    // Auth Guard: Require login for user library and admin panel
    if ((viewName === 'user' || viewName === 'admin') && !currentUser) {
        showToast('🔒 Please sign in to access Zmusic.', 'warning');
        viewName = 'login';
    }

    document.querySelectorAll('.page-view').forEach(view => view.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

    if (viewName === 'intro') {
        const viewIntro = document.getElementById('view-intro');
        const navIntro = document.getElementById('nav-intro');
        if (viewIntro) viewIntro.classList.add('active');
        if (navIntro) navIntro.classList.add('active');
        initIntroAutoTimer();
    } else if (viewName === 'user') {
        const viewUser = document.getElementById('view-user');
        const navUser = document.getElementById('nav-user');
        if (viewUser) viewUser.classList.add('active');
        if (navUser) navUser.classList.add('active');
    } else if (viewName === 'admin') {
        const viewAdmin = document.getElementById('view-admin');
        const navAdmin = document.getElementById('nav-admin');
        if (viewAdmin) viewAdmin.classList.add('active');
        if (navAdmin) navAdmin.classList.add('active');
    } else if (viewName === 'login') {
        const viewLogin = document.getElementById('view-login');
        const navLogin = document.getElementById('nav-login');
        if (viewLogin) viewLogin.classList.add('active');
        if (navLogin) navLogin.classList.add('active');
    }

    // Close mobile sidebar if open
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');
}

function playFeaturedDemoTrack() {
    if (songsList && songsList.length > 0) {
        currentSongIndex = 0;
        loadAndPlaySong(songsList[0]);
        showToast('Now Playing Featured Track: "Let Me Go" by JayJen 🎧', 'success');
    } else {
        showToast('Loading tracks from database...', 'info');
    }
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

function handleSearch(query) {
    const term = query.toLowerCase().trim();
    if (!term) {
        filteredSongs = [...songsList];
    } else {
        filteredSongs = songsList.filter(song =>
            song.title.toLowerCase().includes(term) ||
            song.artist.toLowerCase().includes(term) ||
            (song.album && song.album.toLowerCase().includes(term))
        );
    }
    renderUserSongs(filteredSongs);
}

// --- RENDER FUNCTIONS ---
function showLoader(loading) {
    const loader = document.getElementById('songs-loader');
    const grid = document.getElementById('songs-grid');
    const emptyState = document.getElementById('empty-state');

    if (loading) {
        loader.style.display = 'flex';
        grid.style.display = 'none';
        emptyState.style.display = 'none';
    } else {
        loader.style.display = 'none';
    }
}

function renderUserSongs(songs) {
    const grid = document.getElementById('songs-grid');
    const emptyState = document.getElementById('empty-state');
    const songCountBadge = document.getElementById('user-song-count');

    songCountBadge.textContent = `${songs.length} Track${songs.length !== 1 ? 's' : ''}`;

    if (songs.length === 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    grid.style.display = 'grid';

    grid.innerHTML = songs.map((song, idx) => {
        const isCurrentPlaying = currentSongIndex !== -1 &&
            filteredSongs[currentSongIndex] &&
            filteredSongs[currentSongIndex].id === song.id &&
            isPlaying;

        const defaultCover = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=600&auto=format&fit=crop';
        const coverSrc = song.cover_url || defaultCover;

        return `
            <div class="song-card ${isCurrentPlaying ? 'playing' : ''}" onclick="playSongFromUserGrid(${idx})">
                <div class="cover-wrapper">
                    <img class="cover-img" src="${coverSrc}" alt="${escapeHtml(song.title)}" onerror="this.src='${defaultCover}'">
                    <div class="play-overlay">
                        <button class="btn-play-card">
                            <i class="${isCurrentPlaying ? 'ri-pause-fill' : 'ri-play-fill'}"></i>
                        </button>
                    </div>
                </div>
                <div class="song-info">
                    <div class="song-title" title="${escapeHtml(song.title)}">${escapeHtml(song.title)}</div>
                    <div class="song-artist" title="${escapeHtml(song.artist)}">${escapeHtml(song.artist)}</div>
                    ${song.album ? `<div class="song-album">${escapeHtml(song.album)}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function renderAdminSongsTable(songs) {
    const tbody = document.getElementById('admin-songs-tbody');
    const adminCount = document.getElementById('admin-song-count');
    adminCount.textContent = songs.length;

    if (songs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 30px;">
                    No songs found in database. Add a song using the form on the left!
                </td>
            </tr>
        `;
        return;
    }

    const defaultCover = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=600&auto=format&fit=crop';

    tbody.innerHTML = songs.map(song => `
        <tr>
            <td>
                <img class="table-cover" src="${song.cover_url || defaultCover}" alt="Cover" onerror="this.src='${defaultCover}'">
            </td>
            <td>
                <div style="font-weight: 700; color: var(--text-main);">${escapeHtml(song.title)}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(song.artist)}</div>
            </td>
            <td style="color: var(--text-dim);">${escapeHtml(song.album || 'Single')}</td>
            <td>
                <div class="action-btns">
                    <button class="btn-action edit" onclick="openEditModal('${song.id}')">
                        <i class="ri-edit-line"></i> Edit
                    </button>
                    <button class="btn-action delete" onclick="handleDeleteSong('${song.id}')">
                        <i class="ri-delete-bin-line"></i> Delete
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// --- AUDIO PLAYER CONTROLS ---

function playSongFromUserGrid(index) {
    if (currentSongIndex === index && isPlaying) {
        pauseAudio();
        return;
    }
    currentSongIndex = index;
    loadAndPlaySong(filteredSongs[currentSongIndex]);
}

function loadAndPlaySong(song) {
    if (!song) return;

    audioPlayer.src = song.audio_url;
    audioPlayer.load();

    // Update Bottom Player UI
    const defaultCover = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=600&auto=format&fit=crop';
    document.getElementById('player-cover-img').src = song.cover_url || defaultCover;
    document.getElementById('player-song-title').textContent = song.title;
    document.getElementById('player-song-artist').textContent = song.artist;

    playAudio();
    renderUserSongs(filteredSongs);
}

function playAudio() {
    audioPlayer.play().then(() => {
        isPlaying = true;
        updatePlayPauseUI();
    }).catch(err => {
        console.error('Playback Error:', err);
        showToast('Unable to play audio. Check URL format.', 'error');
        isPlaying = false;
        updatePlayPauseUI();
    });
}

function pauseAudio() {
    audioPlayer.pause();
    isPlaying = false;
    updatePlayPauseUI();
    renderUserSongs(filteredSongs);
}

function togglePlayPause() {
    if (currentSongIndex === -1 && filteredSongs.length > 0) {
        currentSongIndex = 0;
        loadAndPlaySong(filteredSongs[0]);
        return;
    }
    if (isPlaying) {
        pauseAudio();
    } else {
        playAudio();
    }
}

function updatePlayPauseUI() {
    const mainIcon = document.getElementById('main-play-icon');
    const eqBars = document.getElementById('player-eq');

    if (isPlaying) {
        mainIcon.className = 'ri-pause-fill';
        eqBars.style.display = 'flex';
    } else {
        mainIcon.className = 'ri-play-fill';
        eqBars.style.display = 'none';
    }
}

function playNextSong() {
    if (filteredSongs.length === 0) return;

    if (isShuffle) {
        let randomIndex = Math.floor(Math.random() * filteredSongs.length);
        if (randomIndex === currentSongIndex && filteredSongs.length > 1) {
            randomIndex = (randomIndex + 1) % filteredSongs.length;
        }
        currentSongIndex = randomIndex;
    } else {
        currentSongIndex = (currentSongIndex + 1) % filteredSongs.length;
    }
    loadAndPlaySong(filteredSongs[currentSongIndex]);
}

function playPreviousSong() {
    if (filteredSongs.length === 0) return;

    if (audioPlayer.currentTime > 3) {
        audioPlayer.currentTime = 0;
        return;
    }

    currentSongIndex = (currentSongIndex - 1 + filteredSongs.length) % filteredSongs.length;
    loadAndPlaySong(filteredSongs[currentSongIndex]);
}

function toggleShuffle() {
    isShuffle = !isShuffle;
    const btn = document.getElementById('btn-shuffle');
    btn.classList.toggle('active', isShuffle);
    showToast(`Shuffle ${isShuffle ? 'Enabled' : 'Disabled'}`, 'success');
}

function toggleRepeat() {
    isRepeat = !isRepeat;
    const btn = document.getElementById('btn-repeat');
    btn.classList.toggle('active', isRepeat);
    showToast(`Repeat ${isRepeat ? 'Enabled' : 'Disabled'}`, 'success');
}

// Audio Element Event Listeners
function setupAudioEventListeners() {
    audioPlayer.addEventListener('timeupdate', () => {
        const currentTime = audioPlayer.currentTime;
        const duration = audioPlayer.duration || 0;

        document.getElementById('time-current').textContent = formatTime(currentTime);
        document.getElementById('time-duration').textContent = formatTime(duration);

        if (duration > 0) {
            const fillPercent = (currentTime / duration) * 100;
            document.getElementById('progress-fill').style.width = `${fillPercent}%`;
        }
    });

    audioPlayer.addEventListener('ended', () => {
        if (isRepeat) {
            audioPlayer.currentTime = 0;
            playAudio();
        } else {
            playNextSong();
        }
    });

    audioPlayer.addEventListener('error', (e) => {
        console.error('Audio element error:', e);
        showToast('Error playing audio track', 'error');
        pauseAudio();
    });
}

function seekAudio(event) {
    const wrapper = document.getElementById('progress-wrapper');
    const rect = wrapper.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const width = rect.width;
    const duration = audioPlayer.duration;

    if (duration > 0) {
        const seekTime = (clickX / width) * duration;
        audioPlayer.currentTime = seekTime;
    }
}

function handleVolumeChange(val) {
    audioPlayer.volume = val;
    isMuted = val == 0;
    updateVolumeIcon();
}

function toggleMute() {
    const slider = document.getElementById('volume-slider');
    if (isMuted) {
        audioPlayer.volume = previousVolume || 0.8;
        slider.value = audioPlayer.volume;
        isMuted = false;
    } else {
        previousVolume = audioPlayer.volume;
        audioPlayer.volume = 0;
        slider.value = 0;
        isMuted = true;
    }
    updateVolumeIcon();
}

function updateVolumeIcon() {
    const icon = document.getElementById('volume-icon');
    if (audioPlayer.volume === 0 || isMuted) {
        icon.className = 'ri-volume-mute-fill';
    } else if (audioPlayer.volume < 0.5) {
        icon.className = 'ri-volume-down-line';
    } else {
        icon.className = 'ri-volume-up-line';
    }
}

// --- ADMIN CRUD FUNCTIONS ---

/**
 * Handle Add Song Form Submit
 */
async function handleAddSong(e) {
    e.preventDefault();

    const title = document.getElementById('add-title').value.trim();
    const artist = document.getElementById('add-artist').value.trim();
    const album = document.getElementById('add-album').value.trim();
    const cover_url = document.getElementById('add-cover').value.trim();
    const audio_url = document.getElementById('add-audio').value.trim();

    const submitBtn = document.getElementById('btn-submit-add');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="ri-loader-4-line spinner"></i> Saving...';

    const newSong = {
        title,
        artist,
        album: album || 'Single',
        cover_url: cover_url || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=600&auto=format&fit=crop',
        audio_url
    };

    if (supabaseClient) {
        try {
            const { data, error } = await supabaseClient
                .from('songs')
                .insert([newSong])
                .select();

            if (error) throw error;
            showToast('Song published to Supabase!', 'success');
        } catch (err) {
            console.error('Supabase Insert Error:', err);
            showToast('Database error. Added locally in session mode.', 'error');
            newSong.id = 'demo-' + Date.now();
            newSong.created_at = new Date().toISOString();
            songsList.unshift(newSong);
        }
    } else {
        // Fallback Demo Add
        newSong.id = 'demo-' + Date.now();
        newSong.created_at = new Date().toISOString();
        songsList.unshift(newSong);
        showToast('Song added in Demo Mode!', 'success');
    }

    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="ri-upload-cloud-line"></i> Submit & Publish Song';

    // Reset Form
    document.getElementById('add-song-form').reset();
    document.getElementById('add-preview-img').style.display = 'none';
    document.getElementById('add-preview-placeholder').style.display = 'block';

    // Refresh Data & Views
    await fetchSongsFromSupabase();
    switchView('user');
}

/**
 * Open Edit Modal with Pre-filled Song Data
 */
function openEditModal(songId) {
    const song = songsList.find(s => s.id === songId);
    if (!song) return;

    document.getElementById('edit-id').value = song.id;
    document.getElementById('edit-title').value = song.title;
    document.getElementById('edit-artist').value = song.artist;
    document.getElementById('edit-album').value = song.album || '';
    document.getElementById('edit-cover').value = song.cover_url || '';
    document.getElementById('edit-audio').value = song.audio_url;

    updateImagePreview('edit-cover', 'edit-preview-img');
    openModal('modal-edit');
}

/**
 * Handle Update Song Form Submit
 */
async function handleUpdateSong(e) {
    e.preventDefault();

    const id = document.getElementById('edit-id').value;
    const title = document.getElementById('edit-title').value.trim();
    const artist = document.getElementById('edit-artist').value.trim();
    const album = document.getElementById('edit-album').value.trim();
    const cover_url = document.getElementById('edit-cover').value.trim();
    const audio_url = document.getElementById('edit-audio').value.trim();

    const submitBtn = document.getElementById('btn-submit-edit');
    submitBtn.disabled = true;

    const updatedData = { title, artist, album, cover_url, audio_url };

    if (supabaseClient && !id.startsWith('demo-')) {
        try {
            const { error } = await supabaseClient
                .from('songs')
                .update(updatedData)
                .eq('id', id);

            if (error) throw error;
            showToast('Song updated successfully!', 'success');
        } catch (err) {
            console.error('Update Failed:', err);
            showToast('Failed to update song in database.', 'error');
        }
    } else {
        // Local Edit for Demo Mode
        const idx = songsList.findIndex(s => s.id === id);
        if (idx !== -1) {
            songsList[idx] = { ...songsList[idx], ...updatedData };
            showToast('Song updated in Demo Mode!', 'success');
        }
    }

    submitBtn.disabled = false;
    closeModal('modal-edit');
    fetchSongsFromSupabase();
}

/**
 * Handle Delete Song
 */
async function handleDeleteSong(songId) {
    const song = songsList.find(s => s.id === songId);
    if (!song) return;

    if (!confirm(`Are you sure you want to delete "${song.title}" by ${song.artist}?`)) {
        return;
    }

    if (supabaseClient && !songId.startsWith('demo-')) {
        try {
            const { error } = await supabaseClient
                .from('songs')
                .delete()
                .eq('id', songId);

            if (error) throw error;
            showToast('Song deleted from database!', 'success');
        } catch (err) {
            console.error('Delete Failed:', err);
            showToast('Failed to delete song from database.', 'error');
        }
    } else {
        songsList = songsList.filter(s => s.id !== songId);
        showToast('Song deleted in Demo Mode!', 'success');
    }

    // Stop audio if deleted song was playing
    if (currentSongIndex !== -1 && filteredSongs[currentSongIndex] && filteredSongs[currentSongIndex].id === songId) {
        pauseAudio();
        currentSongIndex = -1;
    }

    fetchSongsFromSupabase();
}

// --- HELPERS & MODAL UTILITIES ---
function updateImagePreview(inputId, imgId) {
    const url = document.getElementById(inputId).value.trim();
    const img = document.getElementById(imgId);
    const placeholder = document.getElementById(inputId.replace('cover', 'preview-placeholder'));

    if (url) {
        img.src = url;
        img.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';
    } else {
        img.style.display = 'none';
        if (placeholder) placeholder.style.display = 'block';
    }
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const iconClass = type === 'success' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill';
    toast.innerHTML = `<i class="${iconClass}"></i> <span>${escapeHtml(message)}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(50px)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function formatTime(seconds) {
    if (isNaN(seconds) || seconds === 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
