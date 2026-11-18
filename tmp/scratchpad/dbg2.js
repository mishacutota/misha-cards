const fs = require('fs');
global.window = { BANK_CARDS: null, RARITY_WEIGHT: { common: 52, rare: 28, epic: 14, legend: 6 } };
eval(fs.readFileSync('/workspace/js/cards.js', 'utf8'));
const store = {};
global.localStorage = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } };
global.fetch = fetch;

(async () => {
  const SHARED_URL = 'https://api.restful-api.dev/objects/ff808181a09d98f701a1ea6233bc08a7';
  const res = await fetch(SHARED_URL, { cache: 'no-store' });
  console.log('status', res.status);
  const json = await res.json();
  console.log('json ok');
  // inline normalizeDb
  function createEmptyDb() { return { version: 2, rev: 0, users: {}, stock: {}, history: [] }; }
  const raw = (json && typeof json === 'object' && json.data && typeof json.data === 'object') ? json.data : json;
  console.log('raw type', typeof raw);
  const db = createEmptyDb();
  console.log('db created');
  // stock loop
  for (const c of global.window.BANK_CARDS) {
    const r = Number(raw.stock && raw.stock[c.id]);
    db.stock[c.id] = (Number.isInteger(r) && r >= 0) ? Math.min(r, c.limit) : c.limit;
  }
  console.log('stock done', Object.keys(db.stock).length);
  // users
  if (!raw.users || typeof raw.users !== 'object') raw.users = {};
  for (const [key, user] of Object.entries(raw.users)) {
    console.log('user', key);
  }
  console.log('users done');
  // history
  db.history = Array.isArray(raw.history) ? raw.history.slice(-5) : [];
  console.log('history done');
  // saveLocal
  try { store['x'] = JSON.stringify(db); console.log('stringify ok'); } catch (e) { console.log('stringify err', e.message); }
})();
