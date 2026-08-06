const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [/.+\@.+\..+/, "Format email tidak valid"],
    },
    passwordHash: {
      type: String,
      default: null, // kosong kalau login via SSO (Google)
    },
    googleId: {
      type: String,
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    profile: {
      fullName: {
        type: String,
        required: true,
        minlength: 2,
        maxlength: 50,
        default: "New User",
      },
      roleTitle: {
        type: String,
        maxlength: 50,
        default: "",
      },
      avatarUrl: {
        type: String,
        default: "",
      },
    },
    onboarding: {
      isCompleted: {
        type: Boolean,
        required: true,
        default: false,
      },
      role: {
        type: String,
        default: "",
      },
      teamSize: {
        type: String,
        default: "",
      },
      primaryGoal: {
        type: String,
        default: "",
      },
    },
    storage: {
      usedBytes: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
      },
      limitBytes: {
        type: Number,
        required: true,
        default: 4294967296, // 4GB in bytes
      },
    },
    subscription: {
      plan: {
        type: String,
        required: true,
        enum: ["Free", "Standard", "Premium"],
        default: "Free",
      },
      status: {
        type: String,
        required: true,
        enum: ["active", "expired"],
        default: "active",
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);

