const express = require("express");
const path = require("path");
const helmet = require("helmet");
const bcrypt = require("bcrypt");
const session = require("express-session");

require("dotenv").config();

const pool = require("./db");
const pgSession = require("connect-pg-simple")(session);

const { requireLogin } = require("./middleware/auth");

const {
  validateReviewId,
  requireReviewOwnership,
} = require("./middleware/ownership");

const {
  registerValidation,
  loginValidation,
  reviewValidation,
  handleValidationErrors,
} = require("./middleware/validation");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

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

app.get("/auth-status", (req, res) => {
  res.set("Cache-Control", "no-store");

  res.json({
    loggedIn: Boolean(req.session.userId),
    username: req.session.username || null,
  });
});

app.get("/", (req, res) => {
  return res.render("index", {
    isLoggedIn: Boolean(req.session.userId),
  });
});

app.get("/register", (req, res) => {
  if (req.session.userId) {
    return res.redirect("/profile");
  }

  return res.render("register", {
    isLoggedIn: false,
  });
});

app.post(
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
      return res.status(500).send("The account could not be created.");
    }
  }
);

app.get("/login", (req, res) => {
  if (req.session.userId) {
    return res.redirect("/profile");
  }

  return res.render("login", {
    isLoggedIn: false,
  });
});

app.post(
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

          return res.redirect("/profile");
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
  return res.render("submit-review", {
    isLoggedIn: true,
  });
});

app.post(
  "/submit-review",
  requireLogin,
  reviewValidation,
  handleValidationErrors,
  async (req, res) => {
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

app.get(
  "/reviews/:id/edit",
  requireLogin,
  validateReviewId,
  requireReviewOwnership,
  (req, res) => {
    return res.render("edit-review", {
      isLoggedIn: true,
      review: req.review,
    });
  }
);

app.post(
  "/reviews/:id/edit",
  requireLogin,
  validateReviewId,
  requireReviewOwnership,
  reviewValidation,
  handleValidationErrors,
  async (req, res) => {
    const {
      landlord_name,
      property_address,
      rating,
      review_text,
    } = req.body;

    const reviewId = req.reviewId;
    const landlordId = req.review.landlord_id;

    let client;

    try {
      client = await pool.connect();

      await client.query("BEGIN");

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
  validateReviewId,
  requireReviewOwnership,
  async (req, res) => {
    const reviewId = req.reviewId;

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

      const landlordId = deletedReview.rows[0].landlord_id;

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

app.get("/profile", requireLogin, async (req, res) => {
  try {
    const userResult = await pool.query(
      `SELECT
         id,
         username,
         email,
         created_at
       FROM users
       WHERE id = $1`,
      [req.session.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).send("User account not found.");
    }

    const user = userResult.rows[0];

    const reviewsResult = await pool.query(
      `SELECT
         reviews.id AS review_id,
         reviews.rating,
         reviews.review_text,
         reviews.created_at,
         landlords.landlord_name,
         landlords.property_address
       FROM reviews
       INNER JOIN landlords
         ON reviews.landlord_id = landlords.id
       WHERE reviews.user_id = $1
       ORDER BY reviews.created_at DESC`,
      [req.session.userId]
    );

    const reviews = reviewsResult.rows;

    const accountCreatedDate = new Date(
      user.created_at
    ).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    return res.render("profile", {
      isLoggedIn: true,
      user,
      reviews,
      accountCreatedDate,
    });
  } catch (error) {
    console.error("Profile page error:", error);

    return res.status(500).send(
      "The profile page could not be loaded."
    );
  }
});

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

    const reviews = result.rows.map((review) => {
      const userOwnsReview =
        isLoggedIn &&
        Number(review.user_id) === Number(req.session.userId);

      const searchableText =
        `${review.landlord_name} ${review.property_address} ${review.review_text} ${review.username}`
          .toLowerCase();

      return {
        ...review,
        userOwnsReview,
        searchableText,
      };
    });

    return res.render("reviews", {
      isLoggedIn,
      reviews,
    });
  } catch (error) {
    console.error("Review display error:", error);

    return res.status(500).send(
      "The reviews could not be loaded."
    );
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});