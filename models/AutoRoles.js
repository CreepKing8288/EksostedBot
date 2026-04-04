const { Schema, model } = require('mongoose');

const autoRoleSchema = new Schema({
  guildId: { type: String, required: true, unique: true },
  serverId: { type: String },
  roleIds: [{ type: String, required: true }],
});

module.exports = model('AutoRole', autoRoleSchema);
