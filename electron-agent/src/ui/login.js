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

// Custom Dropdowns
const campaignTrigger = document.getElementById('campaignTrigger');
const campaignMenu = document.getElementById('campaignMenu');
const campaignList = document.getElementById('campaignList');
const selectedCampaignText = document.getElementById('selectedCampaignText');

const breakTrigger = document.getElementById('breakTrigger');
const breakMenu = document.getElementById('breakMenu');
const breakList = document.getElementById('breakList');
const selectedBreakText = document.getElementById('selectedBreakText');

const currentBreakTypeSpan = document.getElementById('currentBreakType');
const campaignSection = document.getElementById('campaignSection');
const campaignBadge = document.getElementById('campaignBadge');

let timerInterval = null;
let secondsElapsed = 0;
let sessionStartTime = null;
let isTracking = false;
let selectedCampaignId = null;
let hasCampaigns = false;

// Break Timer Variables
let breakTimerInterval = null;
let breakSecondsElapsed = 0;
let breakDurationLimit = null; // in seconds, null if no limit
let breakStartTime = null;

// Store break definitions (id -> { name, max_duration_seconds, is_paid })
let breakDefinitions = {};

// Notification States (ensure we don't spam the user)
let shiftLimitNotified = false;
let breakWarningNotified = false;
let breakLimitNotified = false;
let idleAlertNotified = false;

function showOSNotification(title, body) {
    if (ipcRenderer) {
        ipcRenderer.send('show-notification', { title, body });
    }
}

function toggleDropdown(menu) {
    const isHidden = menu.classList.contains('hidden');
    closeAllDropdowns();
    if (isHidden) {
        menu.classList.remove('hidden');
        menu.classList.add('flex');
    }
}

function closeAllDropdowns() {
    [campaignMenu, breakMenu].forEach(m => {
        m.classList.add('hidden');
        m.classList.remove('flex');
    });
}

function formatTime(s) {
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${h}:${m}:${sec}`;
}

async function fetchAndPopulateBreaks() {
    try {
        const breaks = await ipcRenderer.invoke('get-breaks');
        breakList.innerHTML = '';
        breakDefinitions = {};

        const renderItem = (b) => {
            const li = document.createElement('li');
            li.className = 'dropdown-item';
            li.innerHTML = `<i data-lucide="coffee" class="w-3 h-3 text-amber-500/60"></i> ${b.name}`;
            li.onclick = () => {
                selectedBreakName = b.name;
                selectedBreakText.innerText = b.name;
                selectedBreakText.classList.remove('text-slate-400');
                selectedBreakText.classList.add('text-slate-900');
                closeAllDropdowns();
                
                // Highlight selection
                Array.from(breakList.children).forEach(child => child.classList.remove('selected'));
                li.classList.add('selected');
            };
            breakList.appendChild(li);
            breakDefinitions[b.name] = b;
        };

        if (breaks && breaks.length > 0) {
            breaks.forEach(renderItem);
        } else {
            const defaults = ['Lunch Break', 'Tea Break', 'Meeting', 'Personal'];
            defaults.forEach(name => renderItem({ name, max_duration_seconds: null }));
        }
        
        if (window.lucide) window.lucide.refresh();
    } catch (e) {
        console.error('Failed to load breaks:', e);
    }
}

async function fetchAndPopulateCampaigns() {
    try {
        const campaigns = await ipcRenderer.invoke('get-campaigns');
        campaignList.innerHTML = '';
        if (campaigns && campaigns.length > 0) {
            hasCampaigns = true;
            campaigns.forEach(c => {
                const li = document.createElement('li');
                li.className = 'dropdown-item';
                li.innerHTML = `<i data-lucide="megaphone" class="w-3 h-3 text-primary/60"></i> ${c.name}`;
                li.onclick = () => {
                    selectedCampaignId = c.id;
                    selectedCampaignText.innerText = c.name;
                    selectedCampaignText.classList.remove('text-slate-400');
                    selectedCampaignText.classList.add('text-slate-900');
                    closeAllDropdowns();
                    
                    // Highlight
                    Array.from(campaignList.children).forEach(child => child.classList.remove('selected'));
                    li.classList.add('selected');
                };
                campaignList.appendChild(li);
            });
            campaignSection.classList.remove('hidden');
            campaignSection.classList.add('flex');
            if (window.lucide) window.lucide.refresh();
        } else {
            hasCampaigns = false;
            campaignSection.classList.add('hidden');
            campaignSection.classList.remove('flex');
        }
    } catch (e) {
        console.error('Failed to load campaigns:', e);
        hasCampaigns = false;
    }
}

function updateStatus(status) {
    // Reset classes while keeping common base classes
    statusBadge.className = 'inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-slate-200 transition-all duration-500';
    const dot = statusBadge.querySelector('.status-dot');
    dot.className = 'status-dot w-2 h-2 rounded-full status-pulse'; // Reset dot classes
    
    if (status === 'ACTIVE') {
        statusBadge.classList.add('bg-emerald-500/10', 'border-emerald-500/20', 'text-emerald-600');
        dot.classList.add('bg-emerald-500');
        statusText.innerText = 'Shift Active';
        timerDisplay.classList.add('tracking-pulse');
        timerDisplay.classList.add('text-slate-900');
        idleAlertNotified = false; // Reset when active
    } else if (status === 'BREAK' || status === 'AFK') {
        const isAFK = status === 'AFK';
        statusBadge.classList.add('bg-amber-500/10', 'border-amber-500/20', 'text-amber-600');
        dot.classList.add('bg-amber-500');
        statusText.innerText = isAFK ? 'Idle / AFK' : 'On Break';
        timerDisplay.classList.remove('tracking-pulse');
        timerDisplay.classList.add('text-amber-600');

        if (isAFK && !idleAlertNotified) {
            idleAlertNotified = true;
            showOSNotification("Inactivity Detected", "You appear to be idle. Would you like to start a break or resume work?");
        }
    } else {
        statusBadge.classList.add('bg-red-500/10', 'border-red-500/20', 'text-red-500');
        dot.classList.add('bg-red-500');
        statusText.innerText = 'Offline';
        timerDisplay.classList.remove('tracking-pulse');
        timerDisplay.classList.remove('text-amber-600');
        timerDisplay.classList.add('text-slate-900');
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

        // Shift Threshold Notification (e.g., 8 hours)
        if (secondsElapsed >= 28800 && !shiftLimitNotified) {
            shiftLimitNotified = true;
            showOSNotification("Shift Duration Alert", "You have been on shift for 8 hours. Please consider taking a break or ending your shift.");
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
    shiftLimitNotified = false; // Reset for next session
    updateStatus('OFFLINE');
}

function startBreakTimer(durationLimit) {
    if (breakTimerInterval) clearInterval(breakTimerInterval);
    breakStartTime = Date.now();
    breakSecondsElapsed = 0;
    breakDurationLimit = durationLimit;

    updateStatus('BREAK');
    timerDisplay.innerText = durationLimit !== null ? formatTime(durationLimit) : "00:00:00";

    // Change color if limit exists
    if (durationLimit !== null) {
        timerDisplay.style.color = 'var(--warning)';
    }

    breakTimerInterval = setInterval(() => {
        const now = Date.now();
        breakSecondsElapsed = Math.floor((now - breakStartTime) / 1000);

        if (breakDurationLimit !== null) {
            // Count DOWN logic
            const remaining = breakDurationLimit - breakSecondsElapsed;

            if (remaining <= 0) {
                // Time Exceeded
                const exceededBy = Math.abs(remaining);
                timerDisplay.innerText = `-${formatTime(exceededBy)}`;
                timerDisplay.style.color = '#ef4444'; // Red-500

                // Notify OS when limits are reached
                if (!breakLimitNotified) {
                    breakLimitNotified = true;
                    showOSNotification("Break Time Over", "You have exceeded your break limit. Please resume work immediately.");
                }
            } else {
                // Normal Countdown
                timerDisplay.innerText = formatTime(remaining);

                // 1-minute warning
                if (remaining <= 60 && !breakWarningNotified) {
                    breakWarningNotified = true;
                    showOSNotification("Break Ending Soon", "Your break will end in less than 1 minute.");
                }
            }
        } else {
            // Count UP (No limit)
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
    breakWarningNotified = false; // Reset for next break
    breakLimitNotified = false;
    timerDisplay.style.color = ''; // Let classes handle it
}

function showTracking(user) {
    loginView.classList.add('hidden');
    trackingView.classList.remove('hidden');
    trackingView.classList.add('flex');
    logoutBtn.classList.remove('hidden');
    
    roleBadge.innerText = user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Standard User';
    updateLastSync();

    // Load breaks and campaigns
    fetchAndPopulateBreaks();
    fetchAndPopulateCampaigns();

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
        errorMsg.classList.remove('hidden');
        submitBtn.innerHTML = originalContent;
        if (window.lucide) window.lucide.createIcons();
    } finally {
        submitBtn.disabled = false;
    }
});

startShiftBtn.addEventListener('click', () => {
    // Check selection
    if (hasCampaigns && !selectedCampaignId) {
        campaignTrigger.classList.add('ring-2', 'ring-red-500/50');
        campaignTrigger.focus();
        return;
    }
    campaignTrigger.classList.remove('ring-2', 'ring-red-500/50');

    // Show the active campaign as a badge
    if (selectedCampaignId) {
        campaignBadge.innerHTML = `<i data-lucide="megaphone" class="w-3 h-3"></i> <span>${selectedCampaignText.innerText}</span>`;
        campaignBadge.className = 'badge-pill'; // Correctly apply the new pill class
        if (window.lucide) window.lucide.createIcons();
    }

    isTracking = true;
    ipcRenderer.send('start-tracking', { campaignId: selectedCampaignId });
    startActions.classList.add('hidden');
    activeActions.classList.remove('hidden');
    activeActions.classList.add('flex');
    
    // Hide overflow during shift
    document.querySelector('main').classList.add('overflow-hidden');
    document.querySelector('main').classList.remove('overflow-y-auto');

    startTimer();
    updateLastSync();
});

endShiftBtn.addEventListener('click', async () => {
    const confirmed = await ipcRenderer.invoke('show-confirm-dialog', {
        title: 'End Shift',
        message: 'Are you sure you want to end the shift?'
    });
    if (!confirmed) return;

    isTracking = false;
    ipcRenderer.send('end-shift');
    activeActions.classList.add('hidden');
    activeActions.classList.remove('flex');
    startActions.classList.remove('hidden');
    startActions.classList.add('flex');

    // Restore overflow
    document.querySelector('main').classList.add('overflow-y-auto');
    document.querySelector('main').classList.remove('overflow-hidden');

    stopTimer();
    secondsElapsed = 0;
    timerDisplay.innerText = "00:00:00";
    
    // Hide campaign badge on shift end
    campaignBadge.innerHTML = '';
    campaignBadge.className = 'hidden';
    
    updateLastSync();
});

breakBtn.addEventListener('click', () => {
    const breakName = selectedBreakName;
    if (!breakName) {
        breakTrigger.classList.add('ring-2', 'ring-amber-500/50');
        return;
    }
    breakTrigger.classList.remove('ring-2', 'ring-amber-500/50');

    ipcRenderer.send('pause-tracking', breakName);
    activeActions.classList.add('hidden');
    activeActions.classList.remove('flex');
    breakActions.classList.remove('hidden');
    breakActions.classList.add('flex');
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
    breakActions.classList.add('hidden');
    breakActions.classList.remove('flex');
    activeActions.classList.remove('hidden');
    activeActions.classList.add('flex');

    stopBreakTimer();
    startTimer();
    updateLastSync();
});

logoutBtn.addEventListener('click', () => {
    console.log('[UI] Logout button clicked.');
    ipcRenderer.send('logout');
    stopTimer();
    stopBreakTimer();
});

// Auto-login listener
ipcRenderer.on('auto-login-success', (event, { user, token }) => {
    showTracking(user);
});

// Dropdown Triggers
if (campaignTrigger) {
    campaignTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown(campaignMenu);
    });
}

if (breakTrigger) {
    breakTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown(breakMenu);
    });
}

// Global Click-Outside
window.addEventListener('click', () => {
    closeAllDropdowns();
});
