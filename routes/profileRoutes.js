const express = require("express");

const pool = require("../db");
const { requireLogin } = require("../middleware/auth");

const router = express.Router();

router.get("/profile", requireLogin, async (req, res) => {
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
      return res.status(404).send(
        "User account not found."
      );
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

module.exports = router;