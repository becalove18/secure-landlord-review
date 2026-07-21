document.addEventListener("DOMContentLoaded", () => {
  const loggedOutLinks =
    document.getElementById("logged-out-links");

  const loggedInLinks =
    document.getElementById("logged-in-links");

  const logoutButton =
    document.getElementById("logout-button");

  async function updateNavigation() {
    if (!loggedOutLinks || !loggedInLinks) {
      return;
    }

    try {
      const response = await fetch("/auth-status", {
        credentials: "same-origin"
      });

      if (!response.ok) {
        throw new Error("Unable to check login status.");
      }

      const data = await response.json();

      if (data.loggedIn) {
        loggedOutLinks.hidden = true;
        loggedInLinks.hidden = false;
      } else {
        loggedOutLinks.hidden = false;
        loggedInLinks.hidden = true;
      }
    } catch (error) {
      console.error(
        "Login status error:",
        error
      );

      loggedOutLinks.hidden = false;
      loggedInLinks.hidden = true;
    }
  }

  if (logoutButton) {
    logoutButton.addEventListener(
      "click",
      async () => {
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
          alert(
            "Unable to log out. Please try again."
          );
        }
      }
    );
  }

  updateNavigation();

  const searchInput =
    document.getElementById("review-search");

  const ratingFilter =
    document.getElementById("rating-filter");

  const clearFiltersButton =
    document.getElementById("clear-filters");

  const reviewCards =
    document.querySelectorAll(".review-card");

  const reviewCount =
    document.getElementById("review-count");

  const noResults =
    document.getElementById("no-results");

  // Stop the review-filter portion on pages
  // that do not contain the review controls.
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

    const minimumRating =
      Number(ratingFilter.value);

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