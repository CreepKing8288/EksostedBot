const mongoose = require('mongoose');

const eksosCoinSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  balance: { type: Number, default: 0 },
  bank: { type: Number, default: 0 },
  dailyStreak: { type: Number, default: 0 },
  lastDaily: { type: Date, default: null },
  lastWork: { type: Date, default: null },
  totalEarned: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  lastSlot: { type: Date, default: null },
  loan: { type: Number, default: 0 },
  loanGuildId: { type: String, default: null },
  loanPrincipal: { type: Number, default: 0 },
  loanDate: { type: Date, default: null },
  inventory: {
    type: [
      {
        itemId: { type: String, required: true },
        name: { type: String, required: true },
        quantity: { type: Number, default: 1 },
      },
    ],
    default: [],
  },
});

module.exports = mongoose.model('EksosCoin', eksosCoinSchema);
