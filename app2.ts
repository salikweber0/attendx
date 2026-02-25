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
const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxj0TnrFAesR_OcRwQfpSfspKwZfuN-4GQayj4pvnSU95Djhm7UgedKhwzjqBzQiWS16g/exec';

// Attendance window: 09:55 – 16:00 (24h)
const WINDOW_START_H = 9,  WINDOW_START_M = 55;
const WINDOW_END_H   = 16, WINDOW_END_M   = 0;

// localStorage keys
const LS_STUDENT_KEY = 'attendx_student';

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────
interface Subject {
  id: string;
  name: string;
  shortName: string;
  isLab: boolean;
  prefix: string;
  suffix: string;
}

interface StudentProfile {
  fullName: string;
  rollNo: string;
}

interface LectureRecord {
  date: string;
  subject: string;
  code: string;
  createdTime: string;
}

interface ApiResponse {
  success: boolean;
  error?: string;
  records?: LectureRecord[];
  message?: string;
  alreadyMarked?: boolean;
}

// ─────────────────────────────────────────
// SUBJECTS  (matches teacher panel exactly)
// ─────────────────────────────────────────
const SUBJECTS: Subject[] = [
  { id: 'dhtml_lab', name: 'DHTML (Lab)', shortName: 'DHTML', isLab: true,  prefix: 'DH', suffix: 'LB' },
  { id: 'ds_lab',    name: 'DS (Lab)',    shortName: 'DS',    isLab: true,  prefix: 'DS', suffix: 'LB' },
  { id: 'mysql_lab', name: 'MySQL (Lab)', shortName: 'MySQL', isLab: true,  prefix: 'MY', suffix: 'LB' },
  { id: 'wp_lab',    name: 'WordPress (Lab)', shortName: 'WP', isLab: true, prefix: 'WP', suffix: 'LB' },
  { id: 'dhtml',     name: 'DHTML',       shortName: 'DHTML', isLab: false, prefix: 'DH', suffix: 'TH' },
  { id: 'ds',        name: 'DS',          shortName: 'DS',    isLab: false, prefix: 'DS', suffix: 'TH' },
  { id: 'mysql',     name: 'MySQL',       shortName: 'MySQL', isLab: false, prefix: 'MY', suffix: 'TH' },
  { id: 'wordpress', name: 'WordPress',   shortName: 'WP',    isLab: false, prefix: 'WP', suffix: 'TH' },
];

// ─────────────────────────────────────────
// STATE
// ─────────────────────────────────────────
let student: StudentProfile | null = null;
let activeSubject: Subject | null  = null;
let activeLectureCode: string      = '';   // ← sheet se fetch hoga

// ─────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────

/** Returns today as YYYY-MM-DD */
function getTodayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Friendly date: Mon, 24 Feb 2026 */
function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });
}

/** HH:MM AM/PM */
function getCurrentTime(): string {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Check if current time is within the attendance window.
 * Window: 09:55 – 16:00
 */
function isAttendanceOpen(): boolean {
  const now  = new Date();
  const hour = now.getHours();
  const min  = now.getMinutes();
  const totalMin = hour * 60 + min;
  const startMin = WINDOW_START_H * 60 + WINDOW_START_M;
  const endMin   = WINDOW_END_H   * 60 + WINDOW_END_M;
  return totalMin >= startMin && totalMin <= endMin;
}

// ─────────────────────────────────────────
// DOM HELPER
// ─────────────────────────────────────────
function $<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;
type ToastType = 'default' | 'success' | 'error' | 'info' | 'warning';

function showToast(msg: string, type: ToastType = 'default', duration = 3200): void {
  const toast = $('toast');
  toast.className = 'toast';
  if (type !== 'default') toast.classList.add(type);
  toast.textContent = msg;
  toast.getBoundingClientRect(); // force reflow
  toast.classList.add('visible');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), duration);
}

// ─────────────────────────────────────────
// BOTTOM SHEET
// ─────────────────────────────────────────
function openSheet(): void {
  const overlay = $('sheetOverlay');
  const sheet   = $('attendSheet');
  overlay.classList.remove('hidden');
  requestAnimationFrame(() => {
    overlay.classList.add('visible');
    sheet.classList.add('open');
  });
  document.body.style.overflow = 'hidden';
}

function closeSheet(): void {
  const overlay = $('sheetOverlay');
  const sheet   = $('attendSheet');
  overlay.classList.remove('visible');
  sheet.classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => overlay.classList.add('hidden'), 300);
}

/** Swipe-down to dismiss bottom sheet */
function setupSwipeToClose(): void {
  const sheet = $('attendSheet');
  let startY = 0, delta = 0;

  sheet.addEventListener('touchstart', (e: TouchEvent) => {
    startY = e.touches[0].clientY;
    delta  = 0;
  }, { passive: true });

  sheet.addEventListener('touchmove', (e: TouchEvent) => {
    delta = e.touches[0].clientY - startY;
    if (delta > 0) {
      sheet.style.transform = `translateX(-50%) translateY(${delta}px)`;
    }
  }, { passive: true });

  sheet.addEventListener('touchend', () => {
    if (delta > 110) {
      sheet.style.transform = '';
      closeSheet();
    } else {
      sheet.style.transform = '';
    }
  });
}

// ─────────────────────────────────────────
// REGISTRATION
// ─────────────────────────────────────────
function loadStudent(): StudentProfile | null {
  try {
    const raw = localStorage.getItem(LS_STUDENT_KEY);
    return raw ? (JSON.parse(raw) as StudentProfile) : null;
  } catch {
    return null;
  }
}

function saveStudent(profile: StudentProfile): void {
  localStorage.setItem(LS_STUDENT_KEY, JSON.stringify(profile));
}

function handleRegister(): void {
  const nameInput = $<HTMLInputElement>('inputName');
  const rollInput = $<HTMLInputElement>('inputRoll');

  const fullName = nameInput.value.trim();
  const rollNo   = rollInput.value.trim().toUpperCase();

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

  const profile: StudentProfile = { fullName, rollNo };
  saveStudent(profile);
  student = profile;

  showToast(`Welcome, ${fullName.split(' ')[0]}! 👋`, 'success');
  setTimeout(() => switchToDashboard(), 500);
}

// ─────────────────────────────────────────
// VIEWS
// ─────────────────────────────────────────
function showRegistration(): void {
  $('registrationView').classList.remove('hidden');
  $('dashboardView').classList.add('hidden');
  $('studentBadge').classList.add('hidden');
}

function switchToDashboard(): void {
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
function checkTimeRestriction(): void {
  const open   = isAttendanceOpen();
  const banner = $('closedBanner');
  const grid   = $('subjectsGrid');

  if (open) {
    banner.classList.add('hidden');
    // re-enable cards
    grid.querySelectorAll('.subject-card').forEach(c => c.classList.remove('disabled-card'));
  } else {
    banner.classList.remove('hidden');
    // disable cards visually
    grid.querySelectorAll('.subject-card').forEach(c => c.classList.add('disabled-card'));
  }
}

// ─────────────────────────────────────────
// SUBJECT GRID
// ─────────────────────────────────────────
function renderSubjectGrid(): void {
  const grid = $('subjectsGrid');
  grid.innerHTML = '';

  SUBJECTS.forEach(subject => {
    const card = document.createElement('div');
    card.className = 'subject-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Mark attendance for ${subject.name}`);

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

    card.addEventListener('click', () => onSubjectSelect(subject));
    card.addEventListener('keypress', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') onSubjectSelect(subject);
    });

    grid.appendChild(card);
  });
}

// ─────────────────────────────────────────
// SUBJECT SELECTION → opens sheet + checks lecture
// ─────────────────────────────────────────
function onSubjectSelect(subject: Subject): void {
  if (!isAttendanceOpen()) {
    showToast('Attendance closed. Open 9:55 AM – 4:00 PM', 'warning');
    return;
  }

  activeSubject = subject;

  // Populate header
  const badge = $('sheetBadge');
  badge.textContent = subject.isLab ? 'Lab' : 'Theory';
  badge.className   = `sheet-badge ${subject.isLab ? 'lab-badge' : 'theory-badge'}`;
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
  ($('codeInput') as HTMLInputElement).value = '';
  ($('codeInput') as HTMLInputElement).classList.remove('input-error');

  openSheet();
  checkActiveLecture(subject);
}

// ─────────────────────────────────────────
// STEP SWITCHER
// ─────────────────────────────────────────
type StepId = 'stepVerify' | 'stepCode' | 'stepSuccess';

function showStep(id: StepId): void {
  (['stepVerify', 'stepCode', 'stepSuccess'] as StepId[]).forEach(s => {
    $(s).classList.toggle('hidden', s !== id);
  });
}

// ─────────────────────────────────────────
// STEP 1 — Fetch active lecture + display code
// ─────────────────────────────────────────
async function checkActiveLecture(subject: Subject): Promise<void> {
  const today = getTodayISO();

  try {
    const url = new URL(APPS_SCRIPT_URL);
    url.searchParams.set('action', 'getAttendance');
    url.searchParams.set('date', today);
    url.searchParams.set('subject', subject.name);

    const res  = await fetch(url.toString());
    const data = await res.json() as ApiResponse;

    $('verifyLoader').classList.add('hidden');

    if (!data.success || !data.records || data.records.length === 0) {
      showVerifyError('Aaj ka koi active lecture nahi mila. Teacher se poochho.');
      return;
    }

    // Get the LATEST record (last entry = most recent code)
    const latest = data.records[data.records.length - 1];
    activeLectureCode = latest.code.trim().toUpperCase();

    // Display fetched code on screen
    $('fetchedCodeDisplay').textContent = activeLectureCode;

    // Show clean time — createdTime is already "HH:MM AM" from teacher panel
    const timeLabel = latest.createdTime && latest.createdTime.length < 20
      ? `Started at ${latest.createdTime}`
      : 'Active lecture';
    $('fetchedCodeTime').textContent = timeLabel;

    // Move to step 2 — code display + confirm button
    showStep('stepCode');

  } catch {
    $('verifyLoader').classList.add('hidden');
    showVerifyError('Internet connection error. Dobara try karo.');
  }
}

function showVerifyError(msg: string): void {
  $('verifyErrorMsg').textContent = msg;
  $('verifyError').classList.remove('hidden');
}

// ─────────────────────────────────────────
// STEP 2 — Student types code → validate → submit
// ─────────────────────────────────────────
async function handleSubmit(): Promise<void> {
  if (!activeSubject || !student) return;

  const codeEl    = document.getElementById('codeInput') as HTMLInputElement;
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

  const btn = $<HTMLButtonElement>('submitBtn');
  btn.disabled = true;
  btn.innerHTML = `
    <div class="spinner spinner-sm"></div>
    Submitting…
  `;

  const payload = {
    action: 'markStudentAttendance',
    data: {
      date:        getTodayISO(),
      subject:     activeSubject.name,
      lectureCode: activeLectureCode,
      studentName: student.fullName,
      rollNo:      student.rollNo,
    },
  };

  try {
    await fetch(APPS_SCRIPT_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      mode:    'no-cors',
    });

    showStep('stepSuccess');
    $('successSubText').textContent =
      `${activeSubject.name} · ${student.rollNo} · ${getCurrentTime()}`;

    setTimeout(() => closeSheet(), 2500);

  } catch {
    showToast('⚠ Submit nahi hua. Internet check karo.', 'error');
  } finally {
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
function initSplash(): void {
  const splash = $('splash');
  const app    = $('app');

  setTimeout(() => {
    splash.classList.add('fade-out');
    app.classList.remove('hidden');
    setTimeout(() => splash.classList.add('hidden'), 400);
  }, 1300);
}

// ─────────────────────────────────────────
// EVENT LISTENERS
// ─────────────────────────────────────────
function bindEvents(): void {
  // Registration
  $('registerBtn').addEventListener('click', handleRegister);
  $<HTMLInputElement>('inputRoll').addEventListener('keypress', (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleRegister();
  });
  $<HTMLInputElement>('inputName').addEventListener('keypress', (e: KeyboardEvent) => {
    if (e.key === 'Enter') $<HTMLInputElement>('inputRoll').focus();
  });

  // Submit attendance
  $('submitBtn').addEventListener('click', handleSubmit);
  ($('codeInput') as HTMLInputElement).addEventListener('keypress', (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  });

  // Close sheet
  $('closeSheetBtn').addEventListener('click', closeSheet);
  $('sheetOverlay').addEventListener('click', closeSheet);

  // Swipe to close
  setupSwipeToClose();

  // Re-check time restriction every 60s
  setInterval(checkTimeRestriction, 60_000);
}

// ─────────────────────────────────────────
// INIT
// ─────────────────────────────────────────
function init(): void {
  initSplash();
  bindEvents();

  // Decide which screen to show after splash
  setTimeout(() => {
    student = loadStudent();

    if (student) {
      switchToDashboard();
    } else {
      showRegistration();
    }
  }, 1350); // slightly after splash reveals app
}

document.addEventListener('DOMContentLoaded', init);