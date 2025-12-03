const pool = require("../../config/db");
const createError = require('http-errors');


const { successResponse } = require("./responseController");


const handleGetCurrentUsage = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const currentMonth = new Date().toISOString().slice(0, 7); // "2025-12"

        // এই মাসের usage রেকর্ড
        const usageResult = await pool.query(
            `SELECT 
                COALESCE(messages_used, 0) AS messages_used,
                COALESCE(tokens_used, 0) AS tokens_used,
                COALESCE(images_generated, 0) AS images_generated,
                COALESCE(total_cost_cents, 0) AS total_cost_cents
             FROM usage 
             WHERE user_id = $1 AND period_month = $2`,
            [userId, currentMonth]
        );

        const row = usageResult.rows[0] || {
            messages_used: 0,
            tokens_used: 0,
            images_generated: 0,
            total_cost_cents: 0
        };

        // ফ্রি টিয়ারের লিমিট (পরে ডাটাবেস থেকে নিবি)
        const limits = {
            messages: 100,
            tokens: 1_000_000,
            images: 30
        };

        const used = {
            messages: row.messages_used,
            tokens: Number(row.tokens_used),
            images: row.images_generated
        };

        const remaining = {
            messages: Math.max(0, limits.messages - used.messages),
            tokens: Math.max(0, limits.tokens - used.tokens),
            images: Math.max(0, limits.images - used.images)
        };

        const percentage = {
            messages: Math.min(100, Math.round((used.messages / limits.messages) * 100)),
            tokens: Math.min(100, Math.round((used.tokens / limits.tokens) * 100)),
            images: Math.min(100, Math.round((used.images / limits.images) * 100))
        };

        // পরের মাসের ১ তারিখে রিসেট
        const nextReset = new Date();
        nextReset.setMonth(nextReset.getMonth() + 1);
        nextReset.setDate(1);
        nextReset.setHours(0, 0, 0, 0);

        return successResponse(res, {
            statusCode: 200,
            message: "Current usage fetched successfully",
            payload: {
                current_month: currentMonth,
                limits,
                used,
                remaining,
                percentage,
                total_cost_usd: (row.total_cost_cents / 100).toFixed(2),
                will_reset_at: nextReset.toISOString()
            }
        });

    } catch (error) {
        console.error("GetCurrentUsage Error:", error);
        next(error);
    }
};


const handleGetUsageHistory = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const historyResult = await pool.query(
            `SELECT 
                period_month,
                messages_used,
                tokens_used,
                images_generated,
                total_cost_cents
             FROM usage 
             WHERE user_id = $1 
             ORDER BY period_month DESC 
             LIMIT 6`,
            [userId]
        );

        const history = historyResult.rows.map(row => ({
            month: row.period_month,
            messages_used: row.messages_used || 0,
            tokens_used: Number(row.tokens_used) || 0,
            images_generated: row.images_generated || 0,
            total_cost_usd: row.total_cost_cents ? (row.total_cost_cents / 100).toFixed(2) : "0.00"
        }));

        return successResponse(res, {
            statusCode: 200,
            message: "Usage history fetched successfully",
            payload: history
        });

    } catch (error) {
        console.error("GetUsageHistory Error:", error);
        next(error);
    }
};

module.exports = {
    handleGetCurrentUsage,
    handleGetUsageHistory,
};