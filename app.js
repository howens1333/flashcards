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

// Run immediately so there's no flash of wrong theme
initTheme();



const STORAGE_KEY = 'flashdeck_sets';

function getSets() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch { return []; }
}

function saveSets(sets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sets));
}

function getSet(id) {
  return getSets().find(s => s.id === id) || null;
}

function saveSet(set) {
  const sets = getSets();
  const idx = sets.findIndex(s => s.id === set.id);
  if (idx >= 0) sets[idx] = set;
  else sets.push(set);
  saveSets(sets);
}

function deleteSet(id) {
  saveSets(getSets().filter(s => s.id !== id));
}

function createSet(title, description = '') {
  return {
    id: crypto.randomUUID(),
    title,
    description,
    created: Date.now(),
    modified: Date.now(),
    cards: []
  };
}

function createCard(term = '', definition = '') {
  return { id: crypto.randomUUID(), term, definition };
}

// ── IMPORT / EXPORT ───────────────────────────────────────────────────────────

function exportSet(set) {
  const blob = new Blob([JSON.stringify(set, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${set.title.replace(/[^a-z0-9]/gi, '_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportAllSets() {
  const sets = getSets();
  if (!sets.length) { toast('No sets to export.'); return; }
  const blob = new Blob([JSON.stringify({ flashdeck: true, version: 1, sets }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `flashdeck_all_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importFromFile(file, onSuccess) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      // Could be a single set or a flashdeck export bundle
      if (data.flashdeck && Array.isArray(data.sets)) {
        // Bundle
        let imported = 0;
        data.sets.forEach(set => {
          // Assign new ID to avoid collisions
          set.id = crypto.randomUUID();
          set.modified = Date.now();
          saveSet(set);
          imported++;
        });
        toast(`Imported ${imported} set${imported !== 1 ? 's' : ''}.`);
      } else if (data.id && data.title && Array.isArray(data.cards)) {
        // Single set
        data.id = crypto.randomUUID();
        data.modified = Date.now();
        saveSet(data);
        toast(`Imported "${data.title}".`);
      } else {
        toast('Invalid file format.');
        return;
      }
      if (onSuccess) onSuccess();
    } catch {
      toast('Could not read file.');
    }
  };
  reader.readAsText(file);
}

// ── TOAST ─────────────────────────────────────────────────────────────────────

function toast(msg, duration = 2800) {
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
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}
