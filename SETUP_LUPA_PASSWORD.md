# 📧 Setup Fitur Lupa Password - SIBUDI

Panduan lengkap untuk mengaktifkan fitur lupa password dengan email (Gmail/Outlook).

---

## 📋 Daftar Isi

1. [Instalasi Database](#1-instalasi-database)
2. [Konfigurasi Email](#2-konfigurasi-email)
3. [Testing Fitur](#3-testing-fitur)
4. [Troubleshooting](#4-troubleshooting)

---

## 1. Instalasi Database

### Jalankan SQL untuk membuat tabel

Buka phpMyAdmin atau MySQL client, lalu jalankan file SQL berikut:

```bash
database/password_reset_tokens.sql
```

Atau jalankan query ini langsung:

```sql
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50) NULL,
    member_id VARCHAR(50) NULL,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    user_type ENUM('user', 'member') NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    used TINYINT(1) DEFAULT 0,
    INDEX idx_token (token),
    INDEX idx_email (email),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 2. Konfigurasi Email

### A. Pilih Provider Email

Anda bisa menggunakan **Gmail** atau **Outlook**. Pilih salah satu:

---

### B. Setup Gmail

#### 1. Aktifkan 2-Step Verification

1. Buka [Google Account Security](https://myaccount.google.com/security)
2. Scroll ke bawah, cari **"2-Step Verification"**
3. Klik **"Get Started"** dan ikuti petunjuk
4. Verifikasi dengan nomor HP Anda

#### 2. Generate App Password

1. Buka [App Passwords](https://myaccount.google.com/apppasswords)
2. Pilih **"Mail"** di dropdown pertama
3. Pilih **"Windows Computer"** atau **"Other"** di dropdown kedua
4. Klik **"Generate"**
5. Salin **16 digit password** yang muncul (contoh: `abcd efgh ijkl mnop`)

#### 3. Update file `.env`

Buka file `.env` di root project, tambahkan:

```env
EMAIL_SERVICE=gmail
EMAIL_USER=emailanda@gmail.com
EMAIL_PASS=abcdefghijklmnop
```

⚠️ **Penting:** 
- Paste App Password **tanpa spasi**
- Jangan gunakan password email biasa
- Jangan commit file `.env` ke Git

---

### C. Setup Outlook

#### 1. Generate App Password

1. Login ke [Microsoft Account](https://account.microsoft.com/)
2. Buka [Security Settings](https://account.live.com/proofs/manage/additional)
3. Klik **"Create a new app password"**
4. Salin password yang muncul

#### 2. Update file `.env`

```env
EMAIL_SERVICE=outlook
EMAIL_USER=emailanda@outlook.com
EMAIL_PASS=password-yang-disalin
```

---

## 3. Testing Fitur

### A. Pastikan Email Sudah Terdaftar

Cek database Anda, pastikan user/member memiliki email:

```sql
-- Cek email di tabel user (pustakawan/admin)
SELECT user_id, username, email FROM user WHERE email IS NOT NULL;

-- Cek email di tabel member
SELECT member_id, member_name, member_email FROM member WHERE member_email IS NOT NULL;
```

Jika belum ada email, update dulu:

```sql
-- Update email user
UPDATE user SET email = 'emailanda@gmail.com' WHERE user_id = 'admin';

-- Update email member
UPDATE member SET member_email = 'emailanda@gmail.com' WHERE member_id = '12345';
```

---

### B. Test Flow Lupa Password

1. **Buka halaman login**
   ```
   http://localhost:3000/login
   ```

2. **Klik "Lupa Kata Sandi?"**

3. **Masukkan email yang terdaftar**

4. **Cek inbox email Anda**
   - Email akan masuk dalam 1-2 menit
   - Jika tidak ada, cek folder **Spam/Junk**

5. **Klik link di email**
   - Link berlaku selama **1 jam**
   - Link hanya bisa digunakan **1 kali**

6. **Masukkan password baru**
   - Minimal 6 karakter
   - Konfirmasi password harus sama

7. **Login dengan password baru**

---

## 4. Troubleshooting

### ❌ Error: "Invalid login: 535-5.7.8 Username and Password not accepted"

**Penyebab:** App Password salah atau belum diaktifkan

**Solusi:**
- Pastikan menggunakan **App Password**, bukan password email biasa
- Generate ulang App Password
- Pastikan tidak ada spasi di App Password
- Untuk Gmail, pastikan 2-Step Verification sudah aktif

---

### ❌ Email tidak terkirim / tidak masuk

**Solusi:**
1. Cek console/terminal untuk error
2. Cek folder Spam/Junk di email
3. Pastikan koneksi internet stabil
4. Cek konfigurasi `.env` sudah benar
5. Test dengan email lain

---

### ❌ Error: "getaddrinfo ENOTFOUND smtp.gmail.com"

**Penyebab:** Koneksi internet bermasalah atau firewall memblokir

**Solusi:**
- Pastikan koneksi internet aktif
- Cek firewall/antivirus
- Coba restart aplikasi

---

### ❌ Link reset password expired

**Penyebab:** Link sudah lebih dari 1 jam atau sudah digunakan

**Solusi:**
- Kembali ke halaman lupa password
- Request link baru
- Gunakan link dalam 1 jam

---

### ❌ Token tidak valid

**Penyebab:** Token sudah digunakan atau tidak ada di database

**Solusi:**
- Request link reset password baru
- Jangan gunakan link yang sama 2 kali

---

## 📝 Catatan Penting

### Keamanan

✅ **DO:**
- Gunakan App Password, bukan password email asli
- Simpan `.env` di `.gitignore`
- Gunakan HTTPS di production
- Set token expiry yang wajar (default: 1 jam)

❌ **DON'T:**
- Jangan commit `.env` ke Git
- Jangan share App Password
- Jangan gunakan password email biasa
- Jangan set expiry terlalu lama

---

### Maintenance

**Bersihkan token expired secara berkala:**

```sql
-- Hapus token yang sudah expired (lebih dari 24 jam)
DELETE FROM password_reset_tokens 
WHERE expires_at < DATE_SUB(NOW(), INTERVAL 24 HOUR);

-- Atau buat cron job untuk auto-cleanup
```

---

## 🎨 Fitur yang Sudah Diimplementasi

✅ Halaman lupa password dengan tema hijau SIBUDI
✅ Pengiriman email dengan template HTML profesional
✅ Token unik dengan expiry 1 jam
✅ Validasi email untuk user dan member
✅ Halaman reset password dengan validasi
✅ Password hashing dengan bcrypt
✅ Popup notifikasi sukses/error
✅ Responsive design (mobile & desktop)
✅ Support Gmail & Outlook

---

## 📞 Support

Jika masih ada masalah, cek:
- Console browser (F12) untuk error frontend
- Terminal/console untuk error backend
- Log email di console

---

**Dibuat untuk SIBUDI - Sistem Peminjaman dan Perpanjangan Buku Mandiri Unand**
