/**
 * ЛР 11. Інтерактивний віджет «Калькулятор вартості б'юті-курсу» JuliGrain.
 * Vanilla JS, без jQuery. Код ізольовано в IIFE: жодної глобальної змінної,
 * кожен блок [data-course-calculator] отримує власний екземпляр.
 *
 * Захист (Defensive Programming), 3 рівні:
 *  1) HTML5: type="number" min="1" max="12" step="1" required, maxlength="30";
 *  2) JS: перевірка та приведення типів ДО розрахунку (NaN, Infinity, 0, від'ємні,
 *     надвеликі, дробові, порожні, невідомі значення select/radio, відсутні DOM-елементи);
 *  3) безпечне виведення: лише textContent, ніколи innerHTML для даних користувача.
 */
(() => {
  "use strict";

  // ---------- Бізнес-правила (таблиця з етапу 1) ----------
  const RULES = Object.freeze({
    procedures: Object.freeze({
      "face-massage": { name: "Міофасціальний масаж обличчя", price: 1400 },
      "is-clinical": { name: "Чистка обличчя Is Clinical", price: 2000 },
      "prx-peel": { name: "Пілінг PRX-T33 обличчя", price: 2300 },
      "hair-repair": { name: "Зволоження волосся Repair", price: 1900 },
      manicure: { name: "Класичний/комбінований манікюр", price: 650 },
    }),
    levels: Object.freeze({ master: { name: "майстер", factor: 1 }, top: { name: "топ-майстер", factor: 1.2 } }),
    minSessions: 1,
    maxSessions: 12,
    ledPerSession: 350,
    giftPrice: 150,
    recipientMax: 30,
  });

  const MSG = {
    sessionsEmpty: `Вкажіть кількість сеансів від ${RULES.minSessions} до ${RULES.maxSessions}.`,
    sessionsNotNumber: "Введіть число цифрами, наприклад 5.",
    sessionsRange: `Кількість сеансів має бути від ${RULES.minSessions} до ${RULES.maxSessions}.`,
    procedure: "Оберіть процедуру зі списку.",
    level: "Оберіть рівень майстра.",
    recipient: "Ім'я може містити лише літери, пробіл, апостроф або дефіс (до 30 символів).",
  };

  const ERROR_CLASSES = ["border-red-600", "focus:border-red-600", "focus:ring-red-600/30", "bg-red-50"];
  const NORMAL_CLASSES = ["border-stone-300", "focus:border-sage", "focus:ring-gold/60", "bg-white"];
  const NAME_RE = /^[\p{L}][\p{L}\s'ʼ’-]*$/u;
  const money = new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 0 });
  const formatUAH = (n) => `${money.format(n)} грн`;

  /** Знижка за курс: 5–9 сеансів — 10 %, 10–12 — 15 %. */
  const discountRate = (sessions) => (sessions >= 10 ? 0.15 : sessions >= 5 ? 0.1 : 0);

  /**
   * Розбір поля кількості сеансів. Повертає { value } або { error }.
   * Дробове число нормалізується (округлення), а не відхиляється.
   */
  function parseSessions(input) {
    if (input.validity && input.validity.badInput) return { error: MSG.sessionsNotNumber }; // «abc», «--», «1e»
    const raw = String(input.value).trim();
    if (raw === "") return { error: MSG.sessionsEmpty };
    const num = Number(raw);
    if (!Number.isFinite(num)) return { error: MSG.sessionsNotNumber }; // NaN, Infinity
    const value = Math.round(num);
    if (value < RULES.minSessions || value > RULES.maxSessions) return { error: MSG.sessionsRange };
    return { value, rounded: value !== num };
  }

  /** Чиста функція розрахунку: тільки перевірені дані на вході, тільки скінченні невід'ємні числа на виході. */
  function calculateCourse({ procedure, level, sessions, led, gift }) {
    const perSession = Math.round(procedure.price * level.factor) + (led ? RULES.ledPerSession : 0);
    const sessionsTotal = perSession * sessions;
    const discount = Math.round(sessionsTotal * discountRate(sessions));
    const giftPrice = gift ? RULES.giftPrice : 0;
    const total = sessionsTotal - discount + giftPrice;
    if (![perSession, discount, total].every((n) => Number.isFinite(n) && n >= 0)) {
      throw new RangeError("Некоректний результат розрахунку");
    }
    return { perSession, discount, giftPrice, total };
  }

  function initCalculator(root) {
    const q = (name) => root.querySelector(`[data-calc="${name}"]`);
    const el = {
      form: q("form"), procedure: q("procedure"), sessions: q("sessions"), led: q("led"), gift: q("gift"),
      giftBox: q("gift-box"), recipient: q("recipient"), summary: q("summary"), perSession: q("per-session"),
      discount: q("discount"), giftPrice: q("gift-price"), total: q("total"), note: q("note"), send: q("send"),
      errors: { procedure: q("procedure-error"), sessions: q("sessions-error"), level: q("level-error"), recipient: q("recipient-error") },
    };
    const levels = [...root.querySelectorAll('[data-calc="level"]')];

    // Відсутній DOM-елемент: попередження в консолі замість TypeError, решта сторінки працює.
    const missing = Object.entries(el).filter(([, v]) => !v).map(([k]) => k)
      .concat(Object.entries(el.errors).filter(([, v]) => !v).map(([k]) => `${k}-error`));
    if (missing.length || levels.length === 0) {
      console.warn("[JuliGrain calculator] Віджет не запущено, бракує елементів:", missing.concat(levels.length ? [] : ["level"]).join(", "));
      return null;
    }

    let latest = null; // останній коректний розрахунок
    let frame = 0;

    function setFieldError(field, errorEl, message) {
      const invalid = Boolean(message);
      if (field) {
        field.setAttribute("aria-invalid", String(invalid));
        field.classList.remove(...(invalid ? NORMAL_CLASSES : ERROR_CLASSES));
        field.classList.add(...(invalid ? ERROR_CLASSES : NORMAL_CLASSES));
      }
      errorEl.textContent = message || "";
      errorEl.classList.toggle("hidden", !invalid);
    }

    function showInvalid() {
      latest = null;
      el.perSession.textContent = "—";
      el.discount.textContent = "—";
      el.giftPrice.textContent = el.gift.checked ? formatUAH(RULES.giftPrice) : "—";
      el.total.textContent = "—";
      el.summary.textContent = "Виправте поля, позначені червоним, щоб побачити суму.";
      el.send.disabled = true;
    }

    function render() {
      frame = 0;
      el.giftBox.classList.toggle("hidden", !el.gift.checked);

      const procedure = Object.prototype.hasOwnProperty.call(RULES.procedures, el.procedure.value) ? RULES.procedures[el.procedure.value] : null;
      const checked = levels.find((r) => r.checked);
      const level = checked && Object.prototype.hasOwnProperty.call(RULES.levels, checked.value) ? RULES.levels[checked.value] : null;
      const sessions = parseSessions(el.sessions);
      const name = el.recipient.value.trim().replace(/\s+/g, " ");
      const nameOk = !el.gift.checked || name === "" || (name.length <= RULES.recipientMax && NAME_RE.test(name));

      setFieldError(el.procedure, el.errors.procedure, procedure ? "" : MSG.procedure);
      setFieldError(null, el.errors.level, level ? "" : MSG.level);
      setFieldError(el.sessions, el.errors.sessions, sessions.error || "");
      setFieldError(el.recipient, el.errors.recipient, nameOk ? "" : MSG.recipient);

      if (!procedure || !level || sessions.error || !nameOk) return showInvalid();

      let result;
      try {
        result = calculateCourse({ procedure, level, sessions: sessions.value, led: el.led.checked, gift: el.gift.checked });
      } catch (err) {
        console.error("[JuliGrain calculator]", err);
        return showInvalid();
      }

      const word = sessions.value === 1 ? "сеанс" : sessions.value < 5 ? "сеанси" : "сеансів";
      let summary = `${procedure.name} × ${sessions.value} ${word}, ${level.name}`;
      if (el.led.checked) summary += ", LED-маска";
      if (el.gift.checked) summary += name ? `. Сертифікат для: ${name}` : ". Подарунковий сертифікат";

      el.summary.textContent = summary; // textContent: HTML з поля імені не виконується
      el.perSession.textContent = formatUAH(result.perSession);
      el.discount.textContent = result.discount ? `−${formatUAH(result.discount)}` : formatUAH(0);
      el.giftPrice.textContent = el.gift.checked ? formatUAH(result.giftPrice) : "—";
      el.total.textContent = formatUAH(result.total);
      el.note.textContent = sessions.rounded ? `Кількість сеансів округлено до ${sessions.value}.` : "";
      el.send.disabled = false;
      latest = { summary, total: result.total };
    }

    // Швидке повторне введення: серія подій в одному циклі дає лише один перерахунок.
    // (queueMicrotask, а не requestAnimationFrame: rAF «засинає» у фоновій вкладці.)
    const schedule = () => { if (!frame) { frame = 1; queueMicrotask(render); } };

    el.sessions.addEventListener("input", schedule);
    el.recipient.addEventListener("input", schedule);
    [el.procedure, el.led, el.gift, ...levels].forEach((c) => c.addEventListener("change", schedule));
    // Після виходу з поля показуємо нормалізоване значення (2.5 → 3).
    el.sessions.addEventListener("change", () => {
      const s = parseSessions(el.sessions);
      if (!s.error && s.rounded) el.sessions.value = String(s.value);
      schedule();
    });
    el.form.addEventListener("submit", (e) => e.preventDefault()); // Enter у полі не перезавантажує сторінку

    el.send.addEventListener("click", () => {
      if (!latest) return;
      const message = document.getElementById("message");
      const text = `Хочу записатися на курс: ${latest.summary}. Орієнтовна сума: ${formatUAH(latest.total)}.`;
      if (message) {
        message.value = text.slice(0, Number(message.maxLength) > 0 ? message.maxLength : 1000);
        message.dispatchEvent(new Event("input", { bubbles: true }));
        const topic = document.getElementById("topic");
        const wanted = el.gift.checked ? "certificate" : "consultation";
        if (topic && [...topic.options].some((o) => o.value === wanted)) topic.value = wanted;
        document.getElementById("contact")?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        message.focus({ preventScroll: true });
      }
    });

    render();
    return { render, calculate: calculateCourse };
  }

  function start() {
    document.querySelectorAll("[data-course-calculator]").forEach(initCalculator);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
