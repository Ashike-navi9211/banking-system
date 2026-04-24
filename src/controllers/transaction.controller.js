const Account     = require('../models/Account.model')
const Transaction = require('../models/Transaction.model')

// ─────────────────────────────────────────────────────────────
// @route   POST /api/transactions/deposit
// @access  Private
// ─────────────────────────────────────────────────────────────
const deposit = async (req, res, next) => {
  try {
    const { accountId, amount, description, channel, category } = req.body

    const account = await Account.findById(accountId)

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      })
    }

    if (account.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This account does not belong to you'
      })
    }

    if (account.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: `Cannot deposit to a ${account.status} account`
      })
    }

    // Update balance
    account.balance += amount
    await account.save()

    // Record transaction
    const transaction = await Transaction.create({
      accountId,
      userId:       req.user._id,
      type:         'deposit',
      amount,
      balanceAfter: account.balance,
      description:  description || 'Cash deposit',
      channel:      channel || 'online',
      category:     category || 'other',
      ipAddress:    req.ip,
      status:       'completed'
    })

    res.status(200).json({
      success: true,
      message: `₹${amount} deposited successfully`,
      transaction: {
        transactionId: transaction.transactionId,
        type:          'deposit',
        amount,
        balanceAfter:  account.balance,
        description:   transaction.description,
        status:        'completed',
        date:          transaction.createdAt
      }
    })

  } catch (error) {
    next(error)
  }
}


// ─────────────────────────────────────────────────────────────
// @route   POST /api/transactions/withdraw
// @access  Private
// ─────────────────────────────────────────────────────────────
const withdraw = async (req, res, next) => {
  try {
    const { accountId, amount, description, channel } = req.body

    const account = await Account.findById(accountId)

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      })
    }

    if (account.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      })
    }

    if (account.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: `Cannot withdraw from a ${account.status} account`
      })
    }

    if (account.accountType === 'fixed_deposit') {
      return res.status(400).json({
        success: false,
        message: 'Cannot withdraw from a fixed deposit before maturity'
      })
    }

    if (account.balance < amount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ₹${account.balance}`
      })
    }

    const balanceAfterWithdrawal = account.balance - amount
    if (balanceAfterWithdrawal < account.minimumBalance) {
      return res.status(400).json({
        success: false,
        message: `Minimum balance of ₹${account.minimumBalance} must be maintained. Maximum you can withdraw: ₹${account.balance - account.minimumBalance}`
      })
    }

    // Deduct balance
    account.balance -= amount
    await account.save()

    // Record transaction
    const transaction = await Transaction.create({
      accountId,
      userId:       req.user._id,
      type:         'withdrawal',
      amount,
      balanceAfter: account.balance,
      description:  description || 'Cash withdrawal',
      channel:      channel || 'online',
      ipAddress:    req.ip,
      status:       'completed'
    })

    res.status(200).json({
      success: true,
      message: `₹${amount} withdrawn successfully`,
      transaction: {
        transactionId: transaction.transactionId,
        type:          'withdrawal',
        amount,
        balanceAfter:  account.balance,
        description:   transaction.description,
        status:        'completed',
        date:          transaction.createdAt
      }
    })

  } catch (error) {
    next(error)
  }
}


// ─────────────────────────────────────────────────────────────
// @route   POST /api/transactions/transfer
// @access  Private
// ─────────────────────────────────────────────────────────────
const transfer = async (req, res, next) => {
  try {
    const { fromAccountId, toAccountNumber, amount, description, channel } = req.body

    // Find sender account
    const fromAccount = await Account.findById(fromAccountId)

    if (!fromAccount) {
      return res.status(404).json({
        success: false,
        message: 'Source account not found'
      })
    }

    if (fromAccount.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Source account does not belong to you'
      })
    }

    // Find receiver account
    const toAccount = await Account.findOne({ accountNumber: toAccountNumber })

    if (!toAccount) {
      return res.status(404).json({
        success: false,
        message: 'Destination account not found. Please check account number'
      })
    }

    if (fromAccount._id.toString() === toAccount._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot transfer to the same account'
      })
    }

    if (fromAccount.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: `Your account is ${fromAccount.status}. Cannot transfer`
      })
    }

    if (toAccount.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Destination account is not active'
      })
    }

    if (fromAccount.balance < amount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ₹${fromAccount.balance}`
      })
    }

    const balanceAfterTransfer = fromAccount.balance - amount
    if (balanceAfterTransfer < fromAccount.minimumBalance) {
      return res.status(400).json({
        success: false,
        message: `Transfer would breach minimum balance of ₹${fromAccount.minimumBalance}. Maximum you can transfer: ₹${fromAccount.balance - fromAccount.minimumBalance}`
      })
    }

    // Step 1: Debit sender
    fromAccount.balance -= amount
    await fromAccount.save()

    // Step 2: Credit receiver
    toAccount.balance += amount
    await toAccount.save()

    // Step 3: Record both sides
    await Transaction.insertMany([
      {
        accountId:    fromAccountId,
        userId:       req.user._id,
        type:         'transfer_out',
        amount,
        balanceAfter: fromAccount.balance,
        description:  description || `Transfer to ${toAccountNumber}`,
        channel:      channel || 'online',
        transfer: {
          toAccountId:     toAccount._id,
          toAccountNumber: toAccount.accountNumber
        },
        ipAddress: req.ip,
        status:    'completed'
      },
      {
        accountId:    toAccount._id,
        userId:       toAccount.userId,
        type:         'transfer_in',
        amount,
        balanceAfter: toAccount.balance,
        description:  description || `Transfer from ${fromAccount.accountNumber}`,
        channel:      channel || 'online',
        transfer: {
          fromAccountId:     fromAccount._id,
          fromAccountNumber: fromAccount.accountNumber
        },
        status: 'completed'
      }
    ])

    res.status(200).json({
      success: true,
      message: `₹${amount} transferred successfully`,
      transfer: {
        from: {
          accountNumber: fromAccount.accountNumber,
          balanceAfter:  fromAccount.balance
        },
        to: {
          accountNumber: toAccount.accountNumber
        },
        amount,
        description: description || `Transfer to ${toAccountNumber}`,
        status:      'completed',
        date:        new Date()
      }
    })

  } catch (error) {
    next(error)
  }
}


// ─────────────────────────────────────────────────────────────
// @route   GET /api/transactions/history/:accountId
// @access  Private
// ─────────────────────────────────────────────────────────────
const getTransactionHistory = async (req, res, next) => {
  try {
    const { accountId } = req.params

    const account = await Account.findById(accountId)
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      })
    }

    if (account.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      })
    }

    const {
      type,
      startDate,
      endDate,
      page  = 1,
      limit = 10
    } = req.query

    const filter = { accountId }
    if (type) filter.type = type
    if (startDate || endDate) {
      filter.createdAt = {}
      if (startDate) filter.createdAt.$gte = new Date(startDate)
      if (endDate)   filter.createdAt.$lte = new Date(endDate)
    }

    const skip = (page - 1) * limit

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Transaction.countDocuments(filter)
    ])

    res.status(200).json({
      success:    true,
      total,
      page:       Number(page),
      totalPages: Math.ceil(total / limit),
      transactions
    })

  } catch (error) {
    next(error)
  }
}


// ─────────────────────────────────────────────────────────────
// @route   GET /api/transactions/:txnId
// @access  Private
// ─────────────────────────────────────────────────────────────
const getTransactionById = async (req, res, next) => {
  try {
    const transaction = await Transaction.findOne({
      transactionId: req.params.txnId
    }).populate('accountId', 'accountNumber accountType')

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      })
    }

    if (transaction.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      })
    }

    res.status(200).json({
      success: true,
      transaction
    })

  } catch (error) {
    next(error)
  }
}

module.exports = {
  deposit,
  withdraw,
  transfer,
  getTransactionHistory,
  getTransactionById
}
