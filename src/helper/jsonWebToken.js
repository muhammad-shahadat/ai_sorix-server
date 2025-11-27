const jwt = require("jsonwebtoken");

const createJsonWebToken = async (jwtPayload, privateKey, expiresIn) =>{

    return new Promise((resolve, reject) => {
        jwt.sign(jwtPayload, privateKey, expiresIn, (error, token) =>{
            if(error){
                return reject(error);
            }
            resolve(token);
        });
        
    })

}

module.exports = {
    createJsonWebToken,
}