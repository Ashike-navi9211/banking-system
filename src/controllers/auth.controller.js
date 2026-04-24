const jwt = require('jsonwebtoken')
const User = require('../models/User.model')
const { JWT_SECRET, JWT_EXPIRE } = require('../config/config')

// ─── Helper: Generate JWT Token ──────────────────────────────
// We use this in both register and login
// Keeps code DRY (Don't Repeat Yourself)
const generateToken = (id, role) => {
  return jwt.sign(
    { id, role },     // payload — data stored inside token
    JWT_SECRET,       // secret key to sign the token
    { expiresIn: JWT_EXPIRE }  // token expires after this time
  )
}

// ─── Helper: Send Token Response ─────────────────────────────
// Consistent response format for login and register
const sendTokenResponse = (user, statusCode, res, message) => {
  const token = generateToken(user._id, user.role)

  // Remove password from response even if somehow selected
  user.password = undefined

  res.status(statusCode).json({
    success: true,
    message,
    token,
    user: {
      id:        user._id,
      firstName: user.firstName,
      lastName:  user.lastName,
      email:     user.email,
      phone:     user.phone,
      role:      user.role,
      isActive:  user.isActive,
      kyc:       user.kyc
    }
  })
}

// ─────────────────────────────────────────────────────────────
// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
// ─────────────────────────────────────────────────────────────
const register = async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      dateOfBirth,
      gender
    } = req.body

    // Check if email already registered
    const emailExists = await User.findOne({ email })
    if (emailExists) {
      return res.status(400).json({
        success: false,
        message: 'This email is already registered'
      })
    }

    // Check if phone already registered
    const phoneExists = await User.findOne({ phone })
    if (phoneExists) {
      return res.status(400).json({
        success: false,
        message: 'This phone number is already registered'
      })
    }

    // Create user — password is hashed automatically
    // by our pre('save') hook in the User model
    const user = await User.create({
      firstName,
      lastName,
      email,
      phone,
      password,
      dateOfBirth,
      gender
    })

    // Update last login time
    user.lastLogin = new Date()
    await user.save({ validateBeforeSave: false })

    // Send back token and user data
    sendTokenResponse(user, 201, res, 'Registration successful')

  } catch (error) {
    next(error)   // passes error to our global error middleware
  }
}

// ─────────────────────────────────────────────────────────────
// @route   POST /api/auth/login
// @desc    Login user and return JWT token
// @access  Public
// ─────────────────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body

    // Find user by email
    // We use .select('+password') because password has select: false
    // in the model — it never comes back unless we explicitly ask
    const user = await User.findOne({ email }).select('+password')

    // User not found
    // IMPORTANT: We give the SAME message for wrong email AND wrong password
    // If we say "email not found" hackers know valid emails in our system
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      })
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated. Contact support'
      })
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(401).json({
        success: false,
        message: 'Account locked due to multiple failed attempts. Contact support'
      })
    }

    // Compare entered password with hashed password in DB
    const isPasswordCorrect = await user.comparePassword(password)

    if (!isPasswordCorrect) {
      // Increment failed login attempts
      user.loginAttempts += 1

      // Lock account after 5 failed attempts
      if (user.loginAttempts >= 5) {
        user.isLocked = true
        await user.save({ validateBeforeSave: false })

        return res.status(401).json({
          success: false,
          message: 'Account locked after 5 failed attempts. Contact support'
        })
      }

      await user.save({ validateBeforeSave: false })

      return res.status(401).json({
        success: false,
        message: `Invalid email or password. ${5 - user.loginAttempts} attempts remaining`
      })
    }

    // Password correct — reset failed attempts
    user.loginAttempts = 0
    user.lastLogin = new Date()
    await user.save({ validateBeforeSave: false })

    sendTokenResponse(user, 200, res, 'Login successful')

  } catch (error) {
    next(error)
  }
}

// ─────────────────────────────────────────────────────────────
// @route   GET /api/auth/me
// @desc    Get currently logged in user profile
// @access  Private (requires token)
// ─────────────────────────────────────────────────────────────
const getMe = async (req, res, next) => {
  try {
    // req.user is set by our protect middleware
    // We fetch fresh data from DB to ensure it's current
    const user = await User.findById(req.user._id)

    res.status(200).json({
      success: true,
      user
    })
  } catch (error) {
    next(error)
  }
}

// ─────────────────────────────────────────────────────────────
// @route   PUT /api/auth/change-password
// @desc    Change password for logged in user
// @access  Private
// ─────────────────────────────────────────────────────────────
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body

    // Get user with password field
    const user = await User.findById(req.user._id).select('+password')

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword)
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      })
    }

    // Make sure new password is different from old password
    const isSamePassword = await user.comparePassword(newPassword)
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password'
      })
    }

    // Set new password — pre('save') hook will hash it automatically
    user.password = newPassword
    await user.save()

    res.status(200).json({
      success: true,
      message: 'Password changed successfully. Please login again'
    })

  } catch (error) {
    next(error)
  }
}

// ─────────────────────────────────────────────────────────────
// @route   PUT /api/auth/update-profile
// @desc    Update user profile details
// @access  Private
// ─────────────────────────────────────────────────────────────
const updateProfile = async (req, res, next) => {
  try {
    // Only allow these fields to be updated from this route
    // Password, role, email — must go through different routes
    const allowedFields = {
      firstName:   req.body.firstName,
      lastName:    req.body.lastName,
      phone:       req.body.phone,
      address:     req.body.address,
      dateOfBirth: req.body.dateOfBirth,
      gender:      req.body.gender
    }

    // Remove undefined fields — don't overwrite with empty values
    Object.keys(allowedFields).forEach(
      (key) => allowedFields[key] === undefined && delete allowedFields[key]
    )

    const user = await User.findByIdAndUpdate(
      req.user._id,
      allowedFields,
      {
        new: true,            // return updated document
        runValidators: true   // run schema validators on update
      }
    )

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user
    })

  } catch (error) {
    next(error)
  }
}

// ─────────────────────────────────────────────────────────────
// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
// ─────────────────────────────────────────────────────────────
const logout = async (req, res) => {
  // With JWT, logout is handled on the CLIENT SIDE
  // The client simply deletes the token from storage
  // Server-side we just send a confirmation

  // In production you would also maintain a token blacklist
  // or use short-lived tokens with refresh tokens

  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  })
}

module.exports = {
  register,
  login,
  getMe,
  changePassword,
  updateProfile,
  logout
}
