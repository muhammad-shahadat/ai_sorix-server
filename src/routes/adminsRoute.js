const express = require("express");


const passport = require("../passport");
const authRole = require("../middleware/authRole");
const { handleAdminResetUserUsage, handleAdminGetAllUsersUsage } = require("../controllers/adminsController");





const authenticate = passport.authenticate("jwt", { session: false });


const router = express.Router();




// POST /api/admin/usage/reset → একজন ইউজারের কোটা রিসেট
router.post("/usage/reset",
    authenticate,
    authRole("admin"),
    handleAdminResetUserUsage
);


// GET /api/admin/users/usage → সব ইউজারের এই মাসের ব্যবহার (পেজিনেশন + সার্চ)
router.get("/users/usage", 
    authenticate,
    authRole("admin"),
    handleAdminGetAllUsersUsage
);



module.exports = router;