// ─── Why a separate middleware for validation? ───────────────
// Instead of calling Joi inside every controller
// we create ONE middleware that handles validation for any route
// Usage: router.post('/register', validate(registerValidator), controller)

const validate = (schema) => {
  return (req, res, next) => {

    // validate req.body against the Joi schema
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,  // show ALL errors at once, not just first one
      stripUnknown: true  // silently remove any fields not in schema
                          // protects against extra/unwanted fields
    })

    if (error) {
      // Extract all error messages into a clean array
      const errors = error.details.map((detail) => detail.message)

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors
      })
    }

    // Replace req.body with the cleaned/validated value
    req.body = value
    next()
  }
}

module.exports = validate
