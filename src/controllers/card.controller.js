const bcrypt  = require('bcryptjs')
const Card    = require('../models/Card.model')
const Account = require('../models/Account.model')

// ─── Helper: Mask Card Number ─────────────────────────────────
// Never show full card number in responses
// 4532 1234 5678 9010 → 4532 **** **** 9010
const maskCardNumber = (cardNumber) => {
  const parts = cardNumber.split(' ')
  return `${parts[0]} **** **** ${parts[3]}`
}

// ─── Helper: Format Expiry Date ───────────────────────────────
// Date → MM/YY format like real cards
const formatExpiry = (date) => {
  const d = new Date(date)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year  = String(d.getFullYear()).slice(-2)
  return `${month}/${year}`
}


// ─────────────────────────────────────────────────────────────
// @route   POST /api/cards/generate
// @desc    Generate a new virtual card
// @access  Private
// ─────────────────────────────────────────────────────────────
const generateCard = async (req, res, next) => {
  try {
    const { accountId, cardType, cardNetwork, creditLimit } = req.body

    // ── Verify account ────────────────────────────────────────
    const account = await Account.findById(accountId)
      .populate('userId', 'firstName lastName')

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      })
    }

    if (account.userId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Account does not belong to you'
      })
    }

    if (account.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Account must be active to generate a card'
      })
    }

    // ── One active card per type per account ──────────────────
    const existingCard = await Card.findOne({
      accountId,
      cardType,
      status: { $in: ['active', 'blocked'] }
    })

    if (existingCard) {
      return res.status(400).json({
        success: false,
        message: `An active ${cardType} card already exists for this account`
      })
    }

    // ── Cannot create credit card for FD account ──────────────
    if (account.accountType === 'fixed_deposit') {
      return res.status(400).json({
        success: false,
        message: 'Cards cannot be issued for fixed deposit accounts'
      })
    }

    // ── Build card holder name ────────────────────────────────
    const cardHolderName =
      `${req.user.firstName} ${req.user.lastName}`.toUpperCase()

    // ── Create the card ───────────────────────────────────────
    const cardData = {
      userId:         req.user._id,
      accountId,
      cardType,
      cardNetwork:    cardNetwork || 'rupay',
      cardHolderName,
      status:         'active'
    }

    // Credit card specific settings
    if (cardType === 'credit') {
      cardData.creditLimit        = creditLimit
      cardData.outstandingBalance = 0
      cardData.dailyLimit         = Math.min(creditLimit * 0.2, 25000)
      cardData.monthlyLimit       = creditLimit
    }

    const card = await Card.create(cardData)

    // ── Fetch card with CVV for first time display only ───────
    const cardWithCVV = await Card.findById(card._id).select('+cvv')

    res.status(201).json({
      success: true,
      message: `${cardType} card generated successfully`,
      card: {
        cardId:         card._id,
        cardNumber:     cardWithCVV.cardNumber,   // show full number once
        maskedNumber:   maskCardNumber(cardWithCVV.cardNumber),
        cardType:       card.cardType,
        cardNetwork:    card.cardNetwork,
        cardHolderName: card.cardHolderName,
        expiryDate:     formatExpiry(card.expiryDate),
        cvv:            cardWithCVV.cvv,          // show CVV once only
        status:         card.status,
        dailyLimit:     card.dailyLimit,
        monthlyLimit:   card.monthlyLimit,
        creditLimit:    card.creditLimit || null,
        isOnlineEnabled:      card.isOnlineEnabled,
        isInternationalEnabled: card.isInternationalEnabled,
        note: '⚠️ Save your card details. CVV will not be shown again'
      }
    })

  } catch (error) {
    next(error)
  }
}


// ─────────────────────────────────────────────────────────────
// @route   GET /api/cards/my
// @desc    Get all cards of logged in user
// @access  Private
// ─────────────────────────────────────────────────────────────
const getMyCards = async (req, res, next) => {
  try {
    const cards = await Card.find({
      userId: req.user._id,
      status: { $ne: 'hotlisted' }   // never show hotlisted cards
    })
    .populate('accountId', 'accountNumber accountType')
    .sort({ createdAt: -1 })

    // Mask card numbers in list view
    const maskedCards = cards.map(card => ({
      cardId:         card._id,
      maskedNumber:   maskCardNumber(card.cardNumber),
      cardType:       card.cardType,
      cardNetwork:    card.cardNetwork,
      cardHolderName: card.cardHolderName,
      expiryDate:     formatExpiry(card.expiryDate),
      status:         card.status,
      dailyLimit:     card.dailyLimit,
      monthlyLimit:   card.monthlyLimit,
      isOnlineEnabled:        card.isOnlineEnabled,
      isInternationalEnabled: card.isInternationalEnabled,
      isContactlessEnabled:   card.isContactlessEnabled,
      isPinSet:       card.isPinSet,
      lastUsedAt:     card.lastUsedAt,
      account:        card.accountId
    }))

    res.status(200).json({
      success:    true,
      totalCards: maskedCards.length,
      cards:      maskedCards
    })

  } catch (error) {
    next(error)
  }
}


// ─────────────────────────────────────────────────────────────
// @route   GET /api/cards/:cardId
// @desc    Get single card details
// @access  Private
// ─────────────────────────────────────────────────────────────
const getCardById = async (req, res, next) => {
  try {
    const card = await Card.findById(req.params.cardId)
      .populate('accountId', 'accountNumber accountType balance')

    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Card not found'
      })
    }

    if (card.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      })
    }

    res.status(200).json({
      success: true,
      card: {
        cardId:         card._id,
        maskedNumber:   maskCardNumber(card.cardNumber),
        cardType:       card.cardType,
        cardNetwork:    card.cardNetwork,
        cardHolderName: card.cardHolderName,
        expiryDate:     formatExpiry(card.expiryDate),
        status:         card.status,
        dailyLimit:     card.dailyLimit,
        monthlyLimit:   card.monthlyLimit,
        creditLimit:    card.creditLimit,
        outstandingBalance: card.outstandingBalance,
        isOnlineEnabled:        card.isOnlineEnabled,
        isInternationalEnabled: card.isInternationalEnabled,
        isContactlessEnabled:   card.isContactlessEnabled,
        isPinSet:   card.isPinSet,
        lastUsedAt: card.lastUsedAt,
        account:    card.accountId,
        createdAt:  card.createdAt
      }
    })

  } catch (error) {
    next(error)
  }
}


// ─────────────────────────────────────────────────────────────
// @route   PUT /api/cards/:cardId/block
// @desc    Block or unblock a card
// @access  Private
// ─────────────────────────────────────────────────────────────
const blockUnblockCard = async (req, res, next) => {
  try {
    const { action, reason } = req.body

    // action must be 'block' or 'unblock'
    if (!['block', 'unblock'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be block or unblock'
      })
    }

    const card = await Card.findById(req.params.cardId)

    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Card not found'
      })
    }

    if (card.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      })
    }

    // Hotlisted cards can NEVER be unblocked
    if (card.status === 'hotlisted') {
      return res.status(400).json({
        success: false,
        message: 'This card has been permanently blocked. Please request a new card'
      })
    }

    if (action === 'block') {
      card.status = 'blocked'
    } else {
      card.status = 'active'
    }

    await card.save()

    res.status(200).json({
      success: true,
      message: `Card ${action}ed successfully`,
      card: {
        cardId:       card._id,
        maskedNumber: maskCardNumber(card.cardNumber),
        status:       card.status
      }
    })

  } catch (error) {
    next(error)
  }
}


// ─────────────────────────────────────────────────────────────
// @route   PUT /api/cards/:cardId/limits
// @desc    Update card spending limits
// @access  Private
// ─────────────────────────────────────────────────────────────
const updateLimits = async (req, res, next) => {
  try {
    const { dailyLimit, monthlyLimit } = req.body

    const card = await Card.findById(req.params.cardId)

    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Card not found'
      })
    }

    if (card.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      })
    }

    if (card.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: `Cannot update limits on a ${card.status} card`
      })
    }

    // Make sure daily limit never exceeds monthly limit
    const newDailyLimit   = dailyLimit   || card.dailyLimit
    const newMonthlyLimit = monthlyLimit || card.monthlyLimit

    if (newDailyLimit > newMonthlyLimit) {
      return res.status(400).json({
        success: false,
        message: 'Daily limit cannot exceed monthly limit'
      })
    }

    card.dailyLimit   = newDailyLimit
    card.monthlyLimit = newMonthlyLimit
    await card.save()

    res.status(200).json({
      success: true,
      message: 'Card limits updated successfully',
      limits: {
        dailyLimit:   card.dailyLimit,
        monthlyLimit: card.monthlyLimit
      }
    })

  } catch (error) {
    next(error)
  }
}


// ─────────────────────────────────────────────────────────────
// @route   PUT /api/cards/:cardId/settings
// @desc    Toggle card settings (international, online, contactless)
// @access  Private
// ─────────────────────────────────────────────────────────────
const updateSettings = async (req, res, next) => {
  try {
    const {
      isInternationalEnabled,
      isOnlineEnabled,
      isContactlessEnabled
    } = req.body

    const card = await Card.findById(req.params.cardId)

    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Card not found'
      })
    }

    if (card.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      })
    }

    if (card.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: `Cannot update settings on a ${card.status} card`
      })
    }

    // Only update fields that were actually sent
    if (isInternationalEnabled !== undefined)
      card.isInternationalEnabled = isInternationalEnabled

    if (isOnlineEnabled !== undefined)
      card.isOnlineEnabled = isOnlineEnabled

    if (isContactlessEnabled !== undefined)
      card.isContactlessEnabled = isContactlessEnabled

    await card.save()

    res.status(200).json({
      success: true,
      message: 'Card settings updated successfully',
      settings: {
        isInternationalEnabled: card.isInternationalEnabled,
        isOnlineEnabled:        card.isOnlineEnabled,
        isContactlessEnabled:   card.isContactlessEnabled
      }
    })

  } catch (error) {
    next(error)
  }
}


// ─────────────────────────────────────────────────────────────
// @route   PUT /api/cards/:cardId/pin
// @desc    Set or change card PIN
// @access  Private
// ─────────────────────────────────────────────────────────────
const setPin = async (req, res, next) => {
  try {
    const { pin } = req.body

    const card = await Card.findById(req.params.cardId)

    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Card not found'
      })
    }

    if (card.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      })
    }

    if (card.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Card must be active to set PIN'
      })
    }

    // Hash the PIN just like a password
    // Never store raw PIN in database
    const salt     = await bcrypt.genSalt(10)
    card.pin       = await bcrypt.hash(pin, salt)
    card.isPinSet  = true
    await card.save()

    res.status(200).json({
      success:  true,
      message:  'Card PIN set successfully',
      isPinSet: true
    })

  } catch (error) {
    next(error)
  }
}

module.exports = {
  generateCard,
  getMyCards,
  getCardById,
  blockUnblockCard,
  updateLimits,
  updateSettings,
  setPin
}
