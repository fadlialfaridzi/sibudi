/**
 * ==========================================================
 * middleware/security.js
 * Middleware keamanan & performa global untuk aplikasi SiBuDi
 * ==========================================================
 *
 * 🔒 Fitur:
 * - Helmet (CSP + HTTP security headers)
 * - Compression (optimasi performa)
 * - RateLimiter (proteksi brute force)
 *
 * ⚙️ Catatan:
 * - Saat development, CSP dilonggarkan agar tidak memblokir CDN (Tailwind, FontAwesome, Preline).
 * - Saat production, CSP diperketat otomatis.
 * ==========================================================
 */

const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

module.exports = (app) => {
  const isDev = process.env.NODE_ENV !== "production";

  // =====================================================
  // 1️⃣ Content Security Policy (CSP)
  // =====================================================
  const cspDirectives = {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      "'unsafe-inline'", // dibutuhkan untuk Tailwind/Preline
      "https://cdn.tailwindcss.com",
      "https://cdn.jsdelivr.net",
      "https://cdnjs.cloudflare.com",
      "https://unpkg.com",
      "https://preline.co",
      "https://kit.fontawesome.com",
      // API / Tracking
      "https://www.googletagmanager.com",
      "https://maps.googleapis.com",
      "https://maps.gstatic.com",
      "https://www.google.com",
      // Library animasi / 3D
      "https://cdn.jsdelivr.net/npm",
      "https://unpkg.com/gsap",
      "https://cdnjs.cloudflare.com/ajax/libs/gsap/",
      "https://assets.lottiefiles.com",
    ],
    styleSrc: [
      "'self'",
      "'unsafe-inline'", // dibutuhkan agar Tailwind, FontAwesome, Preline bisa jalan
      "https://fonts.googleapis.com",
      "https://cdn.jsdelivr.net",
      "https://cdnjs.cloudflare.com",
      "https://unpkg.com",
      "https://preline.co",
      "https://kit-free.fontawesome.com",  
      "https://ka-f.fontawesome.com", 
    ],
    fontSrc: [
      "'self'",
      "data:",
      "https://fonts.gstatic.com",
      "https://cdnjs.cloudflare.com",
      "https://ka-f.fontawesome.com", 
    ],
    imgSrc: [
      "'self'",
      "data:",
      "blob:",
      "https://*",
      "https://assets.lottiefiles.com",
      
    ],
    connectSrc: ["'self'", "https://*", "blob:", "data:"],
    frameSrc: [
      "'self'",
      "https://www.google.com",
      "https://maps.google.com",
      "https://maps.gstatic.com",
      "https://lottiefiles.com",
    ],
    objectSrc: ["'none'"],
    workerSrc: ["'self'", "blob:"],
    mediaSrc: ["'self'", "blob:", "data:", "https://*"],
  };

  // =====================================================
  // ⚙️ Mode Development → CSP dilonggarkan
  // =====================================================
  if (isDev) {
    console.warn("⚠️ [CSP] Mode DEVELOPMENT aktif (CSP longgar).");
    cspDirectives.scriptSrc.push("'unsafe-eval'");
    cspDirectives.styleSrc.push("'unsafe-inline'");
    cspDirectives.fontSrc.push("https://cdn.jsdelivr.net");
    cspDirectives.styleSrc.push("https://fonts.googleapis.com");
  } else {
    console.log("✅ [CSP] Mode PRODUCTION aktif (CSP ketat).");
  }

  // =====================================================
  // 2️⃣ Aktifkan Helmet + CSP
  // =====================================================
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: cspDirectives,
      },
      crossOriginEmbedderPolicy: false, // wajib utk asset 3D / fetch blob
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  // =====================================================
  // 3️⃣ Compression — optimasi performa
  // =====================================================
  app.use(compression());

  // =====================================================
  // 4️⃣ Rate limiter — proteksi brute-force login
  // =====================================================
  const loginLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 menit
    max: 100,
    message:
      "⚠️ Terlalu banyak percobaan login dari IP ini. Coba lagi nanti.",
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use("/login", loginLimiter);
};
