/* Локальное хранилище для GitHub Pages: профили одного браузера делят одну игровую коллекцию. */
(function () {
  'use strict';

  const STORAGE_KEY = 'misha-bank-v1';
  const STARTER = { puff: 2, frog: 1, fox: 1 };
  const DAILY_CARDS = 3;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const INITIAL_STOCK = Object.fromEntries(window.BANK_CARDS.map(card => [card.id, card.limit]));

  function createEmptyDb() {
    return { version: 2, users: {}, stock: { ...INITIAL_STOCK }, history: [] };
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
    if (!value || typeof value !== 'object' || !value.users || typeof value.users !== 'object') return createEmptyDb();
    const db = createEmptyDb();
    for (const card of window.BANK_CARDS) {
      const raw = Number(value.stock && value.stock[card.id]);
      db.stock[card.id] = Number.isInteger(raw) && raw >= 0 ? Math.min(raw, card.limit) : card.limit;
    }
    for (const [key, user] of Object.entries(value.users)) {
      if (!user || typeof user !== 'object' || typeof user.nick !== 'string') continue;
      const normalizedKey = normalizeNick(user.nick);
      if (!normalizedKey || normalizedKey !== key.toLowerCase()) continue;
      db.users[normalizedKey] = {
        nick: user.nick,
        pin: typeof user.pin === 'string' ? user.pin : '',
        createdAt: Number.isFinite(user.createdAt) ? user.createdAt : Date.now(),
        inventory: normalizeInventory(user.inventory),
        lastDailyAt: Number.isFinite(user.lastDailyAt) ? user.lastDailyAt : 0
      };
    }
    db.history = Array.isArray(value.history)
      ? value.history.filter(item => item && typeof item === 'object').slice(-500).map(item => ({
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

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeDb(JSON.parse(raw)) : createEmptyDb();
    } catch (error) {
      console.warn('MISHA CARDS: не удалось прочитать сохранённые данные.', error);
      return createEmptyDb();
    }
  }

  let db = load();

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
      return true;
    } catch (error) {
      console.error('MISHA CARDS: не удалось сохранить данные.', error);
      return false;
    }
  }

  function total(inventory) {
    return window.BANK_CARDS.reduce((sum, card) => sum + card.spark * (inventory[card.id] || 0), 0);
  }

  function countCards(inventory) {
    return window.BANK_CARDS.reduce((sum, card) => sum + (inventory[card.id] || 0), 0);
  }

  function todayKey(time) {
    const date = new Date(time);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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

    const eligible = window.BANK_CARDS.filter(card => db.stock[card.id] > 0);
    const daily = {};
    for (let draw = 0; draw < DAILY_CARDS && eligible.length; draw++) {
      const active = eligible.filter(card => db.stock[card.id] > 0);
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
    if (!save()) {
      for (const card of window.BANK_CARDS) {
        user.inventory[card.id] -= daily[card.id] || 0;
        db.stock[card.id] += daily[card.id] || 0;
      }
      user.lastDailyAt = 0;
      if (countCards(daily)) db.history.pop();
      return { ok: false, error: 'Не удалось сохранить ежедневные карточки.' };
    }
    return { ok: true, cards: daily, issued: countCards(daily), nextAt: user.lastDailyAt + DAY_MS };
  }

  function register(nick, pin) {
    const key = normalizeNick(nick);
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(String(nick || '').trim())) {
      return { ok: false, error: 'Ник: 3–16 символов, только латиница, цифры и _.' };
    }
    if (!/^\d{4,6}$/.test(String(pin || ''))) return { ok: false, error: 'ПИН-код должен содержать 4–6 цифр.' };
    if (db.users[key]) return { ok: false, error: 'Этот ник уже занят. Придумай другой.' };

    const inventory = normalizeInventory(STARTER);
    for (const card of window.BANK_CARDS) {
      const granted = Math.min(inventory[card.id], db.stock[card.id]);
      inventory[card.id] = granted;
      db.stock[card.id] -= granted;
    }
    const user = { nick: String(nick).trim(), pin: String(pin), createdAt: Date.now(), inventory, lastDailyAt: 0 };
    db.users[key] = user;
    addHistory({ type: 'mint', userKey: key, peer: '', cards: { ...inventory }, memo: 'Стартовая коллекция' });
    if (!save()) {
      delete db.users[key];
      for (const card of window.BANK_CARDS) db.stock[card.id] += inventory[card.id];
      db.history.pop();
      return { ok: false, error: 'Не получилось сохранить коллекцию на этом устройстве.' };
    }
    const daily = issueDaily(key);
    if (!daily.ok) return { ok: false, error: daily.error };
    return { ok: true, user: publicUser(user), key, daily };
  }

  function login(nick, pin) {
    const key = normalizeNick(nick);
    const user = db.users[key];
    if (!user || user.pin !== String(pin)) return { ok: false, error: 'Неверный ник или ПИН-код.' };
    const daily = issueDaily(key);
    if (!daily.ok) return { ok: false, error: daily.error };
    return { ok: true, user: publicUser(user), key, daily };
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

  function transfer(fromKey, targetNick, requested) {
    const sender = db.users[fromKey];
    const targetKey = normalizeNick(targetNick);
    const recipient = db.users[targetKey];
    if (!sender) return { ok: false, error: 'Не удалось найти твой профиль.' };
    if (!recipient) return { ok: false, error: 'Такого игрока нет в коллекции этого браузера.' };
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
    if (!save()) {
      for (const card of window.BANK_CARDS) {
        sender.inventory[card.id] += move[card.id];
        recipient.inventory[card.id] -= move[card.id];
      }
      db.history.splice(-2);
      return { ok: false, error: 'Не удалось сохранить подарок.' };
    }
    return { ok: true, recipient: recipient.nick, spark, cards: move };
  }

  function createDemoUsers() {
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
    if (!save()) return { ok: false, created: 0 };
    return { ok: true, created };
  }

  function exportData() {
    return JSON.stringify({ format: 'misha-cards-export', version: 2, data: db }, null, 2);
  }

  function importData(text) {
    let parsed;
    try { parsed = JSON.parse(text); } catch (_) { return { ok: false, error: 'Файл не похож на JSON.' }; }
    const incoming = normalizeDb(parsed && parsed.data ? parsed.data : parsed);
    if (!Object.keys(incoming.users).length) return { ok: false, error: 'В файле не найдены игроки коллекции.' };
    const previous = db;
    db = incoming;
    if (!save()) {
      db = previous;
      return { ok: false, error: 'Не удалось сохранить коллекцию из файла.' };
    }
    return { ok: true };
  }

  window.BankStore = {
    register,
    login,
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
    refresh() { db = load(); }
  };
})();
