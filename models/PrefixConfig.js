const mongoose = require('mongoose');

const PrefixConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  prefix: { type: String, default: '!' },
}, { timestamps: true });

module.exports = mongoose.model('PrefixConfig', PrefixConfigSchema);
