const mongoose = require('mongoose');

const shopItemSchema = new mongoose.Schema({
  itemId: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true },
  type: {
    type: String,
    required: true,
    enum: ['role', 'xp_boost', 'custom'],
  },
  roleId: { type: String, default: null },
  xpMultiplier: { type: Number, default: 1 },
  stock: { type: Number, default: -1 },
  purchaseCount: { type: Number, default: 0 },
  enabled: { type: Boolean, default: true },
});

const serverShopSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: true },
  shopChannelId: { type: String, default: null },
  items: { type: [shopItemSchema], default: [] },
});

module.exports = mongoose.model('ServerShop', serverShopSchema);
