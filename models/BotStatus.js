const mongoose = require('mongoose');

const BotStatusSchema = new mongoose.Schema({
  _id: { type: String, default: 'global' },
  type: { type: String, enum: ['PLAYING', 'STREAMING', 'LISTENING', 'WATCHING', 'COMPETING'], default: 'PLAYING' },
  state: { type: String, default: '{userCount} people.' },
  url: { type: String, default: '' },
  enabled: { type: Boolean, default: true },
  interval: { type: Number, default: 30000 },
  updatedBy: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('BotStatus', BotStatusSchema);
