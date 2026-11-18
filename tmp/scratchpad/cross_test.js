const fs = require('fs');

function makeEnv() {
  const store = {};
  global.localStorage = {
    getItem: k => store[k] || null,
    setItem: (k, v) => { store[k] = v; },
    removeItem: k => { delete store[k]; }
  };
  global.window = { BANK_CARDS: null, RARITY_WEIGHT: null };
  const cardsCode = fs.readFileSync('/workspace/js/cards.js', 'utf8');
  eval(cardsCode);
  global.fetch = fetch;
  const storeCode = fs.readFileSync('/workspace/js/store.js', 'utf8');
  eval(storeCode);
  return { S: global.window.BankStore };
}

const READ_URL = 'https://textdb.online/misha-cards-shared-9f4c1a7b3e';
const WRITE_URL = 'https://textdb.online/update';

async function resetShared() {
  const body = new URLSearchParams();
  body.set('key', 'misha-cards-shared-9f4c1a7b3e');
  body.set('value', JSON.stringify({ version: 2, rev: 0, users: {}, stock: {}, history: [] }));
  const res = await fetch(WRITE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  const json = await res.json();
  console.log('reset status', json.status);
}

(async () => {
  try {
    await resetShared();
    await new Promise(r => setTimeout(r, 3000));

    // Браузер №1 — Алиса
    const A = makeEnv();
    const regA = await A.S.register('alice99', '1234');
    console.log('A register:', regA.ok, regA.error || '');

    // Браузер №2 — Боб (другое устройство, своё localStorage)
    const B = makeEnv();
    const regB = await B.S.register('bob99', '5678');
    console.log('B register:', regB.ok, regB.error || '');

    if (!regA.ok || !regB.ok) { console.log('STOP: регистрация не прошла'); return; }

    const before = B.S.getUser(regB.key).inventory;
    console.log('B до перевода:', JSON.stringify(before));

    // Алиса переводит Бобу карточку
    const tr = await A.S.transfer(regA.key, regB.user.nick, { puff: 1 });
    console.log('transfer:', tr.ok, tr.error || '', tr.recipient || '');

    // Боб перечитывает общую базу на своём устройстве
    await B.S.pull();
    const after = B.S.getUser(regB.key).inventory;
    console.log('B после перевода:', JSON.stringify(after));

    const aAfter = A.S.getUser(regA.key).inventory;
    console.log('A после перевода:', JSON.stringify(aAfter));

    console.log('РЕЗУЛЬТАТ:', after.puff > before.puff ? 'ПЕРЕВОД ДОШЁЛ ✅' : 'ПЕРЕВОД НЕ ДОШЁЛ ❌');
  } catch (e) {
    console.log('ERR', e && e.stack);
  }
})();
