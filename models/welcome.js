const mongoose = require('mongoose');

const welcomeSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  serverId: { type: String },
  enabled: { type: Boolean, default: false },
  description: { type: String, default: 'Welcome {member} to {server}' },
  channelId: { type: String, default: null },
  embedEnabled: { type: Boolean, default: false },
  embedTitle: { type: String, default: 'Welcome to {server}!' },
  embedColor: { type: String, default: '#7c3aed' },
  embedDescription: { type: String, default: '' },
  embedFooter: { type: String, default: '' },
  embedImage: { type: String, default: '' },
  embedThumbnail: { type: String, default: '' },
  embedAuthor: { type: String, default: '' },
  useRandomImage: { type: Boolean, default: false },
  randomImages: { type: [String], default: [] },
  mentionUser: { type: Boolean, default: true },
  autoDM: { type: Boolean, default: false },
  dmMessage: { type: String, default: '' },
}, { timestamps: true });

const Welcome = mongoose.model('Welcome', welcomeSchema);

module.exports = Welcome;
