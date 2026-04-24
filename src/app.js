const express   = require('express')
const cors      = require('cors')
const helmet    = require('helmet')
const morgan    = require('morgan')
const rateLimit = require('express-rate-limit')

const app = express()

// ─── Security Headers ─────────────────────────────────────────
app.use(helmet())

// ─── CORS ─────────────────────────────────────────────────────
app.use(cors())

// ─── Rate Limiting ────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      100,
  message: {
    success: false,
    message: 'Too many requests. Please try again after 15 minutes'
  }
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes'
  }
})

app.use(globalLimiter)
app.use('/api/auth/login',    authLimiter)
app.use('/api/auth/register', authLimiter)

// ─── Body Parsers ─────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }))
app.use(express.urlencoded({ extended: true, limit: '10kb' }))

// ─── Logger ───────────────────────────────────────────────────
app.use(morgan('dev'))

// ─── Health Check ─────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    success:     true,
    message:     '🏦 Banking System API is running',
    version:     '1.0.0',
    environment: process.env.NODE_ENV,
    timestamp:   new Date()
  })
})

// ─── API Routes ───────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth.routes'))
app.use('/api/accounts',     require('./routes/account.routes'))
app.use('/api/transactions', require('./routes/transaction.routes'))
app.use('/api/loans',        require('./routes/loan.routes'))
app.use('/api/cards',        require('./routes/card.routes'))
app.use('/api/statements',   require('./routes/statement.routes'))
app.use('/api/admin',        require('./routes/admin.routes'))

// ─── 404 Handler ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  })
})

// ─── Global Error Handler (always last) ───────────────────────
app.use(require('./middlewares/error.middleware'))

module.exports = app
