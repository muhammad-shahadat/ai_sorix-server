const createError = require('http-errors');
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const pool = require("../../config/db");
const { createJsonWebToken } = require("../helper/jsonWebToken");
const { emailWithNodemailer } = require("../helper/nodemailer");
const { successResponse } = require("./responseController");
const { nodeEnv, jwtActivationKey, jwtAccessKey, jwtRefreshKey } = require("../secret");
const { registrationMail } = require('../helper/prepareMail');

const saltRounds = 10;
const isProduction = nodeEnv === "production";




const handleCreateUser = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        // 1. ইমেইল আছে কিনা চেক করা (PostgreSQL style)
        const existingUser = await pool.query(
            `SELECT id FROM users WHERE email = $1 AND _deleted = false`,
            [email]
        );

        if (existingUser.rows.length > 0) {
            return next(createError(409, "This email is already registered!"));
        }

        // 2. পাসওয়ার্ড হ্যাশ করা
        const hashPassword = await bcrypt.hash(password, saltRounds);

        // 3. JWT টোকেন তৈরি
        const jwtPayload = {
            name,
            email,
            hashPassword,
        };

        const token = await createJsonWebToken(
            jwtPayload,
            jwtActivationKey,
            { expiresIn: "30m" }
        );

        // 4. ইমেইল পাঠানো
        const mailData = registrationMail(email, name, token);
        await emailWithNodemailer(mailData);

        // 5. সাকসেস রেসপন্স
        return successResponse(res, {
            statusCode: 200,
            message: "We've sent a verification link to your email. Please check your inbox and click the link to complete registration.",
        });

    } catch (error) {
        next(error);
    }
};

const handleActivateUser = async (req, res, next) => {
    try {
        const { token } = req.body;

        if (!token) {
            return next(createError(404, "Token not found"));
        }

        // JWT ভেরিফাই করা
        const decoded = jwt.verify(token, jwtActivationKey);

        if (!decoded) {
            return next(createError(401, "Unable to verify user"));
        }

        const { name, email, hashPassword } = decoded;

        // চেক করা — ইউজার আগে থেকে আছে কিনা (সফট ডিলিট সহ)
        const existingUser = await pool.query(
            `SELECT id FROM users WHERE email = $1 AND _deleted = false`,
            [email]
        );

        if (existingUser.rows.length > 0) {
            return next(createError(409, "User account is already activated. Please sign in."));
        }

        // নতুন ইউজার ইনসার্ট করা + RETURNING দিয়ে ডাটা নেওয়া (PostgreSQL স্টাইল)
        const result = await pool.query(
            `INSERT INTO users (
                name, 
                email, 
                password_hash, 
                is_email_verified,
                created_at,
                updated_at
            ) VALUES ($1, $2, $3, $4, NOW(), NOW())
            RETURNING id, name, email, role, created_at`,
            [name, email, hashPassword, true]
        );

        const newUser = result.rows[0];

        // সাকসেস রেসপন্স
        return successResponse(res, {
            statusCode: 201,
            message: "User registered and activated successfully!",
            payload: {
                user: {
                    id: newUser.id,
                    name: newUser.name,
                    email: newUser.email,
                    role: newUser.role,
                    is_email_verified: true,
                    created_at: newUser.created_at,
                }
            }
        });

    } catch (error) {
        // JWT এরর হ্যান্ডলিং
        if (error.name === "TokenExpiredError") {
            return next(createError(401, "Activation link has expired. Please register again."));
        }
        if (error.name === "JsonWebTokenError") {
            return next(createError(401, "Invalid activation link!"));
        }

        // অন্য সব এরর
        next(error);
    }
};

const handleLoginUser = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // 1. ইউজার খুঁজে বের করা (সফট ডিলিট + ব্যান চেক সহ)
        const result = await pool.query(
            `SELECT 
                id, name, email, password_hash, role, 
                is_active, is_email_verified, _deleted 
             FROM users 
             WHERE email = $1 AND _deleted = false`,
            [email]
        );

        if (result.rows.length === 0) {
            return next(createError(401, "Invalid email or password!"));
        }

        const user = result.rows[0];

        // 2. ইমেইল ভেরিফাইড কিনা চেক
        if (!user.is_email_verified) {
            return next(createError(403, "Please verify your email first!"));
        }

        // 3. ব্যান চেক (is_active = false মানে ব্যান)
        if (!user.is_active) {
            return next(createError(403, "Your account is banned! Please contact support."));
        }

        // 4. পাসওয়ার্ড ম্যাচ করা
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return next(createError(401, "Invalid email or password!"));
        }

        // 5. JWT পেলোড তৈরি
        const jwtPayload = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
        };

        // 6. Access Token (10 মিনিট)
        const accessToken = await createJsonWebToken(jwtPayload, jwtAccessKey, {
            expiresIn: "10m",
        });

        // 7. Refresh Token (7 দিন)
        const refreshToken = await createJsonWebToken(jwtPayload, jwtRefreshKey, {
            expiresIn: "7d",
        });

        // 8. কুকি সেট করা
        const isProduction = process.env.NODE_ENV === "production";

        res.cookie("accessToken", accessToken, {
            maxAge: 10 * 60 * 1000, // 10 মিনিট
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
        });

        res.cookie("refreshToken", refreshToken, {
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 দিন
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
        });

        // 9. সাকসেস রেসপন্স
        return successResponse(res, {
            statusCode: 200,
            message: "Login successful!",
            payload: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    is_email_verified: user.is_email_verified,
                    is_active: user.is_active,
                },
            },
        });

    } catch (error) {
        next(error);
    }
};

const handleRefreshToken = async (req, res, next) => {
    try {
        const oldRefreshToken = req.cookies.refreshToken;

        // 1. রিফ্রেশ টোকেন আছে কিনা চেক
        if (!oldRefreshToken) {
            return next(createError(401, "No refresh token found. Please log in again."));
        }

        // 2. টোকেন ভেরিফাই করা
        let decoded;
        try {
            decoded = jwt.verify(oldRefreshToken, jwtRefreshKey);
        } catch (err) {
            if (err.name === "TokenExpiredError") {
                return next(createError(401, "Refresh token has expired. Please log in again."));
            }
            if (err.name === "JsonWebTokenError") {
                return next(createError(401, "Invalid refresh token!"));
            }
            throw err;
        }

        const { id, email } = decoded;

        // 3. ডাটাবেসে ইউজার আছে কিনা + ব্যান/ডিলিট চেক (খুবই জরুরি!)
        const result = await pool.query(
            `SELECT id, name, email, role, is_active, _deleted 
             FROM users 
             WHERE id = $1 AND email = $2 AND _deleted = false`,
            [id, email]
        );

        if (result.rows.length === 0) {
            return next(createError(401, "User not found or account has been deleted."));
        }

        const user = result.rows[0];

        // 4. ব্যান চেক
        if (!user.is_active) {
            return next(createError(403, "Your account is banned! Please contact support."));
        }

        // 5. নতুন JWT পেলোড তৈরি
        const jwtPayload = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
        };

        // 6. নতুন Access Token (10 মিনিট)
        const newAccessToken = await createJsonWebToken(jwtPayload, jwtAccessKey, {
            expiresIn: "10m",
        });

        // 7. নতুন Refresh Token (7 দিন) — রোটেট করা (সিকিউরিটির জন্য)
        const newRefreshToken = await createJsonWebToken(jwtPayload, jwtRefreshKey, {
            expiresIn: "7d",
        });

        // 8. কুকি আপডেট করা
        const isProduction = process.env.NODE_ENV === "production";

        res.cookie("accessToken", newAccessToken, {
            maxAge: 10 * 60 * 1000, // 10 মিনিট
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
        });

        res.cookie("refreshToken", newRefreshToken, {
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 দিন
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
        });

        // 9. সাকসেস রেসপন্স
        return successResponse(res, {
            statusCode: 200,
            message: "Tokens refreshed successfully",
            payload: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                },
            },
        });

    } catch (error) {
        // JWT এরর হ্যান্ডলিং (উপরে ইতিমধ্যে হ্যান্ডল করা হয়েছে)
        next(error);
    }
};

const handleLogoutUser = async (req, res, next) => {
    try {
        const isProduction = process.env.NODE_ENV === "production";

        // 1. রিফ্রেশ টোকেন নেওয়া (যদি থাকে)
        const refreshToken = req.cookies.refreshToken;

        if (refreshToken) {
            try {
                // টোকেন ভেরিফাই করে ইউজার আইডি বের করা (যাতে ভুল টোকেন দিলেও কোনো সমস্যা না হয়)
                const decoded = jwt.verify(refreshToken, jwtRefreshKey);
                const userId = decoded.id;

                // ভবিষ্যতে যদি refresh_tokens টেবিল থাকে — তাহলে এভাবে ডিলিট করবি:
                // await pool.query(`DELETE FROM refresh_tokens WHERE user_id = $1 AND token = $2`, [userId, refreshToken]);

                // অথবা শুধু user_id দিয়ে সব টোকেন ডিলিট করা (আরও সিকিউর):
                // await pool.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [userId]);

                // এখন যেহেতু টেবিল নাই — তাই শুধু কুকি ক্লিয়ার করব
                console.log(`User ${userId} logged out. Refresh token invalidated.`);
            } catch (err) {
                // যদি টোকেন ইনভ্যালিড বা এক্সপায়ার্ড হয় — তবুও কুকি ক্লিয়ার করব
                console.log("Invalid or expired refresh token during logout.");
            }
        }

        // 2. কুকি ক্লিয়ার করা (সব ডিভাইস থেকে লগআউট)
        res.clearCookie("accessToken", {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
            path: "/", // খুবই জরুরি — না দিলে কুকি ক্লিয়ার হবে না!
        });

        res.clearCookie("refreshToken", {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
            path: "/",
        });

        // অপশনাল: যদি frontend-এ localStorage-এ টোকেন রাখিস — তাহলে এটা পাঠাবি
        // res.clearCookie("user", { path: "/" });

        // 3. সাকসেস রেসপন্স
        return successResponse(res, {
            statusCode: 200,
            message: "Logout successful. See you soon!",
            payload: {}
        });

    } catch (error) {
        next(error);
    }
};

const handleUserProfile = async (req, res, next) => {
    try {
        // req.user তোর auth middleware থেকে আসছে (jwt.verify করে দিয়েছিস)
        const userId = req.user.id;

        // ডাটাবেস থেকে সর্বশেষ ডাটা নিয়ে আসা (খুবই জরুরি!)
        const result = await pool.query(
            `SELECT 
                id, 
                name, 
                email, 
                avatar_url, 
                phone, 
                country, 
                role, 
                is_email_verified, 
                is_active, 
                preferences,
                created_at,
                last_login_at
             FROM users 
             WHERE id = $1 AND _deleted = false`,
            [userId]
        );

        if (result.rows.length === 0) {
            return next(createError(404, "User not found or account has been deleted."));
        }

        const user = result.rows[0];

        // ব্যান চেক (যদি কেউ ব্যান হয়ে যায় তবুও টোকেন থাকলে এরর দেখাবে)
        if (!user.is_active) {
            return next(createError(403, "Your account is banned. Please contact support."));
        }

        // সাকসেস রেসপন্স — শুধু দরকারি ডাটা পাঠানো হচ্ছে
        return successResponse(res, {
            statusCode: 200,
            message: "User profile fetched successfully",
            payload: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    avatar_url: user.avatar_url || null,
                    phone: user.phone || null,
                    country: user.country || null,
                    role: user.role,
                    is_email_verified: user.is_email_verified,
                    preferences: user.preferences || {},
                    created_at: user.created_at,
                    last_login_at: user.last_login_at || null,
                }
            }
        });

    } catch (error) {
        next(error);
    }
};

const handleAdminDashboard = async (req, res, next) => {
    try {
        const adminId = req.user.id; // auth middleware থেকে আসছে

        // ১. প্রথমে চেক করি — ইউজার এখনো অ্যাকটিভ আছে কিনা + রোল সত্যিই admin কিনা
        const result = await pool.query(
            `SELECT 
                id, name, email, role, is_active, _deleted, last_login_at, created_at
             FROM users 
             WHERE id = $1 AND role = 'admin' AND is_active = true AND _deleted = false`,
            [adminId]
        );

        if (result.rows.length === 0) {
            return next(createError(403, "Access denied. Admin privileges required or account is inactive."));
        }

        const admin = result.rows[0];

        // ২. অ্যাডমিন ড্যাশবোর্ডের জন্য কিছু রিয়েল-টাইম স্ট্যাটস (অপশনাল কিন্তু দারুণ লাগে)
        const stats = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM users WHERE _deleted = false) AS total_users,
                (SELECT COUNT(*) FROM users WHERE _deleted = false AND is_active = false) AS banned_users,
                (SELECT COUNT(*) FROM users WHERE is_email_verified = false AND _deleted = false) AS unverified_users,
                (SELECT COUNT(*) FROM chats WHERE _deleted = false) AS total_chats,
                (SELECT COUNT(*) FROM messages) AS total_messages,
                (SELECT COUNT(*) FROM subscriptions WHERE status = 'active') AS active_subscriptions
        `);

        const dashboardStats = stats.rows[0];

        // ৩. ফাইনাল রেসপন্স
        return successResponse(res, {
            statusCode: 200,
            message: "Welcome to Admin Dashboard",
            payload: {
                admin: {
                    id: admin.id,
                    name: admin.name,
                    email: admin.email,
                    role: admin.role,
                    last_login_at: admin.last_login_at,
                    account_created_at: admin.created_at,
                },
                stats: {
                    total_users: Number(dashboardStats.total_users),
                    banned_users: Number(dashboardStats.banned_users),
                    unverified_users: Number(dashboardStats.unverified_users),
                    total_chats: Number(dashboardStats.total_chats),
                    total_messages: Number(dashboardStats.total_messages),
                    active_subscriptions: Number(dashboardStats.active_subscriptions),
                },
                server_time: new Date().toISOString(),
            }
        });

    } catch (error) {
        next(error);
    }
};

module.exports = {
    handleCreateUser,
    handleLoginUser,
    handleLogoutUser,
    handleActivateUser,
    handleUserProfile,
    handleRefreshToken,
    handleAdminDashboard,

}