const fs = require('fs');
global.window = {
  BANK_CARDS: null,
  RARITY_WEIGHT: { common: 52, rare: 28, epic: 14, legend: 6 }
};
// load cards
eval(fs.readFileSync('js/cards.js','utf8'));
// mock localStorage
const store = {};
global.localStorage = { getItem: k => store[k]||null, setItem: (k,v)=>{store[k]=v;}, removeItem: k=>{delete store[k];} };
// fetch from node
global.fetch = fetch;
// load store
eval(fs.readFileSync('js/store.js','utf8'));
const S = global.window.BankStore;

(async () => {
  let ok, err;
  try { ok = await S.pull(); } catch (e) { err = e; console.log('THREW', e && e.stack); }
  console.log('pull', ok, 'online', S.isOnline(), 'err', S.lastError(), err && err.message);
  const r1 = await S.register('alice_test', '1234');
  console.log('register alice', r1.ok, r1.key, r1.error, 'online', S.isOnline(), 'lastErr', S.lastError());
  const r2 = await S.register('bob_test', '5678');
  console.log('register bob', r2.ok, r2.key, r2.error);
  // alice sends 1 puff to bob
  const t = await S.transfer('alice_test', 'bob_test', { puff: 1 });
  console.log('transfer', t.ok, t.cards);
  const bob = S.getUser('bob_test');
  console.log('bob inventory', bob.inventory);
  const alice = S.getUser('alice_test');
  console.log('alice inventory', alice.inventory);
  // duplicate nick check
  const dup = await S.register('alice_test', '9999');
  console.log('dup register ok?', dup.ok, dup.error);
  // daily
  // cleanup: not needed
  console.log('DONE');
})();
