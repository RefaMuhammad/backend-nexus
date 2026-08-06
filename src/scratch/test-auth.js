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
        primaryGoal: "Build a portfolio and get my first job"
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
