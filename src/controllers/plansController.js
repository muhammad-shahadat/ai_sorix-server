require("dotenv").config();
const createError = require('http-errors');
const SSLCommerzPayment = require("sslcommerz-lts");

const pool = require("../../config/db");
const { successResponse } = require("./responseController");

const handleGetActivePlans = async (req, res, next) => {
    try {
        // শুধু active প্ল্যানগুলো নিব (যেগুলো ফ্রন্টএন্ডে দেখানো যাবে)
        const result = await pool.query(
            `SELECT 
                id,
                slug,
                title,
                description,
                price_cents,
                billing_interval,
                trial_days,
                messages_per_month,
                images_per_month,
                max_file_size_mb,
                max_chat_history_days,
                model_access,
                features,
                display_order,
                created_at
             FROM plans 
             WHERE is_active = true 
             ORDER BY display_order ASC, price_cents ASC`
        );

        // যদি কোনো প্ল্যান না থাকে (অসম্ভব, কিন্তু সেফটির জন্য)
        if (result.rows.length === 0) {
            return next(createError(404, "No active plans found."));
        }

        // ফ্রন্টএন্ডে সুন্দর করে দেখানোর জন্য প্রাইস ফরম্যাট করা
        const plans = result.rows.map(plan => ({
            ...plan,
            price_bdt: plan.price_cents / 100, // 49900 → 499.00
            is_unlimited_messages: plan.messages_per_month === -1,
            formatted_price: `৳${(plan.price_cents / 100).toLocaleString('en-BD')}`,
            yearly_savings: plan.billing_interval === 'yearly' 
                ? Math.round(((plan.price_cents / 100) * 12) - (plan.price_cents / 100)) 
                : null
        }));

        // সাকসেস রেসপন্স — তোর স্টাইলে
        return successResponse(res, {
            statusCode: 200,
            message: "Pricing plans fetched successfully",
            payload: {
                plans
            }
        });

    } catch (error) {
        // ডাটাবেস বা অন্য কোনো এরর হলে
        next(error);
    }
};

const handleGetAllPlans = async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT 
                id,
                slug,
                title,
                description,
                price_cents,
                billing_interval,
                trial_days,
                messages_per_month,
                images_per_month,
                max_file_size_mb,
                max_chat_history_days,
                model_access,
                features,
                is_active,
                display_order,
                created_at,
                updated_at
            FROM plans 
            ORDER BY display_order ASC, created_at DESC
        `);

        // যদি কোনো প্ল্যান না থাকে (খুবই রেয়ার)
        if (result.rows.length === 0) {
            return next(createError(404, "No plans found in database."));
        }

        // ফ্রন্টএন্ডে সুবিধার জন্য কিছু এক্সট্রা ফিল্ড যোগ করা
        const plans = result.rows.map(plan => ({
            ...plan,
            price_bdt: (plan.price_cents / 100).toFixed(2),
            formatted_price: `৳${(plan.price_cents / 100).toLocaleString('en-BD')}`,
            is_unlimited_messages: plan.messages_per_month === -1,
            status: plan.is_active ? "Live" : "Draft",           // অ্যাডমিন UI-এ দেখানোর জন্য
            status_badge: plan.is_active ? "success" : "warning" // টেবিলে ব্যাজ দেখানোর জন্য
        }));

        return successResponse(res, {
            statusCode: 200,
            message: "All plans fetched successfully (including inactive)",
            payload: {
                total: plans.length,
                plans
            }
        });

    } catch (error) {
        next(error);
    }
};

const handleGetMyPlan = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const result = await pool.query(`
            SELECT 
                s.id AS subscription_id,
                s.status,
                s.current_period_end,
                s.provider,
                s.auto_renew,
                s.payment_method,
                
                p.id AS plan_id,
                p.slug,
                p.title,
                p.description,
                p.price_cents,
                p.billing_interval,
                p.images_per_month,
                p.messages_per_month,
                p.model_access,
                p.features
            FROM subscriptions s
            JOIN plans p ON s.plan_id = p.id
            WHERE s.user_id = $1 
              AND s.status IN ('active', 'trialing')
            ORDER BY s.created_at DESC
            LIMIT 1
        `, [userId]);

        if (result.rows.length === 0) {
            return successResponse(res, {
                statusCode: 200,
                message: "No active subscription found",
                payload: { plan: null }
            });
        }

        const sub = result.rows[0];

        const plan = {
            subscription_id: sub.subscription_id,
            plan_id: sub.plan_id,
            slug: sub.slug,
            title: sub.title,
            description: sub.description,
            price_bdt: sub.price_cents / 100,
            formatted_price: `৳${(sub.price_cents / 100).toLocaleString('en-BD')}`,
            billing_interval: sub.billing_interval,
            status: sub.status,
            provider: sub.provider,
            payment_method: sub.payment_method,
            auto_renew: sub.auto_renew,
            renews_or_expires_at: sub.current_period_end,
            images_per_month: sub.images_per_month,
            is_unlimited_messages: sub.messages_per_month === -1,
            features: sub.features,
            model_access: sub.model_access
        };

        return successResponse(res, {
            statusCode: 200,
            message: "Current plan fetched successfully",
            payload: { plan }
        });

    } catch (error) {
        next(error);
    }
};

const handleCheckout = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { plan_slug } = req.body;

        if (!plan_slug) {
            return next(createError(400, "plan_slug is required"));
        }

        // প্ল্যান খুঁজে বের করা
        const planResult = await pool.query(
            `SELECT * FROM plans WHERE slug = $1 AND is_active = true`,
            [plan_slug]
        );

        if (planResult.rows.length === 0) {
            return next(createError(404, "Plan not found or not active"));
        }

        const plan = planResult.rows[0];

        // ইউজারের ডাটা
        const userResult = await pool.query(
            `SELECT name, email, phone FROM users WHERE id = $1`,
            [userId]
        );
        const user = userResult.rows[0];

        // SSLCommerz প্যারামিটার (তোর স্টাইলে)
        const post_data = {
            
            total_amount: (plan.price_cents / 100).toFixed(2),
            currency: "BDT",
            tran_id: `SORIX_${Date.now()}_${userId}`,
            success_url: `${process.env.CLIENT_URL}/payment/success`,
            fail_url: `${process.env.CLIENT_URL}/payment/fail`,
            cancel_url: `${process.env.CLIENT_URL}/plans`,
            ipn_url: `${process.env.BASE_URL}/api/webhook/payment`,
            cus_name: user.name,
            cus_email: user.email,
            cus_phone: user.phone || "",
            cus_add1: "Dhaka, Bangladesh",
            cus_city: "Dhaka",
            cus_country: "Bangladesh",
            product_name: plan.title,
            product_category: "AI Subscription",
            product_profile: "general",
            value_a: userId,           // ইউজার আইডি
            value_b: plan.id,          // প্ল্যান আইডি
            value_c: plan.slug         // প্ল্যান স্লাগ
        };
        
        console.log(post_data)


        // SSLCommerz সেশন তৈরি (sandbox / live)
        const sslcz = new SSLCommerzPayment(
            process.env.SSLCOMMERZ_STORE_ID,
            process.env.SSLCOMMERZ_STORE_PASS,
            process.env.NODE_ENV === 'production' ? false : true  // true = sandbox
        );

        const response = await sslcz.init(post_data);
        
        console.log(response);

        if (!response?.GatewayPageURL) {
            return next(createError(500, "Failed to create payment session"));
        }

        return successResponse(res, {
            statusCode: 200,
            message: "Checkout session created successfully",
            payload: {
                payment_url: response.GatewayPageURL,
                transaction_id: post_data.tran_id,
                plan_title: plan.title,
                amount_bdt: (plan.price_cents / 100).toFixed(2)
            }
        });

    } catch (error) {
        console.error("Checkout Error:", error);
        next(error);
    }
};


module.exports = {
    handleGetActivePlans,
    handleGetAllPlans,
    handleGetMyPlan,
    handleCheckout,
}