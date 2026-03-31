require('dotenv').config();
const mongoose = require('mongoose');
module.exports = async (client) => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    client.db = mongoose.connection.db;
    console.log(global.styles.infoColor('✅ Connected to MongoDB'));
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
  }
};
