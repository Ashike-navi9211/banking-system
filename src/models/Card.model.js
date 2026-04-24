const mongoose = require('mongoose')

const CardSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true
    },

    // ─── Card Details ────────────────────────────────────────
    cardNumber: {
      type: String,
      unique: true,
      default: () => {
        // Generate 16-digit card number
        return Array.from({ length: 4 }, () =>
          Math.floor(1000 + Math.random() * 9000)
        ).join(' ')
      }
    },

    cardType: {
      type: String,
      enum: ['debit', 'credit', 'prepaid'],
      required: true
    },

    cardNetwork: {
      type: String,
      enum: ['visa', 'mastercard', 'rupay'],
      default: 'rupay'
    },

    // ─── Validity ────────────────────────────────────────────
    expiryDate: {
      type: Date,
      default: () => {
        // Card valid for 3 years from now
        const d = new Date()
        d.setFullYear(d.getFullYear() + 3)
        return d
      }
    },

    cvv: {
      type: String,
      select: false,    // never return CVV in API responses
      default: () => Math.floor(100 + Math.random() * 900).toString()
    },

    // ─── Cardholder Name ─────────────────────────────────────
    cardHolderName: {
      type: String,
      required: true,
      uppercase: true
    },

    // ─── Limits ──────────────────────────────────────────────
    dailyLimit: {
      type: Number,
      default: 25000    // ₹25,000 per day default
    },

    monthlyLimit: {
      type: Number,
      default: 100000   // ₹1,00,000 per month default
    },

    // ─── Status ──────────────────────────────────────────────
    status: {
      type: String,
      enum: ['active', 'blocked', 'expired', 'hotlisted'],
      default: 'active'
      // hotlisted = reported stolen, permanently blocked
    },

    isInternationalEnabled: {
      type: Boolean,
      default: false    // international transactions disabled by default
    },

    isOnlineEnabled: {
      type: Boolean,
      default: true
    },

    isContactlessEnabled: {
      type: Boolean,
      default: true
    },

    // ─── PIN ─────────────────────────────────────────────────
    pin: {
      type: String,
      select: false     // never return PIN in responses
    },

    isPinSet: {
      type: Boolean,
      default: false
    },

    // ─── Credit Card Specific ────────────────────────────────
    creditLimit: {
      type: Number,
      default: 0        // only used for credit cards
    },

    outstandingBalance: {
      type: Number,
      default: 0
    },

    // ─── Last Used ───────────────────────────────────────────
    lastUsedAt: {
      type: Date
    }
  },

  { timestamps: true }
)

const Card = mongoose.model('Card', CardSchema)

module.exports = Card
