    const express = require('express')
const router  = express.Router()

const {
  getMiniStatement,
  getFullStatement,
  getMonthlySummary,
  downloadPDF
} = require('../controllers/statement.controller')

const { protect } = require('../middlewares/auth.middleware')

router.use(protect)

router.get('/:accountId/mini',    getMiniStatement)
router.get('/:accountId/full',    getFullStatement)
router.get('/:accountId/summary', getMonthlySummary)
router.get('/:accountId/pdf',     downloadPDF)

module.exports = router
