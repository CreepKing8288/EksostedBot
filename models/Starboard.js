const mongoose = require('mongoose');

const StarboardSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  channelId: { type: String },
  emoji: { type: String, default: '⭐' },
  threshold: { type: Number, default: 3 },
  ignoredChannels: { type: [String], default: [] },
});

module.exports = mongoose.model('Starboard', StarboardSchema);
