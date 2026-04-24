const Account = require('../models/Account.model')
const User    = require('../models/User.model')

// ─── Helper: Calculate Interest Rate ─────────────────────────
// Different account types get different interest rates
// Just like real banks
const getInterestRate = (accountType) => {
  const rates = {
    savings:       3.5,
    current:       0,
    fixed_deposit: 6.5,
    salary:        3.5
  }
  return rates[accountType] || 0
}

// ─── Helper: Calculate Minimum Balance ───────────────────────
const getMinimumBalance = (accountType) => {
  const minimums = {
    savings:       1000,
    current:       5000,
    fixed_deposit: 10000,
    salary:        0       // salary accounts have no minimum
  }
  return minimums[accountType] || 0
}

// ─── Helper: Calculate FD Maturity ───────────────────────────
// Formula: A = P × (1 + r/n)^(n×t)
// P = principal, r = annual rate, n = compounds per year, t = years
const calculateFDMaturity = (principal, tenureMonths, interestRate) => {
  const r = interestRate / 100       // convert percentage to decimal
  const t = tenureMonths / 12        // convert months to years
  const maturityAmount = principal * Math.pow((1 + r), t)
  return Math.round(maturityAmount * 100) / 100  // round to 2 decimals
}


// ─────────────────────────────────────────────────────────────
// @route   POST /api/accounts/create
// @desc    Create a new bank account for logged in user
// @access  Private
// ─────────────────────────────────────────────────────────────
const createAccount = async (req, res, next) => {
  try {
    const {
      accountType,
      currency,
      nominee,
      fdDetails,
      initialDeposit
    } = req.body

    // req.user is set by protect middleware — we know who is logged in
    const userId = req.user._id

    // ── Rule 1: Check KYC ────────────────────────────────────
    // In real banks you cannot open an account without KYC
    // We check if user's KYC is verified
    const user = await User.findById(userId)

    // if (!user.kyc.isVerified) {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'KYC verification is required to open an account. Please complete your KYC first'
    //   })
    // }

    // ── Rule 2: Maximum accounts per type ────────────────────
    // A user can have max 2 savings accounts
    // 1 current account, 1 salary account
    const existingAccounts = await Account.find({
      userId,
      accountType,
      status: { $ne: 'closed' }    // $ne = not equal — ignore closed accounts
    })

    const maxAccounts = {
      savings:       2,
      current:       1,
      fixed_deposit: 5,   // user can have multiple FDs
      salary:        1
    }

    if (existingAccounts.length >= maxAccounts[accountType]) {
      return res.status(400).json({
        success: false,
        message: `You can only have ${maxAccounts[accountType]} ${accountType} account(s)`
      })
    }

    // ── Rule 3: FD needs initial deposit ─────────────────────
    if (accountType === 'fixed_deposit' && initialDeposit < 10000) {
      return res.status(400).json({
        success: false,
        message: 'Fixed deposit requires minimum ₹10,000 initial deposit'
      })
    }

    // ── Build the account object ──────────────────────────────
    const interestRate  = getInterestRate(accountType)
    const minimumBalance = getMinimumBalance(accountType)

    const accountData = {
      userId,
      accountType,
      currency:       currency || 'INR',
      balance:        initialDeposit || 0,
      interestRate,
      minimumBalance,
      nominee:        nominee || {},

      // First account created by user becomes primary
      isPrimary: existingAccounts.length === 0
    }

    // ── FD Specific Data ──────────────────────────────────────
    if (accountType === 'fixed_deposit' && fdDetails) {
      const maturityDate = new Date()
      maturityDate.setMonth(maturityDate.getMonth() + fdDetails.tenure)

      const maturityAmount = calculateFDMaturity(
        initialDeposit,
        fdDetails.tenure,
        interestRate
      )

      accountData.fdDetails = {
        tenure:         fdDetails.tenure,
        maturityDate,
        maturityAmount,
        isMatured:      false
      }
    }

    // ── Create the account ────────────────────────────────────
    const account = await Account.create(accountData)

    res.status(201).json({
      success:  true,
      message:  `${accountType} account created successfully`,
      account: {
        id:            account._id,
        accountNumber: account.accountNumber,
        accountType:   account.accountType,
        balance:       account.balance,
        currency:      account.currency,
        status:        account.status,
        interestRate:  account.interestRate,
        minimumBalance:account.minimumBalance,
        ifscCode:      account.ifscCode,
        branchCode:    account.branchCode,
        isPrimary:     account.isPrimary,
        fdDetails:     account.fdDetails,
        createdAt:     account.createdAt
      }
    })

  } catch (error) {
    next(error)
  }
}


// ─────────────────────────────────────────────────────────────
// @route   GET /api/accounts/my
// @desc    Get all accounts of logged in user
// @access  Private
// ─────────────────────────────────────────────────────────────
const getMyAccounts = async (req, res, next) => {
  try {
    const accounts = await Account.find({
      userId: req.user._id,
      status: { $ne: 'closed' }    // don't show closed accounts
    }).sort({ isPrimary: -1, createdAt: 1 })
    // sort: primary account first, then by creation date

    // Calculate total balance across all accounts
    const totalBalance = accounts.reduce(
      (sum, account) => sum + account.balance, 0
    )

    res.status(200).json({
      success:      true,
      totalAccounts: accounts.length,
      totalBalance,
      accounts
    })

  } catch (error) {
    next(error)
  }
}


// ─────────────────────────────────────────────────────────────
// @route   GET /api/accounts/:id
// @desc    Get single account details
// @access  Private
// ─────────────────────────────────────────────────────────────
const getAccountById = async (req, res, next) => {
  try {
    const account = await Account.findById(req.params.id)
      .populate('userId', 'firstName lastName email phone')
      // populate means: instead of just storing userId
      // fetch the actual user data and embed it in the response

    // Account not found
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      })
    }

    // Security check: make sure this account belongs to
    // the logged in user — unless they are admin
    if (
      account.userId._id.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This account does not belong to you'
      })
    }

    res.status(200).json({
      success: true,
      account
    })

  } catch (error) {
    next(error)
  }
}


// ─────────────────────────────────────────────────────────────
// @route   GET /api/accounts/:id/balance
// @desc    Get account balance
// @access  Private
// ─────────────────────────────────────────────────────────────
const getBalance = async (req, res, next) => {
  try {
    const account = await Account.findById(req.params.id)
      .select('accountNumber accountType balance currency status userId')

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      })
    }

    // Security: only owner can check balance
    if (account.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      })
    }

    if (account.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: `Account is ${account.status}. Cannot retrieve balance`
      })
    }

    res.status(200).json({
      success:       true,
      accountNumber: account.accountNumber,
      accountType:   account.accountType,
      balance:       account.balance,
      currency:      account.currency,
      asOf:          new Date()    // timestamp of balance check
    })

  } catch (error) {
    next(error)
  }
}


// ─────────────────────────────────────────────────────────────
// @route   PUT /api/accounts/:id/status
// @desc    Update account status (admin only)
// @access  Private + Admin
// ─────────────────────────────────────────────────────────────
const updateAccountStatus = async (req, res, next) => {
  try {
    const { status, reason } = req.body

    // Only these transitions are allowed
    const allowedStatuses = ['active', 'inactive', 'frozen', 'closed']

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${allowedStatuses.join(', ')}`
      })
    }

    const account = await Account.findById(req.params.id)

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      })
    }

    // Cannot reopen a closed account — ever
    // This is a hard banking rule
    if (account.status === 'closed') {
      return res.status(400).json({
        success: false,
        message: 'A closed account cannot be reopened'
      })
    }

    account.status = status
    await account.save()

    res.status(200).json({
      success: true,
      message: `Account status updated to ${status}`,
      account: {
        id:            account._id,
        accountNumber: account.accountNumber,
        status:        account.status
      }
    })

  } catch (error) {
    next(error)
  }
}


// ─────────────────────────────────────────────────────────────
// @route   PUT /api/accounts/:id/nominee
// @desc    Update nominee details
// @access  Private
// ─────────────────────────────────────────────────────────────
const updateNominee = async (req, res, next) => {
  try {
    const { name, relationship, phone } = req.body

    const account = await Account.findById(req.params.id)

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      })
    }

    // Only account owner can update nominee
    if (account.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      })
    }

    account.nominee = { name, relationship, phone }
    await account.save()

    res.status(200).json({
      success: true,
      message: 'Nominee updated successfully',
      nominee: account.nominee
    })

  } catch (error) {
    next(error)
  }
}

module.exports = {
  createAccount,
  getMyAccounts,
  getAccountById,
  getBalance,
  updateAccountStatus,
  updateNominee
}
