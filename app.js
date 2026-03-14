"use strict";

// ─────────────────────────────────────────
// SOUND SYSTEM — Teacher Panel
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

    // Helper: play an oscillator note
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
        // 1. Splash welcome — rich ascending chime (teacher authority tone)
        welcome() {
            const ac = resume();
            const t = ac.currentTime;
            note(330, 'sine', t, 0.3, 0.18, ac);
            note(440, 'sine', t + 0.12, 0.3, 0.18, ac);
            note(550, 'sine', t + 0.24, 0.35, 0.2, ac);
            note(660, 'sine', t + 0.36, 0.5, 0.22, ac);
            note(880, 'sine', t + 0.52, 0.6, 0.18, ac);
        },
        // 2. Subject card tap — crisp select pop
        cardTap() {
            const ac = resume();
            const t = ac.currentTime;
            note(800, 'sine', t, 0.08, 0.12, ac);
            note(1000, 'sine', t + 0.05, 0.12, 0.1, ac);
        },
        // 3. Sheet open — smooth upward whoosh
        sheetOpen() {
            const ac = resume();
            const t = ac.currentTime;
            const osc = ac.createOscillator();
            const g = ac.createGain();
            osc.connect(g); g.connect(ac.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(200, t);
            osc.frequency.exponentialRampToValueAtTime(600, t + 0.22);
            g.gain.setValueAtTime(0.13, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
            osc.start(t); osc.stop(t + 0.28);
        },
        // 4. Sheet close / cancel — downward whoosh
        sheetClose() {
            const ac = resume();
            const t = ac.currentTime;
            const osc = ac.createOscillator();
            const g = ac.createGain();
            osc.connect(g); g.connect(ac.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(500, t);
            osc.frequency.exponentialRampToValueAtTime(180, t + 0.2);
            g.gain.setValueAtTime(0.1, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
            osc.start(t); osc.stop(t + 0.25);
        },
        // 5. Code refresh — quick double blip
        codeRefresh() {
            const ac = resume();
            const t = ac.currentTime;
            note(900, 'square', t, 0.06, 0.07, ac);
            note(1200, 'square', t + 0.09, 0.08, 0.07, ac);
        },
        // 6. Start attendance — triumphant success fanfare
        startAttendance() {
            const ac = resume();
            const t = ac.currentTime;
            note(523, 'sine', t, 0.18, 0.2, ac);
            note(659, 'sine', t + 0.14, 0.18, 0.2, ac);
            note(784, 'sine', t + 0.28, 0.25, 0.22, ac);
            note(1047, 'sine', t + 0.42, 0.55, 0.2, ac);
        },
        // 7. Check attendance btn — info ping
        checkAttendance() {
            const ac = resume();
            const t = ac.currentTime;
            note(660, 'sine', t, 0.14, 0.13, ac);
            note(880, 'sine', t + 0.1, 0.18, 0.12, ac);
        },
        // 8. No internet — harsh warning buzz
        noInternet() {
            const ac = resume();
            const t = ac.currentTime;
            note(200, 'sawtooth', t, 0.12, 0.18, ac);
            note(160, 'sawtooth', t + 0.13, 0.12, 0.18, ac);
            note(120, 'sawtooth', t + 0.26, 0.2, 0.2, ac);
        },
        // 9. Fetch records — data scan sweep
        fetchRecords() {
            const ac = resume();
            const t = ac.currentTime;
            const osc = ac.createOscillator();
            const g = ac.createGain();
            osc.connect(g); g.connect(ac.destination);
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(300, t);
            osc.frequency.linearRampToValueAtTime(900, t + 0.3);
            g.gain.setValueAtTime(0.08, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
            osc.start(t); osc.stop(t + 0.35);
        },
    };
    return sounds;
})();

/**
 * AttendX — Teacher Panel
 * TypeScript Source (app.ts)
 *
 * Compile with:
 *   tsc app.ts --target ES2020 --strict --outFile app.js
 * or using ts-node / esbuild for development.
 */
// ─────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────
/**
 * ⚠️ Replace this with your deployed Google Apps Script Web App URL.
 * After deploying Apps Script, paste the URL here.
 */
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw1tRQ139zqN1Zpdm43WK4P32KCDxV5EWQ9kgA1CRa9T_aLrtNzy_4cdgr63MFS9dt4kg/exec';
// Subjects list
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
let activeSubject = null;
let currentCode = '';
// ─────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────
/** Format: YYYY-MM-DD */
function getTodayISO() {
    return new Date().toISOString().slice(0, 10);
}
/** Format: Mon, 24 Feb 2026 */
function formatDisplayDate(isoDate) {
    const d = new Date(isoDate + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
    });
}
/** Format: HH:MM AM/PM */
function getCurrentTime() {
    return new Date().toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit'
    });
}
/**
 * Generate attendance code:
 * Format: [prefix][4 random digits][suffix]
 * Example: DS4821LB
 */
function generateCode(subject) {
    const digits = Math.floor(1000 + Math.random() * 9000).toString();
    return `${subject.prefix}${digits}${subject.suffix}`;
}
// ─────────────────────────────────────────
// DOM HELPERS
// ─────────────────────────────────────────
function $(id) {
    return document.getElementById(id);
}
let toastTimer = null;
function showToast(message, opts = {}) {
    const toast = $('toast');
    const { type = 'default', duration = 3000 } = opts;
    // Clear previous classes
    toast.className = 'toast';
    if (type !== 'default')
        toast.classList.add(type);
    toast.textContent = message;
    // Force reflow
    toast.getBoundingClientRect();
    toast.classList.add('visible');
    if (toastTimer)
        clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove('visible');
    }, duration);
}
// ─────────────────────────────────────────
// SHEET MANAGEMENT
// ─────────────────────────────────────────
function openSheet(overlayId, sheetId) {
    SFX.sheetOpen();
    const overlay = $(overlayId);
    const sheet = $(sheetId);
    overlay.classList.remove('hidden');
    // Allow transition
    requestAnimationFrame(() => {
        overlay.classList.add('visible');
        sheet.classList.add('open');
    });
    document.body.style.overflow = 'hidden';
}
function closeSheet(overlayId, sheetId) {
    SFX.sheetClose();
    const overlay = $(overlayId);
    const sheet = $(sheetId);
    overlay.classList.remove('visible');
    sheet.classList.remove('open');
    document.body.style.overflow = '';
    // Hide after transition
    setTimeout(() => {
        overlay.classList.add('hidden');
    }, 300);
}
// ─────────────────────────────────────────
// SUBJECT CARDS
// ─────────────────────────────────────────
function renderSubjectCards() {
    const grid = $('subjectsGrid');
    grid.innerHTML = '';
    SUBJECTS.forEach((subject) => {
        const card = document.createElement('div');
        card.className = 'subject-card';
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', `Select ${subject.name}`);
        const typeClass = subject.isLab ? 'lab' : 'theory';
        const typeLabel = subject.isLab ? 'Lab' : 'Theory';
        card.innerHTML = `
      <div class="card-dot ${typeClass}"></div>
      <div class="card-name">${subject.name.replace(' (Lab)', '')}</div>
      <div class="card-type ${typeClass}">${typeLabel}</div>
      <div class="card-arrow">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    `;
        card.addEventListener('click', () => selectSubject(subject));
        card.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' || e.key === ' ')
                selectSubject(subject);
        });
        grid.appendChild(card);
    });
}
// ─────────────────────────────────────────
// SUBJECT SELECTION
// ─────────────────────────────────────────
function selectSubject(subject) {
    SFX.cardTap();
    activeSubject = subject;
    currentCode = generateCode(subject);
    // Populate sheet
    const badge = $('sheetBadge');
    badge.textContent = subject.isLab ? 'Lab' : 'Theory';
    badge.className = `sheet-badge ${subject.isLab ? 'lab-badge' : 'theory-badge'}`;
    $('sheetSubject').textContent = subject.name;
    $('codeValue').textContent = currentCode;
    const today = getTodayISO();
    $('chipDate').textContent = formatDisplayDate(today);
    $('chipTime').textContent = getCurrentTime();
    openSheet('sheetOverlay', 'subjectSheet');
}
// ─────────────────────────────────────────
// CODE REFRESH
// ─────────────────────────────────────────
function refreshCode() {
    if (!activeSubject)
        return;
    SFX.codeRefresh();
    const codeEl = $('codeValue');
    codeEl.classList.add('refreshing');
    setTimeout(() => {
        currentCode = generateCode(activeSubject);
        codeEl.textContent = currentCode;
        codeEl.classList.remove('refreshing');
        // Update time
        $('chipTime').textContent = getCurrentTime();
    }, 150);
}
// ─────────────────────────────────────────
// START ATTENDANCE → Google Sheets
// ─────────────────────────────────────────
function showNoInternetMsg() {
    // Agar already dikh raha hai toh skip
    if (document.getElementById('noInternetMsg')) return;
    const msg = document.createElement('div');
    msg.id = 'noInternetMsg';
    msg.innerHTML = '📵 Please turn on your Internet';
    msg.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
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
        transform: translateY(-100%);
        transition: opacity 0.22s ease, transform 0.22s ease;
        box-shadow: 0 4px 24px rgba(220,38,38,0.35);
        letter-spacing: 0.01em;
    `;
    document.body.appendChild(msg);
    requestAnimationFrame(() => {
        msg.style.opacity = '1';
        msg.style.transform = 'translateY(0)';
    });
    setTimeout(() => {
        msg.style.opacity = '0';
        msg.style.transform = 'translateY(-100%)';
        setTimeout(() => msg.remove(), 280);
    }, 3000);
}

function startAttendance() {
    if (!activeSubject)
        return;
    // ── Internet Check ──
    if (!navigator.onLine) {
        SFX.noInternet();
        showNoInternetMsg();
        return;
    }
    SFX.startAttendance();
    const now = new Date();
    const payload = {
        date: getTodayISO(),
        subject: activeSubject.name,
        code: currentCode,
        createdTime: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    // Fire-and-forget — no-cors se response read nahi hota, background mein save hone do
    fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'startLecture', data: payload }),
        mode: 'no-cors',
    }).catch(err => console.error('Background save error:', err));
    // Turant success dikhao — sheet mein save ho hi raha hai background mein
    showToast('✓ Attendance started! Code saved.', { type: 'success' });
    setTimeout(() => {
        closeSheet('sheetOverlay', 'subjectSheet');
    }, 900);
}
// ─────────────────────────────────────────
// CHECK ATTENDANCE → Fetch from Sheets
// ─────────────────────────────────────────
function openCheckAttendance() {
    if (!activeSubject)
        return;
    SFX.checkAttendance();
    // Pre-fill date
    const picker = $('datePicker');
    picker.value = getTodayISO();
    $('checkSubjectLabel').textContent = activeSubject.name;
    // Reset previous results
    $('attendanceResults').classList.add('hidden');
    $('attendanceEmpty').classList.add('hidden');
    $('attendanceLoader').classList.add('hidden');
    openSheet('checkSheetOverlay', 'checkSheet');
}
async function fetchAttendance() {
    if (!activeSubject)
        return;
    SFX.fetchRecords();
    const picker = $('datePicker');
    const selectedDate = picker.value;
    if (!selectedDate) {
        showToast('Please select a date first', { type: 'info' });
        return;
    }
    // Show loader
    $('attendanceResults').classList.add('hidden');
    $('attendanceEmpty').classList.add('hidden');
    $('attendanceLoader').classList.remove('hidden');
    try {
        const url = new URL(APPS_SCRIPT_URL);
        url.searchParams.set('action', 'getStudentAttendance');
        url.searchParams.set('date', selectedDate);
        url.searchParams.set('subject', activeSubject.name);
        const res = await fetch(url.toString());
        const json = await res.json();
        $('attendanceLoader').classList.add('hidden');
        if (!json.records || json.records.length === 0) {
            $('attendanceEmpty').classList.remove('hidden');
        }
        else {
            renderAttendanceResults(json.records);
        }
    }
    catch (err) {
        console.error('Fetch error:', err);
        $('attendanceLoader').classList.add('hidden');
        $('attendanceEmpty').classList.remove('hidden');
        showToast('Could not fetch records. Check URL.', { type: 'error' });
    }
}
function renderAttendanceResults(records) {
    const list = $('resultsList');
    list.innerHTML = '';
    // Add search box if not already present
    let searchWrap = document.getElementById('rollSearchWrap');
    if (!searchWrap) {
        searchWrap = document.createElement('div');
        searchWrap.id = 'rollSearchWrap';
        searchWrap.style.cssText = 'margin-bottom:12px;display:flex;gap:8px;';
        searchWrap.innerHTML = `
          <input id="rollSearchInput" type="text" placeholder="Roll No. se search karo…" autocomplete="off"
            style="flex:1;padding:10px 14px;background:var(--c-surface2);border:1.5px solid var(--c-border2);
            border-radius:12px;color:var(--c-text-1);font-size:14px;font-family:var(--f-body);outline:none;"/>
          <button id="rollSearchBtn" style="padding:10px 16px;background:var(--c-grad-1);border:none;border-radius:12px;
            color:white;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;">Search</button>
        `;
        const resultsSection = $('attendanceResults');
        resultsSection.insertBefore(searchWrap, $('resultsList'));
        const doSearch = () => {
            const query = document.getElementById('rollSearchInput').value.trim().toUpperCase();
            const rows = list.querySelectorAll('.result-row');
            rows.forEach(row => {
                const rollText = row.querySelector('.rr-date')?.textContent?.toUpperCase() || '';
                const nameText = row.querySelector('.rr-subject')?.textContent?.toUpperCase() || '';
                row.style.display = (!query || rollText.includes(query) || nameText.includes(query)) ? '' : 'none';
            });
        };
        document.getElementById('rollSearchBtn').addEventListener('click', doSearch);
        document.getElementById('rollSearchInput').addEventListener('input', doSearch);
        document.getElementById('rollSearchInput').addEventListener('keypress', (e) => { if (e.key === 'Enter') doSearch(); });
    } else {
        document.getElementById('rollSearchInput').value = '';
    }
    records.forEach((rec, i) => {
        const row = document.createElement('div');
        row.className = 'result-row';
        row.style.animationDelay = `${i * 0.05}s`;
        row.innerHTML = `
      <div class="result-row-left">
        <div class="rr-subject">${rec.studentName}</div>
        <div class="rr-date">${rec.rollNo}</div>
      </div>
      <div class="result-row-right">
        <div class="rr-code">${rec.subject}</div>
        <div class="rr-time">${rec.submissionTime || ''}</div>
      </div>
    `;
        list.appendChild(row);
    });
    $('resultsCount').textContent =
        `${records.length} student${records.length !== 1 ? 's' : ''}`;
    $('attendanceResults').classList.remove('hidden');
}
// ─────────────────────────────────────────
// HEADER DATE
// ─────────────────────────────────────────
function updateHeaderDate() {
    const el = $('headerDate');
    const now = new Date();
    const day = now.toLocaleDateString('en-US', { weekday: 'short' });
    const date = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    el.innerHTML = `${day}<br>${date}`;
}
// ─────────────────────────────────────────
// SPLASH
// ─────────────────────────────────────────
function initSplash() {
    const splash = $('splash');
    const app = $('app');
    // Welcome sound on splash
    setTimeout(() => SFX.welcome(), 200);
    setTimeout(() => {
        splash.classList.add('fade-out');
        app.classList.remove('hidden');
        setTimeout(() => {
            splash.classList.add('hidden');
        }, 400);
    }, 1400);
}
// ─────────────────────────────────────────
// EVENT LISTENERS
// ─────────────────────────────────────────
function bindEvents() {
    // Close subject sheet
    $('closeSheetBtn').addEventListener('click', () => {
        closeSheet('sheetOverlay', 'subjectSheet');
    });
    $('sheetOverlay').addEventListener('click', () => {
        closeSheet('sheetOverlay', 'subjectSheet');
    });
    // Refresh code
    $('codeRefresh').addEventListener('click', refreshCode);
    // Start attendance
    $('startAttendanceBtn').addEventListener('click', startAttendance);
    // Check attendance
    $('checkAttendanceBtn').addEventListener('click', openCheckAttendance);
    $('fetchAttendanceBtn').addEventListener('click', fetchAttendance);
    // Close check sheet
    $('closeCheckSheetBtn').addEventListener('click', () => {
        closeSheet('checkSheetOverlay', 'checkSheet');
    });
    $('checkSheetOverlay').addEventListener('click', () => {
        closeSheet('checkSheetOverlay', 'checkSheet');
    });
    // Swipe down to close sheets (touch gesture)
    setupSwipeToClose('subjectSheet', () => closeSheet('sheetOverlay', 'subjectSheet'));
    setupSwipeToClose('checkSheet', () => closeSheet('checkSheetOverlay', 'checkSheet'));
}
// Swipe down gesture for bottom sheets
function setupSwipeToClose(sheetId, onClose) {
    const sheet = $(sheetId);
    let startY = 0;
    let startTranslate = 0;
    let isSwipingSheet = false;

    sheet.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
        startTranslate = 0;
        isSwipingSheet = false;

        // Check if touch started on a scrollable element that has content to scroll
        const scrollable = e.target.closest('.results-list, .subject-sheet, .check-sheet');
        const resultsList = sheet.querySelector('.results-list');
        if (resultsList && resultsList.scrollTop > 0) {
            // User is in middle of scrollable content — don't allow sheet dismiss
            isSwipingSheet = false;
        } else {
            isSwipingSheet = true;
        }
    }, { passive: true });

    sheet.addEventListener('touchmove', (e) => {
        if (!isSwipingSheet) return;

        const delta = e.touches[0].clientY - startY;

        // Check if any scrollable child can still scroll down
        const resultsList = sheet.querySelector('.results-list');
        if (resultsList && resultsList.scrollTop > 0) {
            // Content is scrolled — don't hijack for sheet dismissal
            isSwipingSheet = false;
            sheet.style.transform = '';
            return;
        }

        if (delta > 0) {
            startTranslate = delta;
            sheet.style.transform = `translateX(-50%) translateY(${delta}px)`;
        }
    }, { passive: true });

    sheet.addEventListener('touchend', () => {
        if (isSwipingSheet && startTranslate > 100) {
            sheet.style.transform = '';
            onClose();
        } else {
            sheet.style.transform = '';
        }
        isSwipingSheet = false;
    });
}
// ─────────────────────────────────────────
// INIT
// ─────────────────────────────────────────
function init() {
    initSplash();
    updateHeaderDate();
    renderSubjectCards();
    bindEvents();
}
// Boot
document.addEventListener('DOMContentLoaded', init);
