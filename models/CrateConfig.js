const mongoose = require('mongoose');

const crateConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  dropChannelId: { type: String, default: null },
  enabled: { type: Boolean, default: false },
  points: {
    small: { type: Number, default: 10 },
    medium: { type: Number, default: 25 },
    large: { type: Number, default: 50 },
  },
});

module.exports = mongoose.model('CrateConfig', crateConfigSchema);
