"use strict";

// ─────────────────────────────────────────
// SOUND SYSTEM — Student Panel
// ─────────────────────────────────────────
const SFX = (() => {
    let ctx = null;
    function getCtx() {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        return ctx;
    }
    function resume() {
        const c = getCtx();
        if (c.state === 'suspended') c.resume();
        return c;
    }
    function note(freq, type, startTime, duration, gainVal, ac) {
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.connect(g); g.connect(ac.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);
        g.gain.setValueAtTime(gainVal, startTime);
        g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.start(startTime);
        osc.stop(startTime + duration + 0.01);
    }

    const sounds = {
        // 1. Splash welcome — warm student greeting melody
        welcome() {
            const ac = resume();
            const t = ac.currentTime;
            note(392, 'sine', t, 0.2, 0.15, ac);
            note(523, 'sine', t + 0.15, 0.2, 0.17, ac);
            note(659, 'sine', t + 0.30, 0.2, 0.17, ac);
            note(784, 'sine', t + 0.45, 0.4, 0.2, ac);
        },
        // 2. Register / create profile — satisfying confirm pop
        register() {
            const ac = resume();
            const t = ac.currentTime;
            note(600, 'sine', t, 0.1, 0.15, ac);
            note(900, 'sine', t + 0.08, 0.15, 0.15, ac);
            note(1200, 'sine', t + 0.18, 0.25, 0.18, ac);
        },
        // 3. Subject card select — soft tap click
        cardTap() {
            const ac = resume();
            const t = ac.currentTime;
            note(750, 'sine', t, 0.07, 0.11, ac);
            note(950, 'sine', t + 0.04, 0.1, 0.09, ac);
        },
        // 4. Sheet slide up — upward swoosh
        sheetOpen() {
            const ac = resume();
            const t = ac.currentTime;
            const osc = ac.createOscillator();
            const g = ac.createGain();
            osc.connect(g); g.connect(ac.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(250, t);
            osc.frequency.exponentialRampToValueAtTime(700, t + 0.2);
            g.gain.setValueAtTime(0.12, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
            osc.start(t); osc.stop(t + 0.25);
        },
        // 5. Sheet close / cancel — gentle down swipe
        sheetClose() {
            const ac = resume();
            const t = ac.currentTime;
            const osc = ac.createOscillator();
            const g = ac.createGain();
            osc.connect(g); g.connect(ac.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(480, t);
            osc.frequency.exponentialRampToValueAtTime(200, t + 0.18);
            g.gain.setValueAtTime(0.09, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
            osc.start(t); osc.stop(t + 0.22);
        },
        // 6. Submit attendance — determined send sound
        submit() {
            const ac = resume();
            const t = ac.currentTime;
            note(500, 'sine', t, 0.1, 0.14, ac);
            note(700, 'sine', t + 0.08, 0.12, 0.14, ac);
            note(900, 'sine', t + 0.18, 0.2, 0.15, ac);
        },
        // 7. Attendance success — mini celebration jingle
        success() {
            const ac = resume();
            const t = ac.currentTime;
            note(523, 'sine', t, 0.15, 0.18, ac);
            note(659, 'sine', t + 0.12, 0.15, 0.18, ac);
            note(784, 'sine', t + 0.24, 0.15, 0.18, ac);
            note(1047, 'sine', t + 0.36, 0.5, 0.22, ac);
            // Sparkle
            note(1319, 'sine', t + 0.55, 0.3, 0.12, ac);
        },
        // 8. Error (wrong code etc.) — gentle descending buzz
        error() {
            const ac = resume();
            const t = ac.currentTime;
            note(350, 'sawtooth', t, 0.1, 0.1, ac);
            note(280, 'sawtooth', t + 0.1, 0.15, 0.1, ac);
        },
        // 9. No internet — harsh warning buzz
        noInternet() {
            const ac = resume();
            const t = ac.currentTime;
            note(200, 'sawtooth', t, 0.12, 0.18, ac);
            note(160, 'sawtooth', t + 0.13, 0.12, 0.18, ac);
            note(120, 'sawtooth', t + 0.26, 0.2, 0.2, ac);
        },
    };
    return sounds;
})();

/**
 * AttendX — Student Panel
 * TypeScript Source (app.ts)
 *
 * Compile with:
 *   tsc app.ts --target ES2020 --strict --outFile app.js
 *
 * Architecture:
 *  - Registration stored in localStorage only (no server)
 *  - Attendance submitted to Google Apps Script
 *  - Time restriction: 9:55 AM – 4:00 PM
 *  - Duplicate prevention: Roll No + Subject + Date checked server-side
 */
// ─────────────────────────────────────────
// CONFIG  ← Replace with your deployed URL
// ─────────────────────────────────────────
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw1tRQ139zqN1Zpdm43WK4P32KCDxV5EWQ9kgA1CRa9T_aLrtNzy_4cdgr63MFS9dt4kg/exec';
// Attendance window: 09:55 – 16:00 (24h)
const WINDOW_START_H = 9, WINDOW_START_M = 55;
const WINDOW_END_H = 16, WINDOW_END_M = 0;
// localStorage keys
const LS_STUDENT_KEY = 'attendx_student';
// ─────────────────────────────────────────
// SUBJECTS  (matches teacher panel exactly)
// ─────────────────────────────────────────
const SUBJECTS = [
    { id: 'dhtml_lab', name: 'DHTML (Lab)', shortName: 'DHTML', isLab: true, prefix: 'DH', suffix: 'LB' },
    { id: 'ds_lab', name: 'DS (Lab)', shortName: 'DS', isLab: true, prefix: 'DS', suffix: 'LB' },
    { id: 'mysql_lab', name: 'MySQL (Lab)', shortName: 'MySQL', isLab: true, prefix: 'MY', suffix: 'LB' },
    { id: 'wp_lab', name: 'WordPress (Lab)', shortName: 'WP', isLab: true, prefix: 'WP', suffix: 'LB' },
    { id: 'dhtml', name: 'DHTML', shortName: 'DHTML', isLab: false, prefix: 'DH', suffix: 'TH' },
    { id: 'ds', name: 'DS', shortName: 'DS', isLab: false, prefix: 'DS', suffix: 'TH' },
    { id: 'mysql', name: 'MySQL', shortName: 'MySQL', isLab: false, prefix: 'MY', suffix: 'TH' },
    { id: 'wordpress', name: 'WordPress', shortName: 'WP', isLab: false, prefix: 'WP', suffix: 'TH' },
];
// ─────────────────────────────────────────
// STATE
// ─────────────────────────────────────────
let student = null;
let activeSubject = null;
let activeLectureCode = '';      // ← sheet se fetch hoga
let lectureCreatedTime = '';     // code ki created time (expiry check ke liye)
let isOnlineMode = false;        // secret online student mode (10s hold se activate)
// Code expiry: 2 minutes = 120,000 ms
const CODE_EXPIRY_MS = 1 * 60 * 1000; // 1 minute expiry
// ─────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────
/** Returns today as YYYY-MM-DD in local timezone (IST safe) */
function getTodayISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
/** Check if attendance already marked locally for this subject today */
function isAlreadyMarkedLocally(subjectName) {
    const key = `attendx_marked_${getTodayISO()}_${subjectName}`;
    return localStorage.getItem(key) === 'true';
}
/** Save attendance marked flag in localStorage for this subject today */
function saveMarkedLocally(subjectName) {
    const key = `attendx_marked_${getTodayISO()}_${subjectName}`;
    localStorage.setItem(key, 'true');
}
function formatDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-IN', {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    });
}
/** HH:MM AM/PM */
function getCurrentTime() {
    return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
/**
 * Check if current time is within the attendance window.
 * Window: 09:55 – 16:00
 */
function isAttendanceOpen() {
    const now = new Date();
    const hour = now.getHours();
    const min = now.getMinutes();
    const totalMin = hour * 60 + min;
    const startMin = WINDOW_START_H * 60 + WINDOW_START_M;
    const endMin = WINDOW_END_H * 60 + WINDOW_END_M;
    return totalMin >= startMin && totalMin <= endMin;
}
// ─────────────────────────────────────────
// DOM HELPER
// ─────────────────────────────────────────
function $(id) {
    return document.getElementById(id);
}
let toastTimer = null;
function showToast(msg, type = 'default', duration = 3200) {
    const toast = $('toast');
    toast.className = 'toast';
    if (type !== 'default')
        toast.classList.add(type);
    toast.textContent = msg;
    toast.getBoundingClientRect(); // force reflow
    toast.classList.add('visible');
    if (toastTimer)
        clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), duration);
}
// ─────────────────────────────────────────
// BOTTOM SHEET
// ─────────────────────────────────────────
function openSheet() {
    SFX.sheetOpen();
    const overlay = $('sheetOverlay');
    const sheet = $('attendSheet');
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => {
        overlay.classList.add('visible');
        sheet.classList.add('open');
    });
    document.body.style.overflow = 'hidden';
}
function closeSheet() {
    SFX.sheetClose();
    const overlay = $('sheetOverlay');
    const sheet = $('attendSheet');
    overlay.classList.remove('visible');
    sheet.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => overlay.classList.add('hidden'), 300);
}
/** Swipe-down to dismiss bottom sheet */
function setupSwipeToClose() {
    const sheet = $('attendSheet');
    let startY = 0, delta = 0;
    sheet.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
        delta = 0;
    }, { passive: true });
    sheet.addEventListener('touchmove', (e) => {
        delta = e.touches[0].clientY - startY;
        if (delta > 0) {
            sheet.style.transform = `translateX(-50%) translateY(${delta}px)`;
        }
    }, { passive: true });
    sheet.addEventListener('touchend', () => {
        if (delta > 110) {
            sheet.style.transform = '';
            closeSheet();
        }
        else {
            sheet.style.transform = '';
        }
    });
}
// ─────────────────────────────────────────
// COLLEGE SYSTEM
// ─────────────────────────────────────────
const COLLEGE_LIST = [
    'MIT — Massachusetts Institute of Technology',
    'Stanford University',
    'Harvard University',
    'University of Oxford',
    'ETH Zurich — Swiss Federal Institute of Technology',
];
const SECRET_COLLEGE_CODE = 'NGCCA';
let selectedCollege = ''; // '' = nothing selected yet

function initCollegeDropdown() {
    const searchBtn = $('collegeSearchBtn');
    const displayInput = $('collegeDisplay');
    const dropdown = $('collegeDropdown');
    const searchInput = $('collegeSearchInput');

    function openDropdown() {
        dropdown.classList.remove('hidden');
        searchInput.value = '';
        renderCollegeList('');
        setTimeout(() => searchInput.focus(), 80);
    }

    function closeDropdown() {
        dropdown.classList.add('hidden');
    }

    // Open on button click or display input click
    searchBtn.addEventListener('click', (e) => { e.stopPropagation(); openDropdown(); });
    displayInput.addEventListener('click', () => openDropdown());

    // Live search filter
    searchInput.addEventListener('input', () => {
        renderCollegeList(searchInput.value.trim());
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!$('collegeFieldGroup').contains(e.target) && !dropdown.contains(e.target)) {
            closeDropdown();
        }
    });
}

function renderCollegeList(query) {
    const list = $('collegeList');
    list.innerHTML = '';

    const q = query.toUpperCase().trim();

    // Check if query is the secret code — show not found but save silently
    if (q === SECRET_COLLEGE_CODE) {
        // Save secret college silently — show not found msg
        selectedCollege = SECRET_COLLEGE_CODE;
        list.innerHTML = `<div class="college-not-found">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <span>Not Found</span>
        </div>`;
        // Auto-set display as empty (don't reveal)
        $('collegeDisplay').value = '';
        return;
    }

    // Filter from visible list
    const filtered = q === ''
        ? COLLEGE_LIST
        : COLLEGE_LIST.filter(c => c.toUpperCase().includes(q));

    if (filtered.length === 0) {
        list.innerHTML = `<div class="college-not-found">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <span>Not Found</span>
        </div>`;
        return;
    }

    filtered.forEach(college => {
        const item = document.createElement('div');
        item.className = 'college-item';
        item.textContent = college;
        item.addEventListener('click', () => {
            selectedCollege = college;
            $('collegeDisplay').value = college;
            $('collegeDropdown').classList.add('hidden');
            // Remove any existing error box
            const old = document.getElementById('collegeErrorBox');
            if (old) old.remove();
        });
        list.appendChild(item);
    });
}

function showCollegeError(msg) {
    const old = document.getElementById('collegeErrorBox');
    if (old) old.remove();

    const box = document.createElement('div');
    box.id = 'collegeErrorBox';
    box.style.cssText = `
        margin: 10px 0 4px 0;
        padding: 13px 16px;
        background: rgba(220,38,38,0.18);
        border: 1.5px solid #dc2626;
        border-radius: 12px;
        text-align: center;
        font-family: 'DM Sans', sans-serif;
        font-size: 13px; font-weight: 600;
        color: #fca5a5;
        opacity: 0; transform: translateY(-6px);
        transition: opacity 0.25s ease, transform 0.25s ease;
    `;
    box.textContent = msg;

    const collegeGroup = $('collegeFieldGroup');
    // Insert after dropdown or after the group
    const dropdown = $('collegeDropdown');
    dropdown.insertAdjacentElement('afterend', box);

    requestAnimationFrame(() => {
        box.style.opacity = '1';
        box.style.transform = 'translateY(0)';
    });
    setTimeout(() => {
        box.style.opacity = '0';
        box.style.transform = 'translateY(-6px)';
        setTimeout(() => box.remove(), 300);
    }, 4000);
}

// ─────────────────────────────────────────
// REGISTRATION
// ─────────────────────────────────────────
function loadStudent() {
    try {
        const raw = localStorage.getItem(LS_STUDENT_KEY);
        return raw ? JSON.parse(raw) : null;
    }
    catch {
        return null;
    }
}
function saveStudent(profile) {
    localStorage.setItem(LS_STUDENT_KEY, JSON.stringify(profile));
}
async function handleRegister() {
    const nameInput = $('inputName');
    const rollInput = $('inputRoll');
    const fullName = nameInput.value.trim();
    const rollNo = rollInput.value.trim().toUpperCase();
    if (!fullName) {
        SFX.error();
        showToast('Please enter your full name', 'error');
        nameInput.focus();
        return;
    }
    if (!rollNo) {
        SFX.error();
        showToast('Please enter your roll number', 'error');
        rollInput.focus();
        return;
    }
    if (rollNo.length < 4) {
        SFX.error();
        showToast('Roll number seems too short', 'error');
        rollInput.focus();
        return;
    }

    // ── College validation ──
    if (!selectedCollege) {
        SFX.error();
        showCollegeError('Please select your college');
        return;
    }
    // Agar secret code nahi hai aur koi visible college select kiya → block
    if (selectedCollege !== SECRET_COLLEGE_CODE) {
        SFX.error();
        showCollegeError('Tum is college ke nahi ho 😏');
        return;
    }
    // Secret college selected — proceed normally
    // Roll No. range check: sirf 1001–1142 allowed
    const rollNum = parseInt(rollNo, 10);
    if (isNaN(rollNum) || rollNum < 1001 || rollNum > 1142) {
        SFX.error();
        showDontBeSmartReg();
        return;
    }

    // ── Show checking animation ──
    showRollCheckOverlay(true);

    let checkPassed = false;
    try {
        const url = new URL(APPS_SCRIPT_URL);
        url.searchParams.set('action', 'checkRollStatus');
        url.searchParams.set('rollNo', rollNo);
        const res = await fetch(url.toString());
        const data = await res.json();

        showRollCheckOverlay(false);

        if (data.active === true) {
            // Roll No already active → block registration
            SFX.error();
            showDontBeSmartReg();
            return;
        }

        // active nahi hai (blank ya kuch bhi) → allow karo
        checkPassed = true;

    } catch (err) {
        // Network error → registration block karo, retry karne bolo
        showRollCheckOverlay(false);
        SFX.error();
        showToast('⚠ Internet error. Check your connection and try again.', 'error', 4000);
        return;
    }

    if (!checkPassed) return;

    // ── All good → register immediately, activate in background ──
    showRollCheckOverlay(false);

    // Fire-and-forget — await nahi karna, no delay
    const activateUrl = new URL(APPS_SCRIPT_URL);
    activateUrl.searchParams.set('action', 'activateRoll');
    activateUrl.searchParams.set('rollNo', rollNo);
    fetch(activateUrl.toString()).catch(() => {});

    SFX.register();
    const profile = { fullName, rollNo, college: SECRET_COLLEGE_CODE };
    saveStudent(profile);
    student = profile;

    showToast(`Welcome, ${fullName}! 👋`, 'success');
    setTimeout(() => switchToDashboard(), 500);
}

/** Show/hide the "Checking…" overlay animation during roll no. verification */
function showRollCheckOverlay(show) {
    let overlay = document.getElementById('rollCheckOverlay');
    if (show) {
        if (overlay) return;
        overlay = document.createElement('div');
        overlay.id = 'rollCheckOverlay';
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 9999;
            background: rgba(10,10,20,0.75);
            backdrop-filter: blur(8px);
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            gap: 16px;
            opacity: 0; transition: opacity 0.2s ease;
        `;
        overlay.innerHTML = `
            <div style="
                width: 56px; height: 56px;
                border: 3px solid rgba(124,58,237,0.2);
                border-top-color: #7C3AED;
                border-radius: 50%;
                animation: spin 0.7s linear infinite;
            "></div>
            <p style="
                font-family: 'DM Sans', sans-serif;
                color: rgba(255,255,255,0.85);
                font-size: 15px; font-weight: 500;
                letter-spacing: 0.3px;
            ">Verifying Roll Number…</p>
            <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
        `;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => { overlay.style.opacity = '1'; });
        // Disable register button while checking
        const btn = $('registerBtn');
        if (btn) { btn.disabled = true; }
    } else {
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => overlay && overlay.remove(), 220);
        }
        const btn = $('registerBtn');
        if (btn) { btn.disabled = false; }
    }
}

/** Show red "Don't be smart" error box — invalid or already active roll no. */
function showDontBeSmartReg() {
    const old = document.getElementById('rollExistsError');
    if (old) old.remove();

    const box = document.createElement('div');
    box.id = 'rollExistsError';
    box.style.cssText = `
        margin: 12px 0 4px 0;
        padding: 14px 18px;
        background: rgba(220, 38, 38, 0.5);
        border: 2px solid #dc2626;
        border-radius: 12px;
        text-align: center;
        font-family: 'DM Sans', sans-serif;
        font-size: 14px;
        font-weight: 600;
        color: #fff;
        letter-spacing: 0.2px;
        opacity: 0;
        transform: translateY(-6px);
        transition: opacity 0.25s ease, transform 0.25s ease;
    `;
    box.textContent = "Don't be smart 😏";

    const rollGroup = $('inputRoll').closest('.field-group');
    rollGroup.insertAdjacentElement('afterend', box);

    requestAnimationFrame(() => {
        box.style.opacity = '1';
        box.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
        box.style.opacity = '0';
        box.style.transform = 'translateY(-6px)';
        setTimeout(() => box.remove(), 300);
    }, 5000);
}
// ─────────────────────────────────────────
// VIEWS
// ─────────────────────────────────────────
function showRegistration() {
    $('registrationView').classList.remove('hidden');
    $('dashboardView').classList.add('hidden');
    $('studentBadge').classList.add('hidden');
}
function switchToDashboard() {
    $('registrationView').classList.add('hidden');
    $('dashboardView').classList.remove('hidden');
    if (student) {
        $('studentBadgeName').textContent = student.fullName.split(' ')[0] + ' · ' + student.rollNo;
        $('studentBadge').classList.remove('hidden');
    }
    renderSubjectGrid();
    checkTimeRestriction();
}
// ─────────────────────────────────────────
// TIME RESTRICTION
// ─────────────────────────────────────────
function checkTimeRestriction() {
    const open = isAttendanceOpen();
    const banner = $('closedBanner');
    const grid = $('subjectsGrid');
    if (open) {
        banner.classList.add('hidden');
        // re-enable cards
        grid.querySelectorAll('.subject-card').forEach(c => c.classList.remove('disabled-card'));
    }
    else {
        banner.classList.remove('hidden');
        // disable cards visually
        grid.querySelectorAll('.subject-card').forEach(c => c.classList.add('disabled-card'));
    }
}
// ─────────────────────────────────────────
// SUBJECT GRID
// ─────────────────────────────────────────

/**
 * Online Student Secret Feature:
 * 20 second tak card ko hold karo → Online Mode activate hoga
 * Online mode mein code kabhi expire nahi hoga
 * Yeh feature sirf online students ke liye hai — kisi ko batana nahi!
 */
function setupHoldToActivateOnline(card, subject) {
    let holdTimer = null;
    const HOLD_MS = 30000; // 30 seconds

    function startHold(e) {
        if (isAlreadyMarkedLocally(subject.name)) return;
        if (!isAttendanceOpen()) return;

        holdTimer = setTimeout(() => {
            // Activate online mode — silently, no animation, no visual indicator
            isOnlineMode = true;
            if (navigator.vibrate) navigator.vibrate(80); // subtle single vibrate only
            if (isAlreadyMarkedLocally(subject.name)) {
                showToast(`✅ ${subject.name} ki attendance aaj already fill ho chuki hai!`, 'success', 4000);
                isOnlineMode = false;
                return;
            }
            openAttendanceSheet(subject);
        }, HOLD_MS);
    }

    function cancelHold() {
        if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    }

    // Touch events (mobile)
    card.addEventListener('touchstart', startHold, { passive: true });
    card.addEventListener('touchend', cancelHold);
    card.addEventListener('touchcancel', cancelHold);
    card.addEventListener('touchmove', cancelHold, { passive: true });

    // Mouse events (desktop testing ke liye)
    card.addEventListener('mousedown', startHold);
    card.addEventListener('mouseup', cancelHold);
    card.addEventListener('mouseleave', cancelHold);
}

function renderSubjectGrid() {
    const grid = $('subjectsGrid');
    grid.innerHTML = '';
    SUBJECTS.forEach(subject => {
        const card = document.createElement('div');
        const alreadyMarked = isAlreadyMarkedLocally(subject.name);
        card.className = 'subject-card' + (alreadyMarked ? ' card-filled' : '');
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', `Mark attendance for ${subject.name}`);
        const typeClass = subject.isLab ? 'lab' : 'theory';
        const typeLabel = subject.isLab ? 'Lab' : 'Theory';
        const markedBadge = alreadyMarked
            ? `<div class="card-marked-badge">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Done
               </div>`
            : `<div class="card-arrow">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" stroke-width="2.5"
                  stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
               </div>`;
        card.innerHTML = `
      <div class="card-dot ${typeClass}"></div>
      <div class="card-name">${subject.name.replace(' (Lab)', '')}</div>
      <div class="card-type ${typeClass}">${typeLabel}</div>
      ${markedBadge}
    `;
        card.addEventListener('click', () => onSubjectSelect(subject));
        card.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' || e.key === ' ')
                onSubjectSelect(subject);
        });
        // ── Online Mode: 15-second hold secret feature ──
        setupHoldToActivateOnline(card, subject);
        grid.appendChild(card);
    });
}
// ─────────────────────────────────────────
// SUBJECT SELECTION → opens sheet + checks lecture
// ─────────────────────────────────────────
function onSubjectSelect(subject) {
    if (!isAttendanceOpen()) {
        SFX.error();
        showToast('Attendance closed. Open 9:55 AM – 4:00 PM', 'warning');
        return;
    }
    // ── Internet Check ──
    if (!navigator.onLine) {
        SFX.noInternet();
        showNoInternetMsg();
        return;
    }
    // Local flag check — already marked today?
    if (isAlreadyMarkedLocally(subject.name)) {
        SFX.cardTap();
        showToast(`✅ ${subject.name} ki attendance aaj already fill ho chuki hai!`, 'success', 4000);
        return;
    }
    SFX.cardTap();
    // Reset online mode for normal click — offline student flow
    isOnlineMode = false;
    openAttendanceSheet(subject);
}

function openAttendanceSheet(subject) {
    activeSubject = subject;
    // Populate header
    const badge = $('sheetBadge');
    badge.textContent = subject.isLab ? 'Lab' : 'Theory';
    badge.className = `sheet-badge ${subject.isLab ? 'lab-badge' : 'theory-badge'}`;
    $('sheetSubjectName').textContent = subject.name;
    $('sheetDate').textContent = formatDate(getTodayISO());
    $('sheetTime').textContent = getCurrentTime();
    // Reset steps
    activeLectureCode = '';
    showStep('stepVerify');
    $('verifyLoader').classList.remove('hidden');
    $('verifyError').classList.add('hidden');
    $('fetchedCodeDisplay').textContent = '——';
    $('fetchedCodeTime').textContent = '—';
    $('codeInput').value = '';
    $('codeInput').classList.remove('input-error');
    openSheet();
    checkActiveLecture(subject);
}
function showStep(id) {
    ['stepVerify', 'stepCode', 'stepSuccess'].forEach(s => {
        $(s).classList.toggle('hidden', s !== id);
    });
}
// ─────────────────────────────────────────
// CODE EXPIRY HELPERS
// ─────────────────────────────────────────
/**
 * createdTime "HH:MM" ko aaj ki Date object mein convert karo
 * e.g. "10:30" → today at 10:30:00
 */
function parseCreatedTimeToDate(timeStr) {
    if (!timeStr) return null;
    // "10:30 AM", "10:30", "10:30:00", "10:30:45 AM" sab handle karo
    const match = timeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
    if (!match) return null;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const s = match[3] ? parseInt(match[3], 10) : 0; // ✅ seconds bhi extract karo
    const ampm = match[4];
    if (ampm) {
        if (ampm.toUpperCase() === 'PM' && h !== 12) h += 12;
        if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
    }
    const d = new Date();
    d.setHours(h, m, s, 0); // ✅ exact second se 60s baad expire hoga
    return d;
}

/**
 * Returns true if code is still within 1-minute expiry window
 * Always returns true for online mode students
 */
function isCodeStillValid(createdTimeStr) {
    if (isOnlineMode) return true; // online students ke liye no expiry
    const created = parseCreatedTimeToDate(createdTimeStr);
    if (!created) return true; // parse nahi hua toh assume valid
    const nowMs = Date.now();
    return (nowMs - created.getTime()) <= CODE_EXPIRY_MS;
}

// ─────────────────────────────────────────
// STEP 1 — Fetch active lecture + display code
// ─────────────────────────────────────────
async function checkActiveLecture(subject) {
    const today = getTodayISO();
    try {
        const url = new URL(APPS_SCRIPT_URL);
        url.searchParams.set('action', 'getAttendance');
        url.searchParams.set('date', today);
        url.searchParams.set('subject', subject.name);
        const res = await fetch(url.toString());
        const data = await res.json();
        $('verifyLoader').classList.add('hidden');
        if (!data.success || !data.records || data.records.length === 0) {
            showVerifyError('Aaj ka koi active lecture nahi mila. Teacher se poochho.');
            return;
        }
        // Get the LATEST record (last entry = most recent code)
        const latest = data.records[data.records.length - 1];
        lectureCreatedTime = latest.createdTime || '';

        // ⏱ Client-side expiry check (offline students ke liye)
        if (!isOnlineMode && !isCodeStillValid(lectureCreatedTime)) {
            showVerifyError('Code expire ho gaya (1 minute ho gayi). Teacher se dobara start karwao.');
            return;
        }

        activeLectureCode = latest.code.trim().toUpperCase();
        // Display fetched code on screen
        $('fetchedCodeDisplay').textContent = activeLectureCode;
        // Show clean time — createdTime is already "HH:MM" from teacher panel
        const timeLabel = lectureCreatedTime && lectureCreatedTime.length < 20
            ? `Started at ${lectureCreatedTime}`
            : 'Active lecture';

        // Online mode indicator
        if (isOnlineMode) {
            $('fetchedCodeTime').innerHTML = `<span style="color:#10B981;font-weight:600;">🌐 Online Mode — No Expiry</span>`;
        } else {
            $('fetchedCodeTime').textContent = timeLabel;
        }
        // Move to step 2 — code display + confirm button
        showStep('stepCode');
    }
    catch {
        $('verifyLoader').classList.add('hidden');
        showVerifyError('Internet connection error. Dobara try karo.');
    }
}
function showVerifyError(msg) {
    $('verifyErrorMsg').textContent = msg;
    $('verifyError').classList.remove('hidden');
}
// ─────────────────────────────────────────
// STEP 2 — Student types code → validate → submit
// ─────────────────────────────────────────
function showNoInternetMsg() {
    if (document.getElementById('noInternetMsg')) return;
    const msg = document.createElement('div');
    msg.id = 'noInternetMsg';
    msg.textContent = '📵 Please turn on your Internet';
    msg.style.cssText = `
        position: fixed;
        top: 0;
        left: 50%;
        width: 100vw;
        transform: translateX(-50%) translateY(-100%);
        background: rgba(220,38,38,0.97);
        color: #fff;
        font-family: 'Syne', sans-serif;
        font-size: 14px;
        font-weight: 700;
        padding: 14px 20px;
        text-align: center;
        z-index: 99999;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.22s ease, transform 0.22s ease;
        box-shadow: 0 4px 24px rgba(220,38,38,0.35);
        letter-spacing: 0.01em;
    `;
    document.body.appendChild(msg);
    requestAnimationFrame(() => {
        msg.style.opacity = '1';
        msg.style.transform = 'translateX(-50%) translateY(0)';
    });
    setTimeout(() => {
        msg.style.opacity = '0';
        msg.style.transform = 'translateX(-50%) translateY(-100%)';
        setTimeout(() => msg.remove(), 280);
    }, 3000);
}

async function handleSubmit() {
    if (!activeSubject || !student)
        return;
    // ── Internet Check ──
    if (!navigator.onLine) {
        SFX.noInternet();
        showNoInternetMsg();
        return;
    }
    const codeEl = document.getElementById('codeInput');
    const enteredCode = codeEl.value.trim().toUpperCase();
    // Empty check
    if (!enteredCode) {
        SFX.error();
        showToast('Pehle attendance code daalo', 'error');
        codeEl.focus();
        return;
    }
    // ✅ Validate: entered code must match fetched code
    if (enteredCode !== activeLectureCode) {
        SFX.error();
        showToast('❌ Code galat hai! Teacher se sahi code lo.', 'error', 4000);
        codeEl.classList.add('input-error');
        setTimeout(() => codeEl.classList.remove('input-error'), 1500);
        return;
    }
    // Re-check time restriction
    if (!isAttendanceOpen()) {
        SFX.error();
        showToast('Attendance band ho gayi hai.', 'warning');
        closeSheet();
        checkTimeRestriction();
        return;
    }
    // ── Optimistic UI — code sahi hai, turant success dikhao ──
    SFX.submit();
    saveMarkedLocally(activeSubject.name);
    showStep('stepSuccess');
    SFX.success();
    $('successSubText').textContent =
        `${activeSubject.name} · ${student.rollNo} · ${getCurrentTime()}`;
    setTimeout(() => {
        closeSheet();
        renderSubjectGrid();
    }, 2500);
    // Background mein server pe save karo
    const url = new URL(APPS_SCRIPT_URL);
    url.searchParams.set('action', 'markStudentAttendanceGET');
    url.searchParams.set('date', getTodayISO());
    url.searchParams.set('subject', activeSubject.name);
    url.searchParams.set('lectureCode', activeLectureCode);
    url.searchParams.set('studentName', student.fullName);
    url.searchParams.set('rollNo', student.rollNo);
    url.searchParams.set('isOnlineMode', isOnlineMode ? 'true' : 'false');
    fetch(url.toString()).catch(err => console.error('Background submit error:', err));
}
// ─────────────────────────────────────────
// SPLASH
// ─────────────────────────────────────────
function initSplash() {
    const splash = $('splash');
    const app = $('app');
    setTimeout(() => SFX.welcome(), 200);
    setTimeout(() => {
        splash.classList.add('fade-out');
        app.classList.remove('hidden');
        setTimeout(() => splash.classList.add('hidden'), 400);
    }, 1300);
}
// ─────────────────────────────────────────
// EVENT LISTENERS
// ─────────────────────────────────────────
function bindEvents() {
    // College dropdown
    initCollegeDropdown();
    // Registration
    $('registerBtn').addEventListener('click', handleRegister);
    $('inputRoll').addEventListener('keypress', (e) => {
        if (e.key === 'Enter')
            handleRegister();
    });
    $('inputName').addEventListener('keypress', (e) => {
        if (e.key === 'Enter')
            $('inputRoll').focus();
    });
    // Submit attendance
    $('submitBtn').addEventListener('click', handleSubmit);
    $('codeInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter')
            handleSubmit();
    });
    // Close sheet
    $('closeSheetBtn').addEventListener('click', closeSheet);
    $('sheetOverlay').addEventListener('click', closeSheet);
    // Swipe to close
    setupSwipeToClose();
    // Re-check time restriction every 60s
    setInterval(checkTimeRestriction, 60000);
    // Anti-copy: code display pe copy/select block karo
    setupAntiCopy();
}
// ─────────────────────────────────────────
// ANTI-COPY — Code display se copy/select block
// ─────────────────────────────────────────
function showDontBeSmartMsg() {
    // Agar already dikh raha hai toh dobara mat dikhao
    if (document.getElementById('dontBeSmartMsg')) return;
    const msg = document.createElement('div');
    msg.id = 'dontBeSmartMsg';
    msg.textContent = "Don't be Smart 😏";
    msg.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(0.7);
        background: rgba(15,15,30,0.96);
        color: #fff;
        font-family: 'Syne', sans-serif;
        font-size: 22px;
        font-weight: 700;
        padding: 18px 32px;
        border-radius: 16px;
        border: 1.5px solid rgba(124,58,237,0.5);
        box-shadow: 0 8px 40px rgba(79,70,229,0.35);
        z-index: 99999;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s ease, transform 0.2s ease;
        white-space: nowrap;
        letter-spacing: 0.3px;
    `;
    document.body.appendChild(msg);
    // Animate in
    requestAnimationFrame(() => {
        msg.style.opacity = '1';
        msg.style.transform = 'translate(-50%, -50%) scale(1)';
    });
    // Auto remove after 1.8s
    setTimeout(() => {
        msg.style.opacity = '0';
        msg.style.transform = 'translate(-50%, -50%) scale(0.85)';
        setTimeout(() => msg.remove(), 250);
    }, 1800);
}
function setupAntiCopy() {
    const codeDisplay = $('fetchedCodeDisplay');
    if (!codeDisplay) return;

    // Poora fetched-code-card bhi protect karo (hold se bhi)
    const codeCard = codeDisplay.closest('.fetched-code-card') || codeDisplay.parentElement;

    // Helper: kisi bhi element pe hold protection lagao
    function addHoldProtection(el) {
        if (!el) return;
        // Block right-click context menu
        el.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showDontBeSmartMsg();
        });
        // Long press (hold) detect — 500ms ke baad message show karo
        el.addEventListener('touchstart', (e) => {
            const timer = setTimeout(() => showDontBeSmartMsg(), 500);
            el.addEventListener('touchend', () => clearTimeout(timer), { once: true });
            el.addEventListener('touchcancel', () => clearTimeout(timer), { once: true });
            el.addEventListener('touchmove', () => clearTimeout(timer), { once: true, passive: true });
        }, { passive: true });
        // Block selectstart event
        el.addEventListener('selectstart', (e) => {
            e.preventDefault();
            showDontBeSmartMsg();
        });
    }

    // Code display text pe protection
    addHoldProtection(codeDisplay);
    // Poore card pe bhi same protection
    addHoldProtection(codeCard);
    // Block copy keyboard shortcut (Ctrl+C / Cmd+C) anywhere on the sheet
    document.addEventListener('keydown', (e) => {
        const sheet = $('attendSheet');
        if (!sheet || !sheet.classList.contains('open')) return;
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            // Only block if something in code display area is selected
            const sel = window.getSelection();
            if (sel && sel.toString().length > 0) {
                e.preventDefault();
                showDontBeSmartMsg();
            }
        }
    });
}
// ─────────────────────────────────────────
// INIT
// ─────────────────────────────────────────
function init() {
    initSplash();
    bindEvents();
    // Decide which screen to show after splash
    setTimeout(() => {
        student = loadStudent();
        if (student) {
            switchToDashboard();
        }
        else {
            showRegistration();
        }
    }, 1350); // slightly after splash reveals app
}
document.addEventListener('DOMContentLoaded', init);
