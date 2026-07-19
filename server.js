const express = require("express");
const path = require("path");
const helmet = require("helmet");
require("dotenv").config();

const pool = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

const bcrypt = require("bcrypt");
const { body, validationResult } = require("express-validator");

const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);

app.use(helmet());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    store: new pgSession({
      pool,
      tableName: "session",
      createTableIfMissing: true,
    }),

    secret: process.env.SESSION_SECRET,

    resave: false,

    saveUninitialized: false,

    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      maxAge: 1000 * 60 * 60,
    },
  })
);

app.post(
  "/login",
  [
    body("email")
      .trim()
      .isEmail()
      .normalizeEmail(),

    body("password")
      .notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).send("Invalid login information.");
    }

    const { email, password } = req.body;

    try {
      const result = await pool.query(
        `SELECT id, username, email, password_hash
         FROM users
         WHERE email = $1`,
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).send("Invalid email or password.");
      }

      const user = result.rows[0];

      const passwordMatches = await bcrypt.compare(
        password,
        user.password_hash
      );

      if (!passwordMatches) {
        return res.status(401).send("Invalid email or password.");
      }

      req.session.userId = user.id;
      req.session.username = user.username;

      res.redirect("/submit-review");
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).send("The login request could not be completed.");
    }
  }
);

function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  next();
}

app.get("/submit-review", requireLogin, (req, res) => {
  res.sendFile(
    path.join(__dirname, "views", "submit-review.html")
  );
});

app.get("/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error("Logout error:", error);
      return res.status(500).send("The logout request failed.");
    }

    res.clearCookie("connect.sid");
    res.redirect("/");
  });
});

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "views", "index.html")
  );
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