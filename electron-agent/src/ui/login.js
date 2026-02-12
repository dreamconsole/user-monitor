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
let sessionStartTime = null;
let isTracking = false;

// Break Timer Variables
let breakTimerInterval = null;
let breakSecondsElapsed = 0;
let breakDurationLimit = null; // in seconds, null if no limit
let breakStartTime = null;

// Store break definitions (id -> { name, max_duration_seconds, is_paid })
let breakDefinitions = {};

function formatTime(s) {
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${h}:${m}:${sec}`;
}

async function fetchAndPopulateBreaks() {
    try {
        const breaks = await ipcRenderer.invoke('get-breaks');
        breakTypeSelect.innerHTML = '<option value="" disabled selected>Select Break</option>';
        breakDefinitions = {};

        if (breaks && breaks.length > 0) {
            breaks.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b.name; // Using name as ID for now to match backend expectation, or change backend to use ID
                opt.textContent = b.name;
                // Store limits
                breakDefinitions[b.name] = b;
                breakTypeSelect.appendChild(opt);
            });
        } else {
            // Fallback if no breaks found
            const defaults = ['Lunch Break', 'Tea Break', 'Meeting', 'Personal'];
            defaults.forEach(name => {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                breakDefinitions[name] = { name, max_duration_seconds: null };
                breakTypeSelect.appendChild(opt);
            });
        }
    } catch (e) {
        console.error('Failed to load breaks:', e);
    }
}

function updateStatus(status) {
    statusBadge.className = 'status-badge';
    if (status === 'ACTIVE') {
        statusBadge.classList.add('status-active');
        statusText.innerText = 'Tracking Active';
        timerDisplay.classList.add('tracking-pulse');
        // Reset timer color
        timerDisplay.style.color = 'var(--text-main)';
    } else if (status === 'BREAK' || status === 'AFK') {
        statusBadge.classList.add('status-idle');
        statusText.innerText = status === 'AFK' ? 'Idle / AFK' : 'On Break';
        timerDisplay.classList.remove('tracking-pulse');
    } else {
        statusBadge.classList.add('status-offline');
        statusText.innerText = 'Offline';
        timerDisplay.classList.remove('tracking-pulse');
        timerDisplay.style.color = 'var(--text-main)';
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
    if (!sessionStartTime) {
        sessionStartTime = Date.now() - (secondsElapsed * 1000);
    }
    timerInterval = setInterval(() => {
        const now = Date.now();
        secondsElapsed = Math.floor((now - sessionStartTime) / 1000);
        timerDisplay.innerText = formatTime(secondsElapsed);

        // Update sync visual every minute
        if (secondsElapsed % 60 === 0) {
            updateLastSync();
        }
    }, 1000);
    updateStatus('ACTIVE');
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    sessionStartTime = null;
    updateStatus('OFFLINE');
}

function startBreakTimer(durationLimit) {
    if (breakTimerInterval) clearInterval(breakTimerInterval);
    breakStartTime = Date.now();
    breakSecondsElapsed = 0;
    breakDurationLimit = durationLimit;

    updateStatus('BREAK');
    timerDisplay.innerText = durationLimit ? formatTime(durationLimit) : "00:00:00";

    // Change color if limit exists
    if (durationLimit) {
        timerDisplay.style.color = 'var(--warning)';
    }

    breakTimerInterval = setInterval(() => {
        const now = Date.now();
        breakSecondsElapsed = Math.floor((now - breakStartTime) / 1000);

        if (breakDurationLimit) {
            // Count DOWN
            const remaining = breakDurationLimit - breakSecondsElapsed;
            if (remaining <= 0) {
                timerDisplay.innerText = "00:00:00";
                timerDisplay.style.color = 'var(--error)';

                // Notify user ONCE when limits are reached
                if (remaining === 0) {
                    new Notification("Break Time Over", {
                        body: "You have exceeded your break limit. Please resume work immediately.",
                        icon: "../assets/icon.png" // Optional
                    });
                    // Also flash the window if possible (requires main process IPC, skipping for now as Notification is standard)
                }
            } else {
                timerDisplay.innerText = formatTime(remaining);
            }
        } else {
            // Count UP
            timerDisplay.innerText = formatTime(breakSecondsElapsed);
        }
    }, 1000);
}

function stopBreakTimer() {
    if (breakTimerInterval) {
        clearInterval(breakTimerInterval);
        breakTimerInterval = null;
    }
    breakStartTime = null;
    breakDurationLimit = null;
    timerDisplay.style.color = 'var(--text-main)';
}

function showTracking(user) {
    loginView.style.display = 'none';
    trackingView.style.display = 'flex';
    roleBadge.innerText = user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Standard User';
    updateLastSync();

    // Load breaks
    fetchAndPopulateBreaks();

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
    const breakName = breakTypeSelect.value;
    if (!breakName) return; // Prevent if nothing selected

    ipcRenderer.send('pause-tracking', breakName);
    activeActions.style.display = 'none';
    breakActions.style.display = 'flex';
    currentBreakTypeSpan.innerText = breakName;

    // Stop work timer
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    sessionStartTime = null; // We'll reset this? No, we need to preserve total work time. 
    // Actually, timer logic here is strictly visual for the current session. 
    // For simplicity, we just stop it. `startTimer` resumes from `secondsElapsed`.
    // Wait, `startTimer` logic:
    // `sessionStartTime = Date.now() - (secondsElapsed * 1000);`
    // This preserves the elapsed time. Correct.

    // Start Break Timer
    const breakDef = breakDefinitions[breakName];
    // Use remaining_seconds if available, otherwise fall back to max_duration_seconds
    let durationLimit = breakDef ? (breakDef.remaining_seconds !== undefined && breakDef.remaining_seconds !== null ? breakDef.remaining_seconds : breakDef.max_duration_seconds) : null;

    // Ensure we don't start with negative time if calculation was slightly off or user overstayed previous break
    if (durationLimit !== null && durationLimit < 0) durationLimit = 0;

    startBreakTimer(durationLimit);
});

resumeBtn.addEventListener('click', () => {
    ipcRenderer.send('resume-tracking');
    breakActions.style.display = 'none';
    activeActions.style.display = 'flex';

    stopBreakTimer();
    startTimer();
    updateLastSync();
});

logoutBtn.addEventListener('click', () => {
    ipcRenderer.send('logout');
    stopTimer();
    stopBreakTimer();
});

// Auto-login listener
ipcRenderer.on('auto-login-success', (event, { user, token }) => {
    showTracking(user);
});
