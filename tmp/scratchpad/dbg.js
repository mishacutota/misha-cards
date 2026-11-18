const fs = require('fs');
global.window = { BANK_CARDS: null, RARITY_WEIGHT: { common: 52, rare: 28, epic: 14, legend: 6 } };
// load cards via require-like read
const cardsCode = fs.readFileSync('/workspace/js/cards.js', 'utf8');
// eslint-disable-next-line no-eval
eval(cardsCode);
const store = {};
global.localStorage = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } };
global.fetch = fetch;
const storeCode = fs.readFileSync('/workspace/js/store.js', 'utf8');
eval(storeCode);
const S = global.window.BankStore;
S.pull().then(ok => { console.log('pull ok', ok, 'online', S.isOnline(), 'err', S.lastError()); }).catch(e => console.log('err', e && e.message));
