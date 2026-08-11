const nodemailer = require("nodemailer");

let transporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

async function sendOtpEmail(to, otp) {
  console.log(`\n===========================================`);
  console.log(`[MAIL SIMULATOR] Kode OTP untuk ${to}: ${otp}`);
  console.log(`===========================================\n`);

  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"App Login" <${process.env.EMAIL_USER}>`,
        to,
        subject: "Kode Verifikasi OTP Anda",
        html: `<p>Kode OTP kamu: <b>${otp}</b></p><p>Berlaku 5 menit.</p>`,
      });
    } catch (error) {
      console.error("[MAIL ERROR] Gagal mengirim email asli:", error.message);
    }
  }
}

module.exports = { sendOtpEmail };

