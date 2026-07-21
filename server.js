const express = require("express");
const path = require("path");
const helmet = require("helmet");
const bcrypt = require("bcrypt");
const session = require("express-session");
const { body, validationResult } = require("express-validator");

require("dotenv").config();

const pool = require("./db");
const pgSession = require("connect-pg-simple")(session);

const app = express();
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

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
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
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

function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  next();
}

app.get("/auth-status", (req, res) => {
  res.set("Cache-Control", "no-store");

  res.json({
    loggedIn: Boolean(req.session.userId),
    username: req.session.username || null,
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
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
      return res.status(500).send("The account could not be created.");
    }
  }
);

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "login.html"));
});

app.post(
  "/login",
  [
    body("email").trim().isEmail().normalizeEmail(),
    body("password").notEmpty(),
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

      req.session.regenerate((regenerateError) => {
        if (regenerateError) {
          console.error("Session regeneration error:", regenerateError);

          return res
            .status(500)
            .send("The login session could not be created.");
        }

        req.session.userId = user.id;
        req.session.username = user.username;

        req.session.save((saveError) => {
          if (saveError) {
            console.error("Session save error:", saveError);

            return res
              .status(500)
              .send("Login succeeded, but the session could not be saved.");
          }

          return res.redirect("/submit-review");
        });
      });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).send("The login request could not be completed.");
    }
  }
);

app.post("/logout", (req, res) => {
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

app.get("/submit-review", requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "views", "submit-review.html"));
});

app.post(
  "/submit-review",
  requireLogin,
  [
    body("landlord_name")
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage("Landlord name must be between 2 and 100 characters."),

    body("property_address")
      .trim()
      .isLength({ min: 5, max: 200 })
      .withMessage("Property address must be between 5 and 200 characters."),

    body("rating")
      .isInt({ min: 1, max: 5 })
      .withMessage("Rating must be between 1 and 5."),

    body("review_text")
      .trim()
      .isLength({ min: 10, max: 1000 })
      .withMessage("Review must be between 10 and 1000 characters."),
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

    let client;

    try {
      client = await pool.connect();

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

      return res.redirect("/reviews");
    } catch (error) {
      if (client) {
        await client.query("ROLLBACK");
      }

      console.error("Review submission error:", error);

      return res.status(500).send("The review could not be submitted.");
    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

app.get("/reviews/:id/edit", requireLogin, async (req, res) => {
  const reviewId = Number(req.params.id);

  if (!Number.isInteger(reviewId) || reviewId < 1) {
    return res.status(400).send("Invalid review ID.");
  }

  try {
    const result = await pool.query(
      `SELECT
         reviews.id AS review_id,
         reviews.rating,
         reviews.review_text,
         landlords.landlord_name,
         landlords.property_address
       FROM reviews
       INNER JOIN landlords
         ON reviews.landlord_id = landlords.id
       WHERE reviews.id = $1
         AND reviews.user_id = $2`,
      [reviewId, req.session.userId]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .send("Review not found, or you do not have permission to edit it.");
    }

    const review = result.rows[0];

    const ratingOptions = [1, 2, 3, 4, 5]
      .map((ratingNumber) => {
        const selected =
          Number(review.rating) === ratingNumber
            ? "selected"
            : "";

        return `
          <option
            value="${ratingNumber}"
            ${selected}
          >
            ${ratingNumber} Star${ratingNumber === 1 ? "" : "s"}
          </option>
        `;
      })
      .join("");

    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        >

        <title>Edit Review | RentReview</title>

        <link
          rel="stylesheet"
          href="/style.css"
        >
      </head>

      <body>
        <nav class="site-nav">
          <a class="site-logo" href="/">
            <span class="logo-icon" aria-hidden="true">⌂</span>
            <span>RentReview</span>
          </a>

          <div class="nav-links">
            <a href="/">Home</a>
            <a href="/reviews">Reviews</a>
            <a href="/submit-review">Submit Review</a>

            <button
              id="logout-button"
              class="nav-button"
              type="button"
            >
              Logout
            </button>
          </div>
        </nav>

        <main class="submit-review-page">
          <section class="submit-review-card">
            <div class="submit-review-heading">
              <p class="eyebrow">
                UPDATE YOUR EXPERIENCE
              </p>

              <h1>Edit Review</h1>

              <p class="submit-review-description">
                Update the landlord, property, rating, or review
                information below.
              </p>
            </div>

            <form
              class="submit-review-form"
              action="/reviews/${review.review_id}/edit"
              method="POST"
            >
              <div class="form-group">
                <label for="landlord_name">
                  Landlord name
                </label>

                <input
                  id="landlord_name"
                  name="landlord_name"
                  type="text"
                  minlength="2"
                  maxlength="100"
                  value="${escapeHtml(review.landlord_name)}"
                  required
                >
              </div>

              <div class="form-group">
                <label for="property_address">
                  Property address
                </label>

                <input
                  id="property_address"
                  name="property_address"
                  type="text"
                  minlength="5"
                  maxlength="200"
                  value="${escapeHtml(review.property_address)}"
                  required
                >
              </div>

              <div class="form-group">
                <label for="rating">
                  Rating
                </label>

                <select
                  id="rating"
                  name="rating"
                  required
                >
                  ${ratingOptions}
                </select>
              </div>

              <div class="form-group">
                <label for="review_text">
                  Review description
                </label>

                <textarea
                  id="review_text"
                  name="review_text"
                  minlength="10"
                  maxlength="1000"
                  required
                >${escapeHtml(review.review_text)}</textarea>

                <p class="field-help">
                  Enter between 10 and 1000 characters.
                </p>
              </div>

              <div class="edit-form-actions">
                <button
                  class="primary-button form-submit-button"
                  type="submit"
                >
                  Save Changes
                </button>

                <a
                  class="secondary-button form-cancel-button"
                  href="/reviews"
                >
                  Cancel
                </a>
              </div>
            </form>
          </section>
        </main>

        <footer class="site-footer">
          <p>
            RentReview helps renters make informed housing decisions.
          </p>
        </footer>

        <script src="/script.js" defer></script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Edit review page error:", error);

    return res.status(500).send(
      "The review editing page could not be loaded."
    );
  }
});

app.post(
  "/reviews/:id/edit",
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
      .withMessage(
        "Rating must be between 1 and 5."
      ),

    body("review_text")
      .trim()
      .isLength({ min: 10, max: 1000 })
      .withMessage(
        "Review must be between 10 and 1000 characters."
      ),
  ],
  async (req, res) => {
    const reviewId = Number(req.params.id);

    if (!Number.isInteger(reviewId) || reviewId < 1) {
      return res.status(400).send("Invalid review ID.");
    }

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).send(
        errors.array()[0].msg
      );
    }

    const {
      landlord_name,
      property_address,
      rating,
      review_text,
    } = req.body;

    let client;

    try {
      client = await pool.connect();

      await client.query("BEGIN");

      const ownedReview = await client.query(
        `SELECT landlord_id
         FROM reviews
         WHERE id = $1
           AND user_id = $2
         FOR UPDATE`,
        [reviewId, req.session.userId]
      );

      if (ownedReview.rows.length === 0) {
        await client.query("ROLLBACK");

        return res
          .status(404)
          .send(
            "Review not found, or you do not have permission to edit it."
          );
      }

      const landlordId =
        ownedReview.rows[0].landlord_id;

      await client.query(
        `UPDATE landlords
         SET landlord_name = $1,
             property_address = $2
         WHERE id = $3`,
        [
          landlord_name,
          property_address,
          landlordId,
        ]
      );

      await client.query(
        `UPDATE reviews
         SET rating = $1,
             review_text = $2
         WHERE id = $3
           AND user_id = $4`,
        [
          Number(rating),
          review_text,
          reviewId,
          req.session.userId,
        ]
      );

      await client.query("COMMIT");

      return res.redirect("/reviews");
    } catch (error) {
      if (client) {
        await client.query("ROLLBACK");
      }

      console.error("Review update error:", error);

      return res.status(500).send(
        "The review could not be updated."
      );
    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

app.post(
  "/reviews/:id/delete",
  requireLogin,
  async (req, res) => {
    const reviewId = Number(req.params.id);

    if (!Number.isInteger(reviewId) || reviewId < 1) {
      return res.status(400).send("Invalid review ID.");
    }

    let client;

    try {
      client = await pool.connect();

      await client.query("BEGIN");

      const deletedReview = await client.query(
        `DELETE FROM reviews
         WHERE id = $1
           AND user_id = $2
         RETURNING landlord_id`,
        [reviewId, req.session.userId]
      );

      if (deletedReview.rows.length === 0) {
        await client.query("ROLLBACK");

        return res
          .status(404)
          .send(
            "Review not found, or you do not have permission to delete it."
          );
      }

      const landlordId =
        deletedReview.rows[0].landlord_id;

      await client.query(
        `DELETE FROM landlords
         WHERE id = $1
           AND NOT EXISTS (
             SELECT 1
             FROM reviews
             WHERE landlord_id = $1
           )`,
        [landlordId]
      );

      await client.query("COMMIT");

      return res.redirect("/reviews");
    } catch (error) {
      if (client) {
        await client.query("ROLLBACK");
      }

      console.error("Review deletion error:", error);

      return res.status(500).send(
        "The review could not be deleted."
      );
    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

app.get("/reviews", async (req, res) => {
  try {
    const result = await pool.query(`
        SELECT
            reviews.id AS review_id,
            reviews.user_id,
            landlords.id AS landlord_id,
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
    const isLoggedIn = Boolean(req.session.userId);

    const accountLinks = isLoggedIn
      ? `
        <span id="logged-in-links">
          <a href="/submit-review">Submit Review</a>

          <button
            id="logout-button"
            class="nav-button"
            type="button"
          >
            Logout
          </button>
        </span>
      `
      : `
        <span id="logged-out-links">
          <a href="/register">Register</a>
          <a href="/login">Login</a>
        </span>
      `;

    const reviewCards = result.rows
      .map((review) => {
        const rating = Number(review.rating);

        const stars =
          "★".repeat(rating) +
          "☆".repeat(5 - rating);

        const userOwnsReview =
            isLoggedIn &&
            Number(review.user_id) === Number(req.session.userId);

        const searchableText = escapeHtml(
          `${review.landlord_name} ${review.property_address} ${review.review_text} ${review.username}`
        ).toLowerCase();

        return `
          <article
            class="review-card"
            data-rating="${rating}"
            data-search="${searchableText}"
          >
            <div class="review-card-header">
              <div>
                <p class="review-label">
                  Landlord
                </p>

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
              <span class="property-icon" aria-hidden="true">
                ⌂
              </span>

              <span>
                ${escapeHtml(review.property_address)}
              </span>
            </div>

            <p class="review-text">${escapeHtml(review.review_text)}</p>

            ${
            userOwnsReview
                ? `
                <div class="review-actions">
                    <a
                    class="secondary-button review-action-button"
                    href="/reviews/${review.review_id}/edit"
                    >
                    Edit Review
                    </a>

                    <form
                    action="/reviews/${review.review_id}/delete"
                    method="POST"
                    class="delete-review-form"
                    >
                    <button
                        class="danger-button review-action-button"
                        type="submit"
                    >
                        Delete Review
                    </button>
                    </form>
                </div>
                `
                : ""
            }

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

    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        >

        <title>Landlord Reviews | RentReview</title>

        <link
          rel="stylesheet"
          href="/style.css"
        >
      </head>

      <body>
        <nav class="site-nav">
          <a class="site-logo" href="/">
            <span class="logo-icon" aria-hidden="true">⌂</span>
            <span>RentReview</span>
          </a>

          <div class="nav-links">
            <a href="/">Home</a>
            <a href="/reviews">Reviews</a>
            ${accountLinks}
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
              class="secondary-button clear-filters-button"
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

              <h2>
                Recent landlord reviews
              </h2>
            </div>

            <p
              id="review-count"
              class="review-count"
            ></p>
          </section>

          <section
            class="reviews-grid"
            id="reviews-grid"
          >
            ${
              reviewCards ||
              `
                <div class="empty-state">
                  <h2>No reviews yet</h2>

                  <p>
                    Be the first person to share a rental experience.
                  </p>

                  ${
                    isLoggedIn
                      ? `
                        <a
                          class="primary-button"
                          href="/submit-review"
                        >
                          Submit a Review
                        </a>
                      `
                      : `
                        <a
                          class="primary-button"
                          href="/register"
                        >
                          Create an Account
                        </a>
                      `
                  }
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
            RentReview helps renters make informed housing decisions.
          </p>
        </footer>

        <script src="/script.js" defer></script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Review display error:", error);
    return res.status(500).send("The reviews could not be loaded.");
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});