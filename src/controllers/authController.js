const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Otp = require("../models/Otp");
const { sendOtpEmail } = require("../config/mailer");

const genOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const isValidEmail = (email) => {
  return typeof email === 'string' && email.includes('@') && email.includes('.');
};

// Helper validasi kerumitan password (NEX-002)
const isValidPassword = (password) => {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return regex.test(password);
};

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
};

// create
exports.register = async (req, res) => {
  let { email, password, fullName } = req.body;
  
  if (!email || typeof email !== 'string' || !password || typeof password !== 'string' || !fullName || typeof fullName !== 'string')
    return res.status(400).json({ message: "Email, password, dan nama lengkap harus diisi" });
    
  email = email.trim().toLowerCase();
  password = password.trim();
  fullName = fullName.trim();
  
  if (!isValidEmail(email))
    return res.status(400).json({ message: "Format email tidak valid (harus mengandung '@' dan '.')" });
    
  if (!isValidPassword(password)) {
    return res.status(400).json({ 
      message: "Password tidak memenuhi syarat (minimal 8 karakter, mengandung huruf besar, kecil, angka, dan karakter spesial)" 
    });
  }

  if (fullName.length < 2 || fullName.length > 50)
    return res.status(400).json({ message: "Nama lengkap harus antara 2 sampai 50 karakter" });

  try {
    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "Email sudah terdaftar" });

    const hashed = await bcrypt.hash(password, 10);
    
    // Simpan pendaftaran dengan nama lengkap di profil
    await User.create({
      email,
      passwordHash: hashed,
      isVerified: false,
      profile: {
        fullName: fullName
      }
    });

    const otp = genOtp();
    await Otp.create({
      email,
      code: otp,
      type: "signup",
      cooldownUntil: new Date(Date.now() + 60 * 1000),
      expiresAt: new Date(Date.now() + 5 * 60000),
    });
    await sendOtpEmail(email, otp);

    res.json({ message: "Registrasi berhasil, cek email untuk kode OTP" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.verifyOtp = async (req, res) => {
  let { email, code, onboarding } = req.body;
  
  if (!email || typeof email !== 'string' || !code || typeof code !== 'string')
    return res.status(400).json({ message: "Email dan OTP harus diisi" });
    
  email = email.trim().toLowerCase();
  code = code.trim();

  try {
    const record = await Otp.findOne({ email, code });
    if (!record) return res.status(400).json({ message: "OTP salah" });
    if (record.expiresAt < new Date())
      return res.status(400).json({ message: "OTP kadaluarsa" });

    // Cari user untuk di-update status verifikasi dan data onboarding-nya
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User tidak ditemukan" });

    user.isVerified = true;

    // Simpan data onboarding jika dikirimkan oleh frontend
    if (onboarding) {
      user.onboarding.role = typeof onboarding.role === 'string' ? onboarding.role.trim() : '';
      user.onboarding.teamSize = typeof onboarding.teamSize === 'string' ? onboarding.teamSize.trim() : '';
      user.onboarding.industry = typeof onboarding.industry === 'string' ? onboarding.industry.trim() : '';
    }
    
    // Set status onboarding telah selesai
    user.onboarding.isCompleted = true;

    await user.save();
    await Otp.deleteMany({ email });

    res.json({ message: "Verifikasi berhasil, silakan login" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.login = async (req, res) => {
  let { email, password, rememberMe } = req.body;
  
  if (!email || typeof email !== 'string' || !password || typeof password !== 'string')
    return res.status(400).json({ message: "Email dan password harus diisi" });
    
  email = email.trim().toLowerCase();

  try {
    const user = await User.findOne({ email });
    if (!user || !user.passwordHash)
      return res.status(400).json({ message: "Email atau password salah" });
    if (!user.isVerified)
      return res.status(403).json({ message: "Akun belum diverifikasi" });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match)
      return res.status(400).json({ message: "Email atau password salah" });

    const expiresIn = (rememberMe === true || rememberMe === 'true') ? '7d' : '1d';
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn },
    );
    res.json({ token, user: { email: user.email } });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// google SSO
exports.googleCallback = (req, res) => {
  const token = jwt.sign(
    { id: req.user._id, email: req.user.email },
    process.env.JWT_SECRET,
    { expiresIn: "1d" },
  );
  const hasPassword = !!req.user.passwordHash;
  res.redirect(`${process.env.CLIENT_URL}/oauth-success?token=${token}&hasPassword=${hasPassword}`);
};

// Fungsi forgotPassword
exports.forgotPassword = async (req, res) => {
  let { email } = req.body;
  if (!email || typeof email !== 'string')
    return res.status(400).json({ message: "Email harus diisi" });

  email = email.trim().toLowerCase();

  try {
    const user = await User.findOne({ email });
    // Opsi A: Jika email tidak ditemukan, tetap tampilkan pesan sukses (User Enumeration Protection)
    if (!user) {
      return res.json({ message: "Jika email terdaftar, kode OTP reset password telah dikirim" });
    }

    // Cooldown check
    const existingOtp = await Otp.findOne({ email, type: 'password_reset' });
    if (existingOtp && existingOtp.cooldownUntil > new Date()) {
      const waitSeconds = Math.ceil((existingOtp.cooldownUntil - new Date()) / 1000);
      return res.status(400).json({ message: `Silakan tunggu ${waitSeconds} detik sebelum meminta OTP kembali` });
    }

    await Otp.deleteMany({ email, type: 'password_reset' });

    const otp = genOtp();
    await Otp.create({
      email,
      code: otp,
      type: "password_reset",
      cooldownUntil: new Date(Date.now() + 60 * 1000),
      expiresAt: new Date(Date.now() + 5 * 60000),
    });
    await sendOtpEmail(email, otp);

    res.json({ message: "Jika email terdaftar, kode OTP reset password telah dikirim" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Fungsi resetPassword
exports.resetPassword = async (req, res) => {
  let { email, code, newPassword } = req.body;

  if (!email || typeof email !== 'string' || !code || typeof code !== 'string' || !newPassword || typeof newPassword !== 'string') {
    return res.status(400).json({ message: "Email, kode OTP, dan password baru harus diisi" });
  }

  email = email.trim().toLowerCase();
  code = code.trim();
  newPassword = newPassword.trim();

  if (!isValidPassword(newPassword)) {
    return res.status(400).json({
      message: "Password baru tidak memenuhi syarat keamanan (minimal 8 karakter, mengandung huruf besar, kecil, angka, dan karakter spesial)"
    });
  }

  try {
    const record = await Otp.findOne({ email, code, type: 'password_reset' });
    if (!record) return res.status(400).json({ message: "Kode OTP salah atau tidak ditemukan" });
    if (record.expiresAt < new Date()) return res.status(400).json({ message: "Kode OTP kadaluarsa" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User tidak ditemukan" });

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.isVerified = true;
    await user.save();

    await Otp.deleteMany({ email, type: 'password_reset' });

    res.json({ message: "Password berhasil diperbarui, silakan login" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


// View Profile
exports.getMe = async (req, res) => {
  try {
    // Ambil data utuh terlebih dahulu agar hasPassword terhitung valid
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });
    
    const userObj = user.toObject();
    const hasPassword = !!userObj.passwordHash;
    
    // Hapus hash password sebelum dikirim demi alasan keamanan
    delete userObj.passwordHash;

    res.json({
      user: {
        email: userObj.email,
        isVerified: userObj.isVerified,
        hasPassword: hasPassword,
        hasGoogle: !!userObj.googleId,
        profile: userObj.profile,
        onboarding: userObj.onboarding,
        storage: {
          usedBytes: userObj.storage.usedBytes,
          limitBytes: userObj.storage.limitBytes,
          // limit dibulatkan dalam GB
          limitGB: Math.round(userObj.storage.limitBytes / (1024 * 1024 * 1024)), 
          usedFormatted: formatBytes(userObj.storage.usedBytes),
          limitFormatted: formatBytes(userObj.storage.limitBytes),
        },
        subscription: userObj.subscription,
        createdAt: userObj.createdAt
      }
    });
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

    const existingOtp = await Otp.findOne({ email, type: 'signup' });
    if (existingOtp && existingOtp.cooldownUntil > new Date()) {
      const waitSeconds = Math.ceil((existingOtp.cooldownUntil - new Date()) / 1000);
      return res.status(400).json({ message: `Silakan tunggu ${waitSeconds} detik sebelum meminta OTP kembali` });
    }

    await Otp.deleteMany({ email });
    const otp = genOtp();
    await Otp.create({
      email,
      code: otp,
      type: 'signup',
      cooldownUntil: new Date(Date.now() + 60 * 1000),
      expiresAt: new Date(Date.now() + 5 * 60000)
    });
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
    if (!isValidPassword(password)) {
      return res.status(400).json({
        message: "Password tidak memenuhi syarat (minimal 8 karakter, mengandung huruf besar, kecil, angka, dan karakter spesial)"
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });
    if (user.passwordHash)
      return res.status(400).json({ message: 'Akun sudah memiliki password' });

    user.passwordHash = await bcrypt.hash(password, 10);
    await user.save();

    res.json({ message: 'Password berhasil disimpan' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Edit Profile
exports.updateProfile = async (req, res) => {
  const { fullName, roleTitle } = req.body;

  // Validasi panjang nama (2-50 karakter - NEX-089)
  if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.trim().length > 50) {
    return res.status(400).json({ message: "Nama lengkap harus antara 2 sampai 50 karakter" });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User tidak ditemukan" });

    // Inisialisasi jika profile belum terbentuk di DB
    if (!user.profile) {
      user.profile = { fullName: 'New User', roleTitle: '', avatarUrl: '' };
    }

    user.profile.fullName = fullName.trim();
    if (roleTitle !== undefined) {
      user.profile.roleTitle = typeof roleTitle === 'string' ? roleTitle.trim() : '';
    }

    await user.save();
    res.json({
      message: "Profil berhasil diperbarui",
      profile: user.profile
    });
  } catch (err) {
    console.error("[PROFILE UPDATE ERROR]:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// fungsi change password di profile
exports.changePassword = async (req, res) => {
  let { currentPassword, newPassword } = req.body;

  if (!currentPassword || typeof currentPassword !== 'string' || !newPassword || typeof newPassword !== 'string') {
    return res.status(400).json({ message: "Password saat ini dan password baru harus diisi" });
  }

  currentPassword = currentPassword.trim();
  newPassword = newPassword.trim();

  if (!isValidPassword(newPassword)) {
    return res.status(400).json({
      message: "Password baru tidak memenuhi syarat keamanan (minimal 8 karakter, mengandung huruf besar, kecil, angka, dan karakter spesial)"
    });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User tidak ditemukan" });

    // Cek jika akun SSO dan belum memiliki password
    if (!user.passwordHash) {
      return res.status(400).json({ message: "Akun Anda belum memiliki password. Silakan gunakan fitur Set Password terlebih dahulu" });
    }

    // Verifikasi password saat ini
    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: "Password saat ini salah" });
    }

    // Mencegah penggunaan password yang sama dengan password saat ini
    const isSame = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSame) {
      return res.status(400).json({ message: "Password baru tidak boleh sama dengan password saat ini" });
    }

    // Hash dan simpan password baru
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: "Password berhasil diubah" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// delete
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




