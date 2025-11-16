@echo off
echo ================================================
echo    EXPORT DATABASE SLiMS UNTUK RAILWAY
echo ================================================
echo.

REM Set database credentials (sesuaikan dengan .env Anda)
set DB_HOST=127.0.0.1
set DB_USER=root
set DB_PASS=
set DB_NAME=slims

echo Mengexport database %DB_NAME%...
echo.

REM Export database ke file SQL
mysqldump -h %DB_HOST% -u %DB_USER% %DB_NAME% > slims_backup_for_railway.sql

if %ERRORLEVEL% EQU 0 (
    echo ✅ SUCCESS! Database berhasil diexport ke: slims_backup_for_railway.sql
    echo.
    echo File ini siap untuk diimport ke Railway MySQL database
    echo.
    echo Langkah selanjutnya:
    echo 1. Upload file ini ke Railway melalui CLI
    echo 2. Atau copy-paste isi file ke Railway database console
) else (
    echo ❌ ERROR! Gagal export database
    echo.
    echo Pastikan:
    echo - MySQL server running
    echo - Database credentials benar
    echo - mysqldump tersedia di PATH
)

echo.
pause