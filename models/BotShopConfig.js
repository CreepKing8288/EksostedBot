const mongoose = require('mongoose');

const botShopConfigSchema = new mongoose.Schema({
  _id: { type: String, default: 'global' },
  bankNotePrice: { type: Number, default: 10000, min: 0 },
  walletShield1dPrice: { type: Number, default: 10000, min: 0 },
  walletShield3dPrice: { type: Number, default: 25000, min: 0 },
  walletShield7dPrice: { type: Number, default: 35000, min: 0 },
});

module.exports = mongoose.model('BotShopConfig', botShopConfigSchema);
