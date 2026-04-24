const mongoose = require('mongoose')

const LoanSchema = new mongoose.Schema(
  {
    // ─── Reference ──────────────────────────────────────────
    loanId: {
      type: String,
      unique: true,
      default: () => 'LOAN' + Date.now()
    },

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

    // ─── Loan Details ────────────────────────────────────────
    loanType: {
      type: String,
      enum: ['personal', 'home', 'car', 'education', 'business', 'gold'],
      required: true
    },

    principalAmount: {
      type: Number,
      required: [true, 'Loan amount is required'],
      min: [1000, 'Minimum loan amount is ₹1000']
    },

    interestRate: {
      type: Number,
      required: true    // annual interest rate in percentage
    },

    tenureMonths: {
      type: Number,
      required: [true, 'Loan tenure is required']
    },

    // ─── EMI Calculation ────────────────────────────────────
    // EMI = P × r × (1+r)^n / ((1+r)^n - 1)
    // P = principal, r = monthly rate, n = tenure months
    emiAmount: {
      type: Number      // calculated and stored when loan is approved
    },

    totalPayable: {
      type: Number      // principal + total interest
    },

    totalInterest: {
      type: Number
    },

    // ─── Repayment Tracking ──────────────────────────────────
    paidAmount: {
      type: Number,
      default: 0
    },

    remainingAmount: {
      type: Number
    },

    emisPaid: {
      type: Number,
      default: 0
    },

    nextEmiDate: {
      type: Date
    },

    // ─── Status ─────────────────────────────────────────────
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'active', 'closed', 'defaulted'],
      default: 'pending'
    },

    // ─── Dates ──────────────────────────────────────────────
    appliedAt:  { type: Date, default: Date.now },
    approvedAt: { type: Date },
    closedAt:   { type: Date },

    // ─── Admin Notes ────────────────────────────────────────
    rejectionReason: { type: String },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'       // which admin approved this loan
    },

    // ─── Purpose ────────────────────────────────────────────
    purpose: {
      type: String,
      trim: true,
      maxlength: [500, 'Purpose description too long']
    }
  },

  { timestamps: true }
)

const Loan = mongoose.model('Loan', LoanSchema)

module.exports = Loan
