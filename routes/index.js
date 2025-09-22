var express = require("express");
var router = express.Router();

/* GET home page. */
router.get("/", function (req, res, next) {
  res.render("index", { title: "SIBUDI" });
});

/* GET peminjaman page. */
router.get("/peminjaman", function (req, res, next) {
  res.render("peminjaman", { title: "Peminjaman Buku" });
});

/* GET peminjaman page. */
router.get("/testing", function (req, res, next) {
  res.render("error", { title: "Testing Peminjaman Buku" });
});

module.exports = router;
