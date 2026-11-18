const fs = require('fs');
global.window = { BANK_CARDS: null, RARITY_WEIGHT: { common: 52, rare: 28, epic: 14, legend: 6 } };
eval(fs.readFileSync('js/cards.js','utf8'));
const store = {};
global.localStorage = { getItem: k => store[k]||null, setItem: (k,v)=>{store[k]=v;}, removeItem: k=>{delete store[k];} };
global.fetch = fetch;
eval(fs.readFileSync('js/store.js','utf8'));
const S = global.window.BankStore;
(async () => {
  await S.pull();
  await S.register('alice_test', '1234');
  await S.register('demo_fox2', '1234');
  console.log('users before purge:', S.getUsers().map(u=>u.nick));
  const r = await S.purgeTestAccounts();
  console.log('purged:', r);
  console.log('users after purge:', S.getUsers().map(u=>u.nick));
  console.log('DONE');
})();
