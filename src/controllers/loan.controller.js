const Loan        = require('../models/Loan.model')
const Account     = require('../models/Account.model')
const Transaction = require('../models/Transaction.model')

// ─── Helper: Calculate EMI ────────────────────────────────────
// EMI = P × r × (1+r)^n / ((1+r)^n - 1)
const calculateEMI = (principal, annualRate, tenureMonths) => {
  const r = annualRate / 12 / 100     // monthly interest rate
  const n = tenureMonths              // number of months

  if (r === 0) return principal / n   // 0% interest edge case

  const emi = (principal * r * Math.pow(1 + r, n)) /
              (Math.pow(1 + r, n) - 1)

  return Math.round(emi * 100) / 100  // round to 2 decimals
}

// ─── Helper: Get Interest Rate by Loan Type ───────────────────
const getLoanInterestRate = (loanType) => {
  const rates = {
    personal:  14.0,   // highest rate — no collateral
    home:       8.5,   // lowest rate — property as collateral
    car:       10.5,
    education: 11.0,
    business:  13.0,
    gold:       9.5
  }
  return rates[loanType] || 14.0
}

// ─── Helper: Generate Repayment Schedule ─────────────────────
// Shows every EMI date and how much goes to principal vs interest
const generateRepaymentSchedule = (
  principal,
  annualRate,
  tenureMonths,
  emiAmount,
  startDate
) => {
  const r        = annualRate / 12 / 100
  const schedule = []
  let   balance  = principal

  for (let month = 1; month <= tenureMonths; month++) {
    const interestForMonth  = Math.round(balance * r * 100) / 100
    const principalForMonth = Math.round((emiAmount - interestForMonth) * 100) / 100
    balance = Math.round((balance - principalForMonth) * 100) / 100

    // Calculate due date for this EMI
    const dueDate = new Date(startDate)
    dueDate.setMonth(dueDate.getMonth() + month)

    schedule.push({
      emiNumber:        month,
      dueDate,
      emiAmount,
      principalAmount:  principalForMonth,
      interestAmount:   interestForMonth,
      remainingBalance: balance < 0 ? 0 : balance,
      status:           'pending'
    })
  }

  return schedule
}


// ─────────────────────────────────────────────────────────────
// @route   POST /api/loans/apply
// @desc    Apply for a loan
// @access  Private
// ─────────────────────────────────────────────────────────────
const applyLoan = async (req, res, next) => {
  try {
    const {
      accountId,
      loanType,
      principalAmount,
      tenureMonths,
      purpose
    } = req.body

    // ── Verify account exists and belongs to user ─────────────
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
        message: 'Access denied. Account does not belong to you'
      })
    }

    if (account.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Account must be active to apply for a loan'
      })
    }

    // ── Check existing active loans ───────────────────────────
    // Max 3 active loans at a time
    const activeLoans = await Loan.countDocuments({
      userId: req.user._id,
      status: { $in: ['active', 'pending', 'approved'] }
    })

    if (activeLoans >= 3) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 3 active loans allowed at a time'
      })
    }

    // ── Calculate loan details ────────────────────────────────
    const interestRate  = getLoanInterestRate(loanType)
    const emiAmount     = calculateEMI(principalAmount, interestRate, tenureMonths)
    const totalPayable  = Math.round(emiAmount * tenureMonths * 100) / 100
    const totalInterest = Math.round((totalPayable - principalAmount) * 100) / 100

    // ── Create the loan application ───────────────────────────
    const loan = await Loan.create({
      userId:          req.user._id,
      accountId,
      loanType,
      principalAmount,
      interestRate,
      tenureMonths,
      emiAmount,
      totalPayable,
      totalInterest,
      remainingAmount: totalPayable,
      purpose,
      status:          'pending'   // admin must approve
    })

    res.status(201).json({
      success: true,
      message: 'Loan application submitted successfully. Awaiting approval',
      loan: {
        loanId:          loan.loanId,
        loanType,
        principalAmount,
        interestRate:    `${interestRate}% per annum`,
        tenureMonths,
        emiAmount,
        totalPayable,
        totalInterest,
        status:          'pending',
        appliedAt:       loan.appliedAt
      }
    })

  } catch (error) {
    next(error)
  }
}


// ─────────────────────────────────────────────────────────────
// @route   GET /api/loans/my
// @desc    Get all loans of logged in user
// @access  Private
// ─────────────────────────────────────────────────────────────
const getMyLoans = async (req, res, next) => {
  try {
    const loans = await Loan.find({ userId: req.user._id })
      .populate('accountId', 'accountNumber accountType')
      .sort({ createdAt: -1 })

    // Summary calculations
    const totalBorrowed = loans
      .filter(l => ['active', 'closed'].includes(l.status))
      .reduce((sum, l) => sum + l.principalAmount, 0)

    const totalOutstanding = loans
      .filter(l => l.status === 'active')
      .reduce((sum, l) => sum + l.remainingAmount, 0)

    res.status(200).json({
      success:          true,
      totalLoans:       loans.length,
      totalBorrowed,
      totalOutstanding,
      loans
    })

  } catch (error) {
    next(error)
  }
}


// ─────────────────────────────────────────────────────────────
// @route   GET /api/loans/:loanId
// @desc    Get single loan details
// @access  Private
// ─────────────────────────────────────────────────────────────
const getLoanById = async (req, res, next) => {
  try {
    const loan = await Loan.findOne({ loanId: req.params.loanId })
      .populate('accountId', 'accountNumber accountType balance')
      .populate('approvedBy', 'firstName lastName')

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      })
    }

    if (
      loan.userId.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      })
    }

    res.status(200).json({
      success: true,
      loan
    })

  } catch (error) {
    next(error)
  }
}


// ─────────────────────────────────────────────────────────────
// @route   GET /api/loans/:loanId/schedule
// @desc    Get full EMI repayment schedule
// @access  Private
// ─────────────────────────────────────────────────────────────
const getRepaymentSchedule = async (req, res, next) => {
  try {
    const loan = await Loan.findOne({ loanId: req.params.loanId })

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      })
    }

    if (loan.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      })
    }

    if (loan.status === 'pending' || loan.status === 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Repayment schedule is only available for approved loans'
      })
    }

    const schedule = generateRepaymentSchedule(
      loan.principalAmount,
      loan.interestRate,
      loan.tenureMonths,
      loan.emiAmount,
      loan.approvedAt || loan.createdAt
    )

    res.status(200).json({
      success: true,
      loanId:       loan.loanId,
      loanType:     loan.loanType,
      emiAmount:    loan.emiAmount,
      totalPayable: loan.totalPayable,
      emisPaid:     loan.emisPaid,
      schedule
    })

  } catch (error) {
    next(error)
  }
}


// ─────────────────────────────────────────────────────────────
// @route   POST /api/loans/:loanId/repay
// @desc    Pay an EMI for a loan
// @access  Private
// ─────────────────────────────────────────────────────────────
const repayLoan = async (req, res, next) => {
  try {
    const { accountId, amount } = req.body

    const loan = await Loan.findOne({ loanId: req.params.loanId })

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      })
    }

    if (loan.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      })
    }

    if (loan.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: `Cannot repay a ${loan.status} loan`
      })
    }

    // Find the account to deduct EMI from
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

    // Check sufficient balance
    if (account.balance < amount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ₹${account.balance}`
      })
    }

    // Deduct from account
    account.balance -= amount
    await account.save()

    // Update loan repayment tracking
    loan.paidAmount      += amount
    loan.remainingAmount  = Math.max(0, loan.totalPayable - loan.paidAmount)
    loan.emisPaid        += 1

    // Set next EMI date
    const nextDate = new Date()
    nextDate.setMonth(nextDate.getMonth() + 1)
    loan.nextEmiDate = nextDate

    // Close loan if fully paid
    if (loan.remainingAmount <= 0) {
      loan.status    = 'closed'
      loan.closedAt  = new Date()
    }

    await loan.save()

    // Record the repayment transaction
    await Transaction.create({
      accountId,
      userId:       req.user._id,
      type:         'loan_repayment',
      amount,
      balanceAfter: account.balance,
      description:  `EMI payment for loan ${loan.loanId}`,
      status:       'completed'
    })

    res.status(200).json({
      success: true,
      message: loan.status === 'closed'
        ? '🎉 Loan fully paid! Congratulations'
        : `EMI of ₹${amount} paid successfully`,
      repayment: {
        loanId:          loan.loanId,
        amountPaid:      amount,
        totalPaid:       loan.paidAmount,
        remainingAmount: loan.remainingAmount,
        emisPaid:        loan.emisPaid,
        nextEmiDate:     loan.nextEmiDate,
        loanStatus:      loan.status,
        accountBalance:  account.balance
      }
    })

  } catch (error) {
    next(error)
  }
}


// ─────────────────────────────────────────────────────────────
// @route   PUT /api/loans/:loanId/status
// @desc    Approve or reject a loan (admin only)
// @access  Private + Admin
// ─────────────────────────────────────────────────────────────
const updateLoanStatus = async (req, res, next) => {
  try {
    const { status, rejectionReason } = req.body

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be approved or rejected'
      })
    }

    const loan = await Loan.findOne({ loanId: req.params.loanId })

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      })
    }

    if (loan.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Loan is already ${loan.status}`
      })
    }

    if (status === 'rejected' && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      })
    }

    loan.status     = status === 'approved' ? 'active' : 'rejected'
    loan.approvedBy = req.user._id
    loan.approvedAt = new Date()

    if (status === 'rejected') {
      loan.rejectionReason = rejectionReason
    }

    // If approved — disburse loan amount to account
    if (status === 'approved') {
      const account = await Account.findById(loan.accountId)
      account.balance += loan.principalAmount
      await account.save()

      // Set first EMI date — 1 month from now
      const nextEmiDate = new Date()
      nextEmiDate.setMonth(nextEmiDate.getMonth() + 1)
      loan.nextEmiDate = nextEmiDate

      // Record disbursement transaction
      await Transaction.create({
        accountId:    loan.accountId,
        userId:       loan.userId,
        type:         'loan_disbursement',
        amount:       loan.principalAmount,
        balanceAfter: account.balance,
        description:  `Loan disbursement for ${loan.loanId}`,
        status:       'completed'
      })
    }

    await loan.save()

    res.status(200).json({
      success: true,
      message: `Loan ${status} successfully`,
      loan: {
        loanId:      loan.loanId,
        status:      loan.status,
        approvedAt:  loan.approvedAt,
        nextEmiDate: loan.nextEmiDate
      }
    })

  } catch (error) {
    next(error)
  }
}

module.exports = {
  applyLoan,
  getMyLoans,
  getLoanById,
  getRepaymentSchedule,
  repayLoan,
  updateLoanStatus
}
