const createError = require('http-errors');
const crypto = require("crypto"); //for stripe
const { pool } = require("../../config/db");
const { successResponse } = require('./responseController');


const handlePaymentWebhook = async (req, res, next) => {
    try {
        const data = req.body;

        // ১. বেসিক চেক
        if (!data?.tran_id || !data?.status || !data?.val_id) {
            return next(createError(400, "Missing required fields in webhook"));
        }

        // ২. SSLCommerz এর সাথে ভেরিফাই
        const verifyUrl = `https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php?val_id=${data.val_id}&store_id=${process.env.SSLCOMMERZ_STORE_ID}&store_passwd=${process.env.SSLCOMMERZ_STORE_PASS}&format=json`;

        const verifyRes = await fetch(verifyUrl);
        const verified = await verifyRes.json();

        if (!verified || !["VALID", "VALIDATED"].includes(verified.status)) {
            console.log("Verification failed:", verified);
            return next(createError(400, "Payment verification failed"));
        }

        if (!["VALID", "VALIDATED"].includes(data.status)) {
            return successResponse(res, {
                statusCode: 200,
                message: "Payment not successful, ignored",
                payload: { status: data.status }
            });
        }

        // ৩. ইউজার + প্ল্যান আইডি বের করা
        const tranParts = data.tran_id.split("_");
        if (tranParts.length < 3 || !tranParts[0].startsWith("SORIX")) {
            return next(createError(400, "Invalid transaction format"));
        }

        const userId = parseInt(tranParts[tranParts.length - 1]);
        const planId = parseInt(data.value_b);

        if (!userId || !planId) {
            return next(createError(400, "User or plan info missing"));
        }

        // ৪. ডুপ্লিকেট চেক (subscriptions টেবিলে)
        const existing = await pool.query(
            `SELECT 1 FROM subscriptions WHERE transaction_id = $1 OR external_subscription_id = $2 LIMIT 1`,
            [data.tran_id, data.val_id]
        );

        if (existing.rows.length > 0) {
            return successResponse(res, {
                statusCode: 200,
                message: "Duplicate payment ignored",
                payload: { transaction_id: data.tran_id }
            });
        }

        // ৫. প্ল্যান চেক
        const planResult = await pool.query(
            `SELECT price_cents, billing_interval FROM plans WHERE id = $1 AND is_active = true`,
            [planId]
        );

        if (planResult.rows.length === 0) {
            return next(createError(404, "Plan not found or inactive"));
        }

        const plan = planResult.rows[0];

        // ৬. পিরিয়ড ক্যালকুলেট
        const now = new Date();
        const periodEnd = new Date(now);
        if (plan.billing_interval === "yearly") {
            periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        } else {
            periodEnd.setMonth(periodEnd.getMonth() + 1);
        }

        // ৭. সাবস্ক্রিপশন তৈরি (RETURNING id দিয়ে subscription_id নিব)
        const subResult = await pool.query(`
            INSERT INTO subscriptions (
                user_id, plan_id, provider, status,
                payment_method, transaction_id, amount_paid_cents, currency,
                current_period_start, current_period_end,
                external_subscription_id, auto_renew
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id
        `, [
            userId,
            planId,
            "sslcommerz",
            "active",
            verified.card_type || verified.bank_tran_id ? "card/mobile_banking" : "bkash/nagad",
            data.tran_id,
            Math.round(parseFloat(verified.amount) * 100),
            verified.currency || "BDT",
            now,
            periodEnd,
            data.val_id,
            true
        ]);

        const subscriptionId = subResult.rows[0].id;

        // নতুন: payments টেবিলে এন্ট্রি (অডিট + রিফান্ড + ড্যাশবোর্ডের জন্য)
        await pool.query(`
            INSERT INTO payments (
                user_id, subscription_id,
                amount_cents, currency, status,
                provider, tran_id, val_id, bank_tran_id,
                payment_method, card_type,
                raw_response
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
            userId,
            subscriptionId,
            Math.round(parseFloat(verified.amount) * 100),
            verified.currency || "BDT",
            "success",
            "sslcommerz",
            data.tran_id,
            data.val_id,
            verified.bank_tran_id || null,
            // payment_method: bKash/Nagad/Card detect
            verified.card_type?.toLowerCase().includes("bkash") ? "bkash" :
            verified.card_type?.toLowerCase().includes("nagad") ? "nagad" :
            verified.card_type?.toLowerCase().includes("rocket") ? "rocket" : "card",
            verified.card_type || null,
            data  // পুরো ওয়েবহুক JSON সেভ → পরে ডিবাগে কাজে লাগবে
        ]);

        console.log(`Subscription & Payment recorded → User:${userId} Plan:${planId} via ${data.tran_id}`);

        return successResponse(res, {
            statusCode: 200,
            message: "Payment successful & subscription activated",
            payload: {
                user_id: userId,
                plan_id: planId,
                subscription_id: subscriptionId,
                transaction_id: data.tran_id,
                amount_bdt: verified.amount,
                activated_at: now.toISOString()
            }
        });

    } catch (error) {
        console.error("Webhook Error:", error.message || error);
        return next(createError(500, "Webhook processing failed"));
    }
};



module.exports = {
    handlePaymentWebhook,
}