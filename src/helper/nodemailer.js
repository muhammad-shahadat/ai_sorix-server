
const nodemailer = require("nodemailer");
const { logger } = require("../../config/logger");
const { smtpUsername, smtpPassword } = require("../secret");

// Create a transporter for SMTP
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // upgrade later with STARTTLS
  auth: {
    user: smtpUsername,
    pass: smtpPassword,
  },
});

const emailWithNodemailer = async (mailData) =>{
    try {
        const mailOptions = {
            from: `"Ai sorix Support" <no-reply@appname.com>`,
            to: mailData.email,
            subject: mailData.subject,
            html: mailData.html,
        }

        const info = await transporter.sendMail(mailOptions);
        console.log("Message sent: %s", info.messageId);
        console.log("Message sent: %s", info.response);

        
    } catch (error) {
        logger.error("Error while sending mail", error);
        throw error;
        
    }
}



module.exports = {
    emailWithNodemailer,
}