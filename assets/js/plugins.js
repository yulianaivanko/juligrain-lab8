/* Ініціалізація JS-плагінів (Vanilla JS, без jQuery), підключених через CDN jsDelivr:
   Swiper.js 11 — слайдер відгуків, Fancybox 5 — галерея робіт, Typed.js 2 — друк тексту в hero.
   Оптимізація: Swiper і Fancybox (JS + CSS) більше не завантажуються разом
   зі сторінкою. Вони підтягуються лише тоді, коли користувач наближається до своєї секції
   (IntersectionObserver), тому не блокують рендер і не займають головний потік на старті. */
const CDN = "https://cdn.jsdelivr.net/npm/";
const ASSETS = {
  swiper: [CDN + "swiper@11.1.14/swiper-bundle.min.css", CDN + "swiper@11.1.14/swiper-bundle.min.js"],
  fancybox: [CDN + "@fancyapps/ui@5.0.36/dist/fancybox/fancybox.css", CDN + "@fancyapps/ui@5.0.36/dist/fancybox/fancybox.umd.js"],
};
const loaded = {};

// Підключає CSS і JS бібліотеки один раз; повертає Promise, який виконується після завантаження JS
function loadLibrary(name) {
  if (loaded[name]) return loaded[name];
  const [cssUrl, jsUrl] = ASSETS[name];
  const css = new Promise((resolve) => {
    const link = Object.assign(document.createElement("link"), { rel: "stylesheet", href: cssUrl });
    link.onload = link.onerror = resolve;
    document.head.append(link);
  });
  const js = new Promise((resolve, reject) => {
    const script = Object.assign(document.createElement("script"), { src: jsUrl, async: true });
    script.onload = resolve;
    script.onerror = () => reject(new Error("Не вдалося завантажити " + name));
    document.body.append(script);
  });
  loaded[name] = Promise.all([css, js]);
  return loaded[name];
}

// Виконує callback, коли елемент наближається до видимої області (за 400 px)
function whenNear(element, callback) {
  if (!element) return;
  if (!("IntersectionObserver" in window)) return callback();
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    observer.disconnect();
    callback();
  }, { rootMargin: "400px 0px" });
  observer.observe(element);
}

document.addEventListener("DOMContentLoaded", () => {
  // Якщо в системі вимкнено анімації — не крутимо слайдер і не «друкуємо» текст
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* 1. Swiper.js: відгуки гостей */
  const reviews = document.querySelector(".reviews-swiper");
  whenNear(reviews, () => loadLibrary("swiper").then(() => {
    new Swiper(reviews, {
      loop: true,                      // нескінченна прокрутка
      speed: 600,                      // тривалість анімації переходу, мс
      spaceBetween: 24,
      grabCursor: true,
      autoHeight: false,
      autoplay: reduceMotion ? false : {
        delay: 4000,                   // пауза між слайдами, мс
        disableOnInteraction: false,
        pauseOnMouseEnter: true,       // зупинка при наведенні миші
      },
      keyboard: { enabled: true, onlyInViewport: true },
      a11y: {
        prevSlideMessage: "Попередній відгук",
        nextSlideMessage: "Наступний відгук",
        paginationBulletMessage: "Перейти до відгуку {{index}}",
        slideRole: "group",            // слайди тепер <div>, роль group для них допустима
      },
      pagination: { el: ".reviews-pagination", clickable: true },
      navigation: { prevEl: ".reviews-prev", nextEl: ".reviews-next" },
      breakpoints: {                   // адаптивність: mobile-first
        320: { slidesPerView: 1 },
        768: { slidesPerView: 2 },
        1024: { slidesPerView: 3 },
      },
    });
  }).catch(console.warn));             // без Swiper відгуки лишаються видимими рядком

  /* 2. Fancybox v5: галерея робіт (альбом за атрибутом data-fancybox) */
  const galleryLinks = document.querySelectorAll('[data-fancybox="juligrain-works"]');
  const bindFancybox = () => loadLibrary("fancybox").then(() => {
    if (bindFancybox.done) return;
    bindFancybox.done = true;
    Fancybox.bind('[data-fancybox="juligrain-works"]', {
      Carousel: { transition: "fade" },  // плавне згасання між фото
      Images: {
        zoom: true,                      // зум колесом, кліком і жестом pinch
        Panzoom: { maxScale: 3 },        // дозволяємо збільшення до 3× для фото 1040×1300 px
      },
      Thumbs: { type: "classic" },       // мініатюри внизу
      Toolbar: {
        display: { left: ["infobar"], middle: [], right: ["zoomIn", "zoomOut", "slideshow", "fullscreen", "close"] },
      },
      l10n: {
        CLOSE: "Закрити", NEXT: "Далі", PREV: "Назад", ZOOMIN: "Збільшити", ZOOMOUT: "Зменшити",
        TOGGLE_SLIDESHOW: "Слайд-шоу", TOGGLE_FULLSCREEN: "На весь екран", ERROR: "Не вдалося завантажити фото",
      },
    });
  });
  if (galleryLinks.length) {
    whenNear(galleryLinks[0], () => bindFancybox().catch(console.warn));
    // Якщо клікнули раніше, ніж бібліотека встигла завантажитися, — дочекатися її й відкрити фото
    galleryLinks.forEach((link) => link.addEventListener("click", (event) => {
      if (bindFancybox.done) return;
      event.preventDefault();
      bindFancybox().then(() => link.click()).catch(() => { window.location.href = link.href; });
    }));
  }

  /* 3. Typed.js: ефект друку в hero.
     Кожен надрукований символ змушує браузер перераховувати стилі й макет великої сторінки
     (Lighthouse: Style & Layout 1,5 с, TBT до 430 мс). Тому друк стартує через 1 с після події load,
     коли основне завантаження вже завершене; до того в рядку стоїть статичний текст із HTML. */
  const startTyped = () => setTimeout(() => {
    if (!window.Typed || !document.querySelector("#typed-text") || reduceMotion) return;
    new Typed("#typed-text", {
      strings: ["стрижки й фарбування", "манікюр без поспіху", "брови та вії", "догляд за шкірою"],
      typeSpeed: 55,     // швидкість друку, мс на символ
      backSpeed: 30,     // швидкість стирання
      backDelay: 1600,   // пауза перед стиранням
      loop: true,
      smartBackspace: true,
    });
  }, 1000);
  if (document.readyState === "complete") startTyped();
  else window.addEventListener("load", startTyped, { once: true });
});
