const { ipcRenderer } = require('electron');
const authService = require('../services/auth');

// DOM Elements
const loginForm = document.getElementById('loginForm');
const errorMsg = document.getElementById('errorMsg');
const submitBtn = document.getElementById('submitBtn');

const loginView = document.getElementById('loginView');
const trackingView = document.getElementById('trackingView');
const timerDisplay = document.getElementById('timerDisplay');
const roleBadge = document.getElementById('roleBadge');
const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');
const lastSyncText = document.getElementById('lastSyncText');

const startActions = document.getElementById('startActions');
const activeActions = document.getElementById('activeActions');
const breakActions = document.getElementById('breakActions');

const startShiftBtn = document.getElementById('startShiftBtn');
const endShiftBtn = document.getElementById('endShiftBtn');
const breakBtn = document.getElementById('breakBtn');
const resumeBtn = document.getElementById('resumeBtn');
const logoutBtn = document.getElementById('logoutBtn');
const breakTypeSelect = document.getElementById('breakType');
const currentBreakTypeSpan = document.getElementById('currentBreakType');

let timerInterval = null;
let secondsElapsed = 0;
let isTracking = false;

function formatTime(s) {
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${h}:${m}:${sec}`;
}

function updateStatus(status) {
    statusBadge.className = 'status-badge';
    if (status === 'ACTIVE') {
        statusBadge.classList.add('status-active');
        statusText.innerText = 'Tracking Active';
        timerDisplay.classList.add('tracking-pulse');
    } else if (status === 'BREAK' || status === 'AFK') {
        statusBadge.classList.add('status-idle');
        statusText.innerText = status === 'AFK' ? 'Idle / AFK' : 'On Break';
        timerDisplay.classList.remove('tracking-pulse');
    } else {
        statusBadge.classList.add('status-offline');
        statusText.innerText = 'Offline';
        timerDisplay.classList.remove('tracking-pulse');
    }
}

ipcRenderer.on('status-update', (event, status) => {
    updateStatus(status);
});

function updateLastSync() {
    const now = new Date();
    lastSyncText.innerText = `Last Sync: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        secondsElapsed++;
        timerDisplay.innerText = formatTime(secondsElapsed);

        // Randomly update sync for visual effect, or every minute
        if (secondsElapsed % 60 === 0) {
            updateLastSync();
        }
    }, 1000);
    updateStatus('ACTIVE');
}

function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    updateStatus('OFFLINE');
}

function showTracking(user) {
    loginView.style.display = 'none';
    trackingView.style.display = 'flex';
    roleBadge.innerText = user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Standard User';
    updateLastSync();
    // Re-run lucide icons to catch any new elements
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    errorMsg.style.display = 'none';
    submitBtn.disabled = true;
    const originalContent = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i> Logging in...';
    if (window.lucide) window.lucide.createIcons();

    try {
        const { user, token } = await authService.login(email, password);
        ipcRenderer.send('login-success', { user, token });
        showTracking(user);
    } catch (error) {
        console.error(error);
        errorMsg.textContent = error.response?.data?.error || 'Login failed. Please check credentials.';
        errorMsg.style.display = 'block';
        submitBtn.innerHTML = originalContent;
        if (window.lucide) window.lucide.createIcons();
    } finally {
        submitBtn.disabled = false;
    }
});

startShiftBtn.addEventListener('click', () => {
    isTracking = true;
    ipcRenderer.send('start-tracking');
    startActions.style.display = 'none';
    activeActions.style.display = 'flex';
    startTimer();
    updateLastSync();
});

endShiftBtn.addEventListener('click', () => {
    isTracking = false;
    ipcRenderer.send('end-shift');
    activeActions.style.display = 'none';
    startActions.style.display = 'flex';
    stopTimer();
    secondsElapsed = 0;
    timerDisplay.innerText = "00:00:00";
    updateLastSync();
});

breakBtn.addEventListener('click', () => {
    const breakType = breakTypeSelect.value;
    ipcRenderer.send('pause-tracking', breakType);
    activeActions.style.display = 'none';
    breakActions.style.display = 'flex';
    currentBreakTypeSpan.innerText = breakType;
    stopTimer();
    updateStatus('idle');
});

resumeBtn.addEventListener('click', () => {
    ipcRenderer.send('resume-tracking');
    breakActions.style.display = 'none';
    activeActions.style.display = 'flex';
    startTimer();
    updateLastSync();
});

logoutBtn.addEventListener('click', () => {
    ipcRenderer.send('logout');
    stopTimer();
});

// Auto-login listener
ipcRenderer.on('auto-login-success', (event, { user, token }) => {
    showTracking(user);
});
