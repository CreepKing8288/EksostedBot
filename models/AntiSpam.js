const mongoose = require('mongoose');

const AntiSpamSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  maxMessages: { type: Number, default: 5 },
  timeWindowMs: { type: Number, default: 5000 },
  duplicateCheck: { type: Boolean, default: true },
  capsCheck: { type: Boolean, default: true },
  capsThreshold: { type: Number, default: 70 },
  punishment: { type: String, enum: ['warn', 'timeout', 'delete'], default: 'delete' },
  timeoutDuration: { type: Number, default: 60 },
  whitelistedChannels: { type: [String], default: [] },
  whitelistedRoles: { type: [String], default: [] },
});

module.exports = mongoose.model('AntiSpam', AntiSpamSchema);
