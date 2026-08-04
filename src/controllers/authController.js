const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Otp = require("../models/Otp");
const { sendOtpEmail } = require("../config/mailer");

const genOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const isValidEmail = (email) => {
  return typeof email === 'string' && email.includes('@') && email.includes('.');
};

exports.register = async (req, res) => {
  let { email, password } = req.body;
  
  if (!email || typeof email !== 'string' || !password || typeof password !== 'string')
    return res.status(400).json({ message: "Email dan password harus diisi" });
    
  email = email.trim().toLowerCase();
  password = password.trim();
  
  if (!isValidEmail(email))
    return res.status(400).json({ message: "Format email tidak valid (harus mengandung '@' dan '.')" });
    
  if (password.length < 6)
    return res.status(400).json({ message: "Password minimal 6 karakter" });

  try {
    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "Email sudah terdaftar" });

    const hashed = await bcrypt.hash(password, 10);
    await User.create({ email, password: hashed, isVerified: false });

    const otp = genOtp();
    await Otp.create({
      email,
      code: otp,
      expiresAt: new Date(Date.now() + 5 * 60000),
    });
    await sendOtpEmail(email, otp);

    res.json({ message: "Registrasi berhasil, cek email untuk kode OTP" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.verifyOtp = async (req, res) => {
  let { email, code } = req.body;
  
  if (!email || typeof email !== 'string' || !code || typeof code !== 'string')
    return res.status(400).json({ message: "Email dan OTP harus diisi" });
    
  email = email.trim().toLowerCase();
  code = code.trim();

  try {
    const record = await Otp.findOne({ email, code });
    if (!record) return res.status(400).json({ message: "OTP salah" });
    if (record.expiresAt < new Date())
      return res.status(400).json({ message: "OTP kadaluarsa" });

    await User.updateOne({ email }, { isVerified: true });
    await Otp.deleteMany({ email });

    res.json({ message: "Verifikasi berhasil, silakan login" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.login = async (req, res) => {
  let { email, password } = req.body;
  
  if (!email || typeof email !== 'string' || !password || typeof password !== 'string')
    return res.status(400).json({ message: "Email dan password harus diisi" });
    
  email = email.trim().toLowerCase();

  try {
    const user = await User.findOne({ email });
    if (!user || !user.password)
      return res.status(400).json({ message: "Email atau password salah" });
    if (!user.isVerified)
      return res.status(403).json({ message: "Akun belum diverifikasi" });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(400).json({ message: "Email atau password salah" });

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );
    res.json({ token, user: { email: user.email } });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.googleCallback = (req, res) => {
  const token = jwt.sign(
    { id: req.user._id, email: req.user.email },
    process.env.JWT_SECRET,
    { expiresIn: "1d" },
  );
  const hasPassword = !!req.user.password;
  res.redirect(`${process.env.CLIENT_URL}/oauth-success?token=${token}&hasPassword=${hasPassword}`);
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });
    res.json({ user: { email: user.email, isVerified: user.isVerified, hasPassword: !!user.password, hasGoogle: !!user.googleId, createdAt: user.createdAt } });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.resendOtp = async (req, res) => {
  let { email } = req.body;
  
  if (!email || typeof email !== 'string')
    return res.status(400).json({ message: "Email harus diisi" });
    
  email = email.trim().toLowerCase();
  
  if (!isValidEmail(email))
    return res.status(400).json({ message: "Format email tidak valid" });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'Email tidak ditemukan' });
    if (user.isVerified) return res.status(400).json({ message: 'Akun sudah terverifikasi' });

    await Otp.deleteMany({ email });
    const otp = genOtp();
    await Otp.create({ email, code: otp, expiresAt: new Date(Date.now() + 5 * 60000) });
    await sendOtpEmail(email, otp);

    res.json({ message: 'Kode OTP baru telah dikirim' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.setPassword = async (req, res) => {
  let { password } = req.body;
  
  if (!password || typeof password !== 'string')
    return res.status(400).json({ message: "Password harus diisi" });
    
  password = password.trim();
  
  try {
    if (password.length < 6)
      return res.status(400).json({ message: 'Password minimal 6 karakter' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });
    if (user.password)
      return res.status(400).json({ message: 'Akun sudah memiliki password' });

    user.password = await bcrypt.hash(password, 10);
    await user.save();

    res.json({ message: 'Password berhasil disimpan' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });

    await Otp.deleteMany({ email: user.email });
    await User.findByIdAndDelete(req.user.id);

    res.json({ message: 'Akun berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Admin endpoints
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
