const Joi = require('joi')

// ─── Register Validator ──────────────────────────────────────
const registerValidator = Joi.object({

  firstName: Joi.string()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.min': 'First name must be at least 2 characters',
      'string.max': 'First name cannot exceed 50 characters',
      'any.required': 'First name is required'
    }),

  lastName: Joi.string()
    .min(2)
    .max(50)
    .required()
    .messages({
      'any.required': 'Last name is required'
    }),

  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please enter a valid email address',
      'any.required': 'Email is required'
    }),

  phone: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .required()
    .messages({
      'string.pattern.base': 'Phone must be a valid 10-digit number',
      'any.required': 'Phone number is required'
    }),

  password: Joi.string()
    .min(8)
    .max(32)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters',
      'string.pattern.base':
        'Password must contain uppercase, lowercase, number and special character',
      'any.required': 'Password is required'
    }),

  dateOfBirth: Joi.date()
    .max('now')
    .required()
    .messages({
      'date.max': 'Date of birth cannot be in the future',
      'any.required': 'Date of birth is required'
    }),

  gender: Joi.string()
    .valid('male', 'female', 'other')
    .required()
    .messages({
      'any.only': 'Gender must be male, female or other',
      'any.required': 'Gender is required'
    })
})

// ─── Login Validator ─────────────────────────────────────────
const loginValidator = Joi.object({

  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please enter a valid email address',
      'any.required': 'Email is required'
    }),

  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required'
    })
})

// ─── Change Password Validator ───────────────────────────────
const changePasswordValidator = Joi.object({

  currentPassword: Joi.string()
    .required()
    .messages({
      'any.required': 'Current password is required'
    }),

  newPassword: Joi.string()
    .min(8)
    .max(32)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .required()
    .messages({
      'string.min': 'New password must be at least 8 characters',
      'string.pattern.base':
        'Password must contain uppercase, lowercase, number and special character',
      'any.required': 'New password is required'
    }),

  confirmPassword: Joi.string()
    .valid(Joi.ref('newPassword'))
    .required()
    .messages({
      'any.only': 'Passwords do not match',
      'any.required': 'Please confirm your new password'
    })
})

// ─── Create Account Validator ────────────────────────────────
const createAccountValidator = Joi.object({

  accountType: Joi.string()
    .valid('savings', 'current', 'fixed_deposit', 'salary')
    .required()
    .messages({
      'any.only': 'Account type must be savings, current, fixed_deposit or salary',
      'any.required': 'Account type is required'
    }),

  currency: Joi.string()
    .valid('INR', 'USD', 'EUR')
    .default('INR'),

  nominee: Joi.object({
    name:         Joi.string().min(2).max(50),
    relationship: Joi.string().min(2).max(30),
    phone:        Joi.string().pattern(/^[0-9]{10}/)
  }).optional(),

  fdDetails: Joi.object({
    tenure: Joi.number()
      .min(1)
      .max(120)
      .required()
      .messages({
        'any.required': 'Tenure is required for fixed deposit',
        'number.min':   'Minimum tenure is 1 month',
        'number.max':   'Maximum tenure is 120 months'
      })
  }).when('accountType', {
    is:        'fixed_deposit',
    then:      Joi.required(),
    otherwise: Joi.optional()
  }),

  initialDeposit: Joi.number()
    .min(0)
    .default(0)
})

// ─── Deposit Validator ───────────────────────────────────────
const depositValidator = Joi.object({

  accountId: Joi.string()
    .required()
    .messages({
      'any.required': 'Account ID is required'
    }),

  amount: Joi.number()
    .min(1)
    .max(1000000)
    .required()
    .messages({
      'number.min':   'Minimum deposit amount is ₹1',
      'number.max':   'Maximum deposit amount is ₹10,00,000',
      'any.required': 'Amount is required'
    }),

  description: Joi.string()
    .max(200)
    .optional(),

  channel: Joi.string()
    .valid('atm', 'online', 'branch', 'mobile', 'neft', 'rtgs', 'imps', 'upi')
    .default('online'),

  category: Joi.string()
    .valid(
      'food', 'transport', 'shopping', 'utilities',
      'healthcare', 'education', 'entertainment',
      'transfer', 'salary', 'investment', 'other'
    )
    .default('other')
})

// ─── Withdraw Validator ──────────────────────────────────────
const withdrawValidator = Joi.object({

  accountId: Joi.string()
    .required()
    .messages({
      'any.required': 'Account ID is required'
    }),

  amount: Joi.number()
    .min(1)
    .max(1000000)
    .required()
    .messages({
      'number.min':   'Minimum withdrawal amount is ₹1',
      'number.max':   'Maximum withdrawal amount is ₹10,00,000',
      'any.required': 'Amount is required'
    }),

  description: Joi.string()
    .max(200)
    .optional(),

  channel: Joi.string()
    .valid('atm', 'online', 'branch', 'mobile', 'neft', 'rtgs', 'imps', 'upi')
    .default('online')
})

// ─── Transfer Validator ──────────────────────────────────────
const transferValidator = Joi.object({

  fromAccountId: Joi.string()
    .required()
    .messages({
      'any.required': 'Source account ID is required'
    }),

  toAccountNumber: Joi.string()
    .required()
    .messages({
      'any.required': 'Destination account number is required'
    }),

  amount: Joi.number()
    .min(1)
    .max(1000000)
    .required()
    .messages({
      'number.min':   'Minimum transfer amount is ₹1',
      'number.max':   'Maximum transfer amount is ₹10,00,000',
      'any.required': 'Amount is required'
    }),

  description: Joi.string()
    .max(200)
    .optional(),

  channel: Joi.string()
    .valid('neft', 'rtgs', 'imps', 'upi', 'online')
    .default('online')
})

// ─── Loan Validators ─────────────────────────────────────────
const applyLoanValidator = Joi.object({

  accountId: Joi.string()
    .required()
    .messages({
      'any.required': 'Account ID is required'
    }),

  loanType: Joi.string()
    .valid('personal', 'home', 'car', 'education', 'business', 'gold')
    .required()
    .messages({
      'any.only':     'Invalid loan type',
      'any.required': 'Loan type is required'
    }),

  principalAmount: Joi.number()
    .min(1000)
    .max(10000000)
    .required()
    .messages({
      'number.min':   'Minimum loan amount is ₹1,000',
      'number.max':   'Maximum loan amount is ₹1,00,00,000',
      'any.required': 'Loan amount is required'
    }),

  tenureMonths: Joi.number()
    .min(3)
    .max(360)
    .required()
    .messages({
      'number.min':   'Minimum tenure is 3 months',
      'number.max':   'Maximum tenure is 360 months (30 years)',
      'any.required': 'Tenure is required'
    }),

  purpose: Joi.string()
    .min(10)
    .max(500)
    .required()
    .messages({
      'string.min':   'Purpose must be at least 10 characters',
      'any.required': 'Loan purpose is required'
    })
})

const repayLoanValidator = Joi.object({
  accountId: Joi.string()
    .required()
    .messages({
      'any.required': 'Account ID to deduct EMI from is required'
    }),

  amount: Joi.number()
    .min(1)
    .required()
    .messages({
      'any.required': 'Repayment amount is required'
    })
})
// ─── Card Validators ─────────────────────────────────────────
const generateCardValidator = Joi.object({

  accountId: Joi.string()
    .required()
    .messages({
      'any.required': 'Account ID is required'
    }),

  cardType: Joi.string()
    .valid('debit', 'credit', 'prepaid')
    .required()
    .messages({
      'any.only':     'Card type must be debit, credit or prepaid',
      'any.required': 'Card type is required'
    }),

  cardNetwork: Joi.string()
    .valid('visa', 'mastercard', 'rupay')
    .default('rupay'),

  creditLimit: Joi.number()
    .min(1000)
    .max(500000)
    .when('cardType', {
      is:        'credit',
      then:      Joi.required(),
      otherwise: Joi.optional()
    })
    .messages({
      'any.required': 'Credit limit is required for credit cards',
      'number.min':   'Minimum credit limit is ₹1,000',
      'number.max':   'Maximum credit limit is ₹5,00,000'
    })
})

const updateLimitsValidator = Joi.object({
  dailyLimit: Joi.number()
    .min(100)
    .max(100000)
    .optional()
    .messages({
      'number.min': 'Minimum daily limit is ₹100',
      'number.max': 'Maximum daily limit is ₹1,00,000'
    }),

  monthlyLimit: Joi.number()
    .min(1000)
    .max(1000000)
    .optional()
    .messages({
      'number.min': 'Minimum monthly limit is ₹1,000',
      'number.max': 'Maximum monthly limit is ₹10,00,000'
    })
})

const setPinValidator = Joi.object({
  pin: Joi.string()
    .pattern(/^[0-9]{4}$/)
    .required()
    .messages({
      'string.pattern.base': 'PIN must be exactly 4 digits',
      'any.required':        'PIN is required'
    }),

  confirmPin: Joi.string()
    .valid(Joi.ref('pin'))
    .required()
    .messages({
      'any.only':     'PINs do not match',
      'any.required': 'Please confirm your PIN'
    })
})
// ─── Export All Validators ───────────────────────────────────
module.exports = {
  registerValidator,
  loginValidator,
  changePasswordValidator,
  createAccountValidator,
  depositValidator,
  withdrawValidator,
  transferValidator,
  applyLoanValidator,
  repayLoanValidator,
  generateCardValidator,
  updateLimitsValidator,
  setPinValidator
}
