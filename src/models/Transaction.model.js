const mongoose = require('mongoose')

const TransactionSchema = new mongoose.Schema(
  {
    // ─── Transaction Reference ───────────────────────────────
    // Unique ID shown to customer like UTR number
    transactionId: {
      type: String,
      unique: true,
      default: () => {
        // Format: TXN + timestamp + random 4 digits
        return 'TXN' + Date.now() + Math.floor(1000 + Math.random() * 9000)
      }
    },

    // ─── Which Account Did This Transaction ──────────────────
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    // ─── Transaction Type ────────────────────────────────────
    type: {
      type: String,
      enum: [
        'deposit',        // money coming in from outside
        'withdrawal',     // money going out to outside
        'transfer_in',    // money received from another account
        'transfer_out',   // money sent to another account
        'loan_disbursement',  // loan amount credited
        'loan_repayment',     // EMI payment
        'interest_credit',    // interest added to account
        'fd_maturity',        // fixed deposit matured
        'charge',             // bank fees/penalties
        'reversal'            // transaction was reversed
      ],
      required: true
    },

    // ─── Amount ──────────────────────────────────────────────
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [1, 'Amount must be at least 1']
    },

    // ─── Balance After This Transaction ──────────────────────
    // We store this so we can show balance at any point in time
    // This is how bank statements work
    balanceAfter: {
      type: Number,
      required: true
    },

    // ─── Transfer Details ────────────────────────────────────
    // Only filled when type is transfer_in or transfer_out
    transfer: {
      toAccountId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
      toAccountNumber: { type: String },
      fromAccountId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
      fromAccountNumber:{ type: String }
    },

    // ─── Description ─────────────────────────────────────────
    description: {
      type: String,
      trim: true,
      maxlength: [200, 'Description too long']
    },

    // ─── Status ──────────────────────────────────────────────
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'reversed'],
      default: 'completed'
    },

    // ─── Payment Channel ─────────────────────────────────────
    channel: {
      type: String,
      enum: ['atm', 'online', 'branch', 'mobile', 'neft', 'rtgs', 'imps', 'upi'],
      default: 'online'
    },

    // ─── IP Address ──────────────────────────────────────────
    // Store for fraud detection and audit trail
    ipAddress: {
      type: String
    },

    // ─── Category ────────────────────────────────────────────
    // Useful for spending analytics
    category: {
      type: String,
      enum: [
        'food', 'transport', 'shopping', 'utilities',
        'healthcare', 'education', 'entertainment',
        'transfer', 'salary', 'investment', 'other'
      ],
      default: 'other'
    },

    remarks: {
      type: String,
      trim: true
    }
  },

  { timestamps: true }
)

const Transaction = mongoose.model('Transaction', TransactionSchema)

module.exports = Transaction
