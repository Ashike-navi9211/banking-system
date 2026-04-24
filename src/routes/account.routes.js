const express = require('express')
const router  = express.Router()

const {
  createAccount,
  getMyAccounts,
  getAccountById,
  getBalance,
  updateAccountStatus,
  updateNominee
} = require('../controllers/account.controller')

const { protect, authorize } = require('../middlewares/auth.middleware')
const validate               = require('../middlewares/validate.middleware')
const { createAccountValidator } = require('../validators/auth.validator')

// ─── All routes require login ─────────────────────────────────
// We use router.use(protect) so we don't repeat
// protect on every single route below
router.use(protect)

// ─── Account Routes ───────────────────────────────────────────
router.post('/create',          validate(createAccountValidator), createAccount)
router.get ('/my',              getMyAccounts)
router.get ('/:id',             getAccountById)
router.get ('/:id/balance',     getBalance)
router.put ('/:id/nominee',     updateNominee)

// Admin only routes
router.put ('/:id/status',      authorize('admin'), updateAccountStatus)

module.exports = router
