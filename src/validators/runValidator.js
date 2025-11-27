const createError = require('http-errors');
const { validationResult } = require("express-validator");

//const { logger } = require('../../config/logger');
//const { deleteUploadedFiles } = require('../helper/deleteUploadedFiles');

const runValidator = async (req, res, next) => {

    try {
        
        const errors = validationResult(req);

        if(!errors.isEmpty()){
            
            return next(createError(422, errors.array()[0].msg));

        }

        next();
        
    } catch (error) {
        next(error);
        
    }


}

module.exports = {
    runValidator,
}