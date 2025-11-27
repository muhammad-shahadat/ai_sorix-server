const { clientUrl } = require("../secret")


const registrationMail = (email, name, token) => {

    const mailData = {

        email,
        subject: "Activate Your Account — Ai sorix", 
        html: `<div style=" font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px; background-color: #f9f9f9; "> 
        
            <h2 style="color: #333;">Hi ${name},</h2> 
            <p style="font-size: 16px; color: #555;"> Thanks for signing up with <b>AppName</b>! Please verify your account by clicking the button below: </p>

            <a href="${clientUrl}/users/activate?verify=${token}" target="_blank" style=" display: inline-block; background-color: #007bff; color: white; text-decoration: none; padding: 10px 20px; border-radius: 5px; margin-top: 15px; "> Verify Account </a> 

            <p style="font-size: 14px; color: #777; margin-top: 20px;"> If you did not create an account, please ignore this email. </p>

            <p style="font-size: 12px; color: #aaa;">
                &copy; ${new Date().getFullYear()} AppName Inc. All rights reserved.  
            </p> 
        </div>`

    }

    return mailData;


}



const forgotPasswordMail = (email, name, token) => {

  const mailData = {
    email,
    subject: "Reset Your Password — Ai sorix",
    html: `
      <div style="
        font-family: Arial, sans-serif;
        max-width: 500px;
        margin: auto;
        padding: 20px;
        border: 1px solid #eaeaea;
        border-radius: 10px;
        background-color: #f9f9f9;
      ">
        <h2 style="color: #333;">Hi ${name},</h2>
        <p style="font-size: 16px; color: #555;">
          We received a request to reset your password for your <b>AppName</b> account.
          Click the button below to set a new password:
        </p>

        <a href="${clientUrl}/users/forgot-password?verify=${token}"
          target="_blank"
          style="
            display: inline-block;
            background-color: #007bff;
            color: white;
            text-decoration: none;
            padding: 10px 20px;
            border-radius: 5px;
            margin-top: 15px;
          ">
          Reset Password
        </a>

        <p style="font-size: 14px; color: #777; margin-top: 20px;">
          If you didn’t request a password reset, you can safely ignore this email.
        </p>

        <p style="font-size: 12px; color: #aaa;">
          &copy; ${new Date().getFullYear()} AppName Inc. All rights reserved.
        </p>
      </div>
    `,
  };

  return mailData;

};






module.exports = {
    registrationMail,
    forgotPasswordMail,
}