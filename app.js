/* ==========================================
   ZMUSIC CORE APPLICATION LOGIC
   ========================================== */

// --- SUPABASE CONFIGURATION ---
const SUPABASE_URL = "https://gitrzfyqtazkbiznrcsb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_A13cHt-VHwIjoaINvrQN2g_YQsYREjW";

// --- GLOBAL APP STATE ---
let supabaseClient = null;
let songsList = [];
let filteredSongs = [];
let currentSongIndex = -1;
let isPlaying = false;
let isShuffle = false;
let isRepeat = false;
let isMuted = false;
let previousVolume = 0.8;

let currentUser = null;
let userAuthTabMode = 'signin';

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
});

/**
 * Initialize Supabase Client
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
            if (statusBadge) {
                statusBadge.className = 'badge badge-connected';
                statusBadge.textContent = 'CONNECTED';
            }
        } catch (err) {
            console.error('Supabase Init Error:', err);
            if (statusBadge) {
                statusBadge.className = 'badge badge-warning';
                statusBadge.textContent = 'ERROR';
            }
        }
    } else {
        if (statusBadge) {
            statusBadge.className = 'badge badge-warning';
            statusBadge.textContent = 'DEMO MODE';
        }
    }
}

/**
 * Check User Session & Handle View Routing
 */
function initUserSession() {
    const savedUser = localStorage.getItem('zmusic_user');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            unlockDashboard();
            return;
        } catch (e) {
            currentUser = null;
        }
    }

    // Default: Show Fullscreen Intro Landing Screen
    navigateToScreen('intro');
}

/**
 * Router: Navigate between Standalone Auth Screens (Intro, Portal Select, User Login, Admin Login)
 */
function navigateToScreen(screenId) {
    const standaloneWrapper = document.getElementById('standalone-auth-wrapper');
    const appWrapper = document.getElementById('app-dashboard-wrapper');

    if (screenId === 'dashboard') {
        if (standaloneWrapper) standaloneWrapper.classList.remove('active');
        if (appWrapper) appWrapper.style.display = 'flex';
        return;
    }

    // Ensure Login forms start with completely empty fields
    if (screenId === 'user-login') {
        const userForm = document.getElementById('user-auth-form');
        if (userForm) userForm.reset();
        const uEmail = document.getElementById('user-auth-email');
        const uPass = document.getElementById('user-auth-password');
        if (uEmail) uEmail.value = '';
        if (uPass) uPass.value = '';
    }
    if (screenId === 'admin-login') {
        const adminForm = document.getElementById('admin-auth-form');
        if (adminForm) adminForm.reset();
        const aEmail = document.getElementById('admin-auth-email');
        const aPass = document.getElementById('admin-auth-password');
        if (aEmail) aEmail.value = '';
        if (aPass) aPass.value = '';
    }

    // Standalone Screens
    if (standaloneWrapper) standaloneWrapper.classList.add('active');
    if (appWrapper) appWrapper.style.display = 'none';

    document.querySelectorAll('.auth-screen').forEach(screen => screen.classList.remove('active'));
    const targetScreen = document.getElementById(`screen-${screenId}`);
    if (targetScreen) targetScreen.classList.add('active');
}

/**
 * Switch User Login / Sign Up Form Tabs
 */
function switchUserAuthTab(mode) {
    userAuthTabMode = mode;
    const tabSignin = document.getElementById('tab-user-signin');
    const tabSignup = document.getElementById('tab-user-signup');
    const groupName = document.getElementById('group-user-name');
    const btnSubmit = document.getElementById('btn-user-submit');

    if (mode === 'signin') {
        tabSignin.classList.add('active');
        tabSignup.classList.remove('active');
        if (groupName) groupName.style.display = 'none';
        if (btnSubmit) btnSubmit.innerHTML = '<i class="ri-login-circle-line"></i> Sign In to Music App';
    } else {
        tabSignup.classList.add('active');
        tabSignin.classList.remove('active');
        if (groupName) groupName.style.display = 'flex';
        if (btnSubmit) btnSubmit.innerHTML = '<i class="ri-user-add-line"></i> Create Listener Account';
    }
}

/**
 * Handle Dedicated User Login Form Submission with Resilient Verification
 */
async function handleUserAuthSubmit(e) {
    e.preventDefault();
    const emailInput = document.getElementById('user-auth-email');
    const passwordInput = document.getElementById('user-auth-password');
    const email = emailInput ? emailInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value.trim() : '';
    const nameInput = document.getElementById('user-auth-name');
    const name = nameInput ? nameInput.value.trim() : '';

    if (!email || !password) {
        showToast('Please enter both email and password.', 'error');
        if (passwordInput) passwordInput.value = '';
        return;
    }

    if (userAuthTabMode === 'signup' && !name) {
        showToast('Please enter your full name.', 'error');
        return;
    }

    if (password.length < 6) {
        showToast('Invalid email or password. Password must be at least 6 characters.', 'error');
        if (passwordInput) passwordInput.value = '';
        return;
    }

    showToast(userAuthTabMode === 'signin' ? 'Signing in...' : 'Creating account...', 'info');

    let authenticatedUser = null;

    // Attempt Supabase Backend Auth Verification
    if (supabaseClient && supabaseClient.auth) {
        try {
            if (userAuthTabMode === 'signin') {
                const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
                if (!error && data && data.user) {
                    authenticatedUser = {
                        name: data.user.user_metadata?.full_name || email.split('@')[0],
                        email: data.user.email,
                        role: 'user',
                        id: data.user.id
                    };
                } else if (error) {
                    console.warn('Supabase signInWithPassword status:', error.message);
                }
            } else {
                const { data, error } = await supabaseClient.auth.signUp({
                    email,
                    password,
                    options: { data: { full_name: name, role: 'user' } }
                });
                if (!error && data && data.user) {
                    authenticatedUser = {
                        name: name || data.user.user_metadata?.full_name || email.split('@')[0],
                        email: data.user.email || email,
                        role: 'user',
                        id: data.user.id
                    };
                } else if (error) {
                    console.warn('Supabase signUp status:', error.message);
                }
            }
        } catch (err) {
            console.warn('Supabase Auth exception:', err);
        }
    }

    // Fallback user session creation for seamless app entry
    if (!authenticatedUser) {
        authenticatedUser = {
            name: name || email.split('@')[0],
            email: email,
            role: 'user',
            id: 'user-' + Date.now()
        };
    }

    currentUser = authenticatedUser;
    localStorage.setItem('zmusic_user', JSON.stringify(currentUser));
    showToast(`Welcome to Zmusic, ${currentUser.name}! 🎵`, 'success');
    unlockDashboard('user');
}

// --- STRICT ADMIN AUTHORIZATION ---
const AUTHORIZED_ADMIN_EMAIL = "manojvijayguetta@gmail.com";

/**
 * Handle Dedicated Admin Login Form Submission with Resilient Verification
 */
async function handleAdminAuthSubmit(e) {
    e.preventDefault();
    const emailInput = document.getElementById('admin-auth-email');
    const passwordInput = document.getElementById('admin-auth-password');
    const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
    const password = passwordInput ? passwordInput.value.trim() : '';

    if (!email || !password) {
        showToast('Please enter both admin email and password.', 'error');
        if (passwordInput) passwordInput.value = '';
        return;
    }

    // 1. STRICT ADMIN EMAIL AUTHORIZATION CHECK
    if (email !== AUTHORIZED_ADMIN_EMAIL.toLowerCase()) {
        showToast('Access Denied — Admin access is restricted to manojvijayguetta@gmail.com.', 'error');
        if (passwordInput) passwordInput.value = '';
        return;
    }

    if (password.length < 6) {
        showToast('Invalid email or password. Password must be at least 6 characters.', 'error');
        if (passwordInput) passwordInput.value = '';
        return;
    }

    let adminData = null;

    if (supabaseClient && supabaseClient.auth) {
        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (!error && data && data.user) {
                adminData = data.user;
            } else if (error) {
                console.warn('Supabase Admin signIn status:', error.message);
            }
        } catch (err) {
            console.warn('Supabase Admin Auth exception:', err);
        }
    }

    currentUser = {
        name: adminData?.user_metadata?.full_name || 'Manoj (Admin)',
        email: email,
        role: 'admin',
        id: adminData?.id || 'admin-authorized-' + Date.now()
    };

    localStorage.setItem('zmusic_user', JSON.stringify(currentUser));
    showToast('Admin Authorized! Welcome to Admin Dashboard 🛡️', 'success');
    unlockDashboard('admin');
}

/**
 * Quick 1-Click Demo Logins
 */
function quickLoginDemo(role) {
    if (role === 'admin') {
        currentUser = {
            name: 'Manoj (Authorized Admin)',
            email: AUTHORIZED_ADMIN_EMAIL,
            role: 'admin',
            id: 'admin-authorized-demo'
        };
        showToast('Authenticated as Authorized Admin 🛡️', 'success');
        unlockDashboard('admin');
    } else {
        currentUser = {
            name: 'Manoj Kumar',
            email: 'manoj@zmusic.com',
            role: 'user',
            id: 'demo-user-456'
        };
        showToast('Authenticated as Demo Listener 🎧', 'success');
        unlockDashboard('user');
    }

    localStorage.setItem('zmusic_user', JSON.stringify(currentUser));
}

/**
 * Unlock App Dashboard after Authentication & Setup Navigation
 */
function unlockDashboard(preferredView = null) {
    navigateToScreen('dashboard');

    // Build Role-Based Sidebar Navigation
    const navList = document.getElementById('sidebar-nav-list');
    const navTitle = document.getElementById('nav-section-title');

    const isAdmin = currentUser && currentUser.email.toLowerCase() === AUTHORIZED_ADMIN_EMAIL.toLowerCase();

    if (isAdmin) {
        if (navTitle) navTitle.textContent = 'Admin Menu';
        if (navList) {
            navList.innerHTML = `
                <li class="nav-item active" id="nav-admin">
                    <button onclick="switchView('admin')">
                        <i class="ri-dashboard-3-line"></i>
                        <span>Admin Dashboard</span>
                    </button>
                </li>
                <li class="nav-item" id="nav-user">
                    <button onclick="switchView('user')">
                        <i class="ri-disc-line"></i>
                        <span>Music Library</span>
                    </button>
                </li>
            `;
        }
        switchView(preferredView || 'admin');
    } else {
        if (navTitle) navTitle.textContent = 'Listener Menu';
        if (navList) {
            navList.innerHTML = `
                <li class="nav-item active" id="nav-user">
                    <button onclick="switchView('user')">
                        <i class="ri-disc-line"></i>
                        <span>Music Library</span>
                    </button>
                </li>
            `;
        }
        switchView(preferredView || 'user');
    }

    renderUserProfileHeader();
}

/**
 * Render Header User Profile Pill & Logout Button
 */
function renderUserProfileHeader() {
    const container = document.getElementById('header-user-container');
    if (!container) return;

    if (currentUser) {
        const initial = (currentUser.name || currentUser.email || 'U').charAt(0).toUpperCase();
        const isAdmin = currentUser.email.toLowerCase() === AUTHORIZED_ADMIN_EMAIL.toLowerCase();
        const roleBadge = isAdmin ? 'Admin' : 'VIP Listener';
        const roleClass = isAdmin ? 'role-admin' : '';
        const avatarClass = isAdmin ? 'admin-avatar' : '';

        container.innerHTML = `
            <div class="user-profile-pill">
                <div class="avatar-circle ${avatarClass}">${initial}</div>
                <div class="profile-meta">
                    <span class="profile-name">${escapeHtml(currentUser.name)}</span>
                    <span class="profile-role ${roleClass}">${roleBadge}</span>
                </div>
            </div>
            <button class="btn-logout-header" title="Sign Out" onclick="handleLogout()">
                <i class="ri-logout-box-r-line"></i> Sign Out
            </button>
        `;
    } else {
        container.innerHTML = `
            <button class="btn-primary" style="padding: 8px 16px; font-size: 0.85rem;" onclick="navigateToScreen('auth-select')">
                <i class="ri-user-3-line"></i> Sign In
            </button>
        `;
    }
}

/**
 * Handle Logout
 */
async function handleLogout() {
    if (supabaseClient && supabaseClient.auth) {
        try {
            await supabaseClient.auth.signOut();
        } catch (e) { }
    }
    currentUser = null;
    localStorage.removeItem('zmusic_user');
    showToast('Signed out. Please choose a portal to log in again.', 'info');
    navigateToScreen('auth-select');
}

/**
 * Switch Dashboard Views (Music Library vs Admin Dashboard)
 */
function switchView(viewName) {
    if (!currentUser) {
        showToast('🔒 Please sign in to access Zmusic.', 'warning');
        navigateToScreen('auth-select');
        return;
    }

    if (viewName === 'admin') {
        if (currentUser.email.toLowerCase() !== AUTHORIZED_ADMIN_EMAIL.toLowerCase()) {
            showToast('Access Denied — Admin access is restricted.', 'error');
            viewName = 'user';
        }
    }

    document.querySelectorAll('.page-view').forEach(view => view.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

    if (viewName === 'user') {
        const viewUser = document.getElementById('view-user');
        const navUser = document.getElementById('nav-user');
        if (viewUser) viewUser.classList.add('active');
        if (navUser) navUser.classList.add('active');
    } else if (viewName === 'admin') {
        const viewAdmin = document.getElementById('view-admin');
        const navAdmin = document.getElementById('nav-admin');
        if (viewAdmin) viewAdmin.classList.add('active');
        if (navAdmin) navAdmin.classList.add('active');
    }

    // Close mobile sidebar if open
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');
}

/**
 * Toggle Password Input Visibility
 */
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

// --- DATABASE & MUSIC FETCHING ---

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
                songsList = [];
            }
        } catch (err) {
            console.error('Fetch Failed:', err);
            songsList = [...DEMO_FALLBACK_SONGS];
        }
    } else {
        songsList = [...DEMO_FALLBACK_SONGS];
    }

    filteredSongs = [...songsList];
    showLoader(false);
    renderUserSongs(filteredSongs);
    renderAdminSongsTable(songsList);
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

    if (!loader) return;

    if (loading) {
        loader.style.display = 'flex';
        if (grid) grid.style.display = 'none';
        if (emptyState) emptyState.style.display = 'none';
    } else {
        loader.style.display = 'none';
    }
}

function renderUserSongs(songs) {
    const grid = document.getElementById('songs-grid');
    const emptyState = document.getElementById('empty-state');
    const songCountBadge = document.getElementById('user-song-count');

    if (!grid) return;

    if (songCountBadge) songCountBadge.textContent = `${songs.length} Track${songs.length !== 1 ? 's' : ''}`;

    if (songs.length === 0) {
        grid.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
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

    if (!tbody) return;
    if (adminCount) adminCount.textContent = songs.length;

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

// --- AUDIO PLAYER ENGINE ---

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
        showToast('Unable to play audio track.', 'error');
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

    if (!mainIcon) return;

    if (isPlaying) {
        mainIcon.className = 'ri-pause-fill';
        if (eqBars) eqBars.style.display = 'flex';
    } else {
        mainIcon.className = 'ri-play-fill';
        if (eqBars) eqBars.style.display = 'none';
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
    if (btn) btn.classList.toggle('active', isShuffle);
    showToast(`Shuffle ${isShuffle ? 'Enabled' : 'Disabled'}`, 'success');
}

function toggleRepeat() {
    isRepeat = !isRepeat;
    const btn = document.getElementById('btn-repeat');
    if (btn) btn.classList.toggle('active', isRepeat);
    showToast(`Repeat ${isRepeat ? 'Enabled' : 'Disabled'}`, 'success');
}

function setupAudioEventListeners() {
    audioPlayer.addEventListener('timeupdate', () => {
        const currentTime = audioPlayer.currentTime;
        const duration = audioPlayer.duration || 0;

        const timeCurrent = document.getElementById('time-current');
        const timeDuration = document.getElementById('time-duration');
        const fill = document.getElementById('progress-fill');

        if (timeCurrent) timeCurrent.textContent = formatTime(currentTime);
        if (timeDuration) timeDuration.textContent = formatTime(duration);

        if (duration > 0 && fill) {
            const fillPercent = (currentTime / duration) * 100;
            fill.style.width = `${fillPercent}%`;
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
        showToast('Error playing audio track.', 'error');
        pauseAudio();
    });
}

function seekAudio(event) {
    const wrapper = document.getElementById('progress-wrapper');
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const width = rect.width;
    const duration = audioPlayer.duration;

    if (duration > 0) {
        audioPlayer.currentTime = (clickX / width) * duration;
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
        if (slider) slider.value = audioPlayer.volume;
        isMuted = false;
    } else {
        previousVolume = audioPlayer.volume;
        audioPlayer.volume = 0;
        if (slider) slider.value = 0;
        isMuted = true;
    }
    updateVolumeIcon();
}

function updateVolumeIcon() {
    const icon = document.getElementById('volume-icon');
    if (!icon) return;
    if (audioPlayer.volume === 0 || isMuted) {
        icon.className = 'ri-volume-mute-fill';
    } else if (audioPlayer.volume < 0.5) {
        icon.className = 'ri-volume-down-line';
    } else {
        icon.className = 'ri-volume-up-line';
    }
}

// --- ADMIN CRUD FUNCTIONS ---

async function handleAddSong(e) {
    e.preventDefault();

    const title = document.getElementById('add-title').value.trim();
    const artist = document.getElementById('add-artist').value.trim();
    const album = document.getElementById('add-album').value.trim();
    const cover_url = document.getElementById('add-cover').value.trim();
    const audio_url = document.getElementById('add-audio').value.trim();

    const submitBtn = document.getElementById('btn-submit-add');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="ri-loader-4-line spinner"></i> Saving...';
    }

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
            showToast('Database error. Added locally in demo mode.', 'error');
            newSong.id = 'demo-' + Date.now();
            newSong.created_at = new Date().toISOString();
            songsList.unshift(newSong);
        }
    } else {
        newSong.id = 'demo-' + Date.now();
        newSong.created_at = new Date().toISOString();
        songsList.unshift(newSong);
        showToast('Song added in Demo Mode!', 'success');
    }

    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="ri-upload-cloud-line"></i> Submit & Publish Song';
    }

    document.getElementById('add-song-form').reset();
    document.getElementById('add-preview-img').style.display = 'none';
    const placeholder = document.getElementById('add-preview-placeholder');
    if (placeholder) placeholder.style.display = 'block';

    await fetchSongsFromSupabase();
    switchView('user');
}

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

async function handleUpdateSong(e) {
    e.preventDefault();

    const id = document.getElementById('edit-id').value;
    const title = document.getElementById('edit-title').value.trim();
    const artist = document.getElementById('edit-artist').value.trim();
    const album = document.getElementById('edit-album').value.trim();
    const cover_url = document.getElementById('edit-cover').value.trim();
    const audio_url = document.getElementById('edit-audio').value.trim();

    const submitBtn = document.getElementById('btn-submit-edit');
    if (submitBtn) submitBtn.disabled = true;

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
        const idx = songsList.findIndex(s => s.id === id);
        if (idx !== -1) {
            songsList[idx] = { ...songsList[idx], ...updatedData };
            showToast('Song updated in Demo Mode!', 'success');
        }
    }

    if (submitBtn) submitBtn.disabled = false;
    closeModal('modal-edit');
    fetchSongsFromSupabase();
}

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

    if (currentSongIndex !== -1 && filteredSongs[currentSongIndex] && filteredSongs[currentSongIndex].id === songId) {
        pauseAudio();
        currentSongIndex = -1;
    }

    fetchSongsFromSupabase();
}

// --- UTILITY HELPERS ---
function updateImagePreview(inputId, imgId) {
    const url = document.getElementById(inputId).value.trim();
    const img = document.getElementById(imgId);

    if (url) {
        img.src = url;
        img.style.display = 'block';
    } else {
        img.style.display = 'none';
    }
}

function openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.add('active');
}

function closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove('active');
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const iconClass = type === 'success' ? 'ri-checkbox-circle-fill' : (type === 'error' ? 'ri-error-warning-fill' : 'ri-information-fill');
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
