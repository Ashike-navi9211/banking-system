const express = require('express')
const router  = express.Router()

const {
  applyLoan,
  getMyLoans,
  getLoanById,
  getRepaymentSchedule,
  repayLoan,
  updateLoanStatus
} = require('../controllers/loan.controller')

const { protect, authorize } = require('../middlewares/auth.middleware')
const validate               = require('../middlewares/validate.middleware')
const {
  applyLoanValidator,
  repayLoanValidator
} = require('../validators/auth.validator')

router.use(protect)

router.post('/',                 validate(applyLoanValidator), applyLoan)
router.get ('/my',               getMyLoans)
router.get ('/:loanId/schedule', getRepaymentSchedule)    // ← move this UP
router.get ('/:loanId',          getLoanById)             // ← this goes AFTER
router.post('/:loanId/repay',    validate(repayLoanValidator), repayLoan)
router.put ('/:loanId/status',   authorize('admin'),      updateLoanStatus)
module.exports = router
