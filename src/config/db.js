const mongoose = require('mongoose')
const { MONGO_URI } = require('./config')

const connectDB = async () => {
  try {
    // Try to connect to MongoDB
    const conn = await mongoose.connect(MONGO_URI)

    // If successful, log which host we connected to
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`)

  } catch (error) {
 
    console.error(`MongoDB Connection Failed: ${error.message}`)
    process.exit(1)
  }
}

module.exports = connectDB
