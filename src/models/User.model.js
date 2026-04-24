const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const UserSchema = new mongoose.Schema(
  {
    // ─── Personal Information ───────────────────────────────
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,         // removes extra spaces automatically
      minlength: [2, 'First name must be at least 2 characters'],
      maxlength: [50, 'First name cannot exceed 50 characters']
    },

    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      minlength: [2, 'Last name must be at least 2 characters'],
      maxlength: [50, 'Last name cannot exceed 50 characters']
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,       // no two users can have same email
      lowercase: true,    // always saves as lowercase
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please enter a valid email address'
      ]
    },

    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number']
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false   // CRITICAL: password NEVER comes back in any query
                      // you must explicitly ask for it with .select('+password')
    },

    dateOfBirth: {
      type: Date,
      required: [true, 'Date of birth is required']
    },

    gender: {
      type: String,
      enum: ['male', 'female', 'other'],  // only these 3 values allowed
      required: [true, 'Gender is required']
    },

    // ─── Address ────────────────────────────────────────────
    address: {
      street: { type: String, trim: true },
      city:   { type: String, trim: true },
      state:  { type: String, trim: true },
      pincode:{ type: String, trim: true },
      country:{ type: String, trim: true, default: 'India' }
    },

    // ─── KYC (Know Your Customer) ───────────────────────────
    // Banks are legally required to verify customer identity
    kyc: {
      panNumber: {
        type: String,
        uppercase: true,
        trim: true,
        match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN number format']
      },
      aadharNumber: {
        type: String,
        trim: true,
        match: [/^[0-9]{12}$/, 'Aadhar must be 12 digits']
      },
      isVerified: {
        type: Boolean,
        default: false    // admin must verify KYC manually
      },
      verifiedAt: {
        type: Date        // when admin approved KYC
      }
    },

    // ─── Profile ────────────────────────────────────────────
    profilePhoto: {
      type: String,       // stores the image URL or file path
      default: null
    },
    // ─── Role & Status ──────────────────────────────────────
    role: {
      type: String,
      enum: ['customer', 'admin', 'staff'],
      default: 'customer'
    },

    isActive: {
      type: Boolean,
      default: true       // admin can deactivate any account
    },

    isEmailVerified: {
      type: Boolean,
      default: false
    },

    // ─── Security ───────────────────────────────────────────
    // These fields are used for "Forgot Password" feature
    resetPasswordToken: String,
    resetPasswordExpire: Date,

    // Track failed login attempts to lock account
    loginAttempts: {
      type: Number,
      default: 0
    },

    isLocked: {
      type: Boolean,
      default: false      // locked after too many failed logins
    },

    lastLogin: {
      type: Date          // track when user last logged in
    }
  },

  {
    // timestamps: true automatically adds createdAt and updatedAt
    // to every document — very useful for banking records
    timestamps: true
  }
)

// ─── Middleware: Hash Password Before Saving ─────────────────
// This runs automatically before every .save()
// If password was not changed, skip hashing

UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return
  const salt = await bcrypt.genSalt(12)
  this.password = await bcrypt.hash(this.password, salt)
})

// ─── Method: Compare Password on Login ───────────────────────
// We add a custom method to the user object
// Usage: const isMatch = await user.comparePassword('enteredPassword')

UserSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password)
}

// ─── Virtual: Full Name ───────────────────────────────────────
// A virtual is a field that is calculated, not stored in DB
// Usage: user.fullName → returns "John Doe"
UserSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`
})

// Create and export the model
const User = mongoose.model('User', UserSchema)
module.exports = User
