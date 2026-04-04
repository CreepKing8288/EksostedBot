const mongoose = require('mongoose');

const welcomeSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  serverId: { type: String },
  enabled: { type: Boolean, default: false },
  description: { type: String, default: 'Welcome {member} to {server}' },
  channelId: { type: String, default: null },
});

const Welcome = mongoose.model('Welcome', welcomeSchema);

module.exports = Welcome;
