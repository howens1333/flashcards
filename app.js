// ── DARK MODE ─────────────────────────────────────────────────────────────────

function initTheme() {
  const saved = localStorage.getItem('flashdeck_theme');
  if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('flashdeck_theme', 'light');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('flashdeck_theme', 'dark');
  }
}

initTheme();

// ── STORAGE: SETS ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'flashdeck_sets';
const FOLDERS_KEY = 'flashdeck_folders';

function getSets() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
}
function saveSets(sets) { localStorage.setItem(STORAGE_KEY, JSON.stringify(sets)); }
function getSet(id) { return getSets().find(s => s.id === id) || null; }
function saveSet(set) {
  const sets = getSets();
  const idx = sets.findIndex(s => s.id === set.id);
  if (idx >= 0) sets[idx] = set; else sets.push(set);
  saveSets(sets);
}
function deleteSet(id) {
  saveSets(getSets().filter(s => s.id !== id));
  const folders = getFolders();
  folders.forEach(f => { f.setIds = (f.setIds||[]).filter(sid => sid !== id); });
  saveFolders(folders);
}
function createSet(title, description='', folderId=null) {
  return { id: crypto.randomUUID(), title, description, folderId, created: Date.now(), modified: Date.now(), cards: [] };
}
function createCard(term='', definition='') {
  return { id: crypto.randomUUID(), term, definition };
}

// ── STORAGE: FOLDERS ──────────────────────────────────────────────────────────

function getFolders() {
  try { return JSON.parse(localStorage.getItem(FOLDERS_KEY)) || []; } catch { return []; }
}
function saveFolders(folders) { localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders)); }
function getFolder(id) { return getFolders().find(f => f.id === id) || null; }
function saveFolder(folder) {
  const folders = getFolders();
  const idx = folders.findIndex(f => f.id === folder.id);
  if (idx >= 0) folders[idx] = folder; else folders.push(folder);
  saveFolders(folders);
}
function deleteFolder(id) {
  const sets = getSets();
  sets.forEach(s => { if (s.folderId === id) s.folderId = null; });
  saveSets(sets);
  saveFolders(getFolders().filter(f => f.id !== id));
}
function createFolder(name, color='#2d5a27') {
  return { id: crypto.randomUUID(), name, color, created: Date.now() };
}
function getSetsInFolder(folderId) { return getSets().filter(s => s.folderId === folderId); }
function getUnfiledSets() { return getSets().filter(s => !s.folderId); }

// ── COMBINE ───────────────────────────────────────────────────────────────────

function combineSets(setIds, newTitle, newDescription='') {
  const sets = setIds.map(id => getSet(id)).filter(Boolean);
  if (sets.length < 2) { toast('Select at least 2 sets to combine.'); return null; }
  const combined = createSet(newTitle, newDescription);
  sets.forEach(s => s.cards.forEach(c => combined.cards.push(createCard(c.term, c.definition))));
  saveSet(combined);
  toast('Combined ' + sets.length + ' sets into "' + newTitle + '" (' + combined.cards.length + ' cards).');
  return combined;
}

// ── IMPORT / EXPORT ───────────────────────────────────────────────────────────

function exportSet(set) {
  const blob = new Blob([JSON.stringify(set, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = set.title.replace(/[^a-z0-9]/gi, '_') + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

function exportAllSets() {
  const sets = getSets();
  if (!sets.length) { toast('No sets to export.'); return; }
  const blob = new Blob([JSON.stringify({ flashdeck: true, version: 1, sets, folders: getFolders() }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'flashdeck_all_' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importFromJson(json, onSuccess) {
  try {
    const data = JSON.parse(json);
    if (data.flashdeck && Array.isArray(data.sets)) {
      let imported = 0;
      data.sets.forEach(set => {
        set.id = crypto.randomUUID();
        set.modified = Date.now();
        set.folderId = null;
        saveSet(set);
        imported++;
      });
      toast('Imported ' + imported + ' set' + (imported !== 1 ? 's' : '') + '.');
    } else if (data.title && Array.isArray(data.cards)) {
      data.id = crypto.randomUUID();
      data.modified = Date.now();
      data.folderId = null;
      saveSet(data);
      toast('Imported "' + data.title + '".');
    } else {
      toast('Invalid format — expected FlashDeck JSON.'); return;
    }
    if (onSuccess) onSuccess();
  } catch { toast('Could not parse JSON.'); }
}

function importFromFile(file, onSuccess) {
  const reader = new FileReader();
  reader.onload = e => importFromJson(e.target.result, onSuccess);
  reader.readAsText(file);
}

// ── SHARE VIA URL ─────────────────────────────────────────────────────────────

function setToShareUrl(set) {
  const slim = {
    title: set.title,
    description: set.description || '',
    cards: set.cards.map(c => ({ t: c.term, d: c.definition }))
  };
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(slim))));
  const base = window.location.href.split('?')[0].replace(/[^/]*$/, '');
  return base + 'import.html?share=' + encodeURIComponent(b64);
}

function shareUrlToSet(b64) {
  try {
    const slim = JSON.parse(decodeURIComponent(escape(atob(b64))));
    return {
      id: crypto.randomUUID(),
      title: slim.title,
      description: slim.description || '',
      folderId: null,
      created: Date.now(),
      modified: Date.now(),
      cards: slim.cards.map(c => createCard(c.t, c.d))
    };
  } catch { return null; }
}

// ── TOAST ─────────────────────────────────────────────────────────────────────

function toast(msg, duration=2800) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove());
  }, duration);
}

// ── UTILS ─────────────────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
}

function getParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

// ── STATISTICS ────────────────────────────────────────────────────────────────

const STATS_KEY = 'flashdeck_stats';

function getAllStats() {
  try { return JSON.parse(localStorage.getItem(STATS_KEY)) || {}; } catch { return {}; }
}

function getSetStats(setId) {
  return getAllStats()[setId] || { results: [] };
}

function saveTestResult(setId, result) {
  // result: { date, mode, direction, score, total, missed: [{term, definition, yourAnswer}] }
  const all = getAllStats();
  if (!all[setId]) all[setId] = { results: [] };
  all[setId].results.push(result);
  // Keep last 50 results per set
  if (all[setId].results.length > 50) all[setId].results = all[setId].results.slice(-50);
  localStorage.setItem(STATS_KEY, JSON.stringify(all));
}

function clearSetStats(setId) {
  const all = getAllStats();
  delete all[setId];
  localStorage.setItem(STATS_KEY, JSON.stringify(all));
}

function statsStorageSize() {
  const raw = localStorage.getItem(STATS_KEY) || '{}';
  return (new Blob([raw]).size / 1024).toFixed(1); // KB
}
