document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("review-search");
  const ratingFilter = document.getElementById("rating-filter");
  const clearFiltersButton = document.getElementById("clear-filters");
  const reviewCards = document.querySelectorAll(".review-card");
  const reviewCount = document.getElementById("review-count");
  const noResults = document.getElementById("no-results");

  // Stop here on pages that do not contain the review controls.
  if (
    !searchInput ||
    !ratingFilter ||
    !clearFiltersButton ||
    !reviewCount ||
    !noResults
  ) {
    return;
  }

  function filterReviews() {
    const searchValue = searchInput.value
      .trim()
      .toLowerCase();

    const minimumRating = Number(ratingFilter.value);

    let visibleCount = 0;

    reviewCards.forEach((card) => {
      const searchableText =
        card.dataset.search || "";

      const rating =
        Number(card.dataset.rating);

      const matchesSearch =
        searchableText.includes(searchValue);

      const matchesRating =
        rating >= minimumRating;

      const shouldShow =
        matchesSearch && matchesRating;

      card.hidden = !shouldShow;

      if (shouldShow) {
        visibleCount++;
      }
    });

    reviewCount.textContent =
      visibleCount === 1
        ? "1 review"
        : `${visibleCount} reviews`;

    noResults.hidden =
      visibleCount !== 0 ||
      reviewCards.length === 0;
  }

  searchInput.addEventListener(
    "input",
    filterReviews
  );

  ratingFilter.addEventListener(
    "change",
    filterReviews
  );

  clearFiltersButton.addEventListener(
    "click",
    () => {
      searchInput.value = "";
      ratingFilter.value = "0";

      filterReviews();
      searchInput.focus();
    }
  );

  filterReviews();
});