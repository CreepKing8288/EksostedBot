const mongoose = require('mongoose');

const SwearFilterSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  aiMode: { type: Boolean, default: false },
  customWords: { type: [String], default: [] },
});

module.exports = mongoose.model('SwearFilter', SwearFilterSchema);
