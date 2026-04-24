const app = require('./src/app')
const connectDB = require('./src/config/db')
const { PORT } = require('./src/config/config')

// Step 1: Connect to MongoDB first
// Step 2: Only then start the HTTP server
// This order is CRITICAL — never start server before DB is ready

const startServer = async () => {
  try {
    // Connect to database
    await connectDB()

    // Start listening for requests
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`)
      console.log(`Environment: ${process.env.NODE_ENV}`)
    })

  } catch (error) {
    console.error(' Failed to start server:', error.message)
    process.exit(1)
  }
}

startServer()
