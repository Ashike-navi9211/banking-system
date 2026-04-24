// ─── Environment Variable Validator ──────────────────────────
// Checks all required env variables exist at startup
// If any are missing the app crashes immediately with a clear message
// Better to crash at start than to fail silently in production

const validateEnv = () => {
  const required = [
    'PORT',
    'MONGO_URI',
    'JWT_SECRET',
    'JWT_EXPIRE',
    'NODE_ENV'
  ]

  const missing = required.filter(key => !process.env[key])

  if (missing.length > 0) {
    console.error(' Missing required environment variables:')
    missing.forEach(key => console.error(`   - ${key}`))
    console.error('Please check your .env file')
    process.exit(1)
  }

  // Warn if using weak JWT secret
  if (process.env.JWT_SECRET.length < 32) {
    console.warn(' WARNING: JWT_SECRET should be at least 32 characters long')
  }

  console.log('Environment variables validated')
}

module.exports = validateEnv
