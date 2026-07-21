const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
  return res.render("index", {
    isLoggedIn: Boolean(req.session.userId),
  });
});

module.exports = router;