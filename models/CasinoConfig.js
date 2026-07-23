const mongoose = require('mongoose');

const casinoConfigSchema = new mongoose.Schema({
  _id: { type: String, default: 'global' },
  slotWeights: { type: [Number], default: [25, 22, 20, 15, 10, 5, 3] },
  slotSymbols: { type: [String], default: ['🍒', '🍋', '🍊', '🍇', '🍉', '💎', '7️⃣'] },
  slotJackpotMult: { type: Number, default: 25 },
  slotTripleMult: { type: Number, default: 10 },
  slotDoubleMult: { type: Number, default: 3 },
  coinflipWinRate: { type: Number, default: 50, min: 0, max: 100 },
  diceUnderMult: { type: Number, default: 2 },
  diceExactMult: { type: Number, default: 4 },
  diceOverMult: { type: Number, default: 2 },
  blackjackWinMult: { type: Number, default: 2 },
  blackjackBjMult: { type: Number, default: 2.5 },
  rouletteColorMult: { type: Number, default: 2 },
  rouletteGreenMult: { type: Number, default: 14 },
  rouletteNumberMult: { type: Number, default: 36 },
  minesCount: { type: Number, default: 4, min: 1, max: 10 },
  colorRedWeight: { type: Number, default: 50 },
  colorRedMult: { type: Number, default: 2 },
  colorYellowWeight: { type: Number, default: 30 },
  colorYellowMult: { type: Number, default: 3 },
  colorGreenWeight: { type: Number, default: 20 },
  colorGreenMult: { type: Number, default: 5 },
});

module.exports = mongoose.model('CasinoConfig', casinoConfigSchema);
