const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector("#site-navigation");
function closeMenu(focus = false) {
  navigation.classList.add("hidden");
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.setAttribute("aria-label", "Відкрити меню");
  if (focus) menuButton.focus();
}
menuButton.addEventListener("click", () => {
  const open = menuButton.getAttribute("aria-expanded") !== "true";
  navigation.classList.toggle("hidden", !open);
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "Закрити меню" : "Відкрити меню");
});
navigation.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => closeMenu()));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll("details[open]").forEach((d) => (d.open = false));
    if (menuButton.getAttribute("aria-expanded") === "true") closeMenu(true);
  }
});
matchMedia("(min-width:768px)").addEventListener("change", () => closeMenu());
const filters = [...document.querySelectorAll("[data-filter]")];
function filterServices(category) {
  filters.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.filter === category)));
  document
    .querySelectorAll("[data-category]")
    .forEach((c) => (c.hidden = category !== "all" && c.dataset.category !== category));
}
filters.forEach((b) => b.addEventListener("click", () => filterServices(b.dataset.filter)));
document.querySelectorAll("[data-category-link]").forEach((a) =>
  a.addEventListener("click", () => {
    filterServices(a.dataset.categoryLink);
    a.closest("details").open = false;
  }),
);
document.addEventListener("click", (e) =>
  document.querySelectorAll("details[open]").forEach((d) => {
    if (!d.contains(e.target)) d.open = false;
  }),
);

// Зовнішні сервіси починають завантаження лише біля видимої області.
// Посилання на YouTube, карту й прогноз залишаються доступними без JavaScript.
function loadNearbyMedia(element) {
  if (element.matches("iframe[data-src]")) {
    element.src = element.dataset.src;
    element.removeAttribute("data-src");
  } else if (!document.getElementById("weather-widget-script")) {
    const script = document.createElement("script");
    script.id = "weather-widget-script";
    script.src = "https://weatherwidget.io/js/widget.min.js";
    script.async = true;
    document.body.append(script);
  }
}
const deferredMedia = document.querySelectorAll("iframe[data-src], .weatherwidget-io");
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(({ isIntersecting, target }) => {
      if (!isIntersecting) return;
      observer.unobserve(target);
      loadNearbyMedia(target);
    });
  }, { rootMargin: "300px" });
  deferredMedia.forEach(element => observer.observe(element));
} else {
  deferredMedia.forEach(loadNearbyMedia);
}
