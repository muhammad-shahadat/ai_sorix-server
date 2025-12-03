const express = require("express");


const passport = require("../passport");
const authRole = require("../middleware/authRole");
const { handleGetCurrentUsage, handleGetUsageHistory } = require("../controllers/usersController");




const authenticate = passport.authenticate("jwt", { session: false });


const router = express.Router();


// GET /api/user/usage → এই মাসের কোটা + ব্যবহার
router.get("/usage",
    authenticate,
    authRole("admin", "user"), 
    handleGetCurrentUsage
);


// GET /api/user/usage/history → গত ৬ মাসের হিসাব
router.get("/usage/history",
    authenticate,
    authRole("admin", "user"), 
    handleGetUsageHistory,
);





module.exports = router;