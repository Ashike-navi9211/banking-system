// ─── Custom Error Class ───────────────────────────────────────
// Instead of throwing generic errors we throw AppError
// This gives us control over status codes and messages
//
// Usage:
// throw new AppError('Account not found', 404)
// throw new AppError('Access denied', 403)
// throw new AppError('Invalid token', 401)

class AppError extends Error {
  constructor(message, statusCode) {
    super(message)           // calls Error constructor with message
    this.statusCode = statusCode
    this.isOperational = true  // marks this as an expected error
                               // vs unexpected crashes

    // Captures where the error was thrown
    Error.captureStackTrace(this, this.constructor)
  }
}

module.exports = AppError
