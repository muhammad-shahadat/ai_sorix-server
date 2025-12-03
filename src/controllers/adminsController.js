const pool = require("../../config/db");
const createError = require('http-errors');


const { successResponse } = require("./responseController");



const handleAdminResetUserUsage = async (req, res, next) => {
    try {
        const adminId = req.user.id;
        const { user_id, period_month } = req.body;

        if (!user_id) {
            return next(createError(400, "user_id is required"));
        }

        const targetMonth = period_month || new Date().toISOString().slice(0, 7);

        const result = await pool.query(
            `UPDATE usage 
             SET 
                messages_used = 0,
                tokens_used = 0,
                images_generated = 0,
                total_cost_cents = 0,
                updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 AND period_month = $2
             RETURNING user_id, period_month`,
            [user_id, targetMonth]
        );

        // যদি রেকর্ড না থাকে, তাহলে নতুন করে ইনসার্ট করা (যাতে পরে ট্র্যাক থাকে)
        if (result.rowCount === 0) {
            await pool.query(
                `INSERT INTO usage (user_id, period_month, messages_used, tokens_used, images_generated, total_cost_cents)
                 VALUES ($1, $2, 0, 0, 0, 0)
                 ON CONFLICT (user_id, period_month) DO NOTHING`,
                [user_id, targetMonth]
            );
        }

        // অ্যাডমিন লগ (যদি টেবিল থাকে)
        try {
            await pool.query(
                `INSERT INTO admin_logs (admin_id, action, target_user_id, details)
                 VALUES ($1, $2, $3, $4)`,
                [adminId, "usage_reset", user_id, `Reset quota for ${targetMonth}`]
            );
        } catch (logError) {
            console.warn("Admin log failed (non-critical):", logError.message);
        }

        return successResponse(res, {
            statusCode: 200,
            message: `ইউজার ${user_id}-এর ${targetMonth} মাসের কোটা রিসেট করা হয়েছে`,
            payload: {
                user_id,
                period_month: targetMonth,
                reset_at: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error("AdminResetUserUsage Error:", error);
        next(error);
    }
};


const handleAdminGetAllUsersUsage = async (req, res, next) => {
    try {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        const search = (req.query.search || "").trim();

        let query = `
            SELECT 
                u.id, u.name, u.email, u.created_at,
                COALESCE(us.messages_used, 0) AS messages_used,
                COALESCE(us.tokens_used, 0) AS tokens_used,
                COALESCE(us.images_generated, 0) AS images_generated,
                COALESCE(us.total_cost_cents, 0) AS total_cost_cents
            FROM users u
            LEFT JOIN usage us ON u.id = us.user_id AND us.period_month = $1
            WHERE u.role != 'admin'
        `;

        const params = [currentMonth];
        let paramIndex = 2;

        if (search) {
            query += ` AND (u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        query += ` ORDER BY us.tokens_used DESC NULLS LAST, u.created_at DESC 
                   LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        const totalResult = await pool.query(
            `SELECT COUNT(*) FROM users WHERE role != 'admin'`
        );
        const total = parseInt(totalResult.rows[0].count);

        const usersUsage = result.rows.map(row => ({
            user_id: row.id,
            name: row.name || "নামহীন",
            email: row.email,
            joined_at: row.created_at,
            messages_used: row.messages_used,
            tokens_used: Number(row.tokens_used),
            images_generated: row.images_generated,
            total_cost_usd: (row.total_cost_cents / 100).toFixed(2)
        }));

        return successResponse(res, {
            statusCode: 200,
            message: "সকল ইউজারের ব্যবহারের তথ্য সফলভাবে পাওয়া গেছে",
            payload: {
                month: currentMonth,
                page,
                limit,
                total_users: total,
                total_pages: Math.ceil(total / limit),
                users: usersUsage
            }
        });

    } catch (error) {
        console.error("AdminGetAllUsersUsage Error:", error);
        next(error);
    }
};

module.exports = {
    handleAdminResetUserUsage,
    handleAdminGetAllUsersUsage
};


