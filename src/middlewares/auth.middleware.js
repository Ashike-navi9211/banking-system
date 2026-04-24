const jwt = require('jsonwebtoken')
const User = require('../models/User.model')
const { JWT_SECRET } = require('../config/config')

// ─── Protect Middleware ──────────────────────────────────────
// This runs before any protected route
// It checks the JWT token and confirms who the user is
// Usage: router.get('/profile', protect, controller)

const protect = async (req, res, next) => {
  try {
    let token

    // Tokens are sent in the Authorization header like this:
    // Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      // Extract just the token part after "Bearer "
      token = req.headers.authorization.split(' ')[1]
    }

    // No token found — user is not logged in
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Please login to continue'
      })
    }

    // Verify the token signature using our secret
    // If token was tampered with, this will throw an error
    const decoded = jwt.verify(token, JWT_SECRET)

    // Find the user from the decoded token payload
    // We check if the user still exists
    // (they might have been deleted after token was issued)
    const user = await User.findById(decoded.id)

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists'
      })
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated. Contact support'
      })
    }

    // Check if account is locked due to failed login attempts
    if (user.isLocked) {
      return res.status(401).json({
        success: false,
        message: 'Your account is locked. Contact support'
      })
    }

    // Attach user to request object
    // Now any controller after this middleware can access req.user
    req.user = user
    next()

  } catch (error) {

    // jwt.verify throws specific errors we can handle cleanly
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please login again'
      })
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again'
      })
    }

    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    })
  }
}

// ─── Authorize Middleware ────────────────────────────────────
// Used AFTER protect middleware
// Checks if user has the right role to access a route
// Usage: router.delete('/user/:id', protect, authorize('admin'), controller)

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. This route requires role: ${roles.join(' or ')}`
      })
    }
    next()
  }
}

module.exports = { protect, authorize }
