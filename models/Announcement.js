const mongoose = require('mongoose');

const AnnouncementSchema = new mongoose.Schema({
  _id: { type: String, default: 'global' },
  sentBy: { type: String, default: '' },
  sentAt: { type: Date },
  content: { type: String, default: '' },
  embedTitle: { type: String, default: '' },
  embedDescription: { type: String, default: '' },
  embedColor: { type: String, default: '#7c3aed' },
  embedFooter: { type: String, default: '' },
  embedImage: { type: String, default: '' },
  embedThumbnail: { type: String, default: '' },
  channelId: { type: String, default: '' },
  totalSent: { type: Number, default: 0 },
  totalFailed: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Announcement', AnnouncementSchema);
