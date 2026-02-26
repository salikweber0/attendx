"use strict";
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
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby9d3RxMh-46BkLfN8TtS-bnavxzxgIodv_9HuyY6bcWacPScJ96Osu8Y_PDfP17gtWaA/exec';
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
const CODE_EXPIRY_MS = 2 * 60 * 1000;
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
function handleRegister() {
    const nameInput = $('inputName');
    const rollInput = $('inputRoll');
    const fullName = nameInput.value.trim();
    const rollNo = rollInput.value.trim().toUpperCase();
    if (!fullName) {
        showToast('Please enter your full name', 'error');
        nameInput.focus();
        return;
    }
    if (!rollNo) {
        showToast('Please enter your roll number', 'error');
        rollInput.focus();
        return;
    }
    if (rollNo.length < 4) {
        showToast('Roll number seems too short', 'error');
        rollInput.focus();
        return;
    }
    const profile = { fullName, rollNo };
    saveStudent(profile);
    student = profile;
    showToast(`Welcome, ${fullName.split(' ')[0]}! 👋`, 'success');
    setTimeout(() => switchToDashboard(), 500);
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
 * 10 second tak card ko hold karo → Online Mode activate hoga
 * Online mode mein code kabhi expire nahi hoga
 * Yeh feature sirf online students ke liye hai — kisi ko batana nahi!
 */
function setupHoldToActivateOnline(card, subject) {
    let holdTimer = null;
    const HOLD_MS = 10000; // 10 seconds

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
        // ── Online Mode: 10-second hold secret feature ──
        setupHoldToActivateOnline(card, subject);
        grid.appendChild(card);
    });
}
// ─────────────────────────────────────────
// SUBJECT SELECTION → opens sheet + checks lecture
// ─────────────────────────────────────────
function onSubjectSelect(subject) {
    if (!isAttendanceOpen()) {
        showToast('Attendance closed. Open 9:55 AM – 4:00 PM', 'warning');
        return;
    }
    // Local flag check — already marked today?
    if (isAlreadyMarkedLocally(subject.name)) {
        showToast(`✅ ${subject.name} ki attendance aaj already fill ho chuki hai!`, 'success', 4000);
        return;
    }
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
    // "10:30 AM", "10:30", "10:30:00" sab handle karo
    const match = timeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
    if (!match) return null;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const ampm = match[4];
    if (ampm) {
        if (ampm.toUpperCase() === 'PM' && h !== 12) h += 12;
        if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
    }
    const d = new Date();
    d.setHours(h, m, 0, 0);
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
async function handleSubmit() {
    if (!activeSubject || !student)
        return;
    const codeEl = document.getElementById('codeInput');
    const enteredCode = codeEl.value.trim().toUpperCase();
    // Empty check
    if (!enteredCode) {
        showToast('Pehle attendance code daalo', 'error');
        codeEl.focus();
        return;
    }
    // ✅ Validate: entered code must match fetched code
    if (enteredCode !== activeLectureCode) {
        showToast('❌ Code galat hai! Teacher se sahi code lo.', 'error', 4000);
        codeEl.classList.add('input-error');
        setTimeout(() => codeEl.classList.remove('input-error'), 1500);
        return;
    }
    // Re-check time restriction
    if (!isAttendanceOpen()) {
        showToast('Attendance band ho gayi hai.', 'warning');
        closeSheet();
        checkTimeRestriction();
        return;
    }
    const btn = $('submitBtn');
    btn.disabled = true;
    btn.innerHTML = `
    <div class="spinner spinner-sm"></div>
    Submitting…
  `;
    const payload = {
        action: 'markStudentAttendance',
        data: {
            date: getTodayISO(),
            subject: activeSubject.name,
            lectureCode: activeLectureCode,
            studentName: student.fullName,
            rollNo: student.rollNo,
            isOnlineMode: isOnlineMode, // ← server-side expiry bypass for online students
        },
    };
    try {
        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            mode: 'no-cors',
        });
        showStep('stepSuccess');
        // Save flag in localStorage so duplicate attempt shows toast
        saveMarkedLocally(activeSubject.name);
        $('successSubText').textContent =
            `${activeSubject.name} · ${student.rollNo} · ${getCurrentTime()}`;
        setTimeout(() => {
            closeSheet();
            renderSubjectGrid(); // refresh cards to show filled badge
        }, 2500);
    }
    catch {
        showToast('⚠ Submit nahi hua. Internet check karo.', 'error');
    }
    finally {
        btn.disabled = false;
        btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      Submit Attendance
    `;
    }
}
// ─────────────────────────────────────────
// SPLASH
// ─────────────────────────────────────────
function initSplash() {
    const splash = $('splash');
    const app = $('app');
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
    // Block right-click context menu
    codeDisplay.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showDontBeSmartMsg();
    });
    // Block text selection on touchstart (long press se select hota hai)
    codeDisplay.addEventListener('touchstart', (e) => {
        // Long press detect — 600ms ke baad message show karo
        const timer = setTimeout(() => showDontBeSmartMsg(), 600);
        codeDisplay.addEventListener('touchend', () => clearTimeout(timer), { once: true });
        codeDisplay.addEventListener('touchcancel', () => clearTimeout(timer), { once: true });
    }, { passive: true });
    // Block selectstart event
    codeDisplay.addEventListener('selectstart', (e) => {
        e.preventDefault();
        showDontBeSmartMsg();
    });
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
