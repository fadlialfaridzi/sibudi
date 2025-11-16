# 🚀 PANDUAN LENGKAP DEPLOY SIBUDI DI RAILWAY

## ✅ PERSIAPAN SEBELUM DEPLOY

### 1. PASTIKAN PROJECT SUDAH DI GITHUB
Jika belum push ke GitHub, jalankan command ini di terminal:
```bash
git add .
git commit -m "Prepare for Railway deployment"
git push origin main
```

## 📋 LANGKAH-LANGKAH DEPLOY:

### STEP 1: SIGNUP & LOGIN RAILWAY
1. Buka https://railway.app
2. Klik **"Login"** → **"Login with GitHub"**
3. Authorize Railway untuk akses repository

### STEP 2: CREATE NEW PROJECT  
1. Klik **"New Project"**
2. Pilih **"Deploy from GitHub repo"**
3. Pilih repository **"sibudi"**
4. Klik **"Deploy Now"**

### STEP 3: SETUP DATABASE MYSQL
1. Di Railway dashboard project, klik **"+ New"**
2. Pilih **"Database"** → **"Add MySQL"**
3. Tunggu database provisioning selesai
4. Klik database yang baru dibuat
5. Masuk ke tab **"Connect"** 
6. Copy informasi koneksi:
   - **HOST**: `containers-us-west-xxx.railway.app`
   - **PORT**: `6543` (contoh)
   - **USERNAME**: `root`
   - **PASSWORD**: `xxx` (auto generate)
   - **DATABASE**: `railway`

### STEP 4: IMPORT DATABASE SLIMS
1. Download **Railway CLI** di https://docs.railway.app/develop/cli
2. Install dan login:
   ```bash
   railway login
   ```
3. Connect ke project:
   ```bash
   railway link [project-id]
   ```
4. Import database SLiMS Anda:
   ```bash
   railway connect mysql
   ```
5. Di MySQL prompt, import database:
   ```sql
   SOURCE /path/to/slims_database.sql;
   ```

### STEP 5: SETUP ENVIRONMENT VARIABLES
1. Di Railway dashboard, klik service **"sibudi"**
2. Masuk tab **"Variables"**
3. Tambahkan variable berikut:

```env
NODE_ENV=production
PORT=$PORT
DB_HOST=[mysql-host-dari-railway]
DB_PORT=[mysql-port-dari-railway]  
DB_USER=root
DB_PASS=[mysql-password-dari-railway]
DB_NAME=railway
SESSION_SECRET=sibudi_railway_secret_unand_2024
EMAIL_SERVICE=gmail
EMAIL_USER=afiqjakhel26@gmail.com
EMAIL_PASS=irmzjoabnvmydtel
```

### STEP 6: DEPLOY & TEST
1. Railway akan auto-deploy setelah environment variables di-set
2. Tunggu deployment selesai (biasanya 2-3 menit)
3. Klik **"Open App"** untuk test aplikasi
4. Test login:
   - **Admin/Pustakawan**: dari tabel `user` database SLiMS
   - **Mahasiswa**: dari tabel `member` database SLiMS

### STEP 7: SETUP CUSTOM DOMAIN
1. Di Railway dashboard, masuk tab **"Settings"**
2. Scroll ke **"Domains"**
3. Klik **"Custom Domain"**
4. Masukkan: `ridhodwisyahputra.my.id`
5. Copy **CNAME record** yang diberikan Railway
6. Masuk ke domain provider (tempat beli domain)
7. Tambah CNAME record:
   - **Name**: `@` atau kosong
   - **Value**: `xxx.up.railway.app` (dari Railway)
8. Tunggu DNS propagation (5-30 menit)

## 🔧 TROUBLESHOOTING

### Database Connection Error:
- Pastikan environment variables benar
- Cek database MySQL sudah running di Railway
- Test koneksi dengan Railway CLI

### Module Error:
- Railway auto-install dependencies dari package.json
- Pastikan package.json valid

### Session Error:
- Ganti SESSION_SECRET dengan string random yang kuat
- Pastikan Redis/session store working

### File Upload Error:
- Railway support persistent volumes
- Pastikan folder `public/uploads` ada

## 🎯 HASIL AKHIR:

✅ **Website live**: `https://ridhodwisyahputra.my.id`
✅ **Database MySQL cloud** dengan data SLiMS
✅ **Auto deploy** dari GitHub
✅ **SSL certificate** gratis
✅ **Custom domain** aktif
✅ **24/7 uptime**

## 💰 BIAYA:
- **Gratis** untuk usage normal
- **$5/bulan** jika exceed free tier (unlikely untuk SIBUDI)

## ⚠️ CATATAN PENTING:
1. **Backup database** sebelum import ke Railway
2. **Test semua fitur** setelah deploy
3. **Monitor usage** di Railway dashboard
4. **Keep GitHub repo updated** untuk auto-deploy

---

**Selesai! SIBUDI siap diakses online 24/7** 🎉