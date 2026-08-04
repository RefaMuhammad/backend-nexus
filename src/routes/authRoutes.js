const express = require("express");
const passport = require("passport");
const router = express.Router();
const auth = require("../controllers/authController");
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');

// Rate limiting configurations
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 10, // batasi setiap IP maksimal 10 request per windowMs untuk login
  message: { message: 'Terlalu banyak percobaan login, coba lagi setelah 15 menit' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 jam
  max: 5, // batasi setiap IP maksimal 5 register per jam
  message: { message: 'Terlalu banyak percobaan daftar, coba lagi setelah 1 jam' },
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: 'Terlalu banyak request, coba lagi nanti' },
});

router.use(generalLimiter);

router.post("/register", registerLimiter, auth.register);
router.post("/verify-otp", auth.verifyOtp);
router.post("/login", loginLimiter, auth.login);

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);
router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.CLIENT_URL}/login?error=oauth_failed`,
  }),
  auth.googleCallback,
);

router.get('/me', verifyToken, auth.getMe);
router.post('/resend-otp', auth.resendOtp);
router.post('/set-password', verifyToken, auth.setPassword);
router.delete('/account', verifyToken, auth.deleteAccount);

// Admin endpoints
router.get('/users', verifyToken, isAdmin, auth.getAllUsers);

module.exports = router;
