const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true';

let sgMail;
if (EMAIL_ENABLED) {
  sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

async function sendOtpEmail(toEmail, otp) {
  if (!EMAIL_ENABLED) {
    console.log(`[email stub] OTP for ${toEmail}: ${otp}`);
    return;
  }

  await sgMail.send({
    to: toEmail,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: 'Your verification code',
    text: `Your one-time code is ${otp}. It expires in ${process.env.OTP_TTL_SECONDS || 300} seconds.`,
    html: `<p>Your one-time code is <strong>${otp}</strong>.</p><p>It expires in ${process.env.OTP_TTL_SECONDS || 300} seconds.</p>`,
  });
}

module.exports = { sendOtpEmail };
