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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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

app.post(
  "/submit-review",
  requireLogin,
  [
    body("landlord_name")
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage(
        "Landlord name must be between 2 and 100 characters."
      ),

    body("property_address")
      .trim()
      .isLength({ min: 5, max: 200 })
      .withMessage(
        "Property address must be between 5 and 200 characters."
      ),

    body("rating")
      .isInt({ min: 1, max: 5 })
      .withMessage("Rating must be between 1 and 5."),

    body("review_text")
      .trim()
      .isLength({ min: 10, max: 1000 })
      .withMessage(
        "Review must be between 10 and 1000 characters."
      ),
  ],
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).send(errors.array()[0].msg);
    }

    const {
      landlord_name,
      property_address,
      rating,
      review_text,
    } = req.body;

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const landlordResult = await client.query(
        `INSERT INTO landlords
         (landlord_name, property_address)
         VALUES ($1, $2)
         RETURNING id`,
        [landlord_name, property_address]
      );

      const landlordId = landlordResult.rows[0].id;

      await client.query(
        `INSERT INTO reviews
         (user_id, landlord_id, rating, review_text)
         VALUES ($1, $2, $3, $4)`,
        [
          req.session.userId,
          landlordId,
          Number(rating),
          review_text,
        ]
      );

      await client.query("COMMIT");

      res.redirect("/reviews");
    } catch (error) {
      await client.query("ROLLBACK");

      console.error("Review submission error:", error);

      res.status(500).send(
        "The review could not be submitted."
      );
    } finally {
      client.release();
    }
  }
);

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

app.get("/reviews", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        landlords.landlord_name,
        landlords.property_address,
        reviews.rating,
        reviews.review_text,
        reviews.created_at,
        users.username
      FROM reviews
      INNER JOIN landlords
        ON reviews.landlord_id = landlords.id
      INNER JOIN users
        ON reviews.user_id = users.id
      ORDER BY reviews.created_at DESC
    `);

    const reviewCards = result.rows
      .map((review) => {
        const rating = Number(review.rating);

        const stars =
          "★".repeat(rating) +
          "☆".repeat(5 - rating);

        return `
          <article
            class="review-card"
            data-rating="${rating}"
            data-search="${escapeHtml(
              `${review.landlord_name} ${review.property_address} ${review.review_text} ${review.username}`
            ).toLowerCase()}"
          >
            <div class="review-card-header">
              <div>
                <p class="review-label">Landlord</p>

                <h2>
                  ${escapeHtml(review.landlord_name)}
                </h2>
              </div>

              <div
                class="star-rating"
                aria-label="${rating} out of 5 stars"
              >
                ${stars}
              </div>
            </div>

            <div class="property-address">
              <span class="property-icon">⌂</span>

              <span>
                ${escapeHtml(review.property_address)}
              </span>
            </div>

            <p class="review-text">
              ${escapeHtml(review.review_text)}
            </p>

            <div class="review-footer">
              <span>
                Posted by
                <strong>
                  ${escapeHtml(review.username)}
                </strong>
              </span>

              <span>
                ${escapeHtml(
                  new Date(review.created_at).toLocaleDateString(
                    "en-US",
                    {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }
                  )
                )}
              </span>
            </div>
          </article>
        `;
      })
      .join("");

    res.send(`
      <!DOCTYPE html>

      <html lang="en">
      <head>
        <meta charset="UTF-8">

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        >

        <title>Landlord Reviews</title>

        <link rel="stylesheet" href="/style.css">
      </head>

      <body>
        <nav class="site-nav">
          <a class="site-logo" href="/">
            RentReview
          </a>

          <div class="nav-links">
            <a href="/">Home</a>
            <a href="/reviews">Reviews</a>
            <a href="/submit-review">Submit Review</a>
            <a href="/register">Register</a>
            <a href="/login">Login</a>
            <a class="logout-link" href="/logout">Logout</a>
          </div>
        </nav>

        <header class="reviews-hero">
          <div class="hero-content">
            <p class="eyebrow">
              RENTAL TRANSPARENCY
            </p>

            <h1>
              Find a landlord you can trust.
            </h1>

            <p class="hero-description">
              Read rental experiences from other tenants and
              make a more informed housing decision.
            </p>
          </div>
        </header>

        <main class="reviews-page">
          <section class="review-controls">
            <div class="search-field">
              <label for="review-search">
                Search reviews
              </label>

              <input
                id="review-search"
                type="search"
                placeholder="Search landlord, property, or review..."
              >
            </div>

            <div class="filter-field">
              <label for="rating-filter">
                Minimum rating
              </label>

              <select id="rating-filter">
                <option value="0">All ratings</option>
                <option value="5">5 stars</option>
                <option value="4">4 stars and up</option>
                <option value="3">3 stars and up</option>
                <option value="2">2 stars and up</option>
                <option value="1">1 star and up</option>
              </select>
            </div>

            <button
              class="clear-filters-button"
              id="clear-filters"
              type="button"
            >
              Clear filters
            </button>
          </section>

          <section class="reviews-heading">
            <div>
              <p class="section-label">
                COMMUNITY REVIEWS
              </p>

              <h2>Recent landlord reviews</h2>
            </div>

            <p id="review-count" class="review-count"></p>
          </section>

          <section class="reviews-grid" id="reviews-grid">
            ${
              reviewCards ||
              `
                <div class="empty-state">
                  <h2>No reviews yet</h2>

                  <p>
                    Be the first person to share a rental
                    experience.
                  </p>

                  <a
                    class="primary-button"
                    href="/submit-review"
                  >
                    Submit a review
                  </a>
                </div>
              `
            }
          </section>

          <section
            class="no-results"
            id="no-results"
            hidden
          >
            <h2>No matching reviews</h2>

            <p>
              Try changing your search term or rating filter.
            </p>
          </section>
        </main>

        <footer class="site-footer">
          <p>
            RentReview helps renters make informed housing
            decisions.
          </p>
        </footer>

        <script src="/script.js"></script>
        
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Review display error:", error);

    res.status(500).send(
      "The reviews could not be loaded."
    );
  }
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