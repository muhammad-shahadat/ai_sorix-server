// src/middleware/passport.js
const passport = require("passport");
const { Strategy: JwtStrategy } = require("passport-jwt");
const pool = require("../config/db");
const { jwtAccessKey } = require("./secret");

// কুকি থেকে টোকেন বের করা
const cookieExtractor = (req) => {
    let token = null;
    if (req && req.cookies) {
        token = req.cookies["accessToken"]; // তোর কুকির নাম
    }
    return token;
};

const opts = {
    jwtFromRequest: cookieExtractor,
    secretOrKey: jwtAccessKey,
};

passport.use(
    new JwtStrategy(opts, async (jwtPayload, done) => {
        try {
            const { id } = jwtPayload;

            // PostgreSQL + তোর স্কিমা অনুযায়ী কোয়েরি
            const result = await pool.query(
                `SELECT 
                    id, 
                    name, 
                    email, 
                    role, 
                    is_active, 
                    is_email_verified,
                    _deleted
                 FROM users 
                 WHERE id = $1 AND _deleted = false`,
                [id]
            );

            // ইউজার পাওয়া গেছে?
            if (result.rows.length === 0) {
                return done(null, false); // ইউজার নাই বা ডিলিটেড
            }

            const user = result.rows[0];

            // ব্যান চেক (is_active = false মানে ব্যান)
            if (!user.is_active) {
                return done(null, false);
            }

            // সফল — ইউজার অবজেক্ট পাস করা
            return done(null, {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                is_email_verified: user.is_email_verified,
            });

        } catch (error) {
            console.error("Passport JWT Error:", error.message);
            return done(error, false);
        }
    })
);

module.exports = passport;