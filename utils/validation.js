// utils/validation.js
const { body } = require('express-validator');

exports.registerValidation = [
  body('name').notEmpty(),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
];

exports.loginValidation = [
  body('email').isEmail(),
  body('password').notEmpty(),
];
