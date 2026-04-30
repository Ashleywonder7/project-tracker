/* ═══════════════════════════════════════════════
   RETAIN — app.js
   Local-first with optional Supabase integration
═══════════════════════════════════════════════ */

// ─── CONFIG ────────────────────────────────────
// To enable Supabase, fill these in and set USE_SUPABASE = true
const SUPABASE_URL  = 'https://pdzmpxwwdhkvfrpoikcw.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_IOVF4cy-Ngwswm3Wy0HC6g_WPlXedk9';
const USE_SUPABASE  = true;



// ─── STATE ─────────────────────────────────────
let currentYear = new Date().getFullYear();
let projects       = {};        // { 2026: [...], 2027: [...], 2028: [...] }
let editingId      = null;
let selectedColor  = '#F59E0B';
let activeFilter   = 'all';
let STAFF = [];
let holidays = []; // Format: { name: "Xmas", date: "2026-12-25", dayIdx: 359 }

const urlParams = new URLSearchParams(window.location.search);
const IS_ADMIN = urlParams.get('admin') === 'true';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Days in each month (non-leap base; leap handled dynamically)
function daysInMonth(month, year) {
  return new Date(year, month + 1, 0).getDate();
}

function totalDaysInYear(year) {
  return isLeapYear(year) ? 366 : 365;
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// ─── INIT ───────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {

  // 1. Load the data first
  await loadProjects(); 
  
  // 2. Build the UI based on that data
  renderYearNav(); 
  populateStaffFilter();
  buildMonthsHeader();
  renderAll();

  applyPermissions(); // Run permissions check

  // Check for auto-popup after everything is loaded
  checkAutoNotify();
  
  // Optional: Set an interval to check every minute while the app is open
  setInterval(checkAutoNotify, 60000);
});


// ADD YEAR
// Open the Modal
function addYear() {
  document.getElementById('yearModal').classList.add('open');
  document.getElementById('newYearInput').focus();
}

// Close the Modal
function closeYearModal() {
  document.getElementById('yearModal').classList.remove('open');
  document.getElementById('newYearInput').value = '';
}

// Close when clicking outside the box
function handleYearModalClick(e) {
  if (e.target === document.getElementById('yearModal')) closeYearModal();
}

// Logic to Save and Create the Button
function saveNewYear() {
  const yearInput = document.getElementById('newYearInput').value;
  const yearNum = parseInt(yearInput);

  if (!yearNum || yearNum < 2000 || yearNum > 2100) {
    alert("Please enter a valid year.");
    return;
  }

  // 1. Initialize data for the new year if it doesn't exist
  if (!projects[yearNum]) {
    projects[yearNum] = [];
  }

  
  // 2. Add the button to the sidebar
  const nav = document.getElementById("yearNav");
  
  // Check if button already exists to avoid duplicates
  const existingButtons = Array.from(nav.querySelectorAll('.year-btn'));
  const alreadyExists = existingButtons.some(btn => parseInt(btn.textContent) === yearNum);

  if (!alreadyExists) {
    const btn = document.createElement("button");
    btn.className = "year-btn";
    btn.textContent = yearNum;
    btn.onclick = () => switchYear(yearNum);
    nav.appendChild(btn);
  }

  // 3. Cleanup and Update
  saveProjects();
  switchYear(yearNum);
  closeYearModal();
}

// Ensure the listener points to the right function
const addYearBtn = document.getElementById("add-year-btn");
if (addYearBtn) {
    addYearBtn.addEventListener("click", addYear);
}

// ─── YEAR SWITCH ────────────────────────────────
function switchYear(year) {
  currentYear = year;
  document.getElementById('dashTitle').innerHTML =
    `Assignment Dashboard <span class="year-badge">${year}</span>`;
  
    document.querySelectorAll('.year-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.textContent) === year);
  });
  
  buildMonthsHeader();
  renderAll();
}

// ─── MONTHS HEADER ──────────────────────────────
function buildMonthsHeader() {
  const header = document.getElementById('monthsHeader');
  const now = new Date();
  header.innerHTML = '';
  
  const totalDays = totalDaysInYear(currentYear);
  header.style.display = 'grid';
  header.style.gridTemplateColumns = `repeat(${totalDays}, 1fr)`;

  MONTHS.forEach((m, i) => {
    const daysCount = daysInMonth(i, currentYear);
    const cell = document.createElement('div');
    cell.className = 'month-cell';
    cell.style.gridColumn = `span ${daysCount}`;
    
    // Highlight current month class
    if (now.getFullYear() === currentYear && now.getMonth() === i) {
      cell.classList.add('current-month');
    }

    // 1. Month Name Label
    const monthLabel = document.createElement('div');
    monthLabel.className = 'month-label';
    monthLabel.textContent = m;
    cell.appendChild(monthLabel);

    // 2. Day Numbers Row
    const daysRow = document.createElement('div');
    daysRow.className = 'days-number-row';
    daysRow.style.display = 'grid';
    daysRow.style.gridTemplateColumns = `repeat(${daysCount}, 1fr)`;

    for (let d = 1; d <= daysCount; d++) {
      const dayNum = document.createElement('span');
      dayNum.textContent = d;

      // Today's Date Highlighting
      const today = new Date();
      if (today.getFullYear() === currentYear && today.getMonth() === i && today.getDate() === d) {
        dayNum.style.color = '#F59E0B'; 
        dayNum.style.fontWeight = 'bold';
        dayNum.style.background = 'rgba(245,158,11,0.2)';
      }
      daysRow.appendChild(dayNum);
    }
    
    cell.appendChild(daysRow);
    header.appendChild(cell);
    
    // REMOVED: cell.textContent = m; (This was the culprit)
  });
}

// ─── RENDER ALL ─────────────────────────────────
function renderAll() {
  const body = document.getElementById('rowsContainer');
  // Re-enable empty state check
  const empty = document.getElementById('emptyState'); 
  body.innerHTML = '';

  // 1. Remove existing rows, but KEEP the timeline-wrapper
  const existingRows = body.querySelectorAll('.timeline-row');
  existingRows.forEach(row => row.remove());

  const yearProjects = (projects[currentYear] || []);

  // Use STAFF.length for the total count, or 1 if a specific staff is filtered
  const displayStaffCount = (activeFilter === 'all' ? STAFF.length : 1);
  
  const filteredStaff = activeFilter === 'all'
    ? STAFF
    : STAFF.filter(s => s === activeFilter);

  const totalDays = totalDaysInYear(currentYear);
  let hasAny = false;

  // Update Project Count
  document.getElementById('projectCount').textContent = 
    `${yearProjects.length} assignment${yearProjects.length !== 1 ? 's' : ''}`;
    
  // Update Staff Count
  document.getElementById('staffCount').textContent = 
    `${displayStaffCount} staff member${displayStaffCount !== 1 ? 's' : ''}`;

  filteredStaff.forEach(staffName => {
    const staffProjects = yearProjects.filter(p => p.staff === staffName);
    hasAny = hasAny || staffProjects.length > 0;

    // Calculate how many lanes we need for this staff member
    const laneCount = calculateLanes(staffProjects);
    const rowHeight = Math.max(2, (laneCount * 35) + 20); // 35px per lane + padding

    const row = document.createElement('div');
    row.className = 'timeline-row';
    row.style.height = `${rowHeight}px`;

    // Staff cell
    const staffCell = document.createElement('div');
    staffCell.className = 'staff-cell';

    const avatar = document.createElement('div');
    avatar.className = 'staff-avatar';
    avatar.textContent = staffName[0];
    staffCell.appendChild(avatar);
    staffCell.appendChild(document.createTextNode(staffName));
    row.appendChild(staffCell);

    // Canvas - Fixed the double declaration here
    const canvas = document.createElement('div');
    canvas.className = 'row-canvas';
    
    // This applies the grid based on days
    canvas.style.gridTemplateColumns = `repeat(${totalDays}, 1fr)`;
    
    //Set default lines first
    canvas.style.backgroundImage = `linear-gradient(to right, rgba(0, 0, 0, 0.79) 1px, transparent 1px)`;
    canvas.style.backgroundSize = `${100 / totalDays}% 100%`;

    staffProjects.forEach(p => {
      const bar = buildProjectBar(p, totalDays);
      if (bar) {
        // Position the bar vertically based on its assigned lane
        const verticalOffset = 20 + (p.lane * 35); 
        bar.style.top = `${verticalOffset}px`;
        canvas.appendChild(bar);
      }
    });

    const today = new Date();
    if (today.getFullYear() === currentYear) {
        const dayIdx = dayOfYear(today);
        highlightDay(canvas, dayIdx, 'rgba(245, 245, 31, 0.2)'); // Pale yellow highlight
    }
    
    row.appendChild(canvas);
    body.appendChild(row);
    updateNotifBadge();
  });
  
  buildGridHighlights(totalDays);

  if (empty) empty.classList.toggle('visible', !hasAny);

  document.getElementById('projectCount').textContent =
    `${yearProjects.length} assignment${yearProjects.length !== 1 ? 's' : ''}`;
}


function buildProjectBar(p, totalDays) {
  const start = new Date(p.start + 'T00:00:00');
  const end = new Date(p.end + 'T00:00:00');
  if (isNaN(start) || isNaN(end)) return null;

  const startDay = dayOfYear(start);
  const endDay = dayOfYear(end);

  // Position based on days
  const leftPct = ((startDay - 1) / totalDays) * 100;
  const widthPct = ((endDay - startDay + 1) / totalDays) * 100;

  const bar = document.createElement('div');
  bar.className = `project-bar ${p.completed ? 'is-completed' : ''}`;
  bar.style.left = `${leftPct}%`;
  bar.style.width = `${widthPct}%`;
  bar.style.background = p.color || '#F59E0B';
  bar.setAttribute('data-comments', p.comments || '');

  const textColor = getLuminance(p.color) > 0.4 ? 'rgba(0,0,0,0.8)' : '#fff';
  bar.style.color = textColor;

  const nameEl = document.createElement('span');
  nameEl.className = 'bar-name';
  nameEl.style.color = textColor;
  nameEl.textContent = p.name;

  if (p.completed) {
    nameEl.style.textDecoration = 'line-through';
    nameEl.style.opacity = '0.7'; // Optional: makes it look slightly faded
  }

  const dateEl = document.createElement('span');
  dateEl.className = 'bar-dates';
  dateEl.textContent = `${formatShort(start)} – ${formatShort(end)}`;

  bar.appendChild(nameEl);
  //bar.appendChild(dateEl);

  bar.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    openEdit(p.id);
  });

  // RIGHT-CLICK EVENT
  bar.addEventListener('contextmenu', e => {
    // 1. Block the standard browser menu
    e.preventDefault(); 
    e.stopPropagation();

    // 2. Permission Check
    if (!IS_ADMIN) {
        console.warn("Viewers cannot duplicate projects.");
        return;
    }
    

    duplicateProject(p.id);
  });

  return bar;
}

// ─── FILTER ─────────────────────────────────────
function filterView(type, value) {
  activeFilter = type === 'all' ? 'all' : value;
  document.getElementById('btnAll').classList.toggle('active', type === 'all');
  if (type === 'all') {
    document.getElementById('staffFilter').value = '';
  }
  renderAll();
}

// ─── FORM ───────────────────────────────────────
function openForm() {
   const form = document.getElementById('projectForm');
  form.classList.remove('closing');

  editingId = null;
  document.getElementById('formTitle').textContent = 'Add Project';
  document.getElementById('name').value = '';
  document.getElementById('staff').value = STAFF[0];
  document.getElementById('startDate').value = '';
  document.getElementById('endDate').value   = '';
  setSelectedColor('#F59E0B');
  document.getElementById('deleteRow').style.display = 'none';
  document.getElementById('projectForm').classList.add('open');
  document.getElementById('projectComments').value = '';
}

function openEdit(id) {
  const p = findProject(id);
  if (!p) return;
  editingId = id;
  document.getElementById('formTitle').textContent = 'Project Details';
  document.getElementById('name').value      = p.name;
  document.getElementById('staff').value     = p.staff;
  document.getElementById('startDate').value = p.start;
  document.getElementById('endDate').value   = p.end;

 // Set the comments value
  document.getElementById('projectComments').value = p.comments || '';

  // Set Color and Status Toggle
  setSelectedColor(p.color || '#F59E0B');
  modalCompletedState = p.completed || false;
  updateModalCompleteUI();

// UPDATED Permissions Check
  const adminOnlyInputs = ['name', 'staff', 'startDate', 'endDate']; 
  adminOnlyInputs.forEach(inputId => {
    const el = document.getElementById(inputId);
    if (el) el.disabled = !IS_ADMIN;
  });

  // 3. LOCK COLOR & COMPLETION TOGGLES
  const colorSwatches = document.querySelectorAll('.color-swatch');
  const completeBtn = document.getElementById('modalCompleteBtn');
  const customSwatch = document.getElementById('customSwatch');

  if (!IS_ADMIN) {
    // Disable Color Swatches
    colorSwatches.forEach(s => {
      s.style.pointerEvents = 'none';
      s.style.opacity = '0.6';
    });
    // Disable Custom Color Trigger
    if (customSwatch) customSwatch.style.pointerEvents = 'none';
    
    // Disable Completion Toggle
    if (completeBtn) {
      completeBtn.style.pointerEvents = 'none';
      completeBtn.style.opacity = '0.7';
    }
  } else {
    // Re-enable for Admins (in case it was locked by previous view)
    colorSwatches.forEach(s => {
      s.style.pointerEvents = 'auto';
      s.style.opacity = '1';
    });
    if (customSwatch) customSwatch.style.pointerEvents = 'auto';
    if (completeBtn) {
      completeBtn.style.pointerEvents = 'auto';
      completeBtn.style.opacity = '1';
    }
  }

  // Keep the comments textarea enabled for everyone
  document.getElementById('projectComments').disabled = false;

  // 3. Ensure the Save button is visible for everyone now
  // Since non-admins can now "Save" comment changes
  document.querySelector('.btn-save').style.display = 'block';

  // 4. Keep administrative buttons (Delete) hidden for non-admins
  document.getElementById('deleteRow').style.display = IS_ADMIN ? 'block' : 'none';
  
  document.getElementById('projectForm').classList.add('open');
}

function closeForm() {
  const form = document.getElementById('projectForm');

  form.classList.remove('open');
  form.classList.add('closing');

  // Wait for animation to finish before fully resetting
  setTimeout(() => {
    form.classList.remove('closing');
    editingId = null;
  }, 180); // match CSS duration
}

function handleModalClick(e) {
  if (e.target === document.getElementById('projectForm')) closeForm();
}

async function saveProject() {
  // 1. Capture Form Inputs
  const name  = document.getElementById('name').value.trim();
  const staff = document.getElementById('staff').value;
  const start = document.getElementById('startDate').value;
  const end   = document.getElementById('endDate').value;
  const color = selectedColor;
  const completed = modalCompletedState; 
  const comments = document.getElementById('projectComments').value.trim();

  // 2. Basic Validation (Only strictly enforced for Admins creating/editing core details)
  if (IS_ADMIN && (!name || !start || !end)) {
    alert('Please fill in all fields.');
    return;
  }

  if (IS_ADMIN && (new Date(start) > new Date(end))) {
    alert('Start date must be before end date.');
    return;
  }

  let projectToSync;

  // 3. Update Local State
  if (editingId !== null) {
    // Update existing project
    projectToSync = findProject(editingId);
    if (projectToSync) {
      if (IS_ADMIN) {
        // Admins can update everything
        Object.assign(projectToSync, { 
          name, 
          staff, 
          start, 
          end, 
          color, 
          completed, 
          comments 
        });
      } else {
        // Non-admins ONLY update the comments field
        projectToSync.comments = comments;
      }
    }
  } else {
    // Only admins can create new projects
    if (!IS_ADMIN) {
      alert("You do not have permission to create projects.");
      return;
    }

    projectToSync = { 
      id: Date.now(), 
      name, 
      staff, 
      start, 
      end, 
      color, 
      completed, 
      comments 
    };
    if (!projects[currentYear]) projects[currentYear] = [];
    projects[currentYear].push(projectToSync);
  }

  // 4. Optimistic UI Update
  closeForm(); 
  renderAll();

  // 5. Background Synchronization
  setSyncing(true);
  try {
    await saveProjects(projectToSync);
    console.log("Sync successful");
  } catch (err) {
    console.error("Sync failed:", err);
  } finally {
    setSyncing(false);
  }
}

async function deleteProject() {
  if (editingId === null) return;

  const idToDelete = editingId; // Capture the ID before closing the form

  // 1. Remove from local state
  projects[currentYear] = (projects[currentYear] || []).filter(p => p.id !== idToDelete);

  // 2. Persist the deletion
  setSyncing(true);
  try {
    if (USE_SUPABASE && supabase) {
      // Explicitly delete from Supabase
      const { error } = await supabase.from('projects').delete().eq('id', idToDelete);
      if (error) throw error;
    } else {
      saveToLocal();
    }
    console.log("Deletion successful");
  } catch (err) {
    console.error("Deletion failed:", err);
    alert("Failed to delete from server. Please try again.");
  } finally {
    setSyncing(false);
  }

  closeForm();
  renderAll();
}

// ─── COLOR PICKER ───────────────────────────────
function selectColor(el) {
  selectedColor = el.dataset.color;
  
  // Remove active class from all swatches (including custom)
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
  
  // Add active class to clicked swatch
  el.classList.add('active');
  
  // Reset the custom trigger background if a preset is picked
  document.getElementById('customSwatch').style.background = 'linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet)';
}

// Function for the custom picker
function handleCustomColor(hex) {
  selectedColor = hex;
  
  const customSwatch = document.getElementById('customSwatch');
  
  // Update UI to show the custom color is active
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
  customSwatch.classList.add('active');
  
  // Change the rainbow background to the selected solid color
  customSwatch.style.background = hex;
}

// Update setSelectedColor (used when editing a project)
function setSelectedColor(hex) {
  selectedColor = hex;
  let matched = false;
  
  document.querySelectorAll('.color-swatch').forEach(s => {
    const isMatch = s.dataset.color === hex;
    s.classList.toggle('active', isMatch);
    if (isMatch) matched = true;
  });

  // If the color isn't a preset, treat it as custom
  if (!matched) {
    const customSwatch = document.getElementById('customSwatch');
    customSwatch.classList.add('active');
    customSwatch.style.background = hex;
    document.getElementById('customColorInput').value = hex;
  }
}

function triggerCustomColor() {
  document.getElementById('customColorInput').click();
}

// ─── PERSISTENCE: LOCAL STORAGE ─────────────────
function loadFromLocal() {
  const raw = localStorage.getItem('retain_projects');
  return raw ? JSON.parse(raw) : { 2026: [], 2027: [], 2028: [] };
}

function saveToLocal() {
  localStorage.setItem('retain_projects', JSON.stringify(projects));
}

// ─── PERSISTENCE: SUPABASE ──────────────────────
// Requires: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
// in your <head>. The free Supabase tier is plenty for this use case.
//
// Supabase table setup (run in Supabase SQL editor):
// ─────────────────────────────────────────────────
//   create table projects (
//     id         bigint primary key,
//     year       int         not null,
//     name       text        not null,
//     staff      text        not null,
//     start_date date        not null,
//     end_date   date        not null,
//     color      text        not null default '#F59E0B'
//   );
//   -- Enable Row Level Security (RLS) for a team:
//   alter table projects enable row level security;
//   create policy "allow all" on projects for all using (true);
// ─────────────────────────────────────────────────

function initSupabase() {
  if (!USE_SUPABASE || !window.supabase) return null;
  return window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

async function loadFromSupabase() {
  const { data, error } = await supabase.from('projects').select('*');
  if (error) { console.error(error); return null; }

  const grouped = { 2026: [], 2027: [], 2028: [] };
  data.forEach(row => {
    if (!grouped[row.year]) grouped[row.year] = [];
    grouped[row.year].push({
      id:    row.id,
      name:  row.name,
      staff: row.staff,
      start: row.start_date,
      end:   row.end_date,
      color: row.color,
      completed: row.completed,
      comments: row.comments
    });
  });
  return grouped;
}

async function saveToSupabase() {
// Use Object.keys to get ALL years dynamically instead of hardcoded [2026, 2027, 2028]
  Object.keys(projects).forEach(year => {
    (projects[year] || []).forEach(p => {
      rows.push({
        id:         p.id,
        year:       parseInt(year),
        name:       p.name,
        staff:      p.staff,
        start_date: p.start,
        end_date:   p.end,
        color:      p.color,
        completed:  p.completed,
        comments:   p.comments
      });
    });
  });

  const { error } = await supabase.from('projects').upsert(rows);
  if (error) console.error('Supabase save error:', error);
}

/// ─── UNIFIED LOAD / SAVE (REPLACEMENT BLOCK) ────────────────────────
async function loadProjects() {
  let success = false;

  if (USE_SUPABASE) {
    try {
      supabase = initSupabase(); 
      
      // Added 'holidays' to the parallel fetch
      const [remoteProjects, { data: staffData }, { data: holidayData }] = await Promise.all([
        loadFromSupabase(),
        supabase.from('staff').select('name').order('display_order', { ascending: true }),
        supabase.from('holidays').select('*') // NEW: Fetch holidays
      ]);

      if (staffData) STAFF = staffData.map(s => s.name); 
      if (holidayData) holidays = holidayData; // NEW: Update local holiday state
      projects = remoteProjects || projects;
      
      updateDbStatus('Supabase', true); 
      success = true;
    } catch (err) {
      console.warn("Supabase failed, falling back to local storage:", err);
    }
  }

  if (!success) {
    // Local Fallback logic
    projects = loadFromLocal(); 
    const rawStaff = localStorage.getItem('retain_staff'); 
    const rawHolidays = localStorage.getItem('retain_holidays');
    if (rawStaff) STAFF = JSON.parse(rawStaff);
    if (rawHolidays) holidays = JSON.parse(rawHolidays);
    updateDbStatus('Local Storage', false); 
  }
}


function loadStaffLocal() {
  const raw = localStorage.getItem('retain_staff');
  // Use saved list OR the original defaults if nothing exists
  STAFF = raw ? JSON.parse(raw) : ['Joshua', 'Vanessa', 'Vivian 1', 'Padmore', 'Eugene'];
}

async function saveProjects(singleProject = null) {
  if (USE_SUPABASE && supabase) {
    if (singleProject) {
      // Only update the specific row changed
      const row = {
        id: singleProject.id,
        year: currentYear,
        name: singleProject.name,
        staff: singleProject.staff,
        start_date: singleProject.start,
        end_date: singleProject.end,
        color: singleProject.color,
        completed: singleProject.completed,
        comments: singleProject.comments
      };
      const { error } = await supabase.from('projects').upsert(row);
      if (error) throw error;
    } else {
      // Fallback for bulk saves if needed
      await saveToSupabase();
    }
  } else {
    saveToLocal();
  }
}

function updateDbStatus(label, isRemote) {
  const el = document.getElementById('dbStatus');
  el.querySelector('span:last-child').textContent = label;
  el.querySelector('.db-dot').style.background = isRemote ? '#6366F1' : '#10B981';
  el.querySelector('.db-dot').style.boxShadow  = isRemote
    ? '0 0 6px #6366F1'
    : '0 0 6px #10B981';
}

// ─── HELPERS ────────────────────────────────────
function findProject(id) {
  for (const year in projects) {
    const p = (projects[year] || []).find(p => p.id === id);
    if (p) return p;
  }
  return null;
}

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff  = date - start;
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

function daysBetween(a, b) {
  return Math.round(Math.abs(b - a) / (1000 * 60 * 60 * 24)) + 1;
}

function formatShort(date) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatFull(date) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getLuminance(hex) {
  if (!hex || hex[0] !== '#') return 0.5;
  const r = parseInt(hex.slice(1,3),16) / 255;
  const g = parseInt(hex.slice(3,5),16) / 255;
  const b = parseInt(hex.slice(5,7),16) / 255;
  return 0.299*r + 0.587*g + 0.114*b;
}

// ─── UNIFIED COLOR PICKER LOGIC ─────────────────
const panel = document.getElementById('pickerPanel');
const canvas = document.getElementById('colorCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const hueRange = document.getElementById('hueRange');
const customSwatch = document.getElementById('customSwatch');
const cursor = document.getElementById('pickerCursor');

let currentHue = 0;

function toggleCustomPicker() {
  panel.classList.toggle('hidden');
  drawCanvas();
}

// Handle Preset Swatches
function selectColor(el) {
  selectedColor = el.dataset.color; // Update the global state
  
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
  el.classList.add('active');
  
  // Reset custom swatch appearance
  customSwatch.style.background = 'linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet)';
  panel.classList.add('hidden'); 
}

// Draw the Canvas Gradient
function drawCanvas() {
  const width = canvas.width = 200;
  const height = canvas.height = 150;

  ctx.fillStyle = `hsl(${currentHue}, 100%, 50%)`;
  ctx.fillRect(0, 0, width, height);

  let whiteGrad = ctx.createLinearGradient(0, 0, width, 0);
  whiteGrad.addColorStop(0, 'white');
  whiteGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = whiteGrad;
  ctx.fillRect(0, 0, width, height);

  let blackGrad = ctx.createLinearGradient(0, 0, 0, height);
  blackGrad.addColorStop(0, 'rgba(0,0,0,0)');
  blackGrad.addColorStop(1, 'black');
  ctx.fillStyle = blackGrad;
  ctx.fillRect(0, 0, width, height);
}

// Update setSelectedColor (Used when OPENING the edit modal)
function setSelectedColor(hex) {
  selectedColor = hex;
  let matched = false;
  
  document.querySelectorAll('.color-swatch').forEach(s => {
    const isMatch = s.dataset.color === hex;
    s.classList.toggle('active', isMatch);
    if (isMatch) matched = true;
  });

  if (!matched) {
    customSwatch.classList.add('active');
    customSwatch.style.background = hex;
  } else {
    customSwatch.style.background = 'linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet)';
  }
}

// Hue Slider Event
hueRange.addEventListener('input', () => {
  currentHue = hueRange.value;
  drawCanvas();
});

// Canvas Interaction
canvas.addEventListener('mousedown', (e) => {
  const pick = (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(event.clientY - rect.top, rect.height));

    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const hex = "#" + ((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1);
    
    // Update global state and UI
    selectedColor = hex;
    cursor.style.left = x + 'px';
    cursor.style.top = y + 'px';
    customSwatch.style.background = hex;
    
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    customSwatch.classList.add('active');
  };

  pick(e);
  window.onmousemove = pick;
  window.onmouseup = () => window.onmousemove = null;
});

// Click outside to close
window.addEventListener('click', (e) => {
  if (!e.target.closest('.color-row') && !e.target.closest('.picker-panel')) {
    panel.classList.add('hidden');
  }
});

function highlightDay(canvas, dayIndex, color = 'rgba(227, 216, 56, 0.68)') {
    const totalDays = totalDaysInYear(currentYear);
    const startPos = ((dayIndex - 1) / totalDays) * 100;
    const endPos = (dayIndex / totalDays) * 100;

    // We combine the existing daily lines with a new highlight stripe
    canvas.style.backgroundImage = `
        linear-gradient(
            to right, 
            transparent ${startPos}%, 
            ${color} ${startPos}%, 
            ${color} ${endPos}%, 
            transparent ${endPos}%
        ),
        linear-gradient(to right, var(--border) 1px, transparent 1px)`;
    canvas.style.backgroundSize = `100% 100%, ${100 / totalDays}% 100%`;
    canvas.style.backgroundRepeat = `no-repeat, repeat-x`;
}

function buildGridHighlights(totalDays) {
  const layer = document.getElementById('gridHighlightLayer');
  if (layer) {
    layer.style.zIndex = "1"; // Keep it low
    layer.style.pointerEvents = "none"; // Ensure it doesn't block clicks
  }

  // 1. Sync the CSS variable for the grid columns
  document.documentElement.style.setProperty('--total-days', totalDays);

  layer.innerHTML = '';
  layer.style.gridTemplateColumns = `var(--staff-col-w) repeat(${totalDays}, 1fr)`;
  
  // 2. Match the width of your other timeline elements
  layer.style.width = "8000px"; 

  const now = new Date();
  const todayAtMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  for (let d = 1; d <= totalDays; d++) {
    const date = new Date(currentYear, 0, d);
    const dateStr = date.getTime();
    const dayOfWeek = date.getDay();
    
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isToday = (currentYear === now.getFullYear() && dateStr === todayAtMidnight);

    if (isWeekend || isToday) {
      const highlight = document.createElement('div');
      highlight.className = 'col-highlight';
      highlight.style.gridColumn = d + 1; // +1 to skip staff column

      if (isWeekend) highlight.classList.add('is-weekend');
      if (isToday) highlight.classList.add('is-today');

      layer.appendChild(highlight);
    }
  }

  // Add Holidays
  holidays.forEach(h => {
    const hDate = new Date(h.date);
    if (hDate.getFullYear() === currentYear) {
      const highlight = document.createElement('div');
      highlight.className = 'col-highlight is-holiday';
      highlight.style.gridColumn = h.dayIdx + 1;
      layer.appendChild(highlight);
    }
  });

  // Sync height to cover all rows, not just the visible viewport
  requestAnimationFrame(() => {
    const wrapper = document.querySelector('.timeline-wrapper');
    const rowsContainer = document.getElementById('rowsContainer');
    const wrapperH = wrapper ? wrapper.offsetHeight : 0;
    const rowsH = rowsContainer ? rowsContainer.offsetHeight : 0;
    layer.style.height = (wrapperH + rowsH) + 'px';
  });
}

/**
 * Highlights a specific day column across the whole timeline
 * @param {number} dayOfYear - The day number (1-365)
 * @param {string} className - The CSS class to apply (e.g., 'is-today' or 'is-holiday')
 */
function highlightColumn(dayOfYear, className) {
  const layer = document.getElementById('gridHighlightLayer');
  const highlight = document.createElement('div');
  
  highlight.className = `col-highlight ${className}`;
  
  // dayOfYear + 1 because the first grid column is the Staff Column
  highlight.style.gridColumn = dayOfYear + 1; 
  
  layer.appendChild(highlight);
}

function populateStaffFilter() {
  const filter = document.getElementById('staffFilter');
  const staffSelect = document.getElementById('staff'); // The one in the "Add Project" modal
  
  // Save the first "default" option
  const defaultOption = filter.options[0];
  
  // Clear existing options
  filter.innerHTML = '';
  filter.appendChild(defaultOption);
  
  // Also clear the "Add Project" modal dropdown if you want that synced too
  if (staffSelect) staffSelect.innerHTML = '';

  STAFF.forEach(name => {
    // 1. Add to the Filter Dropdown
    const optFilter = document.createElement('option');
    optFilter.textContent = name;
    optFilter.value = name;
    filter.appendChild(optFilter);

    // 2. Add to the Modal Dropdown (Project Form)
    if (staffSelect) {
      const optModal = document.createElement('option');
      optModal.textContent = name;
      optModal.value = name;
      staffSelect.appendChild(optModal);
    }
  });
}

function renderYearNav() {
  const nav = document.getElementById("yearNav");
  nav.innerHTML = ''; // Clear hardcoded buttons
  
  // Get all years, sort them, and create buttons
  Object.keys(projects).sort().forEach(year => {
    const btn = document.createElement("button");
    btn.className = "year-btn";
    if (parseInt(year) === currentYear) btn.classList.add('active');
    btn.textContent = year;
    btn.onclick = () => switchYear(parseInt(year));
    nav.appendChild(btn);
  });
}

// Open/Close functions
function openStaffModal() {
  document.getElementById('staffModal').classList.add('open');
  renderStaffList();
}

function closeStaffModal() {
  document.getElementById('staffModal').classList.remove('open');
  document.getElementById('newStaffName').value = '';
}

function handleStaffModalClick(e) {
  if (e.target === document.getElementById('staffModal')) closeStaffModal();
}

// Render the list of current staff with delete buttons
function renderStaffList() {
  const container = document.getElementById('staffListContainer');
  container.innerHTML = '';
  
  STAFF.forEach((member, index) => {
    const item = document.createElement('div');
    item.className = 'staff-list-item'; // Using your existing class
    item.style = "display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid var(--border-soft); color: white; font-size: 14px;";
    
    item.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <div class="reorder-controls" style="display: flex; flex-direction: column; gap: 2px;">
          <button onclick="moveStaff(${index}, -1)" ${index === 0 ? 'disabled style="opacity:0.3"' : ''} class="btn-reorder">▲</button>
          <button onclick="moveStaff(${index}, 1)" ${index === STAFF.length - 1 ? 'disabled style="opacity:0.3"' : ''} class="btn-reorder">▼</button>
        </div>
        <span 
          contenteditable="${IS_ADMIN}" 
          class="editable-staff-name" 
          onblur="renameStaffInline(${index}, this)"
          onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}"
        >${member}</span>
      </div>
      
      <button onclick="removeStaff(${index})" class="btn-list-delete" style="width: auto !important; padding: 4px 8px !important; margin: 0 !important;">Remove</button>
    `;
    container.appendChild(item);
  });
}

// Logic to Add Staff
async function addStaff() {
  const nameInput = document.getElementById('newStaffName');
  const name = nameInput.value.trim();
  
  if (name && !STAFF.includes(name)) {
    STAFF.push(name);
    
    // Save locally immediately
    localStorage.setItem('retain_staff', JSON.stringify(STAFF));
    
    // Save to Supabase if active
    if (USE_SUPABASE && supabase) {
      await supabase.from('staff').insert([{ name }]);
    }

    nameInput.value = '';
    populateStaffFilter();
    renderStaffList();
    renderAll();
  }
}

// Logic to Remove Staff
async function removeStaff(index) {
  const nameToRemove = STAFF[index];
  if (confirm(`Remove ${nameToRemove}?`)) {
    // 1. Remove from local state
    STAFF.splice(index, 1);
    
    // 2. Update local storage
    localStorage.setItem('retain_staff', JSON.stringify(STAFF));
    
    // 3. Remove from Supabase explicitly
    if (USE_SUPABASE && supabase) {
      setSyncing(true); // Visual feedback
      try {
        const { error } = await supabase
          .from('staff')
          .delete()
          .eq('name', nameToRemove);
        
        if (error) throw error;
        console.log("Staff removed from cloud");
      } catch (err) {
        console.error("Cloud staff deletion failed:", err);
      } finally {
        setSyncing(false);
      }
    }

    populateStaffFilter();
    renderStaffList();
    renderAll();
  }
}

// Open/Close
function openHolidayModal() {
  document.getElementById('holidayModal').classList.add('open');
  renderHolidayList();
}

function closeHolidayModal() {
  document.getElementById('holidayModal').classList.remove('open');
}

function handleHolidayModalClick(e) {
  if (e.target === document.getElementById('holidayModal')) closeHolidayModal();
}

// Add Holiday Logic
async function addHoliday() {
  const name = document.getElementById('holidayName').value.trim();
  const dateVal = document.getElementById('holidayDate').value;

  if (!name || !dateVal) return alert("Please fill both fields");

  const dateObj = new Date(dateVal);
  const dayIdx = dayOfYear(dateObj);
  const newHoliday = { name, date: dateVal, day_idx: dayIdx };

  // 1. Update Local State & Storage
  holidays.push(newHoliday);
  localStorage.setItem('retain_holidays', JSON.stringify(holidays));

  // 2. Sync to Supabase
  if (USE_SUPABASE && supabase) {
    setSyncing(true);
    try {
      const { error } = await supabase.from('holidays').insert([newHoliday]);
      if (error) throw error;
    } catch (err) {
      console.error("Cloud holiday save failed:", err);
    } finally {
      setSyncing(false);
    }
  }
  
  document.getElementById('holidayName').value = '';
  document.getElementById('holidayDate').value = '';
  renderHolidayList();
  renderAll(); 
}

// Remove Holiday
async function removeHoliday(index) {
  const holidayToRemove = holidays[index];
  
  // 1. Remove from Local State & Storage
  holidays.splice(index, 1);
  localStorage.setItem('retain_holidays', JSON.stringify(holidays));

  // 2. Remove from Supabase
  if (USE_SUPABASE && supabase) {
    setSyncing(true);
    try {
      const { error } = await supabase
        .from('holidays')
        .delete()
        .eq('name', holidayToRemove.name)
        .eq('date', holidayToRemove.date);
      
      if (error) throw error;
    } catch (err) {
      console.error("Cloud holiday deletion failed:", err);
    } finally {
      setSyncing(false);
    }
  }

  renderHolidayList();
  renderAll();
}

// UI List inside Modal
function renderHolidayList() {
  const container = document.getElementById('holidayListContainer');
  container.innerHTML = '';
  
  holidays.forEach((h, i) => {
    const item = document.createElement('div');
    item.className = 'staff-list-item'; // Reuse your staff list item style
    item.style = "display: flex; justify-content: space-between; padding: 8px; color: white; font-size: 13px;";
    item.innerHTML = `
      <span>${h.name} (${formatShort(new Date(h.date))})</span>
      <button onclick="removeHoliday(${i})" style="width: auto; background: #f9f9f9; color: var(--danger); border: none; cursor: pointer; font-size: 12px;">Remove</button>
    `;
    container.appendChild(item);
  });
}

// Open the Modal and show existing years
function addYear() {
  document.getElementById('yearModal').classList.add('open');
  renderYearList(); // New: show the list
  document.getElementById('newYearInput').focus();
}

// Render the list of years with delete buttons
function renderYearList() {
  const container = document.getElementById('yearListContainer');
  container.innerHTML = '';
  
  // Get all years currently in our projects object
  const existingYears = Object.keys(projects).sort((a, b) => a - b);
  
  existingYears.forEach(year => {
    const item = document.createElement('div');
    item.style = "display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid var(--border-soft); color: white; font-size: 14px;";
    
    // Don't allow deleting the year currently being viewed to avoid UI crashes
    const isCurrent = parseInt(year) === currentYear;
    
    item.innerHTML = `
      <span>${year} ${isCurrent ? '<small>(Active)</small>' : ''}</span>
      ${!isCurrent ? `<button onclick="removeYear(${year})" style="width: auto; background: #f9f9f9; color: var(--danger); border: none; cursor: pointer; font-size: 12px;">Remove</button>` : ''}
    `;
    container.appendChild(item);
  });
}

// Logic to Delete a Year
async function removeYear(year) {
  if (confirm(`Are you sure you want to remove ${year}? All projects for this year will be deleted.`)) {
    // 1. Remove from local data object
    delete projects[year];
    
    // 2. Remove the button from the sidebar UI
    const nav = document.getElementById("yearNav");
    const buttons = Array.from(nav.querySelectorAll('.year-btn'));
    const btnToRemove = buttons.find(btn => parseInt(btn.textContent) === year);
    if (btnToRemove) btnToRemove.remove();
    
    // 3. Sync deletion to Supabase
    if (USE_SUPABASE && supabase) {
      setSyncing(true);
      try {
        // Delete all rows where the 'year' column matches
        const { error } = await supabase
          .from('projects')
          .delete()
          .eq('year', year);
        
        if (error) throw error;
      } catch (err) {
        console.error("Failed to delete year from cloud:", err);
      } finally {
        setSyncing(false);
      }
    } else {
      saveToLocal();
    }

    renderYearList();
  }
}

// Update your saveNewYear to refresh the list
function saveNewYear() {
  const yearInput = document.getElementById('newYearInput').value;
  const yearNum = parseInt(yearInput);

  if (!yearNum || yearNum < 2000 || yearNum > 2100) {
    alert("Please enter a valid year.");
    return;
  }

  if (!projects[yearNum]) {
    projects[yearNum] = [];
    
    // Add button to sidebar
    const nav = document.getElementById("yearNav");
    const btn = document.createElement("button");
    btn.className = "year-btn";
    btn.textContent = yearNum;
    btn.onclick = () => switchYear(yearNum);
    nav.appendChild(btn);
  }

  saveProjects();
  renderYearList(); // Refresh the list in the modal
  document.getElementById('newYearInput').value = '';
}

// --- NOTIFICATION LOGIC ---
function openNotifModal() {
  const modal = document.getElementById('notifModal');
  if (modal) {
    modal.classList.add('open');
    renderNotifList(); // Make sure this function exists too!
  } else {
    console.error("Could not find notifModal element");
  }
}

function closeNotifModal() {
  document.getElementById('notifModal').classList.remove('open');
}

function handleNotifModalClick(e) {
  if (e.target === document.getElementById('notifModal')) closeNotifModal();
}


function getProjectAlerts() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let alerts = [];
  const realYear = new Date().getFullYear();
  const activeProjects = projects[realYear] || [];

  activeProjects.forEach(p => {

    // NEW: Skip this project if it is marked as completed
    if (p.completed) return;

    const dueDate = new Date(p.end + 'T00:00:00');
    dueDate.setHours(0, 0, 0, 0);
    
    const diffTime = dueDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= -1) {
      const daysOverdue = Math.abs(diffDays);
      alerts.push({ 
        name: p.name, 
        staff: p.staff, 
        type: 'past', 
        daysDiff: diffDays, // Store for sorting
        msg: `Overdue by ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}` 
      });
    } else if (diffDays === 0) {
      alerts.push({ 
        name: p.name, 
        staff: p.staff, 
        type: 'due', 
        daysDiff: 0, 
        msg: 'Due today' 
      });
    } else if (diffDays > 0 && diffDays <= 3) {
      alerts.push({ 
        name: p.name, 
        staff: p.staff, 
        type: 'soon', 
        daysDiff: diffDays, 
        msg: `Due in ${diffDays} days` 
      });
    }
  });
  
  // SORTING LOGIC: Smallest (most negative) number comes first.
  // This puts -5 (overdue) before -1, before 0 (today), before 3 (soon).
  return alerts.sort((a, b) => a.daysDiff - b.daysDiff);
}

function updateNotifBadge() {
  const alerts = getProjectAlerts();
  const badge = document.getElementById('notifBadge');
  
  if (alerts.length > 0) {
    badge.textContent = alerts.length;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function renderNotifList() {
  const container = document.getElementById('notifListContainer');
  const alerts = getProjectAlerts();
  container.innerHTML = '';

  if (alerts.length === 0) {
    container.innerHTML = '<p style="color: var(--text-dim); text-align: center; padding: 20px;">No urgent alerts right now.</p>';
    return;
  }

  alerts.forEach(a => {
    const item = document.createElement('div');
    item.className = `notif-item status-${a.type}`;
    item.innerHTML = `
      <div class="notif-info">
        <strong>${a.name}</strong>
        <span>Assignee: ${a.staff}</span>
      </div>
      <div class="notif-status">${a.msg}</div>
    `;
    container.appendChild(item);
  });
}

function setSyncing(isSyncing) {
  const dot = document.querySelector('.db-dot');
  const label = document.querySelector('#dbStatus span:last-child');
  
  if (isSyncing) {
    dot.classList.add('syncing');
    label.classList.add('sync-text');
    label.dataset.originalText = label.textContent; // Store "Supabase" or "Local Storage"
    label.textContent = "Syncing...";
  } else {
    dot.classList.remove('syncing');
    label.classList.remove('sync-text');
    label.textContent = label.dataset.originalText || "Supabase";
  }
}

function calculateLanes(staffProjects) {
  // Sort projects by start date first
  const sorted = [...staffProjects].sort((a, b) => new Date(a.start) - new Date(b.start));
  const lanes = [];

  sorted.forEach(project => {
    let assignedLane = 0;
    
    // Check each lane to see if this project fits
    while (true) {
      const collision = lanes[assignedLane]?.some(p => {
        const pStart = new Date(p.start);
        const pEnd = new Date(p.end);
        const currStart = new Date(project.start);
        const currEnd = new Date(project.end);
        // Overlap logic: (StartA <= EndB) and (EndA >= StartB)
        return currStart <= pEnd && currEnd >= pStart;
      });

      if (!collision) {
        if (!lanes[assignedLane]) lanes[assignedLane] = [];
        lanes[assignedLane].push(project);
        project.lane = assignedLane; // Attach lane index to project object
        break;
      }
      assignedLane++;
    }
  });
  return lanes.length; // Total lanes needed
}

// --- AUTO-POPUP LOGIC ---

function checkAutoNotify() {
  const now = new Date();
  const currentTime = now.getTime();
  const todayDate = now.toDateString(); // e.g., "Fri Apr 17 2026"

  const lastPopupTime = localStorage.getItem('last_notif_popup_time');
  const lastPopupDate = localStorage.getItem('last_notif_popup_date');

  let shouldShow = false;

  // Condition 1: First time opening the app today
  if (lastPopupDate !== todayDate) {
    shouldShow = true;
  } 
  // Condition 2: Every 3 hours (3 hours = 10,800,000 milliseconds)
  else if (lastPopupTime && (currentTime - lastPopupTime > 10800000)) {
    shouldShow = true;
  }

  if (shouldShow) {
    // Only show if there are actual alerts to see
    const alerts = getProjectAlerts();
    if (alerts.length > 0) {
      openNotifModal();
      // Record the time and date of this popup
      localStorage.setItem('last_notif_popup_time', currentTime);
      localStorage.setItem('last_notif_popup_date', todayDate);
    }
  }
}

function applyPermissions() {
  if (!IS_ADMIN) {
    // 1. Hide Management Buttons
    const toHide = ['#add-year-btn', '#staff-btn', '#holiday-btn', '.add-btn'];
    toHide.forEach(selector => {
      const el = document.querySelector(selector);
      if (el) el.style.display = 'none';
    });

    // 2. Hide "Remove" buttons in the Year/Staff/Holiday lists 
    // (in case they find a way to open those modals)
    const style = document.createElement('style');
    style.innerHTML = `
      .btn-list-delete, 
      .btn-delete, 
      #staffModal .modal-actions,   /* Hide staff save */
      #holidayModal .modal-actions, /* Hide holiday save */
      #yearModal .modal-actions     /* Hide year save */
      { display: none !important; }
      
      /* Explicitly ensure project save is visible for comment editing */
      #projectForm .modal-actions { display: flex !important; }

      /* Ensure notification modal actions remain visible */
      #notifModal .modal-actions { display: flex !important; }
      
      .project-bar { cursor: default !important; }
    `;
    document.head.appendChild(style);

    // 3. Mark the body
    document.body.classList.add('viewer-mode');
  }
}

// --- SECURE PIN MODAL LOGIC ---

function openPinModal() {
  document.getElementById('pinModal').classList.add('open');
  const input = document.getElementById('pinInput');
  input.value = '';
  input.focus();
}

function closePinModal() {
  document.getElementById('pinModal').classList.remove('open');
  document.getElementById('pinInput').value = '';
}

function verifyPin() {
  const pin = document.getElementById('pinInput').value;
  const url = new URL(window.location.href);

  if (pin === '$123') { // Replace with your PIN
    url.searchParams.set('admin', 'true');
    window.location.href = url.toString();
  } else {
    alert("Incorrect PIN.");
    document.getElementById('pinInput').value = '';
  }
}

// Shortcut: Ctrl + Shift + A
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'A') {
    e.preventDefault();
    if (IS_ADMIN) {
      const url = new URL(window.location.href);
      url.searchParams.delete('admin');
      window.location.href = url.toString();
    } else {
      openPinModal();
    }
  }
});

// Allow pressing "Enter" inside the PIN modal
document.getElementById('pinInput')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') verifyPin();
});

async function renameStaffInline(index, element) {
  const newName = element.innerText.trim();
  const oldName = STAFF[index];

  if (!newName || newName === oldName) {
    element.innerText = oldName;
    return;
  }

  // 1. Update local state
  STAFF[index] = newName;
  for (const year in projects) {
    projects[year].forEach(p => { 
      if (p.staff === oldName) p.staff = newName; 
    });
  }

  // 2. Persist locally
  localStorage.setItem('retain_staff', JSON.stringify(STAFF));
  saveToLocal(); // Saves the updated project assignments

  // 3. Persist to Supabase
  if (USE_SUPABASE && supabase) {
    setSyncing(true);
    try {
      // Step A: Update the staff table name
      const { error: staffError } = await supabase
        .from('staff')
        .update({ name: newName })
        .eq('name', oldName);
      
      if (staffError) throw staffError;

      // Step B: Update all projects assigned to the old name
      const { error: projectError } = await supabase
        .from('projects')
        .update({ staff: newName })
        .eq('staff', oldName);

      if (projectError) throw projectError;

      showToast("Staff updated successfully");
    } catch (err) {
      console.error("Cloud rename failed:", err);
      showToast("Sync Error", "danger");
      // Optional: Revert local state if DB fails
    } finally {
      setSyncing(false);
    }
  }

  populateStaffFilter();
  renderAll();
}

let modalCompletedState = false; // State tracker for the modal

function toggleModalComplete() {
    modalCompletedState = !modalCompletedState;
    updateModalCompleteUI();
}

function updateModalCompleteUI() {
    const btn = document.getElementById('modalCompleteBtn');
    const text = btn.querySelector('.status-text');
    
    if (modalCompletedState) {
        btn.classList.add('is-completed');
        text.textContent = 'Completed';
    } else {
        btn.classList.remove('is-completed');
        text.textContent = 'Mark as Completed';
    }
}

async function duplicateProject(originalId) {
  const original = findProject(originalId);
  if (!original) return;

  const duplicate = {
    ...original,
    id: Date.now(),
    name: `${original.name} (Copy)`
  };

  if (!projects[currentYear]) projects[currentYear] = [];
  projects[currentYear].push(duplicate);

  renderAll();
  
  // Show a themed toast instead of an alert
  showToast(`Duplicated: ${original.name}`);

  setSyncing(true);
  try {
    await saveProjects(duplicate);
  } catch (err) {
    console.error("Sync failed:", err);
    showToast("Sync Failed", "danger");
  } finally {
    setSyncing(false);
  }
}


function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <span class="toast-icon">${type === 'success' ? '✓' : '✕'}</span>
      <span class="toast-msg">${message}</span>
    </div>
  `;
  
  container.appendChild(toast);

  // Trigger animation
  setTimeout(() => toast.classList.add('visible'), 10);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

async function moveStaff(index, direction) {
  if (!IS_ADMIN) return;

  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= STAFF.length) return;

  // 1. Swap elements in the local array
  const temp = STAFF[index];
  STAFF[index] = STAFF[newIndex];
  STAFF[newIndex] = temp;

  // 2. Persist locally
  localStorage.setItem('retain_staff', JSON.stringify(STAFF));
  
  // 3. Persist to Supabase
  if (USE_SUPABASE && supabase) {
    setSyncing(true);
    try {
      // Update the order for both affected staff members
      const updates = STAFF.map((name, idx) => ({
        name: name,
        display_order: idx
      }));

      // Upsert the new order based on name
      const { error } = await supabase
        .from('staff')
        .upsert(updates, { onConflict: 'name' });

      if (error) throw error;
    } catch (err) {
      console.error("Cloud reorder failed:", err);
    } finally {
      setSyncing(false);
    }
  }

  renderStaffList();
  populateStaffFilter();
  renderAll();
}