/* Общая база MISHA CARDS: GitHub Pages + бесплатное хранилище restful-api.dev.
   Все игроки читают и пишут одну общую коллекцию, поэтому переводы идут между разными людьми. */
(function () {
  'use strict';

  const STORAGE_KEY = 'misha-cards-v2';
  const SHARED_ID = 'ff808181a09d98f701a1ea6233bc08a7';
  const SHARED_URL = 'https://api.restful-api.dev/objects/' + SHARED_ID;
  const STARTER = { puff: 2, frog: 1, fox: 1 };
  const DAILY_CARDS = 3;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const INITIAL_STOCK = Object.fromEntries(window.BANK_CARDS.map(card => [card.id, card.limit]));

  function createEmptyDb() {
    return { version: 2, rev: 0, users: {}, stock: { ...INITIAL_STOCK }, history: [] };
  }

  function normalizeInventory(input) {
    const inventory = {};
    for (const card of window.BANK_CARDS) {
      const amount = Number(input && input[card.id]);
      inventory[card.id] = Number.isInteger(amount) && amount > 0 ? Math.min(amount, card.limit) : 0;
    }
    return inventory;
  }

  function normalizeNick(nick) {
    return String(nick || '').trim().toLowerCase();
  }

  function normalizeDb(value) {
    const raw = (value && typeof value === 'object' && value.data && typeof value.data === 'object') ? value.data : value;
    if (!raw || typeof raw !== 'object') return createEmptyDb();
    const db = createEmptyDb();
    db.rev = Number.isFinite(raw.rev) ? raw.rev : 0;
    if (!raw.users || typeof raw.users !== 'object') raw.users = {};
    if (!raw.stock || typeof raw.stock !== 'object') raw.stock = {};
    for (const card of window.BANK_CARDS) {
      const r = Number(raw.stock[card.id]);
      db.stock[card.id] = Number.isInteger(r) && r >= 0 ? Math.min(r, card.limit) : card.limit;
    }
    for (const [key, user] of Object.entries(raw.users)) {
      if (!user || typeof user !== 'object' || typeof user.nick !== 'string') continue;
      const normalizedKey = normalizeNick(user.nick);
      if (!normalizedKey) continue;
      db.users[normalizedKey] = {
        nick: user.nick,
        pin: typeof user.pin === 'string' ? user.pin : '',
        createdAt: Number.isFinite(user.createdAt) ? user.createdAt : Date.now(),
        inventory: normalizeInventory(user.inventory),
        lastDailyAt: Number.isFinite(user.lastDailyAt) ? user.lastDailyAt : 0
      };
    }
    db.history = Array.isArray(raw.history)
      ? raw.history.filter(item => item && typeof item === 'object').slice(-500).map(item => ({
          at: Number.isFinite(item.at) ? item.at : Date.now(),
          type: ['in', 'out', 'daily', 'mint'].includes(item.type) ? item.type : 'in',
          userKey: String(item.userKey || ''),
          peer: String(item.peer || ''),
          cards: normalizeInventory(item.cards),
          memo: typeof item.memo === 'string' ? item.memo.slice(0, 80) : ''
        }))
      : [];
    return db;
  }

  let db = createEmptyDb();
  let online = false;
  let lastError = '';

  function saveLocal() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch (_) {}
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeDb(JSON.parse(raw)) : null;
    } catch (_) { return null; }
  }

  async function pull() {
    try {
      console.log('PULL start');
      const res = await fetch(SHARED_URL, { cache: 'no-store' });
      console.log('PULL res', res.status);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      console.log('PULL json ok');
      db = normalizeDb(json);
      console.log('PULL normalized, users', Object.keys(db.users));
      online = true;
      lastError = '';
      saveLocal();
      return true;
    } catch (e) {
      online = false;
      lastError = String(e && e.message || e);
      const cached = loadLocal();
      if (cached) db = cached;
      return false;
    }
  }

  async function push() {
    try {
      const res = await fetch(SHARED_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'misha-cards-db', data: db })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      if (json && json.data) db = normalizeDb(json);
      online = true;
      lastError = '';
      saveLocal();
      return true;
    } catch (e) {
      online = false;
      lastError = String(e && e.message || e);
      saveLocal();
      return false;
    }
  }

  async function withLatest(mutator, attempts) {
    attempts = attempts || 5;
    for (let i = 0; i < attempts; i++) {
      await pull();
      let result;
      try { result = mutator(); } catch (e) { result = { ok: false, error: String(e && e.message || e) }; }
      if (!result || result.ok === false) {
        if (result && result.error) return result;
        return { ok: false, error: 'Не удалось выполнить действие.' };
      }
      db.rev = (db.rev || 0) + 1;
      const pushed = await push();
      if (pushed) return result;
    }
    return { ok: false, error: 'Сеть занята, попробуй ещё раз через пару секунд.' };
  }

  function total(inventory) {
    return window.BANK_CARDS.reduce((sum, card) => sum + card.spark * (inventory[card.id] || 0), 0);
  }

  function countCards(inventory) {
    return window.BANK_CARDS.reduce((sum, card) => sum + (inventory[card.id] || 0), 0);
  }

  function addHistory(entry) {
    db.history.push({ ...entry, at: Date.now() });
    if (db.history.length > 500) db.history = db.history.slice(-500);
  }

  function publicUser(user) {
    return {
      nick: user.nick,
      createdAt: user.createdAt,
      inventory: { ...user.inventory },
      lastDailyAt: user.lastDailyAt || 0
    };
  }

  function issueDaily(userKey) {
    const user = db.users[userKey];
    if (!user || (user.lastDailyAt && Date.now() - user.lastDailyAt < DAY_MS)) {
      return { ok: true, cards: {}, issued: 0, nextAt: user ? (user.lastDailyAt || 0) + DAY_MS : 0 };
    }

    const daily = {};
    for (let draw = 0; draw < DAILY_CARDS; draw++) {
      const active = window.BANK_CARDS.filter(card => db.stock[card.id] > 0);
      if (!active.length) break;
      const totalWeight = active.reduce((sum, card) => sum + (window.RARITY_WEIGHT[card.rarityKey] || 1), 0);
      let ticket = Math.random() * totalWeight;
      let picked = active[active.length - 1];
      for (const card of active) {
        ticket -= window.RARITY_WEIGHT[card.rarityKey] || 1;
        if (ticket < 0) { picked = card; break; }
      }
      user.inventory[picked.id] += 1;
      daily[picked.id] = (daily[picked.id] || 0) + 1;
      db.stock[picked.id] -= 1;
    }

    user.lastDailyAt = Date.now();
    if (countCards(daily)) {
      addHistory({ type: 'daily', userKey, peer: '', cards: daily, memo: 'Ежедневный дроп' });
    }
    return { ok: true, cards: daily, issued: countCards(daily), nextAt: user.lastDailyAt + DAY_MS };
  }

  async function register(nick, pin) {
    const clean = String(nick || '').trim();
    const key = normalizeNick(clean);
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(clean)) {
      return { ok: false, error: 'Ник: 3–16 символов, только латиница, цифры и _.' };
    }
    if (!/^\d{4,6}$/.test(String(pin || ''))) return { ok: false, error: 'ПИН-код должен содержать 4–6 цифр.' };

    return withLatest(() => {
      if (db.users[key]) return { ok: false, error: 'Этот ник уже занят. Придумай другой.' };
      const inventory = normalizeInventory(STARTER);
      for (const card of window.BANK_CARDS) {
        const granted = Math.min(inventory[card.id], db.stock[card.id]);
        inventory[card.id] = granted;
        db.stock[card.id] -= granted;
      }
      const user = { nick: clean, pin: String(pin), createdAt: Date.now(), inventory, lastDailyAt: 0 };
      db.users[key] = user;
      addHistory({ type: 'mint', userKey: key, peer: '', cards: { ...inventory }, memo: 'Стартовая коллекция' });
      const daily = issueDaily(key);
      if (!daily.ok) return { ok: false, error: daily.error };
      return { ok: true, user: publicUser(user), key, daily };
    });
  }

  async function login(nick, pin) {
    const key = normalizeNick(nick);
    return withLatest(() => {
      const user = db.users[key];
      if (!user || user.pin !== String(pin)) return { ok: false, error: 'Неверный ник или ПИН-код.' };
      const daily = issueDaily(key);
      if (!daily.ok) return { ok: false, error: daily.error };
      return { ok: true, user: publicUser(user), key, daily };
    });
  }

  async function claimDaily(key) {
    return withLatest(() => {
      const user = db.users[key];
      if (!user) return { ok: false, error: 'Профиль не найден.' };
      const daily = issueDaily(key);
      if (!daily.ok) return { ok: false, error: daily.error };
      return { ok: true, user: publicUser(user), key, daily };
    });
  }

  function getUser(key) {
    const user = db.users[key];
    return user ? publicUser(user) : null;
  }

  function findUser(nick) {
    const key = normalizeNick(nick);
    const user = db.users[key];
    return user ? { key, ...publicUser(user) } : null;
  }

  function getStock() { return { ...db.stock }; }

  function getLeaderboard() {
    return Object.entries(db.users)
      .map(([key, user]) => ({ key, nick: user.nick, value: total(user.inventory) }))
      .sort((a, b) => b.value - a.value || a.nick.localeCompare(b.nick))
      .slice(0, 10);
  }

  function getHistory(key) {
    return db.history.filter(item => item.userKey === key).slice(-40).reverse();
  }

  async function transfer(fromKey, targetNick, requested) {
    const targetKey = normalizeNick(targetNick);
    return withLatest(() => {
      const sender = db.users[fromKey];
      const recipient = db.users[targetKey];
      if (!sender) return { ok: false, error: 'Не удалось найти твой профиль.' };
      if (!recipient) return { ok: false, error: 'Такого игрока нет. Проверь ник.' };
      if (targetKey === fromKey) return { ok: false, error: 'Нельзя отправить карточки самому себе.' };

      const move = normalizeInventory(requested);
      const count = countCards(move);
      if (!count) return { ok: false, error: 'Выбери хотя бы одну карточку.' };
      for (const card of window.BANK_CARDS) {
        if (move[card.id] > sender.inventory[card.id]) return { ok: false, error: `У тебя недостаточно карточек «${card.name}».` };
      }
      for (const card of window.BANK_CARDS) {
        sender.inventory[card.id] -= move[card.id];
        recipient.inventory[card.id] += move[card.id];
      }
      const spark = total(move);
      addHistory({ type: 'out', userKey: fromKey, peer: recipient.nick, cards: { ...move }, memo: 'Подарок' });
      addHistory({ type: 'in', userKey: targetKey, peer: sender.nick, cards: { ...move }, memo: 'Подарок' });
      return { ok: true, recipient: recipient.nick, spark, cards: move };
    });
  }

  async function createDemoUsers() {
    return withLatest(() => {
      const names = ['demo_fox', 'demo_cat', 'demo_star'];
      let created = 0;
      for (const nick of names) {
        const key = normalizeNick(nick);
        if (db.users[key]) continue;
        const inventory = normalizeInventory(STARTER);
        for (const card of window.BANK_CARDS) {
          const granted = Math.min(inventory[card.id], db.stock[card.id]);
          inventory[card.id] = granted;
          db.stock[card.id] -= granted;
        }
        const user = { nick, pin: '', createdAt: Date.now(), inventory, lastDailyAt: 0 };
        db.users[key] = user;
        addHistory({ type: 'mint', userKey: key, peer: '', cards: { ...inventory }, memo: 'Коллекция игрока' });
        const daily = issueDaily(key);
        if (daily.ok) created++;
      }
      return { ok: true, created };
    });
  }

  function exportData() {
    return JSON.stringify({ format: 'misha-cards-export', version: 2, data: db }, null, 2);
  }

  async function importData(text) {
    let parsed;
    try { parsed = JSON.parse(text); } catch (_) { return { ok: false, error: 'Файл не похож на JSON.' }; }
    const incoming = normalizeDb(parsed && parsed.data ? parsed.data : parsed);
    if (!Object.keys(incoming.users).length) return { ok: false, error: 'В файле не найдены игроки коллекции.' };
    db = incoming;
    const pushed = await push();
    if (!pushed) return { ok: false, error: 'Не удалось отправить коллекцию в общую базу.' };
    saveLocal();
    return { ok: true };
  }

  const initial = loadLocal();
  if (initial) db = initial;

  window.BankStore = {
    register,
    login,
    claimDaily,
    getUser,
    findUser,
    getStock,
    getLeaderboard,
    getHistory,
    total,
    countCards,
    transfer,
    createDemoUsers,
    exportData,
    importData,
    pull,
    push,
    isOnline: () => online,
    lastError: () => lastError
  };
})();
