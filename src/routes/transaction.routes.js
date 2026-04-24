const express = require('express')
const router  = express.Router()

const {
  deposit,
  withdraw,
  transfer,
  getTransactionHistory,
  getTransactionById
} = require('../controllers/transaction.controller')

const { protect }  = require('../middlewares/auth.middleware')
const validate     = require('../middlewares/validate.middleware')
const {
  depositValidator,
  withdrawValidator,
  transferValidator
} = require('../validators/auth.validator')

// All routes require login
router.use(protect)

router.post('/deposit',          validate(depositValidator),  deposit)
router.post('/withdraw',         validate(withdrawValidator), withdraw)
router.post('/transfer',         validate(transferValidator), transfer)
router.get ('/history/:accountId', getTransactionHistory)
router.get ('/:txnId',             getTransactionById)

module.exports = router
