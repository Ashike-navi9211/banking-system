const express = require('express')
const router  = express.Router()

const {
  getDashboard,
  getAllUsers,
  getUserDetails,
  updateUserStatus,
  updateKYC,
  getAllTransactions,
  getAllLoans
} = require('../controllers/admin.controller')

const { protect, authorize } = require('../middlewares/auth.middleware')

// All admin routes require login AND admin role
router.use(protect)
router.use(authorize('admin'))

router.get('/dashboard',           getDashboard)
router.get('/users',               getAllUsers)
router.get('/users/:id',           getUserDetails)
router.put('/users/:id/status',    updateUserStatus)
router.put('/users/:id/kyc',       updateKYC)
router.get('/transactions',        getAllTransactions)
router.get('/loans',               getAllLoans)

module.exports = router
