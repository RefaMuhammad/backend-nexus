const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      match: [/^\d{6}$/, "Kode OTP harus berupa 6 digit angka"],
    },
    type: {
      type: String,
      required: true,
      enum: ["signup", "password_reset"],
    },
    cooldownUntil: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 60 * 1000), // 60 detik cooldown
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // TTL index to auto-delete when expiresAt is reached
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Otp", otpSchema);

