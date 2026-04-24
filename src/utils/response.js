// ─── Standardized Response Helpers ───────────────────────────
// Every API response follows the same format
// Makes frontend integration much easier
//
// Usage:
// return sendSuccess(res, 200, 'User created', { user })
// return sendError(res, 404, 'User not found')

const sendSuccess = (res, statusCode = 200, message, data = {}) => {
  return res.status(statusCode).json({
    success: true,
    message,
    ...data
  })
}

const sendError = (res, statusCode = 500, message, errors = null) => {
  const response = {
    success: false,
    message
  }
  if (errors) response.errors = errors

  return res.status(statusCode).json(response)
}

module.exports = { sendSuccess, sendError }         
