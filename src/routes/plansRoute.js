const express = require("express");
const { handleGetActivePlans, handleGetAllPlans, handleGetMyPlan, handleCheckout } = require("../controllers/plansController");
const passport = require("passport");
const authRole = require("../middleware/authRole");




const router = express.Router();






//get all active plans for showing frontend (users)
router.get("/", handleGetActivePlans);

//for showing user's paid plan
router.get("/me",
    passport.authenticate("jwt", {session:false}), 
    handleGetMyPlan
);


router.post("/checkout", 
    passport.authenticate("jwt", {session:false}), handleCheckout
);

//get all active + inactive plans for showing  admin ui/ux
router.get("/admin",
    passport.authenticate("jwt", {session: false}),
    authRole("admin"),
    handleGetAllPlans
)





module.exports = router;
