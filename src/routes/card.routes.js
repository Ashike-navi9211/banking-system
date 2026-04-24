const express = require('express')
const router  = express.Router()

const {
  generateCard,
  getMyCards,
  getCardById,
  blockUnblockCard,
  updateLimits,
  updateSettings,
  setPin
} = require('../controllers/card.controller')

const { protect }  = require('../middlewares/auth.middleware')
const validate     = require('../middlewares/validate.middleware')
const {
  generateCardValidator,
  updateLimitsValidator,
  setPinValidator
} = require('../validators/auth.validator')

router.use(protect)

router.post('/',                   validate(generateCardValidator), generateCard)
router.get ('/my',                 getMyCards)
router.get ('/:cardId',            getCardById)
router.put ('/:cardId/block',      blockUnblockCard)
router.put ('/:cardId/limits',     validate(updateLimitsValidator), updateLimits)
router.put ('/:cardId/settings',   updateSettings)
router.put ('/:cardId/pin',        validate(setPinValidator),       setPin)

module.exports = router
