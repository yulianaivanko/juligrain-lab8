// Перевірка форми зворотного зв'язку JuliGrain.
// Після успішної перевірки звернення надсилається на пошту салону через FormSubmit (formsubmit.co).
// Якщо надіслати не вдалося, дані лишаються у формі, а вікно пропонує Instagram Direct або дзвінок.
(() => {
  "use strict";

  const form = document.getElementById("feedbackForm");
  if (!form) return;

  /* ---------- 1. Правила валідації (регулярні вирази) ---------- */

  // Email: локальна частина @ домен . зона з 2+ літер
  const REGEX_EMAIL = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  // Телефон: строго +380 і рівно 9 цифр, без пробілів, дужок і дефісів
  const REGEX_PHONE = /^\+380\d{9}$/;
  // Ім'я: українські та латинські літери, апостроф, дефіс і пробіл між частинами імені
  const REGEX_NAME = /^[A-Za-zА-ЩЬЮЯҐЄІЇа-щьюяґєії]+(?:['’ʼ\- ][A-Za-zА-ЩЬЮЯҐЄІЇа-щьюяґєії]+)*$/;

  const LIMITS = { nameMin: 2, nameMax: 50, messageMin: 10, messageMax: 1000 };

  /* ---------- 2. Елементи DOM ---------- */

  const fields = {
    name: { input: document.getElementById("username"), error: document.getElementById("nameError") },
    email: { input: document.getElementById("email"), error: document.getElementById("emailError") },
    phone: { input: document.getElementById("phone"), error: document.getElementById("phoneError") },
    message: { input: document.getElementById("message"), error: document.getElementById("messageError") },
    agreement: { input: document.getElementById("agreement"), error: document.getElementById("agreementError") },
  };
  const phoneHint = document.getElementById("phoneHint");
  const counter = document.getElementById("messageCounter");
  const formStatus = document.getElementById("formStatus");
  const submitBtn = document.getElementById("submitBtn");
  const modal = document.getElementById("successModal");
  const modalCard = modal.querySelector('[role="dialog"]');
  const modalName = document.getElementById("modalName");
  const closeModalBtn = document.getElementById("closeModalBtn");

  const PHONE_HINT = "Формат: +380XXXXXXXXX";
  // Поля, з якими користувач уже взаємодіяв (після blur або submit)
  const touched = new Set();
  let isSubmitting = false;
  let lastFocused = null;

  /* ---------- 3. Функції керування UI-станами ---------- */

  const ERROR_CLASSES = ["border-red-600", "focus:border-red-600", "focus:ring-red-600/30"];
  const SUCCESS_CLASSES = ["border-green-700", "focus:border-green-700", "focus:ring-green-700/30"];
  const NORMAL_CLASSES = ["border-stone-300", "focus:border-sage", "focus:ring-gold/60"];

  // Стан Error: червона рамка, текст під полем, aria-invalid="true"
  function showError(field, message) {
    const { input, error } = field;
    input.classList.remove(...NORMAL_CLASSES, ...SUCCESS_CLASSES);
    input.classList.add(...ERROR_CLASSES);
    input.setAttribute("aria-invalid", "true");
    error.textContent = message; // textContent — введений текст ніколи не стає HTML
    error.classList.remove("hidden");
  }

  // Стан Success: зелена рамка, помилку приховано
  function showSuccess(field) {
    const { input } = field;
    input.classList.remove(...NORMAL_CLASSES, ...ERROR_CLASSES);
    input.classList.add(...SUCCESS_CLASSES);
    input.setAttribute("aria-invalid", "false");
    hideErrorText(field);
  }

  // Стан Normal: повернення до початкового вигляду
  function clearError(field) {
    const { input } = field;
    input.classList.remove(...ERROR_CLASSES, ...SUCCESS_CLASSES);
    input.classList.add(...NORMAL_CLASSES);
    input.setAttribute("aria-invalid", "false");
    hideErrorText(field);
  }

  function hideErrorText({ error }) {
    error.textContent = "";
    error.classList.add("hidden");
  }

  // Загальний помічник: перевірка повертає текст помилки або порожній рядок.
  // silent = true (під час введення): червоне не показуємо, бо людина ще пише
  // (наприклад, «Мар'» — це незавершене «Мар'яна», «+38050» — недописаний номер).
  // Помилка з'являється після виходу з поля (blur) або натискання «Надіслати».
  function applyResult(field, message, silent) {
    if (message) {
      if (silent) clearError(field);
      else showError(field, message);
      return false;
    }
    showSuccess(field);
    return true;
  }

  /* ---------- 4. Функції валідації полів ---------- */
  // silent = true: під час першого введення помилку ще не показуємо, лише успіх

  function validateName(silent = false) {
    const value = fields.name.input.value.trim();
    let message = "";
    if (!value) message = "Введіть ваше ім'я.";
    else if (value.length < LIMITS.nameMin) message = `Ім'я повинно містити не менше ${LIMITS.nameMin} символів.`;
    else if (value.length > LIMITS.nameMax) message = `Ім'я не може бути довшим за ${LIMITS.nameMax} символів.`;
    else if (!REGEX_NAME.test(value)) message = "Використовуйте лише літери, апостроф або дефіс.";
    return applyResult(fields.name, message, silent);
  }

  function validateEmail(silent = false) {
    const value = fields.email.input.value.trim();
    let message = "";
    if (!value) message = "Введіть електронну пошту.";
    else if (!REGEX_EMAIL.test(value) || value.includes(".."))
      message = "Введіть коректну електронну адресу, наприклад: user@gmail.com.";
    return applyResult(fields.email, message, silent);
  }

  function validatePhone(silent = false) {
    const value = fields.phone.input.value.trim();
    const digits = value.replace(/\D/g, "");
    let message = "";
    if (!value) message = "Введіть номер телефону.";
    else if (/[^\d+]/.test(value)) message = "Номер може містити лише знак + і цифри.";
    else if (!value.startsWith("+380")) message = "Номер повинен починатися з +380.";
    else if (digits.length > 12) message = `Зайві цифри: після +380 потрібно рівно 9 цифр (зараз ${digits.length - 3}).`;
    else if (!REGEX_PHONE.test(value)) message = `Після +380 потрібно рівно 9 цифр (зараз ${Math.max(digits.length - 3, 0)}).`;
    return applyResult(fields.phone, message, silent);
  }

  function validateMessage(silent = false) {
    const value = fields.message.input.value.trim();
    let message = "";
    if (!value) message = "Напишіть ваше повідомлення.";
    else if (value.length < LIMITS.messageMin)
      message = `Повідомлення повинно містити не менше ${LIMITS.messageMin} символів (зараз ${value.length}).`;
    return applyResult(fields.message, message, silent);
  }

  function validateAgreement(silent = false) {
    const message = fields.agreement.input.checked ? "" : "Підтвердьте згоду з політикою конфіденційності.";
    return applyResult(fields.agreement, message, silent);
  }

  const validators = {
    name: validateName,
    email: validateEmail,
    phone: validatePhone,
    message: validateMessage,
    agreement: validateAgreement,
  };

  /* ---------- 5. Edge cases телефону: м'яка нормалізація ---------- */

  // Повертає номер лише з «+» на початку та цифр і пояснення, що саме змінено
  function normalizePhone(raw) {
    const hadLetters = /[^\d+\s()\-.]/.test(raw);
    const hadFormatting = /[\s()\-.]/.test(raw);
    let digits = raw.replace(/\D/g, "");
    let note = "";

    if (!digits) return { value: raw.trim().startsWith("+") ? "+" : "", note: hadLetters ? "Літери видалено: номер містить лише цифри." : "" };

    // 0501234567 → +380501234567; 80501234567 → +380501234567; 380… → +380…
    if (digits.startsWith("0")) {
      digits = "38" + digits;
      note = "Додано код країни +38.";
    } else if (digits.startsWith("80")) {
      digits = "3" + digits;
      note = "Додано код країни +3.";
    }
    if (hadLetters) note = "Літери видалено: номер містить лише цифри. " + note;
    else if (hadFormatting) note = "Пробіли, дужки й дефіси прибрано. " + note;

    return { value: "+" + digits, note: note.trim() };
  }

  function handlePhoneInput(event) {
    const input = fields.phone.input;
    const before = input.value;
    const caretFromEnd = before.length - (input.selectionEnd ?? before.length);
    // Під час видалення не додаємо код країни, щоб не заважати користувачу
    const deleting = event.inputType && event.inputType.startsWith("delete");
    const { value, note } = deleting
      ? { value: before.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, ""), note: "" }
      : normalizePhone(before);

    if (value !== before) {
      input.value = value;
      // Зберігаємо позицію курсора відносно кінця рядка
      const pos = Math.max(value.length - caretFromEnd, 0);
      input.setSelectionRange(pos, pos);
    }
    phoneHint.textContent = note ? `${note} ${PHONE_HINT}` : PHONE_HINT;
  }

  /* ---------- 6. Динамічна валідація: input + blur ---------- */

  Object.entries(fields).forEach(([key, field]) => {
    const validate = validators[key];
    const eventName = field.input.type === "checkbox" ? "change" : "input";

    field.input.addEventListener(eventName, (event) => {
      if (key === "phone") handlePhoneInput(event);
      if (key === "message") updateCounter();
      // Під час введення показуємо лише успіх; нові помилки з'являються після blur або submit
      validate(key !== "agreement");
      if (key === "agreement") touched.add(key);
      updateStatus();
    });

    if (key !== "agreement") {
      field.input.addEventListener("blur", () => {
        // Порожнє поле, яке тільки «проклацали» Tab-ом, не підсвічуємо червоним
        if (!field.input.value.trim() && !touched.has(key)) return;
        touched.add(key);
        validate();
        updateStatus();
      });
    }
  });

  function updateCounter() {
    const length = fields.message.input.value.length;
    counter.textContent = `${length} / ${LIMITS.messageMax}`;
  }

  // Підсумок над кнопкою оновлюється лише після першої спроби надсилання
  function updateStatus() {
    if (!form.dataset.submitted) return;
    const invalid = Object.values(fields).filter((f) => f.input.getAttribute("aria-invalid") === "true").length;
    formStatus.textContent = invalid ? `Перевірте поля з помилками: ${invalid}.` : "";
  }

  /* ---------- 7. Надсилання форми ---------- */

  form.addEventListener("submit", (event) => {
    event.preventDefault(); // надсилаємо через fetch, без перезавантаження сторінки
    if (isSubmitting) return; // захист від швидкого повторного натискання

    form.dataset.submitted = "true";
    Object.keys(fields).forEach((key) => touched.add(key));
    const results = Object.keys(validators).map((key) => validators[key]());
    updateStatus();

    if (results.includes(false)) {
      // Фокус на першому полі з помилкою — зручно для клавіатури та скрінрідера
      const firstInvalid = Object.values(fields).find((f) => f.input.getAttribute("aria-invalid") === "true");
      firstInvalid?.input.focus();
      return;
    }

    // Надсилання на пошту салону через FormSubmit (адреса — в data-endpoint форми)
    isSubmitting = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "Надсилаємо…";
    formStatus.textContent = "";
    const name = fields.name.input.value.trim();
    const topicSelect = document.getElementById("topic");
    const topic = topicSelect ? topicSelect.options[topicSelect.selectedIndex].text : "";
    const payload = {
      "Ім'я": name,
      Телефон: fields.phone.input.value.trim(),
      Email: fields.email.input.value.trim(),
      Тема: topic,
      Повідомлення: fields.message.input.value.trim(),
      _replyto: fields.email.input.value.trim(),
      _subject: `JuliGrain: ${topic || "звернення"} — ${name}`,
      _template: "table",
      _captcha: "false",
      _honey: form.querySelector('[name="_honey"]')?.value || "",
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    fetch(form.dataset.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
      .then((response) => response.json().catch(() => ({})).then((data) => response.ok && String(data.success) === "true"))
      .catch(() => false)
      .then((sent) => {
        clearTimeout(timer);
        // Кнопку розблоковуємо до відкриття вікна, щоб після закриття на неї можна було повернути фокус
        isSubmitting = false;
        submitBtn.disabled = false;
        submitBtn.textContent = "Надіслати";
        if (sent) resetForm(); // при помилці дані лишаються у формі
        openModal(name, sent);
      });
  });

  function resetForm() {
    form.reset();
    delete form.dataset.submitted;
    touched.clear();
    Object.values(fields).forEach(clearError);
    formStatus.textContent = "";
    phoneHint.textContent = PHONE_HINT;
    updateCounter();
  }

  /* ---------- 8. Доступне модальне вікно ---------- */

  const pageRegions = () => [...document.body.children].filter((el) => !el.contains(modal) && el.tagName !== "SCRIPT");

  const modalTitleText = document.getElementById("modalTitleText");
  const modalText = document.getElementById("modalText");
  const modalFallback = document.getElementById("modalFallback");
  const modalIcon = document.getElementById("modalIcon");

  function openModal(name, sent) {
    lastFocused = document.activeElement === document.body ? submitBtn : document.activeElement;
    modalName.textContent = name; // textContent: HTML у полі імені не виконається
    modalTitleText.textContent = sent ? "Дякуємо, " : "Не вдалося надіслати, ";
    modalText.textContent = sent
      ? "Ми отримали ваше звернення. Адміністраторка відповість протягом робочого дня."
      : "Схоже, зв'язок перервався. Ваш текст лишився у формі — спробуйте ще раз або напишіть нам в Instagram чи зателефонуйте.";
    modalFallback.classList.toggle("hidden", sent);
    modalFallback.classList.toggle("grid", !sent);
    modalIcon.classList.toggle("hidden", !sent);
    modalIcon.classList.toggle("flex", sent);
    // Модальне вікно виносимо в body, щоб решту сторінки можна було зробити inert
    document.body.append(modal);
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    document.body.classList.add("overflow-hidden");
    pageRegions().forEach((el) => (el.inert = true));
    closeModalBtn.focus();
  }

  function closeModal() {
    modal.classList.remove("flex");
    modal.classList.add("hidden");
    document.body.classList.remove("overflow-hidden");
    pageRegions().forEach((el) => (el.inert = false));
    (lastFocused && document.contains(lastFocused) ? lastFocused : submitBtn).focus();
  }

  closeModalBtn.addEventListener("click", closeModal);

  // Клік по затемненому фону закриває вікно, клік усередині картки — ні
  modal.addEventListener("click", (event) => {
    if (!modalCard.contains(event.target)) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (modal.classList.contains("hidden")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
    }
    // Фокус залишається всередині вікна
    if (event.key === "Tab") {
      const focusable = [...modalCard.querySelectorAll("button, a[href]")];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  updateCounter();
})();
