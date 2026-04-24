const PDFDocument = require('pdfkit')
const Account     = require('../models/Account.model')
const Transaction = require('../models/Transaction.model')

// ─── Helper: Format Currency ──────────────────────────────────
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style:    'currency',
    currency: 'INR'
  }).format(amount)
}

// ─── Helper: Format Date ──────────────────────────────────────
const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-IN', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric'
  })
}


// ─────────────────────────────────────────────────────────────
// @route   GET /api/statements/:accountId/mini
// @desc    Get last 5 transactions (mini statement)
// @access  Private
// ─────────────────────────────────────────────────────────────
const getMiniStatement = async (req, res, next) => {
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

    // Get last 5 transactions only
    const transactions = await Transaction.find({ accountId })
      .sort({ createdAt: -1 })
      .limit(5)

    res.status(200).json({
      success:       true,
      accountNumber: account.accountNumber,
      accountType:   account.accountType,
      currentBalance: account.balance,
      transactions:  transactions.map(txn => ({
        transactionId: txn.transactionId,
        type:          txn.type,
        amount:        txn.amount,
        balanceAfter:  txn.balanceAfter,
        description:   txn.description,
        date:          formatDate(txn.createdAt)
      }))
    })

  } catch (error) {
    next(error)
  }
}


// ─────────────────────────────────────────────────────────────
// @route   GET /api/statements/:accountId/full
// @desc    Full statement with date filters and pagination
// @access  Private
// ─────────────────────────────────────────────────────────────
const getFullStatement = async (req, res, next) => {
  try {
    const { accountId } = req.params

    const account = await Account.findById(accountId)
      .populate('userId', 'firstName lastName email phone')

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      })
    }

    if (account.userId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      })
    }

    // ── Filters ───────────────────────────────────────────────
    const {
      startDate,
      endDate,
      type,
      page  = 1,
      limit = 20
    } = req.query

    const filter = { accountId }

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {}
      if (startDate) filter.createdAt.$gte = new Date(startDate)
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)   // include full end day
        filter.createdAt.$lte = end
      }
    }

    // Transaction type filter
    if (type) filter.type = type

    const skip = (page - 1) * limit

    // Fetch transactions and total count together
    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Transaction.countDocuments(filter)
    ])

    // ── Calculate totals for statement period ─────────────────
    const allTransactions = await Transaction.find(filter)

    const totalCredit = allTransactions
      .filter(t => ['deposit', 'transfer_in', 'loan_disbursement', 'interest_credit'].includes(t.type))
      .reduce((sum, t) => sum + t.amount, 0)

    const totalDebit = allTransactions
      .filter(t => ['withdrawal', 'transfer_out', 'loan_repayment', 'charge'].includes(t.type))
      .reduce((sum, t) => sum + t.amount, 0)

    res.status(200).json({
      success: true,
      statement: {
        accountDetails: {
          accountNumber: account.accountNumber,
          accountType:   account.accountType,
          accountHolder: `${account.userId.firstName} ${account.userId.lastName}`,
          email:         account.userId.email,
          ifscCode:      account.ifscCode,
          branchCode:    account.branchCode
        },
        period: {
          from: startDate || 'All time',
          to:   endDate   || formatDate(new Date())
        },
        summary: {
          openingBalance:  transactions.length > 0
            ? transactions[transactions.length - 1].balanceAfter - transactions[transactions.length - 1].amount
            : account.balance,
          closingBalance:  account.balance,
          totalCredit:     Math.round(totalCredit * 100) / 100,
          totalDebit:      Math.round(totalDebit * 100) / 100,
          netFlow:         Math.round((totalCredit - totalDebit) * 100) / 100
        },
        pagination: {
          total,
          page:       Number(page),
          totalPages: Math.ceil(total / limit)
        },
        transactions: transactions.map(txn => ({
          transactionId: txn.transactionId,
          date:          formatDate(txn.createdAt),
          type:          txn.type,
          description:   txn.description,
          debit:         ['withdrawal', 'transfer_out', 'loan_repayment', 'charge']
                           .includes(txn.type) ? txn.amount : 0,
          credit:        ['deposit', 'transfer_in', 'loan_disbursement', 'interest_credit']
                           .includes(txn.type) ? txn.amount : 0,
          balance:       txn.balanceAfter,
          channel:       txn.channel,
          status:        txn.status
        }))
      }
    })

  } catch (error) {
    next(error)
  }
}


// ─────────────────────────────────────────────────────────────
// @route   GET /api/statements/:accountId/summary
// @desc    Monthly income vs expense summary
// @access  Private
// ─────────────────────────────────────────────────────────────
const getMonthlySummary = async (req, res, next) => {
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

    // Get last 6 months of transactions
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const transactions = await Transaction.find({
      accountId,
      createdAt: { $gte: sixMonthsAgo },
      status:    'completed'
    })

    // Group by month
    const monthlyData = {}

    transactions.forEach(txn => {
      const date      = new Date(txn.createdAt)
      const monthKey  = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const monthName = date.toLocaleDateString('en-IN', {
        month: 'long',
        year:  'numeric'
      })

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month:   monthName,
          credit:  0,
          debit:   0,
          savings: 0
        }
      }

      const creditTypes = ['deposit', 'transfer_in', 'loan_disbursement', 'interest_credit']
      const debitTypes  = ['withdrawal', 'transfer_out', 'loan_repayment', 'charge']

      if (creditTypes.includes(txn.type)) {
        monthlyData[monthKey].credit += txn.amount
      } else if (debitTypes.includes(txn.type)) {
        monthlyData[monthKey].debit += txn.amount
      }

      monthlyData[monthKey].savings =
        monthlyData[monthKey].credit - monthlyData[monthKey].debit
    })

    // Convert to sorted array
    const summary = Object.values(monthlyData)
      .sort((a, b) => a.month > b.month ? 1 : -1)
      .map(m => ({
        ...m,
        credit:  Math.round(m.credit  * 100) / 100,
        debit:   Math.round(m.debit   * 100) / 100,
        savings: Math.round(m.savings * 100) / 100
      }))

    // Category breakdown
    const categoryBreakdown = {}
    transactions
      .filter(t => ['withdrawal', 'transfer_out'].includes(t.type))
      .forEach(txn => {
        const cat = txn.category || 'other'
        categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + txn.amount
      })

    res.status(200).json({
      success:           true,
      accountNumber:     account.accountNumber,
      currentBalance:    account.balance,
      monthlySummary:    summary,
      categoryBreakdown,
      totalTransactions: transactions.length
    })

  } catch (error) {
    next(error)
  }
}


// ─────────────────────────────────────────────────────────────
// @route   GET /api/statements/:accountId/pdf
// @desc    Download PDF bank statement
// @access  Private
// ─────────────────────────────────────────────────────────────
const downloadPDF = async (req, res, next) => {
  try {
    const { accountId } = req.params
    const { startDate, endDate } = req.query

    const account = await Account.findById(accountId)
      .populate('userId', 'firstName lastName email phone address')

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      })
    }

    if (account.userId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      })
    }

    // Build filter
    const filter = { accountId }
    if (startDate || endDate) {
      filter.createdAt = {}
      if (startDate) filter.createdAt.$gte = new Date(startDate)
      if (endDate)   filter.createdAt.$lte = new Date(endDate)
    }

    const transactions = await Transaction.find(filter)
      .sort({ createdAt: 1 })

    // ── Generate PDF ──────────────────────────────────────────
    const doc = new PDFDocument({ margin: 50 })

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=statement_${account.accountNumber}.pdf`
    )

    // Pipe PDF directly to response
    doc.pipe(res)

    // ── PDF Header ────────────────────────────────────────────
    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('BANKING SYSTEM', { align: 'center' })

    doc
      .fontSize(12)
      .font('Helvetica')
      .text('Account Statement', { align: 'center' })

    doc.moveDown()
    doc
      .moveTo(50, doc.y)
      .lineTo(550, doc.y)
      .stroke()
    doc.moveDown()

    // ── Account Details ───────────────────────────────────────
    doc.fontSize(11).font('Helvetica-Bold').text('ACCOUNT DETAILS')
    doc.moveDown(0.5)
    doc.font('Helvetica').fontSize(10)
    doc.text(`Account Holder : ${account.userId.firstName} ${account.userId.lastName}`)
    doc.text(`Account Number : ${account.accountNumber}`)
    doc.text(`Account Type   : ${account.accountType.toUpperCase()}`)
    doc.text(`IFSC Code      : ${account.ifscCode}`)
    doc.text(`Current Balance: ${formatCurrency(account.balance)}`)
    doc.text(`Statement Date : ${formatDate(new Date())}`)
    if (startDate) doc.text(`From           : ${formatDate(startDate)}`)
    if (endDate)   doc.text(`To             : ${formatDate(endDate)}`)

    doc.moveDown()
    doc
      .moveTo(50, doc.y)
      .lineTo(550, doc.y)
      .stroke()
    doc.moveDown()

    // ── Transaction Table Header ──────────────────────────────
    doc.font('Helvetica-Bold').fontSize(10)
    doc.text('Date',          50,  doc.y, { width: 80  })
    doc.text('Description',   130, doc.y - doc.currentLineHeight(),
             { width: 180 })
    doc.text('Type',          310, doc.y - doc.currentLineHeight(),
             { width: 80  })
    doc.text('Debit',         390, doc.y - doc.currentLineHeight(),
             { width: 70, align: 'right' })
    doc.text('Credit',        460, doc.y - doc.currentLineHeight(),
             { width: 70, align: 'right' })

    doc.moveDown(0.5)
    doc
      .moveTo(50, doc.y)
      .lineTo(550, doc.y)
      .stroke()
    doc.moveDown(0.5)

    // ── Transaction Rows ──────────────────────────────────────
    doc.font('Helvetica').fontSize(9)

    const creditTypes = ['deposit', 'transfer_in', 'loan_disbursement', 'interest_credit']

    transactions.forEach(txn => {
      const isCredit = creditTypes.includes(txn.type)
      const y        = doc.y

      doc.text(formatDate(txn.createdAt), 50,  y, { width: 80  })
      doc.text(txn.description || txn.type, 130, y, { width: 180 })
      doc.text(txn.type,                    310, y, { width: 80  })

      if (isCredit) {
        doc.text('',                          390, y, { width: 70, align: 'right' })
        doc.text(formatCurrency(txn.amount),  460, y, { width: 70, align: 'right' })
      } else {
        doc.text(formatCurrency(txn.amount),  390, y, { width: 70, align: 'right' })
        doc.text('',                          460, y, { width: 70, align: 'right' })
      }

      doc.moveDown(0.8)

      // Add new page if running out of space
      if (doc.y > 700) {
        doc.addPage()
        doc.y = 50
      }
    })

    // ── PDF Footer ────────────────────────────────────────────
    doc.moveDown()
    doc
      .moveTo(50, doc.y)
      .lineTo(550, doc.y)
      .stroke()
    doc.moveDown()

    doc
      .fontSize(9)
      .font('Helvetica')
      .text(
        'This is a computer generated statement and does not require a signature.',
        { align: 'center' }
      )

    // Finalize the PDF
    doc.end()

  } catch (error) {
    next(error)
  }
}

module.exports = {
  getMiniStatement,
  getFullStatement,
  getMonthlySummary,
  downloadPDF
}
