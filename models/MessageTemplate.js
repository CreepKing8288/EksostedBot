const mongoose = require('mongoose');

const MessageTemplateSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  name: { type: String, required: true },
  content: { type: String, default: '' },
  embedTitle: { type: String, default: '' },
  embedDescription: { type: String, default: '' },
  embedColor: { type: String, default: '#7c3aed' },
  embedFooter: { type: String, default: '' },
  embedImage: { type: String, default: '' },
  embedThumbnail: { type: String, default: '' },
}, { timestamps: true });

MessageTemplateSchema.index({ guildId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('MessageTemplate', MessageTemplateSchema);
