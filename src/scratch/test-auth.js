require("dotenv").config();
const http = require("http");
const mongoose = require("mongoose");
                                                                                         
// Pastikan model di-load oleh Mongoose
const User = require("../models/User");
const Otp = require("../models/Otp");

// Import server (ini akan menyalakan server di port 5000)
require("../app");

// Helper untuk HTTP Request native Node.js (tanpa dependensi eksternal)
function apiRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : "";
    const options = {
      hostname: "localhost",
      port: 5000,
      path: path,
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (token) {
      options.headers["Authorization"] = `Bearer ${token}`;
    }

    if (body) {
      options.headers["Content-Length"] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          resolve({
            status: res.statusCode,
            body: JSON.parse(data),
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            body: data,
          });
        }
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    if (body) {
      req.write(postData);
    }
    req.end();
  });
}

// Fungsi utama test
async function runTests() {
  console.log("Menunggu 3 detik agar database MongoDB terhubung...");
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const testEmail = "testuser@example.com";
  const testPassword = "Password123!";

  console.log("\n=================== STARTING INTEGRATION TESTS ===================");

  try {
    // 0. Bersihkan test data lama jika ada
    await User.deleteMany({ email: testEmail });
    await Otp.deleteMany({ email: testEmail });
    console.log("✓ Database dibersihkan untuk email pengujian");

    // 1. Uji Coba Register/Signup (Dengan Email, Password, Nama)
    console.log("\n[TEST 1] Registering User...");
    const regRes = await apiRequest("POST", "/api/auth/register", {
      email: testEmail,
      password: testPassword,
      fullName: "Ria Kristi",
    });
    console.log("Response Status:", regRes.status);
    console.log("Response Body:", regRes.body);
    if (regRes.status !== 200) throw new Error("Registrasi gagal");

    // 2. Cek OTP terbuat di DB
    const otpRecord = await Otp.findOne({ email: testEmail });
    if (!otpRecord) throw new Error("OTP tidak berhasil dibuat di database");
    console.log("✓ OTP ditemukan di Database:", otpRecord.code);

    // 3. Uji Coba Cooldown Resend OTP (Harus Gagal / status 400)
    console.log("\n[TEST 2] Resend OTP segera setelah register (harus kena cooldown 60s)...");
    const resendRes = await apiRequest("POST", "/api/auth/resend-otp", {
      email: testEmail,
    });
    console.log("Response Status (Expected 400):", resendRes.status);
    console.log("Response Body:", resendRes.body);
    if (resendRes.status !== 400) throw new Error("Harusnya kena cooldown 400");
    console.log("✓ Cooldown 60 detik terverifikasi bekerja dengan baik!");

    // 4. Uji Coba Verifikasi OTP + Pengisian Onboarding
    console.log("\n[TEST 3] Verifying OTP and submitting Onboarding Survey...");
    const verifyRes = await apiRequest("POST", "/api/auth/verify-otp", {
      email: testEmail,
      code: otpRecord.code,
      onboarding: {
        role: "Data Analyst",
        teamSize: "1-5",
        industry: "Education"
      }
    });
    console.log("Response Status:", verifyRes.status);
    console.log("Response Body:", verifyRes.body);
    if (verifyRes.status !== 200) throw new Error("Verifikasi OTP gagal");

    // Cek status user di DB
    const verifiedUser = await User.findOne({ email: testEmail });
    if (!verifiedUser || !verifiedUser.isVerified) throw new Error("User belum terverifikasi di DB");
    console.log("✓ Status user terverifikasi di DB");

     // 5. Uji Coba Login
     console.log("\n[TEST 4] Logging in (dengan rememberMe: true untuk session 7 hari)...");
     const loginRes = await apiRequest("POST", "/api/auth/login", {
       email: testEmail,
       password: testPassword,
       rememberMe: true,
     });
     console.log("Response Status:", loginRes.status);
     console.log("Response Body:", loginRes.body);
     if (loginRes.status !== 200 || !loginRes.body.token) throw new Error("Login gagal");
     const token = loginRes.body.token;
     console.log("✓ Token JWT didapatkan");

    // 6. Uji Coba Proteksi Endpoint /me
    console.log("\n[TEST 5] Accessing protected /me profile route...");
    const meRes = await apiRequest("GET", "/api/auth/me", null, token);
    console.log("Response Status:", meRes.status);
    console.log("Response Body:", meRes.body);
    if (meRes.status !== 200) throw new Error("Gagal mengakses endpoint terproteksi /me");
    console.log("✓ Detail profil user berhasil diakses via JWT!");

    // 6.5. Uji Coba Edit Profile (NEX-089)
    console.log("\n[TEST 5.1] Updating user profile with valid name (Ria Kristi Basri)...");
    const updateRes = await apiRequest("PUT", "/api/auth/profile", {
      fullName: "Ria Kristi Basri",
      roleTitle: "Data Analyst"
    }, token);
    console.log("Response Status:", updateRes.status);
    console.log("Response Body:", updateRes.body);
    if (updateRes.status !== 200) throw new Error("Gagal mengupdate profil");

    console.log("\n[TEST 5.2] Updating user profile with invalid short name (1 character)...");
    const updateShortRes = await apiRequest("PUT", "/api/auth/profile", {
      fullName: "R"
    }, token);
    console.log("Response Status (Expected 400):", updateShortRes.status);
    console.log("Response Body:", updateShortRes.body);
    if (updateShortRes.status !== 400) throw new Error("Update profil dengan nama pendek harusnya gagal");
    console.log("✓ Validasi panjang nama 2-50 karakter terbukti bekerja!");

    // 6.6. Uji Coba Change Password
    console.log("\n[TEST 5.3] Changing password with invalid current password (should fail 400)...");
    const changeFailRes = await apiRequest("POST", "/api/auth/change-password", {
      currentPassword: "WrongPassword!",
      newPassword: "NewPassword123!"
    }, token);
    console.log("Response Status (Expected 400):", changeFailRes.status);
    console.log("Response Body:", changeFailRes.body);
    if (changeFailRes.status !== 400) throw new Error("Harus gagal jika current password salah");

    console.log("\n[TEST 5.4] Changing password with weak new password (should fail 400)...");
    const changeWeakRes = await apiRequest("POST", "/api/auth/change-password", {
      currentPassword: testPassword,
      newPassword: "123"
    }, token);
    console.log("Response Status (Expected 400):", changeWeakRes.status);
    console.log("Response Body:", changeWeakRes.body);
    if (changeWeakRes.status !== 400) throw new Error("Harus gagal jika password baru terlalu lemah");

    console.log("\n[TEST 5.5] Changing password with valid credentials...");
    const newPasswordVal = "NewPassword123!";
    const changeSuccessRes = await apiRequest("POST", "/api/auth/change-password", {
      currentPassword: testPassword,
      newPassword: newPasswordVal
    }, token);
    console.log("Response Status:", changeSuccessRes.status);
    console.log("Response Body:", changeSuccessRes.body);
    if (changeSuccessRes.status !== 200) throw new Error("Gagal mengubah password");

    console.log("\n[TEST 5.6] Trying to login with the old password (should fail)...");
    const oldLoginRes = await apiRequest("POST", "/api/auth/login", {
      email: testEmail,
      password: testPassword,
    });
    console.log("Response Status (Expected 400):", oldLoginRes.status);
    if (oldLoginRes.status !== 400) throw new Error("Harusnya login dengan password lama gagal");

    console.log("\n[TEST 5.7] Logging in with the new password...");
    const newLoginRes = await apiRequest("POST", "/api/auth/login", {
      email: testEmail,
      password: newPasswordVal,
    });
    console.log("Response Status:", newLoginRes.status);
    if (newLoginRes.status !== 200 || !newLoginRes.body.token) throw new Error("Gagal login dengan password baru");
    let activeToken = newLoginRes.body.token;
    console.log("✓ Login dengan password baru sukses!");

    // 6.7. Uji Coba Forgot Password & Reset Password
    console.log("\n[TEST 5.8] Requesting password reset OTP...");
    const forgotRes = await apiRequest("POST", "/api/auth/forgot-password", {
      email: testEmail
    });
    console.log("Response Status:", forgotRes.status);
    console.log("Response Body:", forgotRes.body);
    if (forgotRes.status !== 200) throw new Error("Gagal merequest forgot password");

    // Ambil OTP reset di DB
    const resetOtpRecord = await Otp.findOne({ email: testEmail, type: "password_reset" });
    if (!resetOtpRecord) throw new Error("OTP password reset tidak ditemukan di database");
    console.log("✓ OTP Reset Password ditemukan di DB:", resetOtpRecord.code);

    console.log("\n[TEST 5.9] Resetting password with weak new password (should fail 400)...");
    const resetWeakRes = await apiRequest("POST", "/api/auth/reset-password", {
      email: testEmail,
      code: resetOtpRecord.code,
      newPassword: "123"
    });
    console.log("Response Status (Expected 400):", resetWeakRes.status);
    if (resetWeakRes.status !== 400) throw new Error("Reset password lemah harusnya gagal");

    console.log("\n[TEST 5.10] Resetting password with wrong OTP (should fail 400)...");
    const resetWrongOtpRes = await apiRequest("POST", "/api/auth/reset-password", {
      email: testEmail,
      code: "999999",
      newPassword: "ResetPassword123!"
    });
    console.log("Response Status (Expected 400):", resetWrongOtpRes.status);
    if (resetWrongOtpRes.status !== 400) throw new Error("Reset password dengan OTP salah harusnya gagal");

    console.log("\n[TEST 5.11] Resetting password with valid details...");
    const resetPasswordVal = "ResetPassword123!";
    const resetSuccessRes = await apiRequest("POST", "/api/auth/reset-password", {
      email: testEmail,
      code: resetOtpRecord.code,
      newPassword: resetPasswordVal
    });
    console.log("Response Status:", resetSuccessRes.status);
    console.log("Response Body:", resetSuccessRes.body);
    if (resetSuccessRes.status !== 200) throw new Error("Gagal mereset password");

    console.log("\n[TEST 5.12] Logging in with the reset password...");
    const resetLoginRes = await apiRequest("POST", "/api/auth/login", {
      email: testEmail,
      password: resetPasswordVal,
    });
    console.log("Response Status:", resetLoginRes.status);
    if (resetLoginRes.status !== 200 || !resetLoginRes.body.token) throw new Error("Gagal login dengan password hasil reset");
    activeToken = resetLoginRes.body.token;
    console.log("✓ Login dengan password baru hasil reset sukses!");

    // 7. Cleanup
    console.log("\n[TEST 6] Cleaning up test user...");
    await User.deleteOne({ email: testEmail });
    await Otp.deleteMany({ email: testEmail });
    console.log("✓ Data test dibersihkan");

    console.log("\n===============================================================");
    console.log("ALL TESTS COMPLETED SUCCESSFULLY! \u2705");
    console.log("===============================================================");
    process.exit(0);
  } catch (error) {
    console.error("\nTEST FAILED! \u274C");
    console.error(error);
    process.exit(1);
  }
}

runTests();
