const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const AccountSchema = new mongoose.Schema(
  {
    // ─── Link to User ────────────────────────────────────────
    // ref: 'User' tells Mongoose which collection to look in
    // when we use .populate() to get full user details
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required']
    },

    // ─── Account Number ──────────────────────────────────────
    // Generated automatically — like a real bank account number
    accountNumber: {
      type: String,
      unique: true,
      default: () => {
        // Generates a 12-digit unique account number
        return Math.floor(100000000000 + Math.random() * 900000000000).toString()
      }
    },

    // ─── Account Type ────────────────────────────────────────
    accountType: {
      type: String,
      enum: ['savings', 'current', 'fixed_deposit', 'salary'],
      required: [true, 'Account type is required']
    },

    // ─── Balance ─────────────────────────────────────────────
    // We use Number for balance
    // IMPORTANT: In real production banking, use integers (paise)
    // to avoid floating point errors. Example: ₹10.50 = 1050 paise
    balance: {
      type: Number,
      default: 0,
      min: [0, 'Balance cannot be negative']
    },

    // ─── Currency ────────────────────────────────────────────
    currency: {
      type: String,
      default: 'INR',
      enum: ['INR', 'USD', 'EUR']
    },

    // ─── Account Status ──────────────────────────────────────
    status: {
      type: String,
      enum: ['active', 'inactive', 'frozen', 'closed'],
      default: 'active'
      // frozen = suspicious activity, no transactions allowed
      // closed = permanently closed
    },

    // ─── Interest Rate ───────────────────────────────────────
    // Different account types have different interest rates
    interestRate: {
      type: Number,
      default: 0
      // savings = 3.5%, fixed_deposit = 6.5%, current = 0%
    },

    // ─── Minimum Balance ─────────────────────────────────────
    minimumBalance: {
      type: Number,
      default: 1000   // minimum ₹1000 must stay in savings account
    },

    // ─── Branch Information ──────────────────────────────────
    branchCode: {
      type: String,
      default: 'MAIN001'
    },

    ifscCode: {
      type: String,
      default: 'BANK0MAIN001'
    },

    // ─── Fixed Deposit Specific Fields ───────────────────────
    // Only used when accountType is 'fixed_deposit'
    fdDetails: {
      maturityDate:   { type: Date },
      maturityAmount: { type: Number },
      tenure:         { type: Number },  // in months
      isMatured:      { type: Boolean, default: false }
    },

    // ─── Nominee ─────────────────────────────────────────────
    nominee: {
      name:         { type: String },
      relationship: { type: String },
      phone:        { type: String }
    },

    isPrimary: {
      type: Boolean,
      default: false    // user's main account
    }
  },

  { timestamps: true }
)

const Account = mongoose.model('Account', AccountSchema)

module.exports = Account
