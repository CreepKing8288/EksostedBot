const mongoose = require('mongoose');

const ProtectionSettingsSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  antiBot: { type: Boolean, default: false },
  antiNuke: { type: Boolean, default: false },
  antiRaid: { type: Boolean, default: false },
  antiBotThreshold: { type: Number, default: 3 },
  antiNukeThreshold: { type: Number, default: 3 },
  antiRaidThreshold: { type: Number, default: 5 },
  antiRaidTimeWindow: { type: Number, default: 10000 },
  punishment: { type: String, enum: ['ban', 'kick', 'timeout'], default: 'ban' },
  whitelistedUsers: { type: [String], default: [] },
});

module.exports = mongoose.model('ProtectionSettings', ProtectionSettingsSchema);
