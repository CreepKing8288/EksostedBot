const mongoose = require('mongoose');

const GoodbyeSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  serverId: { type: String },
  enabled: { type: Boolean, default: false },
  description: { type: String, default: 'Goodbye {member} from {server}' },
  channelId: { type: String, default: null },
  embedTitle: { type: String, default: '' },
  embedColor: { type: String, default: '#ef4444' },
  embedImage: { type: String, default: '' },
  embedThumbnail: { type: String, default: '' },
  embedFooter: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Goodbye', GoodbyeSchema);
