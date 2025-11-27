const {body} = require("express-validator");
const createError = require("http-errors");

const registerValidationRules = [

    body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 3, max: 32 })
    .withMessage("Name should be 3-32 characters")
    .escape(),  


    body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid Email"),
    
    body("password")
    .trim()
    .notEmpty()
    .withMessage("Password is required")
    .isLength({min: 6})
    .withMessage("Password should be at least 6 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/)
    .withMessage("password should contains one uppercase, one lowercae letter, one number and one specail case letter"),

];

const loginValidationRules = [

    body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid Email"),
    
    body("password")
    .trim()
    .notEmpty()
    .withMessage("Password is required")
    .isLength({min: 6})
    .withMessage("Password should be at least 6 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/)
    .withMessage("password should contains one uppercase, one lowercae letter, one number and one specail case letter"),

];

const updatePasswordValidationRules = [

    body("newPassword")
    .trim()
    .notEmpty()
    .withMessage("new password is required")
    .isLength({min: 6})
    .withMessage("new password should be at least 6 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&-]+$/)
    .withMessage("new password should contains one uppercase, one lowercae letter, one number and one special case letter"),

    body("confirmedPassword").custom((value, meta) => {
        const {req} = meta; // Object Destructuring
        if(value !== req.body.newPassword){
            throw createError(422, "password did not match");
        }
        return true;

    })

];

const forgotPasswordValidationRules = [

    body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid Email"),

];

const resetPasswordValidationRules = [

    body("token")
    .trim()
    .notEmpty()
    .withMessage("token is required"),

    body("newPassword")
    .trim()
    .notEmpty()
    .withMessage("new password is required")
    .isLength({min: 6})
    .withMessage("new password should be at least 6 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&-]+$/)
    .withMessage("new password should contains one uppercase, one lowercae letter, one number and one special case letter"),
    
    body("confirmedPassword").custom((value, meta) => {
        const {req} = meta; // Object Destructuring
        if(value !== req.body.newPassword){
            throw createError(422, "password did not match");
        }
        return true;

    })

]

module.exports = {
    registerValidationRules,
    loginValidationRules,
    updatePasswordValidationRules,
    forgotPasswordValidationRules,
    resetPasswordValidationRules,
}