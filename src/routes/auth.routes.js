const express = require('express')
const router = express.Router()

// Import controllers
const {
  register,
  login,
  getMe,
  changePassword,
  updateProfile,
  logout
} = require('../controllers/auth.controller')

// Import middlewares
const { protect } = require('../middlewares/auth.middleware')
const validate   = require('../middlewares/validate.middleware')

// Import validators
const {
  registerValidator,
  loginValidator,
  changePasswordValidator
} = require('../validators/auth.validator')

// ─── Route Structure ──────────────────────────────────────────
// METHOD  PATH                  MIDDLEWARE              CONTROLLER
// ─────────────────────────────────────────────────────────────

// Public routes — no token needed
router.post('/register', validate(registerValidator), register)
router.post('/login',    validate(loginValidator),    login)

// Private routes — token required
// protect middleware runs first, then controller
router.get ('/me',              protect,                          getMe)
router.post('/logout',          protect,                          logout)
router.put ('/update-profile',  protect,                          updateProfile)
router.put ('/change-password', protect, validate(changePasswordValidator), changePassword)

module.exports = router
