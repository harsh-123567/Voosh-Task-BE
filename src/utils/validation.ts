import { body, param, query } from 'express-validator';

export const chatValidation = [
  body('session_id')
    .isString()
    .isLength({ min: 1, max: 255 })
    .withMessage('Session ID must be a string between 1 and 255 characters'),
  body('user_message')
    .isString()
    .isLength({ min: 1, max: 4000 })
    .withMessage('User message must be a string between 1 and 4000 characters')
    .trim(),
];

export const sessionValidation = [
  param('session_id')
    .isString()
    .isLength({ min: 1, max: 255 })
    .withMessage('Session ID must be a string between 1 and 255 characters'),
];

export const searchValidation = [
  body('query')
    .isString()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Query must be a string between 1 and 1000 characters')
    .trim(),
  body('limit')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('Limit must be an integer between 1 and 20'),
  body('threshold')
    .optional()
    .isFloat({ min: 0.0, max: 1.0 })
    .withMessage('Threshold must be a float between 0.0 and 1.0'),
];
