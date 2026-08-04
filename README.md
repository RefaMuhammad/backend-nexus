# Backend Nexus API Documentation

This is the backend for the Nexus application, built with Express.js and MongoDB. It handles user authentication (Email/Password & Google OAuth), OTP verification, role-based access control (RBAC), and rate limiting.

## Rate Limiting
- **Global**: 100 requests / 15 minutes per IP
- **Login**: 10 requests / 15 minutes per IP
- **Register**: 5 requests / 1 hour per IP

## Endpoints

### 1. Authentication

#### Register
- **URL**: `/api/auth/register`
- **Method**: `POST`
- **Description**: Mendaftarkan pengguna baru dengan email dan password. OTP akan dikirim ke email untuk verifikasi.
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```

#### Verify OTP
- **URL**: `/api/auth/verify-otp`
- **Method**: `POST`
- **Description**: Verifikasi kode OTP yang dikirimkan ke email saat pendaftaran.
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "code": "123456"
  }
  ```

#### Resend OTP
- **URL**: `/api/auth/resend-otp`
- **Method**: `POST`
- **Description**: Mengirimkan ulang kode OTP ke email jika kode sebelumnya sudah kadaluarsa (berlaku 5 menit).
- **Body**:
  ```json
  {
    "email": "user@example.com"
  }
  ```

#### Login
- **URL**: `/api/auth/login`
- **Method**: `POST`
- **Description**: Login menggunakan email dan password. Mengembalikan JWT Token.
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```

#### Google OAuth Login
- **URL**: `/api/auth/google`
- **Method**: `GET`
- **Description**: Mengarahkan pengguna ke halaman persetujuan OAuth Google.

#### Google OAuth Callback
- **URL**: `/api/auth/google/callback`
- **Method**: `GET`
- **Description**: URL callback untuk Google OAuth. Akan meredirect pengguna kembali ke frontend dengan menyertakan token di query string.

### 2. User Management (Protected Routes)
*Semua endpoint di bawah ini memerlukan header `Authorization: Bearer <token>`*

#### Get Current User
- **URL**: `/api/auth/me`
- **Method**: `GET`
- **Description**: Mengambil data profil user yang sedang login saat ini.
- **Headers**: `Authorization: Bearer <token>`

#### Set Password
- **URL**: `/api/auth/set-password`
- **Method**: `POST`
- **Description**: Membuat password untuk user yang mendaftar via Google OAuth (sehingga bisa login menggunakan email/password ke depannya).
- **Headers**: `Authorization: Bearer <token>`
- **Body**:
  ```json
  {
    "password": "newpassword123"
  }
  ```

#### Delete Account
- **URL**: `/api/auth/account`
- **Method**: `DELETE`
- **Description**: Menghapus akun pengguna beserta data OTP yang tersisa secara permanen.
- **Headers**: `Authorization: Bearer <token>`

### 3. Admin (Protected & Role-based Routes)
*Semua endpoint di bawah ini memerlukan header `Authorization: Bearer <token>` dan user harus memiliki role `"admin"`*

#### Get All Users
- **URL**: `/api/auth/users`
- **Method**: `GET`
- **Description**: Menampilkan daftar semua pengguna yang terdaftar di dalam sistem (tanpa password).
- **Headers**: `Authorization: Bearer <token>`

---

## Setup & Run (Without Docker)

1. Clone repository ini.
2. Jalankan `npm install` untuk menginstal dependensi.
3. Buat file `.env` dengan konfigurasi berikut:
   ```env
   PORT=5000
   MONGO_URI=mongodb://localhost:27017/login_app
   JWT_SECRET=rahasia_jwt_anda
   EMAIL_USER=email_anda@gmail.com
   EMAIL_PASS=app_password_email_anda
   CLIENT_URL=http://localhost:3000
   GOOGLE_CLIENT_ID=client_id_google_anda
   GOOGLE_CLIENT_SECRET=client_secret_google_anda
   GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
   ```
4. Jalankan aplikasi menggunakan `npm start` atau `npm run dev` (dengan nodemon).
