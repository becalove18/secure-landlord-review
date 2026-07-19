const express = require("express");
const path = require("path");
const helmet = require("helmet");
require("dotenv").config();

const pool = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

const bcrypt = require("bcrypt");
const { body, validationResult } = require("express-validator");

app.use(helmet());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.send("<h1>Secure Landlord Rating Website</h1>");
});

app.get("/database-test", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.send(
      `Database connected successfully. PostgreSQL time: ${result.rows[0].now}`
    );
  } catch (error) {
    console.error("Database connection failed:", error);
    res.status(500).send("Database connection failed.");
  }
});

app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "register.html"));
});

app.post(
  "/register",
  [
    body("username")
      .trim()
      .isLength({ min: 3, max: 50 })
      .withMessage("Username must be between 3 and 50 characters."),

    body("email")
      .trim()
      .isEmail()
      .withMessage("Enter a valid email address.")
      .normalizeEmail(),

    body("password")
      .isLength({ min: 8, max: 72 })
      .withMessage("Password must be between 8 and 72 characters."),
  ],
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).send(errors.array()[0].msg);
    }

    const { username, email, password } = req.body;

    try {
      const existingUser = await pool.query(
        "SELECT id FROM users WHERE username = $1 OR email = $2",
        [username, email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).send(
          "That username or email address is already registered."
        );
      }

      const passwordHash = await bcrypt.hash(password, 12);

      await pool.query(
        `INSERT INTO users
         (username, email, password_hash)
         VALUES ($1, $2, $3)`,
        [username, email, passwordHash]
      );

      res.redirect("/login");
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).send("The account could not be created.");
    }
  }
);

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "login.html"));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});