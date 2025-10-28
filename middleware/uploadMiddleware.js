// middleware/uploadMiddleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Pastikan folder uploads/profiles exist
const uploadDir = path.join(__dirname, '../public/uploads/profiles');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Konfigurasi storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Gunakan nama asli file dengan timestamp untuk menghindari duplicate
        const originalName = file.originalname;
        const ext = path.extname(originalName);
        const nameWithoutExt = path.basename(originalName, ext);
        const timestamp = Date.now();
        
        // Format: namafile_timestamp.ext
        const fileName = `${nameWithoutExt}_${timestamp}${ext}`;
        cb(null, fileName);
    }
});

// Filter file - hanya terima image
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Hanya file gambar (JPG, PNG, GIF) yang diperbolehkan!'));
    }
};

// Konfigurasi multer
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 2 * 1024 * 1024 // 2MB dalam bytes
    },
    fileFilter: fileFilter
});

// Middleware untuk handle error upload
const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            req.flash('error', 'Ukuran file terlalu besar! Maksimal 2MB.');
            return res.redirect('/outside/editProfile');
        }
        req.flash('error', 'Terjadi kesalahan saat mengunggah file.');
        return res.redirect('/outside/editProfile');
    } else if (err) {
        req.flash('error', err.message || 'Format file tidak didukung!');
        return res.redirect('/outside/editProfile');
    }
    next();
};

module.exports = {
    upload,
    handleUploadError
};