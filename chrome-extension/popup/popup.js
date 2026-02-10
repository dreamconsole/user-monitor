document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') lucide.createIcons();

    const loginView = document.getElementById('login-view');
    const statusView = document.getElementById('status-view');

    // Auth Elements
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('login-error');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userInfo = document.getElementById('user-info');

    // View Sections
    const startActions = document.getElementById('start-actions');
    const activeActions = document.getElementById('active-actions');
    const breakActions = document.getElementById('break-actions');

    // Controls
    const startShiftBtn = document.getElementById('start-shift-btn');
    const endShiftBtn = document.getElementById('end-shift-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const resumeBtn = document.getElementById('resume-btn');
    const breakTypeSelect = document.getElementById('break-type');

    // Status Elements
    const timerDisplay = document.getElementById('timer-display');
    const statusText = document.getElementById('status-text');
    const statusDot = document.getElementById('status-dot');
    const statusBadge = document.getElementById('status-badge');
    const lastSyncText = document.getElementById('last-sync-text');
    const currentBreakTypeText = document.getElementById('current-break-type');

    let timerInterval = null;

    // Load initial state
    chrome.storage.local.get(['token', 'user', 'monitorState'], (result) => {
        if (result.token && result.user) {
            showStatusView(result.user, result.monitorState);
        } else {
            showLoginView();
        }
    });

    // Listen for storage changes (updates from background)
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.monitorState) {
            updateStatusUI(changes.monitorState.newValue);
        }
    });

    // Login Handler
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput.value;
        const password = passwordInput.value;
        loginError.textContent = '';
        loginError.style.display = 'none';

        loginBtn.disabled = true;
        loginBtn.textContent = 'Authenticating...';

        try {
            const response = await fetch(`${CONFIG.API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Login failed');

            chrome.storage.local.set({ token: data.token, user: data.user }, () => {
                chrome.runtime.sendMessage({ type: 'LOGIN_SUCCESS', user: data.user, token: data.token });
                showStatusView(data.user);
            });
        } catch (error) {
            loginError.textContent = error.message;
            loginError.style.display = 'block';
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Login';
        }
    });

    // Logout Handler
    logoutBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'LOGOUT' }, () => {
            showLoginView();
        });
    });

    // Control Handlers
    startShiftBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'START_SHIFT' });
    });

    endShiftBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to end your shift?')) {
            chrome.runtime.sendMessage({ type: 'END_SHIFT' });
        }
    });

    pauseBtn.addEventListener('click', () => {
        const breakType = breakTypeSelect.value;
        chrome.runtime.sendMessage({ type: 'PAUSE_TRACKING', breakType });
    });

    resumeBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'RESUME_TRACKING' });
    });

    function showLoginView() {
        loginView.classList.remove('hidden');
        statusView.classList.add('hidden');
        loginError.style.display = 'none';
        if (timerInterval) clearInterval(timerInterval);
    }

    function showStatusView(user, monitorState) {
        loginView.classList.add('hidden');
        statusView.classList.remove('hidden');
        userInfo.textContent = `User: ${user.email}`;
        updateStatusUI(monitorState);
    }

    function updateStatusUI(state) {
        if (!state || !state.isTracking) {
            startActions.classList.remove('hidden');
            activeActions.classList.add('hidden');
            breakActions.classList.add('hidden');
            timerDisplay.textContent = '00:00:00';
            statusBadge.className = 'status-badge status-offline';
            statusText.textContent = 'Offline';
            if (timerInterval) clearInterval(timerInterval);
            return;
        }

        startActions.classList.add('hidden');

        if (state.currentState === 'BREAK') {
            activeActions.classList.add('hidden');
            breakActions.classList.remove('hidden');
            currentBreakTypeText.textContent = state.breakType || 'General Break';
            statusBadge.className = 'status-badge status-break';
            statusText.textContent = 'On Break';
        } else {
            activeActions.classList.remove('hidden');
            breakActions.classList.add('hidden');
            const isIdle = state.currentState === 'IDLE';
            statusBadge.className = isIdle ? 'status-badge status-idle' : 'status-badge status-active';
            statusText.textContent = isIdle ? 'Idle' : 'Active';
        }

        // Timer Logic
        if (timerInterval) clearInterval(timerInterval);
        refreshTimer(state);
        timerInterval = setInterval(() => refreshTimer(state), 1000);
    }

    function refreshTimer(state) {
        if (!state || !state.sessionId) return;
        const now = Date.now();
        let elapsed = state.totalWorkSeconds;

        if (state.currentState === 'ACTIVE') {
            elapsed += Math.floor((now - state.lastCheckTime) / 1000);
        } else if (state.currentState === 'IDLE') {
            // Idle time isn't "work time" usually, but let's match Electron's display
            // Electron display usually shows "Active Session Time" which is total shift time minus breaks?
            // Let's show total shift time (Work + Idle)
            elapsed += Math.floor((now - state.lastCheckTime) / 1000) + state.totalIdleSeconds;
        } else if (state.currentState === 'BREAK') {
            elapsed += state.totalIdleSeconds; // Just work + past idle
        } else {
            elapsed += state.totalIdleSeconds;
        }

        timerDisplay.textContent = formatTime(elapsed);
    }

    function formatTime(seconds) {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return [hrs, mins, secs].map(v => v.toString().padStart(2, '0')).join(':');
    }
});
