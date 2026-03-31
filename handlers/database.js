const mongoose = require('mongoose');
module.exports = async (client) => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in the environment.');
    }

    await mongoose.connect(mongoUri);
    client.db = mongoose.connection.db;
    console.log(global.styles.infoColor('✅ Connected to MongoDB'));
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
  }
};
