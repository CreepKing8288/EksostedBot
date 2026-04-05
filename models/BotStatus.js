const mongoose = require('mongoose');

const StatusEntrySchema = new mongoose.Schema({
  order: { type: Number, default: 0 },
  type: { type: String, enum: ['PLAYING', 'STREAMING', 'LISTENING', 'WATCHING', 'COMPETING'], default: 'PLAYING' },
  state: { type: String, default: '' },
  url: { type: String, default: '' },
}, { _id: false });

const BotStatusSchema = new mongoose.Schema({
  _id: { type: String, default: 'global' },
  enabled: { type: Boolean, default: true },
  interval: { type: Number, default: 30000 },
  entries: { type: [StatusEntrySchema], default: [] },
  updatedBy: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('BotStatus', BotStatusSchema);
