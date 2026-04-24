const User        = require('../models/User.model')
const Account     = require('../models/Account.model')
const Transaction = require('../models/Transaction.model')
const Loan        = require('../models/Loan.model')
const Card        = require('../models/Card.model')


// ─────────────────────────────────────────────────────────────
// @route   GET /api/admin/dashboard
// @desc    System wide overview stats
// @access  Admin only
// ─────────────────────────────────────────────────────────────
const getDashboard = async (req, res, next) => {
  try {

    // Run all queries at the same time for speed
    const [
      totalUsers,
      activeUsers,
      totalAccounts,
      totalTransactions,
      totalLoans,
      pendingLoans,
      totalCards,
      recentTransactions,
      recentUsers
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      Account.countDocuments({ status: { $ne: 'closed' } }),
      Transaction.countDocuments(),
      Loan.countDocuments(),
      Loan.countDocuments({ status: 'pending' }),
      Card.countDocuments({ status: { $ne: 'hotlisted' } }),

      // Last 5 transactions across entire system
      Transaction.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('userId', 'firstName lastName'),

      // Last 5 registered users
      User.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('firstName lastName email role createdAt isActive')
    ])

    // Calculate total deposits and withdrawals
    const [depositStats, withdrawalStats] = await Promise.all([
      Transaction.aggregate([
        { $match: { type: 'deposit', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Transaction.aggregate([
        { $match: { type: 'withdrawal', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ])

    // Calculate total outstanding loan amount
    const loanStats = await Loan.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: null, totalOutstanding: { $sum: '$remainingAmount' } } }
    ])

    res.status(200).json({
      success: true,
      dashboard: {
        users: {
          total:    totalUsers,
          active:   activeUsers,
          inactive: totalUsers - activeUsers
        },
        accounts: {
          total: totalAccounts
        },
        transactions: {
          total:          totalTransactions,
          totalDeposits:  depositStats[0]?.total    || 0,
          totalWithdrawals: withdrawalStats[0]?.total || 0
        },
        loans: {
          total:          totalLoans,
          pending:        pendingLoans,
          totalOutstanding: loanStats[0]?.totalOutstanding || 0
        },
        cards: {
          total: totalCards
        },
        recentTransactions,
        recentUsers
      }
    })

  } catch (error) {
    next(error)
  }
}


// ─────────────────────────────────────────────────────────────
// @route   GET /api/admin/users
// @desc    Get all users with search and filters
// @access  Admin only
// ─────────────────────────────────────────────────────────────
const getAllUsers = async (req, res, next) => {
  try {
    const {
      search,
      role,
      isActive,
      isKycVerified,
      page  = 1,
      limit = 10
    } = req.query

    // Build filter dynamically
    const filter = {}

    // Search by name or email
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName:  { $regex: search, $options: 'i' } },
        { email:     { $regex: search, $options: 'i' } },
        { phone:     { $regex: search, $options: 'i' } }
      ]
    }

    if (role)     filter.role     = role
    if (isActive !== undefined)
      filter.isActive = isActive === 'true'
    if (isKycVerified !== undefined)
      filter['kyc.isVerified'] = isKycVerified === 'true'

    const skip = (page - 1) * limit

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select('-password -resetPasswordToken'),
      User.countDocuments(filter)
    ])

    res.status(200).json({
      success:    true,
      total,
      page:       Number(page),
      totalPages: Math.ceil(total / limit),
      users
    })

  } catch (error) {
    next(error)
  }
}


// ─────────────────────────────────────────────────────────────
// @route   GET /api/admin/users/:id
// @desc    Get single user with all their data
// @access  Admin only
// ─────────────────────────────────────────────────────────────
const getUserDetails = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    // Get all accounts, loans, cards for this user
    const [accounts, loans, cards] = await Promise.all([
      Account.find({ userId: req.params.id }),
      Loan.find({ userId: req.params.id }),
      Card.find({ userId: req.params.id })
    ])

    // Calculate total balance
    const totalBalance = accounts.reduce(
      (sum, acc) => sum + acc.balance, 0
    )

    res.status(200).json({
      success: true,
      user,
      accounts,
      loans,
      cards,
      summary: {
        totalAccounts: accounts.length,
        totalBalance,
        totalLoans:    loans.length,
        totalCards:    cards.length
      }
    })

  } catch (error) {
    next(error)
  }
}


// ─────────────────────────────────────────────────────────────
// @route   PUT /api/admin/users/:id/status
// @desc    Activate or deactivate a user
// @access  Admin only
// ─────────────────────────────────────────────────────────────
const updateUserStatus = async (req, res, next) => {
  try {
    const { isActive, reason } = req.body

    // Admin cannot deactivate themselves
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account'
      })
    }

    const user = await User.findById(req.params.id)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    user.isActive = isActive

    // Unlock account if reactivating
    if (isActive) {
      user.isLocked      = false
      user.loginAttempts = 0
    }

    await user.save({ validateBeforeSave: false })

    res.status(200).json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user: {
        id:       user._id,
        name:     `${user.firstName} ${user.lastName}`,
        isActive: user.isActive
      }
    })

  } catch (error) {
    next(error)
  }
}


// ─────────────────────────────────────────────────────────────
// @route   PUT /api/admin/users/:id/kyc
// @desc    Approve or reject KYC
// @access  Admin only
// ─────────────────────────────────────────────────────────────
const updateKYC = async (req, res, next) => {
  try {
    const { status, panNumber, aadharNumber } = req.body

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be approved or rejected'
      })
    }

    const user = await User.findById(req.params.id)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    if (status === 'approved') {
      user.kyc.isVerified  = true
      user.kyc.verifiedAt  = new Date()
      if (panNumber)    user.kyc.panNumber    = panNumber
      if (aadharNumber) user.kyc.aadharNumber = aadharNumber
    } else {
      user.kyc.isVerified = false
    }

    await user.save({ validateBeforeSave: false })

    res.status(200).json({
      success: true,
      message: `KYC ${status} successfully`,
      kyc:     user.kyc
    })

  } catch (error) {
    next(error)
  }
}


// ─────────────────────────────────────────────────────────────
// @route   GET /api/admin/transactions
// @desc    All transactions system wide with filters
// @access  Admin only
// ─────────────────────────────────────────────────────────────
const getAllTransactions = async (req, res, next) => {
  try {
    const {
      type,
      status,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      page  = 1,
      limit = 20
    } = req.query

    const filter = {}

    if (type)   filter.type   = type
    if (status) filter.status = status

    if (startDate || endDate) {
      filter.createdAt = {}
      if (startDate) filter.createdAt.$gte = new Date(startDate)
      if (endDate)   filter.createdAt.$lte = new Date(endDate)
    }

    if (minAmount || maxAmount) {
      filter.amount = {}
      if (minAmount) filter.amount.$gte = Number(minAmount)
      if (maxAmount) filter.amount.$lte = Number(maxAmount)
    }

    const skip = (page - 1) * limit

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('userId',    'firstName lastName email')
        .populate('accountId', 'accountNumber accountType'),
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
// @route   GET /api/admin/loans
// @desc    All loans with filters
// @access  Admin only
// ─────────────────────────────────────────────────────────────
const getAllLoans = async (req, res, next) => {
  try {
    const {
      status,
      loanType,
      page  = 1,
      limit = 10
    } = req.query

    const filter = {}
    if (status)   filter.status   = status
    if (loanType) filter.loanType = loanType

    const skip = (page - 1) * limit

    const [loans, total] = await Promise.all([
      Loan.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('userId',    'firstName lastName email phone')
        .populate('accountId', 'accountNumber accountType'),
      Loan.countDocuments(filter)
    ])

    res.status(200).json({
      success:    true,
      total,
      page:       Number(page),
      totalPages: Math.ceil(total / limit),
      loans
    })

  } catch (error) {
    next(error)
  }
}

module.exports = {
  getDashboard,
  getAllUsers,
  getUserDetails,
  updateUserStatus,
  updateKYC,
  getAllTransactions,
  getAllLoans
}
