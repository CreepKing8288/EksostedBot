const mongoose = require('mongoose');

const StarboardSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  channelId: { type: String },
  emoji: { type: String, default: '⭐' },
  threshold: { type: Number, default: 3 },
  ignoredChannels: { type: [String], default: [] },
  watchChannels: { type: [String], default: [] },
});

const StarboardPostSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  originalMessageId: { type: String, required: true },
  starboardMessageId: { type: String, required: true },
  channelId: { type: String, required: true },
  starCount: { type: Number, default: 0 },
});

StarboardPostSchema.index({ guildId: 1, originalMessageId: 1 }, { unique: true });

module.exports = mongoose.model('Starboard', StarboardSchema);
module.exports.StarboardPost = mongoose.model('StarboardPost', StarboardPostSchema);
