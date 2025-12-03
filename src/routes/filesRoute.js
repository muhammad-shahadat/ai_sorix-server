const express = require("express");


const passport = require("../passport");
const authRole = require("../middleware/authRole");
const { handleUploadSignature, handleSaveFileToDB } = require("../controllers/filesController");



const authenticate = passport.authenticate("jwt", { session: false });





const router = express.Router();


// GET /api/files/upload-signature
router.post("/upload-signature",
    authenticate,
    authRole("admin", "user"),
    handleUploadSignature

);

router.post("/uploaded", 
    authenticate,
    authRole("admin", "user"), 
    handleSaveFileToDB
);














module.exports = router;