const { body, validationResult } = require("express-validator");

const registerValidation = [
  body("username")
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage("Username must be between 3 and 50 characters."),

  body("email")
    .trim()
    .isEmail()
    .withMessage("Enter a valid email address.")
    .normalizeEmail(),

  body("password")
    .isLength({ min: 8, max: 72 })
    .withMessage("Password must be between 8 and 72 characters."),
];

const loginValidation = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("Enter a valid email address.")
    .normalizeEmail(),

  body("password")
    .notEmpty()
    .withMessage("Password is required."),
];

const reviewValidation = [
  body("landlord_name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Landlord name must be between 2 and 100 characters."),

  body("property_address")
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage("Property address must be between 5 and 200 characters."),

  body("rating")
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating must be between 1 and 5."),

  body("review_text")
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage("Review must be between 10 and 1000 characters."),
];

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).send(errors.array()[0].msg);
  }

  next();
}

module.exports = {
  registerValidation,
  loginValidation,
  reviewValidation,
  handleValidationErrors,
};