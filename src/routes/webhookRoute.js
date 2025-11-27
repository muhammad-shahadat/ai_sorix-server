const express = require("express");


const { handlePaymentWebhook } = require("../controllers/webhookController");


const router = express.Router();

router.post("/payment", handlePaymentWebhook);

module.exports = router;