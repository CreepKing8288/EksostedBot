const mongoose = require('mongoose');

const AIChatConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  enabled: { type: Boolean, default: false },
  channels: [{ type: String }],
  quietTimeoutMinutes: { type: Number, default: 30 },
  personality: { type: String, default: 'friendly and engaging' },
});

AIChatConfigSchema.index({ guildId: 1 }, { unique: true });

module.exports = mongoose.model('AIChatConfig', AIChatConfigSchema);
