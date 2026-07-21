const pool = require("../db");

function validateReviewId(req, res, next) {
  const reviewId = Number(req.params.id);

  if (!Number.isInteger(reviewId) || reviewId < 1) {
    return res.status(400).send("Invalid review ID.");
  }

  req.reviewId = reviewId;

  next();
}

async function requireReviewOwnership(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT
         reviews.id AS review_id,
         reviews.user_id,
         reviews.landlord_id,
         reviews.rating,
         reviews.review_text,
         landlords.landlord_name,
         landlords.property_address
       FROM reviews
       INNER JOIN landlords
         ON reviews.landlord_id = landlords.id
       WHERE reviews.id = $1
         AND reviews.user_id = $2`,
      [req.reviewId, req.session.userId]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .send(
          "Review not found, or you do not have permission to access it."
        );
    }

    req.review = result.rows[0];

    next();
  } catch (error) {
    console.error("Review ownership check error:", error);

    return res
      .status(500)
      .send("The review permissions could not be verified.");
  }
}

module.exports = {
  validateReviewId,
  requireReviewOwnership,
};