const express = require("express");
const bcrypt = require("bcrypt");

const pool = require("../db");

const {
  registerValidation,
  loginValidation,
  handleValidationErrors,
} = require("../middleware/validation");

const router = express.Router();

router.get("/auth-status", (req, res) => {
  res.set("Cache-Control", "no-store");

  return res.json({
    loggedIn: Boolean(req.session.userId),
    username: req.session.username || null,
  });
});

router.get("/register", (req, res) => {
  if (req.session.userId) {
    return res.redirect("/profile");
  }

  return res.render("register", {
    isLoggedIn: false,
  });
});

router.post(
  "/register",
  registerValidation,
  handleValidationErrors,
  async (req, res) => {
    const { username, email, password } = req.body;

    try {
      const existingUser = await pool.query(
        `SELECT id
         FROM users
         WHERE username = $1 OR email = $2`,
        [username, email]
      );

      if (existingUser.rows.length > 0) {
        return res
          .status(409)
          .send("That username or email address is already registered.");
      }

      const passwordHash = await bcrypt.hash(password, 12);

      await pool.query(
        `INSERT INTO users
         (username, email, password_hash)
         VALUES ($1, $2, $3)`,
        [username, email, passwordHash]
      );

      return res.redirect("/login");
    } catch (error) {
      console.error("Registration error:", error);

      return res.status(500).send(
        "The account could not be created."
      );
    }
  }
);

router.get("/login", (req, res) => {
  if (req.session.userId) {
    return res.redirect("/profile");
  }

  return res.render("login", {
    isLoggedIn: false,
  });
});

router.post(
  "/login",
  loginValidation,
  handleValidationErrors,
  async (req, res) => {
    const { email, password } = req.body;

    try {
      const result = await pool.query(
        `SELECT id, username, email, password_hash
         FROM users
         WHERE email = $1`,
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).send(
          "Invalid email or password."
        );
      }

      const user = result.rows[0];

      const passwordMatches = await bcrypt.compare(
        password,
        user.password_hash
      );

      if (!passwordMatches) {
        return res.status(401).send(
          "Invalid email or password."
        );
      }

      req.session.regenerate((regenerateError) => {
        if (regenerateError) {
          console.error(
            "Session regeneration error:",
            regenerateError
          );

          return res
            .status(500)
            .send("The login session could not be created.");
        }

        req.session.userId = user.id;
        req.session.username = user.username;

        req.session.save((saveError) => {
          if (saveError) {
            console.error(
              "Session save error:",
              saveError
            );

            return res
              .status(500)
              .send(
                "Login succeeded, but the session could not be saved."
              );
          }

          return res.redirect("/profile");
        });
      });
    } catch (error) {
      console.error("Login error:", error);

      return res.status(500).send(
        "The login request could not be completed."
      );
    }
  }
);

router.post("/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error("Logout error:", error);

      return res.status(500).json({
        message: "Unable to log out.",
      });
    }

    res.clearCookie("connect.sid", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    return res.json({
      message: "Logged out successfully.",
    });
  });
});

module.exports = router;