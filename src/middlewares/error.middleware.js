// This is a global error handler
// Any error thrown anywhere in the app lands here
// Instead of crashing the server, we send a clean response

const errorMiddleware = (err, req, res, next) => {
  // Log the error stack in terminal for debugging
  console.error(err.stack)

  // Use the error's status code or default to 500
  const statusCode = err.statusCode || 500

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    // Only show error stack in development, never in production
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  })
}

module.exports = errorMiddleware
