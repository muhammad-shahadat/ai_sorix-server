const express = require("express");


const passport = require("../passport");
const authRole = require("../middleware/authRole");
const { handleCreateUser, handleActivateUser, handleLoginUser, handleLogoutUser, handleRefreshToken, handleUserProfile, handleAdminDashboard } = require("../controllers/authController");




const router = express.Router();



//user auth
router.post("/register",
    handleCreateUser
)
router.post("/verify", handleActivateUser)
router.post("/login", handleLoginUser)
router.post("/logout", handleLogoutUser)
router.post("/refresh-token", handleRefreshToken)


//user profile
router.get("/profile", passport.authenticate("jwt", {session: false}),  authRole("admin", "user"), handleUserProfile)


//admin dashboard
router.get(
    "/dashboard",
    passport.authenticate("jwt", {session: false}),
    authRole("admin"),
    handleAdminDashboard,
);


module.exports = router;
