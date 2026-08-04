const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendOtpEmail(to, otp) {
  await transporter.sendMail({
    from: `"App Login" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Kode Verifikasi OTP Anda",
    html: `<p>Kode OTP kamu: <b>${otp}</b></p><p>Berlaku 5 menit.</p>`,
  });
}

module.exports = { sendOtpEmail };
