const express = require("express");

const pool = require("../db");

const { requireLogin } = require("../middleware/auth");

const {
  validateReviewId,
  requireReviewOwnership,
} = require("../middleware/ownership");

const {
  reviewValidation,
  handleValidationErrors,
} = require("../middleware/validation");

const router = express.Router();

router.get("/submit-review", requireLogin, (req, res) => {
  return res.render("submit-review", {
    isLoggedIn: true,
  });
});

router.post(
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

      return res.status(500).send(
        "The review could not be submitted."
      );
    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

router.get(
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

router.post(
  "/reviews/:id/edit",
  requireLogin,
  validateReviewId,
  requireReviewOwnership,
  reviewValidation,
  handleValidationErrors,
  async (req, res) => {
    const reviewId = req.reviewId;
    const landlordId = req.review.landlord_id;

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

      const updatedReview = await client.query(
        `UPDATE reviews
         SET rating = $1,
             review_text = $2
         WHERE id = $3
           AND user_id = $4
         RETURNING id`,
        [
          Number(rating),
          review_text,
          reviewId,
          req.session.userId,
        ]
      );

      if (updatedReview.rows.length === 0) {
        await client.query("ROLLBACK");

        return res
          .status(404)
          .send(
            "Review not found, or you do not have permission to edit it."
          );
      }

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

router.post(
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

router.get("/reviews", async (req, res) => {
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
        Number(review.user_id) ===
          Number(req.session.userId);

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

module.exports = router;