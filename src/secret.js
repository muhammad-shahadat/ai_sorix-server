require("dotenv").config();



const port = process.env.PORT || 3000;

const dbHost = process.env.DB_HOST;
const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD;
const dbName = process.env.DB_NAME;
const dbPort = process.env.DB_PORT;

const jwtAccessKey = process.env.JWT_ACCESS_KEY || "access_key@shaon";
const jwtActivationKey = process.env.JWT_ACTIVATION_KEY || "activation_key@shaon";
const jwtRefreshKey = process.env.JWT_REFRESH_KEY || "refresh_key_@shaon";
const jwtForgotPassKey = process.env.JWT_FORGOT_PASS_KEY || "forgot_pass_key@shaon";
const nodeEnv = process.env.NODE_ENV;

const smtpUsername = process.env.SMTP_USERNAME;
const smtpPassword = process.env.SMTP_PASSWORD;
const clientUrl = process.env.CLIENT_URL;

const geminiApiKey = process.env.GEMINI_API_KEY;



module.exports = {
    port,
    dbHost,
    dbUser,
    dbPassword,
    dbName,
    dbPort,
    jwtAccessKey,
    jwtActivationKey,
    jwtRefreshKey,
    jwtForgotPassKey,
    nodeEnv,
    smtpUsername,
    smtpPassword,
    clientUrl,
    geminiApiKey,
}