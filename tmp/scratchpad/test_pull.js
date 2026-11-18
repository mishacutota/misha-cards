const fs = require('fs');
const src = fs.readFileSync('/workspace/js/store.js','utf8');
// inject logging into pull by replacing the pull function body markers
const patched = src.replace(
  "  async function pull() {\n    try {\n      const res = await fetch(SHARED_URL, { cache: 'no-store' });\n      if (!res.ok) throw new Error('HTTP ' + res.status);\n      const json = await res.json();\n      db = normalizeDb(json);\n      online = true;",
  "  async function pull() {\n    try {\n      console.log('PULL start');\n      const res = await fetch(SHARED_URL, { cache: 'no-store' });\n      console.log('PULL res', res.status);\n      if (!res.ok) throw new Error('HTTP ' + res.status);\n      const json = await res.json();\n      console.log('PULL json ok');\n      db = normalizeDb(json);\n      console.log('PULL normalized, users', Object.keys(db.users));\n      online = true;"
);
fs.writeFileSync('/workspace/tmp/scratchpad/store_patched.js', patched);

global.window = { BANK_CARDS: null, RARITY_WEIGHT: { common: 52, rare: 28, epic: 14, legend: 6 } };
eval(fs.readFileSync('/workspace/js/cards.js','utf8'));
const store = {};
global.localStorage = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } };
global.fetch = fetch;
eval(fs.readFileSync('/workspace/tmp/scratchpad/store_patched.js','utf8'));
const S = global.window.BankStore;
(async () => {
  const ok = await S.pull();
  console.log('pull result', ok, S.isOnline(), S.lastError());
})();
