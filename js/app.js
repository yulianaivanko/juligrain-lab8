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

// Зовнішні сервіси (YouTube, карта) починають завантаження лише біля видимої області.
function loadNearbyMedia(element) {
  element.src = element.dataset.src;
  element.removeAttribute("data-src");
}
const deferredMedia = document.querySelectorAll("iframe[data-src]");
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

// Видимий фокус для вбудованих відео й карти. Коли фокус клавіатури переходить усередину
// iframe, сам елемент не отримує :focus, тому позначаємо його класом, поки фокус всередині.
window.addEventListener("blur", () => setTimeout(() => {
  const active = document.activeElement;
  if (active && active.tagName === "IFRAME") active.classList.add("iframe-focused");
}));
window.addEventListener("focus", () => document.querySelectorAll(".iframe-focused").forEach((f) => f.classList.remove("iframe-focused")));
document.addEventListener("focusin", () => document.querySelectorAll(".iframe-focused").forEach((f) => f.classList.remove("iframe-focused")));

// Прайс напряму відкривається в модальному вікні (<dialog>): закриття хрестиком, Esc або кліком по фону.
(() => {
  const dialog = document.getElementById("price-dialog");
  if (!dialog || typeof dialog.showModal !== "function") {
    // Старий браузер без <dialog>: показуємо прайс просто в картці
    document.querySelectorAll("[data-price-open]").forEach((button) =>
      button.addEventListener("click", () => {
        const content = button.nextElementSibling;
        content.hidden = !content.hidden;
      }),
    );
    return;
  }
  const body = dialog.querySelector("[data-price-body]");
  const title = dialog.querySelector("[data-price-title]");
  const eyebrow = dialog.querySelector("[data-price-eyebrow]");
  let opener = null;

  function close() {
    if (!dialog.open || dialog.classList.contains("is-closing")) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    dialog.classList.add("is-closing");
    setTimeout(() => {
      dialog.classList.remove("is-closing");
      dialog.close();
    }, reduce ? 0 : 180);
  }

  document.querySelectorAll("[data-price-open]").forEach((button) =>
    button.addEventListener("click", () => {
      const card = button.closest(".service-card");
      const content = button.nextElementSibling.cloneNode(true);
      content.hidden = false;
      content.removeAttribute("id");
      title.textContent = card.querySelector("h3").textContent.trim();
      eyebrow.textContent = card.querySelector(".service-content > p").textContent.trim();
      body.replaceChildren(content);
      body.scrollTop = 0;
      opener = button;
      document.documentElement.classList.add("overflow-hidden");
      dialog.showModal();
    }),
  );
  dialog.querySelector("[data-price-close]").addEventListener("click", close);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  // Клік по затемненому фону (поза вмістом вікна)
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });
  // Посилання всередині (до калькулятора) спершу закривають вікно
  dialog.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    dialog.classList.remove("is-closing");
    dialog.close();
  });
  dialog.addEventListener("close", () => {
    document.documentElement.classList.remove("overflow-hidden");
    if (opener && !location.hash.startsWith("#calculator")) opener.focus();
  });
})();

// Плавна поява карток послуг під час прокрутки (лише якщо користувач не вимкнув анімації).
(() => {
  const cards = document.querySelectorAll(".service-card");
  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(({ isIntersecting, target }) => {
      if (!isIntersecting) return;
      target.classList.add("is-visible");
      observer.unobserve(target);
    });
  }, { rootMargin: "0px 0px -60px 0px" });
  cards.forEach((card, index) => {
    card.classList.add("reveal");
    card.style.transitionDelay = `${(index % 3) * 90}ms`;
    observer.observe(card);
  });
  // Після фільтра показані картки з'являються знову з легкою анімацією
  document.querySelectorAll("[data-filter], [data-category-link]").forEach((control) =>
    control.addEventListener("click", () =>
      requestAnimationFrame(() =>
        cards.forEach((card, index) => {
          if (card.hidden) return;
          card.classList.remove("is-visible");
          card.style.transitionDelay = `${(index % 3) * 60}ms`;
          requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add("is-visible")));
        }),
      ),
    ),
  );
})();
