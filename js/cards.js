/* Коллекционные карточки MISHA CARDS. Это игра: никаких денег, только искорки. */
(function () {
  'use strict';

  const cards = [
    {
      id: 'puff', name: 'Пушинка', emoji: '🌸', spark: 1,
      rarity: 'обычная', rarityKey: 'common', limit: 60,
      bg: 'linear-gradient(160deg, #ffb3d0 0%, #ff5f9e 55%, #b32a68 100%)', glow: '#ff5f9e',
      tag: 'мягкая и розовая'
    },
    {
      id: 'frog', name: 'Жабка', emoji: '🐸', spark: 2,
      rarity: 'обычная', rarityKey: 'common', limit: 60,
      bg: 'linear-gradient(160deg, #d6ff9a 0%, #57c93f 55%, #1c6f33 100%)', glow: '#7ee34d',
      tag: 'сидит на листе'
    },
    {
      id: 'fox', name: 'Лисёнок', emoji: '🦊', spark: 3,
      rarity: 'обычная', rarityKey: 'common', limit: 60,
      bg: 'linear-gradient(160deg, #ffd08a 0%, #ff8a3d 55%, #b8490f 100%)', glow: '#ff8a3d',
      tag: 'хитрый взгляд'
    },
    {
      id: 'moon', name: 'Лунатик', emoji: '🌙', spark: 6,
      rarity: 'редкая', rarityKey: 'rare', limit: 30,
      bg: 'linear-gradient(160deg, #a9bcff 0%, #4a63d8 55%, #1a2160 100%)', glow: '#6f86ff',
      tag: 'гуляет по ночам'
    },
    {
      id: 'dragon', name: 'Дракончик', emoji: '🐉', spark: 9,
      rarity: 'редкая', rarityKey: 'rare', limit: 30,
      bg: 'linear-gradient(160deg, #8ffbe4 0%, #18b7a0 55%, #07565c 100%)', glow: '#35dfc0',
      tag: 'дышит искрами'
    },
    {
      id: 'unicorn', name: 'Единорожка', emoji: '🦄', spark: 15,
      rarity: 'эпическая', rarityKey: 'epic', limit: 15,
      bg: 'linear-gradient(160deg, #ffb4f4 0%, #b36bff 55%, #521a8f 100%)', glow: '#d18cff',
      tag: 'сияет радугой'
    },
    {
      id: 'ghost', name: 'Призрак', emoji: '👻', spark: 22,
      rarity: 'эпическая', rarityKey: 'epic', limit: 15,
      bg: 'linear-gradient(160deg, #d6fbff 0%, #4fd6ff 55%, #125d8c 100%)', glow: '#7fe4ff',
      tag: 'тихо хихикает'
    },
    {
      id: 'crown', name: 'Корона', emoji: '👑', spark: 40,
      rarity: 'легендарная', rarityKey: 'legend', limit: 5,
      bg: 'linear-gradient(160deg, #fff3bd 0%, #ffc93c 55%, #9b6400 100%)', glow: '#ffd75e',
      tag: 'правит полкой'
    },
    {
      id: 'ufo', name: 'НЛО', emoji: '🛸', spark: 60,
      rarity: 'легендарная', rarityKey: 'legend', limit: 3,
      bg: 'linear-gradient(160deg, #e2ccff 0%, #7a5cff 45%, #1d1550 100%)', glow: '#9c7bff',
      tag: 'прилетело за тобой'
    }
  ];

  window.BANK_CARDS = cards;
  window.RARITY_WEIGHT = { common: 52, rare: 28, epic: 14, legend: 6 };
})();
