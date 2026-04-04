const mongoose = require('mongoose');

const LinkFilterSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  blockAllLinks: { type: Boolean, default: false },
  blockInvites: { type: Boolean, default: true },
  allowedDomains: { type: [String], default: [] },
  whitelistedChannels: { type: [String], default: [] },
  whitelistedRoles: { type: [String], default: [] },
});

module.exports = mongoose.model('LinkFilter', LinkFilterSchema);
