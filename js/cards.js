/* Коллекционные карточки MISHA CARDS. Это игра: никаких денег, только искорки. */
(function () {
  'use strict';

  const cards = [
    {
      id: 'puff', name: 'Пушинка', emoji: '🌸', spark: 1,
      rarity: 'обычная', rarityKey: 'common', limit: 60,
      bg: 'linear-gradient(160deg, #ffb3d0 0%, #ff5f9e 55%, #b32a68 100%)', glow: '#ff5f9e',
      tag: 'мягкая и розовая',
      image: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23ffb3d0"/><circle cx="50" cy="50" r="30" fill="%23ff5f9e"/><text x="50" y="65" text-anchor="middle" fill="white" font-size="12">🌸</text></svg>'
    },
    {
      id: 'frog', name: 'Жабка', emoji: '🐸', spark: 2,
      rarity: 'обычная', rarityKey: 'common', limit: 60,
      bg: 'linear-gradient(160deg, #d6ff9a 0%, #57c93f 55%, #1c6f33 100%)', glow: '#7ee34d',
      tag: 'сидит на листе',
      image: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23d6ff9a"/><path d="M 50 30 C 20 50 30 70 50 70 C 70 70 80 50 70 30 Z" fill="%231c6f33"/><text x="50" y="85" text-anchor="middle" fill="white" font-size="12">🐸</text></svg>'
    },
    {
      id: 'fox', name: 'Лисёнок', emoji: '🦊', spark: 3,
      rarity: 'обычная', rarityKey: 'common', limit: 60,
      bg: 'linear-gradient(160deg, #ffd08a 0%, #ff8a3d 55%, #b8490f 100%)', glow: '#ff8a3d',
      tag: 'хитрый взгляд',
      image: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23ffd08a"/><path d="M 20 30 Q 50 10 80 30 L 80 70 Q 50 90 20 70 Z" fill="%23b8490f"/><text x="50" y="85" text-anchor="middle" fill="white" font-size="12">🦊</text></svg>'
    },
    {
      id: 'moon', name: 'Лунатик', emoji: '🌙', spark: 6,
      rarity: 'редкая', rarityKey: 'rare', limit: 30,
      bg: 'linear-gradient(160deg, #a9bcff 0%, #4a63d8 55%, #1a2160 100%)', glow: '#6f86ff',
      tag: 'гуляет по ночам',
      image: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23a9bcff"/><circle cx="50" cy="50" r="40" fill="white"/><circle cx="50" cy="50" r="20" fill="%231a2160"/><text x="50" y="70" text-anchor="middle" fill="white" font-size="16">🌙</text></svg>'
    },
    {
      id: 'dragon', name: 'Дракончик', emoji: '🐉', spark: 9,
      rarity: 'редкая', rarityKey: 'rare', limit: 30,
      bg: 'linear-gradient(160deg, #8ffbe4 0%, #18b7a0 55%, #07565c 100%)', glow: '#35dfc0',
      tag: 'дышит искрами',
      image: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%238ffbe4"/><path d="M 10 50 Q 30 20 50 10 Q 70 20 90 50 Q 70 80 50 90 Q 30 80 10 50 Z" fill="%2307565c"/><text x="50" y="70" text-anchor="middle" fill="white" font-size="14">🐉</text></svg>'
    },
    {
      id: 'unicorn', name: 'Единорожка', emoji: '🦄', spark: 15,
      rarity: 'эпическая', rarityKey: 'epic', limit: 15,
      bg: 'linear-gradient(160deg, #ffb4f4 0%, #b36bff 55%, #521a8f 100%)', glow: '#d18cff',
      tag: 'сияет радугой',
      image: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23ffb4f4"/><path d="M 10 50 Q 30 20 50 10 Q 90 50 50 90 Q 10 90 50 50 Z" fill="white"/><text x="50" y="55" text-anchor="middle" fill="%23521a8f" font-size="14">🦄</text></svg>'
    },
    {
      id: 'ghost', name: 'Призрак', emoji: '👻', spark: 22,
      rarity: 'эпическая', rarityKey: 'epic', limit: 15,
      bg: 'linear-gradient(160deg, #d6fbff 0%, #4fd6ff 55%, #125d8c 100%)', glow: '#7fe4ff',
      tag: 'тихо хихикает',
      image: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23d6fbff"/><path d="M 10 30 Q 30 10 50 10 Q 70 10 90 30 Q 70 50 50 70 Q 30 90 10 70 Z" fill="%23125d8c"/><ellipse cx="50" cy="60" rx="25" ry="15" fill="white"/><text x="50" y="80" text-anchor="middle" fill="white" font-size="14">👻</text></svg>'
    },
    {
      id: 'crown', name: 'Корона', emoji: '👑', spark: 40,
      rarity: 'легендарная', rarityKey: 'legend', limit: 5,
      bg: 'linear-gradient(160deg, #fff3bd 0%, #ffc93c 55%, #9b6400 100%)', glow: '#ffd75e',
      tag: 'правит полкой',
      image: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23fff3bd"/><path d="M 10 30 Q 30 10 50 10 Q 70 30 90 50 Q 70 70 50 90 Q 30 90 10 70 Z" fill="%239b6400"/><text x="50" y="70" text-anchor="middle" fill="white" font-size="16">👑</text></svg>'
    },
    {
      id: 'ufo', name: 'НЛО', emoji: '🛸', spark: 60,
      rarity: 'легендарная', rarityKey: 'legend', limit: 3,
      bg: 'linear-gradient(160deg, #e2ccff 0%, #7a5cff 45%, #1d1550 100%)', glow: '#9c7bff',
      tag: 'прилетело за тобой',
      image: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23e2ccff"/><ellipse cx="50" cy="50" rx="40" ry="20" fill="white"/><ellipse cx="50" cy="50" rx="20" ry="10" fill="%237a5cff"/><text x="50" y="60" text-anchor="middle" fill="white" font-size="14">🛸</text></svg>'
    }
  ];

  window.BANK_CARDS = cards;
  window.RARITY_WEIGHT = { common: 52, rare: 28, epic: 14, legend: 6 };
})();
