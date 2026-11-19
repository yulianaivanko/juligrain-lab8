/* ЛР 10. Ініціалізація JS-плагінів (Vanilla JS, без jQuery), підключених через CDN jsDelivr:
   Swiper.js 11 — слайдер відгуків, Fancybox 5 — галерея робіт, Typed.js 2 — друк тексту в hero.
   Усе запускається після побудови DOM (DOMContentLoaded). */
document.addEventListener("DOMContentLoaded", () => {
  // Якщо в системі вимкнено анімації — не крутимо слайдер і не «друкуємо» текст
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* 1. Swiper.js: відгуки гостей */
  if (window.Swiper && document.querySelector(".reviews-swiper")) {
    new Swiper(".reviews-swiper", {
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
      },
      pagination: { el: ".reviews-pagination", clickable: true },
      navigation: { prevEl: ".reviews-prev", nextEl: ".reviews-next" },
      breakpoints: {                   // адаптивність: mobile-first
        320: { slidesPerView: 1 },
        768: { slidesPerView: 2 },
        1024: { slidesPerView: 3 },
      },
    });
  }

  /* 2. Fancybox v5: галерея робіт (альбом за атрибутом data-fancybox) */
  if (window.Fancybox) {
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
  }

  /* 3. Typed.js: ефект друку в hero */
  if (window.Typed && document.querySelector("#typed-text") && !reduceMotion) {
    new Typed("#typed-text", {
      strings: ["стрижки й фарбування", "манікюр без поспіху", "брови та вії", "догляд за шкірою"],
      typeSpeed: 55,     // швидкість друку, мс на символ
      backSpeed: 30,     // швидкість стирання
      backDelay: 1600,   // пауза перед стиранням
      startDelay: 400,
      loop: true,
      smartBackspace: true,
    });
  }
});
