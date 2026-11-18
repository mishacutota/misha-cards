const fs = require('fs');
global.window = { BANK_CARDS: null, RARITY_WEIGHT: { common: 52, rare: 28, epic: 14, legend: 6 } };
eval(fs.readFileSync('/workspace/js/cards.js','utf8'));
const store = {};
global.localStorage = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } };
global.fetch = fetch;
eval(fs.readFileSync('/workspace/js/store.js','utf8'));
const S = global.window.BankStore;
(async () => {
  await S.pull();
  // try register but instrument by checking push after manual mutation? Instead call register and print lastError
  const r = await S.register('alice_test2', '1234');
  console.log('result', JSON.stringify(r));
  console.log('online', S.isOnline(), 'lastError', S.lastError());
  // attempt a direct push by importing? push not exported? It is exported.
  const pushed = await S.push();
  console.log('direct push', pushed, S.isOnline(), S.lastError());
})();
