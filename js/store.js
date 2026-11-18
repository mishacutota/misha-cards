/* Общая база MISHA CARDS: GitHub Pages + бесплатное хранилище textdb.online.
   Все игроки читают и пишут одну общую коллекцию, поэтому переводы идут между разными людьми
   и разными браузерами. Сервис не требует регистрации и отдаёт CORS для GitHub Pages. */
(function () {
  'use strict';

  const STORAGE_KEY = 'misha-cards-v2';
  const SHARED_KEY = 'misha-cards-shared-9f4c1a7b3e';
  const WRITE_URL = 'https://textdb.online/update';
  const READ_URL = 'https://textdb.online/' + SHARED_KEY;
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
        lastDailyAt: Number.isFinite(user.lastDailyAt) ? user.lastDailyAt : 0,
        recentRecipients: Array.isArray(user.recentRecipients) ? user.recentRecipients.filter(v => typeof v === 'string').slice(0, 3) : []
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

  function saveLocal() { /* no-op: app is online-only */ }
  function loadLocal() { return null; }

  // Чтение общей базы. textdb.online кэшируется через Cloudflare, поэтому
  // добавляем параметр-обходчик кэша и не полагаемся на HTTP-кэш браузера.
  async function pull() {
    try {
      const res = await fetch(READ_URL + '?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      if (!text || !text.trim()) throw new Error('Общая база пока пуста');
      let json;
      try { json = JSON.parse(text); } catch (_) { throw new Error('Общая база вернула не JSON'); }
      db = normalizeDb(json);
      online = true;
      lastError = '';
      return true;
    } catch (e) {
      online = false;
      lastError = String(e && e.message || e);
      db = createEmptyDb();
      return false;
    }
  }

  // Запись общей базы. Отправляем форму (application/x-www-form-urlencoded) —
  // такой запрос не требует CORS-preflight, поэтому работает с GitHub Pages.
  async function push() {
    try {
      const body = new URLSearchParams();
      body.set('key', SHARED_KEY);
      body.set('value', JSON.stringify(db));
      const res = await fetch(WRITE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      if (!json || json.status !== 1) {
        throw new Error((json && (json.error || json.message)) || 'Сервис отклонил запись');
      }
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

  // textdb.online обновляет запись через CDN с задержкой, поэтому после
  // записи перечитываем базу и убеждаемся, что наш rev действительно сохранился.
  async function verifyWrite(expectedRev, tries) {
    tries = tries || 4;
    for (let i = 0; i < tries; i++) {
      await new Promise(resolve => setTimeout(resolve, 700 + i * 500));
      try {
        const res = await fetch(READ_URL + '?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) continue;
        const text = await res.text();
        if (!text || !text.trim()) continue;
        const remote = normalizeDb(JSON.parse(text));
        if (remote.rev >= expectedRev) {
          db = remote;
          online = true;
          lastError = '';
          saveLocal();
          return true;
        }
      } catch (_) { /* пробуем ещё раз */ }
    }
    return false;
  }

  async function withLatest(mutator, attempts) {
    attempts = attempts || 3;
    for (let i = 0; i < attempts; i++) {
      await pull();
      let result;
      try { result = mutator(); } catch (e) { result = { ok: false, error: String(e && e.message || e) }; }
      if (!result || result.ok === false) {
        if (result && result.error) return result;
        return { ok: false, error: 'Не удалось выполнить действие.' };
      }
      db.rev = (db.rev || 0) + 1;
      const expectedRev = db.rev;
      const pushed = await push();
      if (!pushed) continue;
      const verified = await verifyWrite(expectedRev);
      if (verified) return result;
    }
    return { ok: false, error: 'Общая база не ответила. Проверь интернет и попробуй снова.' };
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
      lastDailyAt: user.lastDailyAt || 0,
      recentRecipients: Array.isArray(user.recentRecipients) ? user.recentRecipients.slice(0, 3) : []
    };
  }

  function issueDaily(userKey) {
    const user = db.users[normalizeNick(userKey)];
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
       const user = { nick: clean, pin: String(pin), createdAt: Date.now(), inventory, lastDailyAt: 0, recentRecipients: [] };
      db.users[key] = user;
      addHistory({ type: 'mint', userKey: key, peer: '', cards: { ...inventory }, memo: 'Стартовая коллекция' });
      const daily = issueDaily(key);
      if (!daily.ok) return { ok: false, error: daily.error };
      return { ok: true, user: publicUser(user), key, daily };
    });
  }

  async function login(nick, pin) {
    const key = normalizeNick(nick);
    // Специальный вход администратора
    if (key === 'admin' && String(pin) === '9898') {
      return withLatest(() => {
        if (!db.users.admin) {
          db.users.admin = { nick: 'admin', pin: '9898', createdAt: Date.now(), inventory: normalizeInventory({}), lastDailyAt: Date.now(), recentRecipients: [] };
        } else {
          db.users.admin.pin = '9898';
          db.users.admin.nick = 'admin';
          if (!Array.isArray(db.users.admin.recentRecipients)) db.users.admin.recentRecipients = [];
        }
        const admin = db.users.admin;
        return { ok: true, user: publicUser(admin), key: 'admin', daily: { ok: true, cards: {}, issued: 0, nextAt: admin.lastDailyAt + DAY_MS } };
      });
    }
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
      const user = db.users[normalizeNick(key)];
      if (!user) return { ok: false, error: 'Профиль не найден.' };
      const daily = issueDaily(key);
      if (!daily.ok) return { ok: false, error: daily.error };
      return { ok: true, user: publicUser(user), key, daily };
    });
  }

  function getUser(key) {
    const user = db.users[normalizeNick(key)];
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
    const normalized = normalizeNick(key);
    return db.history.filter(item => item.userKey === normalized).slice(-40).reverse();
  }

  async function transfer(fromKey, targetNick, requested) {
    const targetKey = normalizeNick(targetNick);
    return withLatest(() => {
      const sender = db.users[normalizeNick(fromKey)];
      const recipient = db.users[targetKey];
      if (!sender) return { ok: false, error: 'Не удалось найти твой профиль.' };
      if (!recipient) return { ok: false, error: 'Такого игрока нет. Проверь ник.' };
      if (targetKey === normalizeNick(fromKey)) return { ok: false, error: 'Нельзя отправить карточки самому себе.' };

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
      addHistory({ type: 'out', userKey: normalizeNick(fromKey), peer: recipient.nick, cards: { ...move }, memo: 'Подарок' });
      addHistory({ type: 'in', userKey: targetKey, peer: sender.nick, cards: { ...move }, memo: 'Подарок' });
      if (!Array.isArray(sender.recentRecipients)) sender.recentRecipients = [];
      sender.recentRecipients = [recipient.nick, ...sender.recentRecipients.filter(n => normalizeNick(n) !== targetKey)].slice(0, 3);
      return { ok: true, recipient: recipient.nick, spark, cards: move };
    });
  }

  async function purgeTestAccounts() {
    return withLatest(() => {
      const removed = [];
      for (const key of Object.keys(db.users)) {
        if (key === 'admin') continue;
        const user = db.users[key];
        const nick = (user && user.nick) ? user.nick : key;
        const isTest = /_test$/i.test(nick) || /^demo_/i.test(nick) ||
          key === 'admintest_user' || key === 'alice' || key === 'bob';
        if (isTest) {
          delete db.users[key];
          removed.push(nick);
        }
      }
      return { ok: true, removed };
    });
  }

  function getUsers() {
    return Object.entries(db.users).map(([key, user]) => ({
      key,
      nick: user.nick,
      createdAt: user.createdAt,
      cards: countCards(user.inventory),
      sparks: total(user.inventory)
    })).sort((a, b) => a.nick.localeCompare(b.nick));
  }

  async function deleteUser(targetNick) {
    const key = normalizeNick(targetNick);
    if (key === 'admin') return { ok: false, error: 'Нельзя удалить администратора.' };
    return withLatest(() => {
      if (!db.users[key]) return { ok: false, error: 'Пользователь не найден.' };
      delete db.users[key];
      return { ok: true };
    });
  }

  async function grantCards(target, requested) {
    const move = {};
    for (const card of window.BANK_CARDS) {
      const amt = Number(requested && requested[card.id]);
      move[card.id] = Number.isInteger(amt) && amt > 0 ? amt : 0;
    }
    if (!countCards(move)) return { ok: false, error: 'Выбери карточки для выдачи.' };
    return withLatest(() => {
      const targetKey = normalizeNick(target);
      const targets = (targetKey === 'all' || target === 'Всем' || target === 'all')
        ? Object.keys(db.users)
        : (db.users[targetKey] ? [targetKey] : null);
      if (!targets) return { ok: false, error: 'Пользователь не найден.' };
      for (const key of targets) {
        const user = db.users[key];
        if (!user.inventory) user.inventory = normalizeInventory({});
        for (const card of window.BANK_CARDS) {
          if (move[card.id]) user.inventory[card.id] = (user.inventory[card.id] || 0) + move[card.id];
        }
        addHistory({ type: 'in', userKey: key, peer: 'admin', cards: { ...move }, memo: 'Выдача от админа' });
      }
      return { ok: true, count: targets.length };
    });
  }

  async function adjustUserCards(targetNick, cardId, amount, mode) {
    const card = window.BANK_CARDS.find(item => item.id === cardId);
    if (!card) return { ok: false, error: 'Карточка не найдена.' };
    const requested = Number(amount);
    if (!Number.isInteger(requested) || requested <= 0) {
      return { ok: false, error: 'Укажи положительное число карточек.' };
    }
    return withLatest(() => {
      const key = normalizeNick(targetNick);
      const user = db.users[key];
      if (!user) return { ok: false, error: 'Пользователь не найден.' };
      if (!user.inventory || typeof user.inventory !== 'object') user.inventory = normalizeInventory({});
      const current = user.inventory[cardId] || 0;
      if (mode === 'add') {
        user.inventory[cardId] = current + requested;
        addHistory({ type: 'in', userKey: key, peer: 'admin', cards: { [cardId]: requested }, memo: 'Выдача от админа' });
        return { ok: true, adjusted: requested, removedMax: false };
      }
      const removed = Math.min(requested, current);
      if (removed <= 0) return { ok: false, error: 'У игрока нет таких карточек.' };
      user.inventory[cardId] = current - removed;
      addHistory({ type: 'out', userKey: key, peer: 'admin', cards: { [cardId]: removed }, memo: 'Изъятие админом' });
      return { ok: true, adjusted: removed, removedMax: removed < requested };
    });
  }

  async function clearHistory(userKey) {
    const key = normalizeNick(userKey);
    return withLatest(() => {
      const before = db.history.length;
      db.history = db.history.filter(item => item.userKey !== key);
      return { ok: true, removed: before - db.history.length };
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
    getUsers,
    purgeTestAccounts,
    deleteUser,
    adjustUserCards,
    clearHistory,
    grantCards,
    exportData,
    importData,
    pull,
    push,
    isOnline: () => online,
    lastError: () => lastError
  };
})();
