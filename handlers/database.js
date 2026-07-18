const mongoose = require('mongoose');
const dns = require('dns');
module.exports = async (client) => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in the environment.');
    }

    if (mongoUri.includes('mongodb+srv://')) {
      dns.setServers(['8.8.8.8', '8.8.4.4']);
    }

    await mongoose.connect(mongoUri);
    client.db = mongoose.connection.db;
    console.log(global.styles.infoColor('✅ Connected to MongoDB'));
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
  }
};
