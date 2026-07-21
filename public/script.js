document.addEventListener("DOMContentLoaded", async () => {
  const loggedOutLinks = document.getElementById("logged-out-links");
  const loggedInLinks = document.getElementById("logged-in-links");
  const logoutButton = document.getElementById("logout-button");

  const heroSubmitReview = document.getElementById("hero-submit-review");
  const heroCreateAccount = document.getElementById("hero-create-account");

  const featureSubmitReview = document.getElementById("feature-submit-review");
  const featureCreateAccount = document.getElementById("feature-create-account");

  async function updateNavigation() {
    if (!loggedOutLinks || !loggedInLinks) {
      return;
    }

    try {
      const response = await fetch("/auth-status", {
        credentials: "same-origin",
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Unable to check login status.");
      }

      const data = await response.json();

      if (data.loggedIn) {
        loggedOutLinks.hidden = true;
        loggedInLinks.hidden = false;

        if (heroSubmitReview) heroSubmitReview.hidden = false;
        if (heroCreateAccount) heroCreateAccount.hidden = true;

        if (featureSubmitReview) featureSubmitReview.hidden = false;
        if (featureCreateAccount) featureCreateAccount.hidden = true;
      } else {
        loggedOutLinks.hidden = false;
        loggedInLinks.hidden = true;

        if (heroSubmitReview) heroSubmitReview.hidden = true;
        if (heroCreateAccount) heroCreateAccount.hidden = false;

        if (featureSubmitReview) featureSubmitReview.hidden = true;
        if (featureCreateAccount) featureCreateAccount.hidden = false;
      }
    } catch (error) {
      console.error("Login status error:", error);

      loggedOutLinks.hidden = false;
      loggedInLinks.hidden = true;

      if (heroSubmitReview) heroSubmitReview.hidden = true;
      if (heroCreateAccount) heroCreateAccount.hidden = false;

      if (featureSubmitReview) featureSubmitReview.hidden = true;
      if (featureCreateAccount) featureCreateAccount.hidden = false;
    }
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      try {
        const response = await fetch("/logout", {
          method: "POST",
          credentials: "same-origin"
        });

        if (!response.ok) {
          throw new Error("Logout failed.");
        }

        window.location.href = "/";
      } catch (error) {
        console.error("Logout error:", error);
        alert("Unable to log out. Please try again.");
      }
    });
  }

  await updateNavigation();

  const searchInput = document.getElementById("review-search");
  const ratingFilter = document.getElementById("rating-filter");
  const clearFiltersButton = document.getElementById("clear-filters");
  const reviewCards = document.querySelectorAll(".review-card");
  const reviewCount = document.getElementById("review-count");
  const noResults = document.getElementById("no-results");

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
    const searchValue = searchInput.value.trim().toLowerCase();
    const minimumRating = Number(ratingFilter.value);

    let visibleCount = 0;

    reviewCards.forEach((card) => {
      const searchableText = card.dataset.search || "";
      const rating = Number(card.dataset.rating);

      const shouldShow =
        searchableText.includes(searchValue) &&
        rating >= minimumRating;

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

  searchInput.addEventListener("input", filterReviews);
  ratingFilter.addEventListener("change", filterReviews);

  clearFiltersButton.addEventListener("click", () => {
    searchInput.value = "";
    ratingFilter.value = "0";

    filterReviews();
    searchInput.focus();
  });

  filterReviews();
});