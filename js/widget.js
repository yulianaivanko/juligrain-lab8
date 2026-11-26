/**
 * Калькулятор візиту JuliGrain.
 * Послуги, ціни й тривалість читаються з прайсу на сторінці (.service-card → .price-list),
 * тож калькулятор завжди збігається з актуальними цінами. Vanilla JS в IIFE, без глобальних змінних;
 * дані користувача виводяться лише через textContent.
 */
(() => {
  "use strict";

  const MAX_ITEMS = 10;
  const RECIPIENT_MAX = 30;
  const NAME_RE = /^[\p{L}][\p{L}\s'ʼ’-]*$/u;
  const ERROR_CLASSES = ["border-red-600", "focus:border-red-600", "focus:ring-red-600/30", "bg-red-50"];
  const NORMAL_CLASSES = ["border-stone-300", "focus:border-sage", "focus:ring-gold/60", "bg-white"];
  const MSG = {
    noService: "Оберіть послугу зі списку.",
    duplicate: "Ця послуга вже є у вашому візиті.",
    tooMany: `За один візит можна обрати до ${MAX_ITEMS} послуг. Для більшого запиту зв'яжіться з адміністраторкою.`,
    pastDate: "Оберіть сьогоднішню або майбутню дату.",
    recipient: `Ім'я може містити лише літери, пробіл, апостроф або дефіс (до ${RECIPIENT_MAX} символів).`,
  };

  const money = new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 0 });
  const formatUAH = (n) => `${money.format(n)} грн`;
  const clean = (text) => String(text || "").replace(/\s+/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").trim();

  /** «МАНІКЮР» → «Манікюр»; звичайні назви лишаються як є. */
  function groupName(text) {
    const t = clean(text);
    return t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t;
  }

  const todayISO = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  };

  function formatDuration(minutes) {
    if (!minutes) return "—";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return [h ? `${h} год` : "", m ? `${m} хв` : ""].filter(Boolean).join(" ");
  }

  /** Збирає прайс зі сторінки: [{ name, services: [{ id, name, price, minutes }] }]. */
  function readPriceList(doc) {
    const groups = [];
    doc.querySelectorAll(".service-price-content").forEach((content) => {
      let current = null;
      [...content.children].forEach((node) => {
        if (node.matches(".price-group-title")) {
          current = { name: groupName(node.textContent), services: [] };
          groups.push(current);
        } else if (node.matches(".price-list") && current) {
          node.querySelectorAll("li").forEach((li) => {
            const name = clean(li.querySelector(".price-name")?.textContent);
            const price = Number(clean(li.querySelector(".price-meta strong")?.textContent).replace(/\D/g, ""));
            const time = clean(li.querySelector(".price-meta span")?.textContent);
            const minutes = /^\d+\s*хв$/.test(time) ? parseInt(time, 10) : 0;
            if (!name || !Number.isFinite(price) || price <= 0) return; // пропускаємо пошкоджені рядки
            current.services.push({ id: `${groups.length - 1}-${current.services.length}`, name, price, minutes });
          });
        }
      });
    });
    return groups.filter((g) => g.services.length);
  }

  function initCalculator(root) {
    const el = {};
    root.querySelectorAll("[data-calc]").forEach((node) => {
      el[node.dataset.calc.replace(/-(\w)/g, (_, c) => c.toUpperCase())] = node;
    });
    const required = ["form", "open", "list", "empty", "total", "count", "duration", "send"];
    const missing = required.filter((key) => !el[key]);
    if (missing.length) {
      console.warn("Калькулятор візиту: не знайдено елементи", missing);
      return;
    }

    const groups = readPriceList(document);
    if (!groups.length) {
      el.open.disabled = true;
      if (el.openLabel) el.openLabel.textContent = "Прайс недоступний";
      if (el.openHint) el.openHint.textContent = "Запишіться за телефоном +380 77 888 35 35";
      el.note.textContent = "Не вдалося завантажити прайс. Зателефонуйте нам, і ми все розрахуємо.";
      return;
    }
    const byId = new Map();
    groups.forEach((g) => g.services.forEach((s) => byId.set(s.id, { ...s, group: g.name })));
    const selected = [];

    function setError(input, box, message) {
      if (!box) return;
      const invalid = Boolean(message);
      box.textContent = message;
      box.classList.toggle("hidden", !invalid);
      input.setAttribute("aria-invalid", String(invalid));
      input.classList.remove(...(invalid ? NORMAL_CLASSES : ERROR_CLASSES));
      input.classList.add(...(invalid ? ERROR_CLASSES : NORMAL_CLASSES));
    }

    // ---------- Додавання й видалення ----------
    function showServiceError(message) {
      if (!el.serviceError) return;
      el.serviceError.textContent = message;
      el.serviceError.classList.toggle("hidden", !message);
    }

    /** Додає послугу за id. Повертає текст помилки або "". */
    function add(id) {
      const service = byId.get(id);
      if (!service) return MSG.noService;
      if (selected.some((s) => s.id === service.id)) return MSG.duplicate;
      if (selected.length >= MAX_ITEMS) return MSG.tooMany;
      selected.push(service);
      showServiceError("");
      render();
      if (el.listBox) el.listBox.scrollTop = el.listBox.scrollHeight;
      return "";
    }

    function remove(id) {
      const index = selected.findIndex((s) => s.id === id);
      if (index === -1) return;
      selected.splice(index, 1);
      render();
      const buttons = el.list.querySelectorAll("button");
      (buttons[Math.min(index, buttons.length - 1)] || el.open).focus();
    }

    /** Бажана дата: порожня (необов'язково) або не раніше за сьогодні. */
    function dateValue() {
      if (!el.date || !el.date.value) return { value: "" };
      if (el.date.value < todayISO()) return { error: MSG.pastDate };
      return { value: el.date.value.split("-").reverse().join(".") };
    }

    function recipientValue() {
      if (!el.gift || !el.gift.checked || !el.recipient) return { value: "" };
      const value = clean(el.recipient.value);
      if (value && (value.length > RECIPIENT_MAX || !NAME_RE.test(value))) return { error: MSG.recipient };
      return { value };
    }

    // ---------- Відображення ----------
    function render() {
      el.list.replaceChildren(
        ...selected.map((s) => {
          const li = document.createElement("li");
          li.className = "flex items-start justify-between gap-3 rounded-lg bg-white/10 px-3 py-2.5 text-sm";
          const info = document.createElement("div");
          info.className = "min-w-0 [overflow-wrap:anywhere]";
          const title = document.createElement("p");
          title.className = "font-semibold text-white";
          title.textContent = s.name;
          const meta = document.createElement("p");
          meta.className = "text-stone-300";
          meta.textContent = [formatUAH(s.price), s.minutes ? formatDuration(s.minutes) : "час уточнюється"].join(" · ");
          info.append(title, meta);
          const del = document.createElement("button");
          del.type = "button";
          del.className = "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/30 text-lg text-white transition hover:bg-white/15";
          del.setAttribute("aria-label", `Прибрати: ${s.name}`);
          del.textContent = "×";
          del.addEventListener("click", () => remove(s.id));
          li.append(info, del);
          return li;
        })
      );
      el.empty.classList.toggle("hidden", selected.length > 0);

      const total = selected.reduce((sum, s) => sum + s.price, 0);
      const minutes = selected.reduce((sum, s) => sum + s.minutes, 0);
      const unknownTime = selected.some((s) => !s.minutes);
      el.count.textContent = String(selected.length);
      el.duration.textContent = selected.length ? formatDuration(minutes) + (unknownTime ? " + уточнюється" : "") : "—";
      el.total.textContent = formatUAH(total);

      const recipient = recipientValue();
      if (el.recipient) setError(el.recipient, el.recipientError, recipient.error || "");
      if (el.recipient) el.recipient.disabled = !(el.gift && el.gift.checked);
      if (el.note) {
        el.note.textContent = el.gift && el.gift.checked && selected.length
          ? `Подарунковий сертифікат${recipient.value ? ` на ім'я: ${recipient.value}` : ""}`
          : "";
      }
      const date = dateValue();
      if (el.date) setError(el.date, el.dateError, date.error || "");
      el.send.disabled = !selected.length || Boolean(recipient.error) || Boolean(date.error);
      if (el.openLabel) el.openLabel.textContent = selected.length ? "Додати ще послугу" : "Обрати послуги";
      if (el.openHint) el.openHint.textContent = selected.length ? `Обрано: ${selected.length} з ${MAX_ITEMS}` : "Пошук по всьому прайсу салону";
      if (picker && picker.open) renderPicker();
    }

    // ---------- Вікно вибору послуг: пошук, напрями, додавання одним дотиком ----------
    const picker = document.getElementById("service-picker");
    const pickerList = picker && picker.querySelector("[data-picker-list]");
    const pickerChips = picker && picker.querySelector("[data-picker-chips]");
    const pickerSearch = picker && picker.querySelector("#picker-search");
    const pickerMsg = picker && picker.querySelector("[data-picker-msg]");
    let activeGroup = -1; // -1 — усі напрями

    const normalize = (text) => text.toLowerCase().replace(/[ʼ’']/g, "'");

    function pickerMessage(message) {
      pickerMsg.textContent = message;
      pickerMsg.classList.toggle("hidden", !message);
    }

    function renderChips() {
      const chip = (label, index) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className =
          "min-h-10 shrink-0 whitespace-nowrap rounded-full border border-stone-300 px-4 py-2 text-sm transition hover:border-sage aria-pressed:border-sage aria-pressed:bg-sage aria-pressed:text-white";
        b.textContent = label;
        b.setAttribute("aria-pressed", String(index === activeGroup));
        b.addEventListener("click", () => {
          activeGroup = index;
          renderChips();
          renderPicker();
          pickerList.scrollTop = 0;
        });
        return b;
      };
      pickerChips.replaceChildren(chip("Усі", -1), ...groups.map((g, i) => chip(g.name, i)));
    }

    function renderPicker() {
      const query = normalize(pickerSearch.value.trim());
      const nodes = [];
      groups.forEach((g, gi) => {
        if (activeGroup !== -1 && gi !== activeGroup) return;
        const items = g.services.filter((s) => !query || normalize(s.name).includes(query));
        if (!items.length) return;
        const heading = document.createElement("p");
        heading.className = "sticky top-0 z-10 bg-cream pb-1 pt-4 text-xs font-semibold uppercase tracking-[0.12em] text-muted";
        heading.textContent = g.name;
        nodes.push(heading);
        items.forEach((s) => {
          const chosen = selected.some((x) => x.id === s.id);
          const row = document.createElement("button");
          row.type = "button";
          row.dataset.id = s.id;
          row.setAttribute("aria-pressed", String(chosen));
          row.className =
            "group/row flex w-full items-center justify-between gap-3 border-b border-stone-200 py-3 text-left transition hover:bg-linen/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-gold";
          const info = document.createElement("span");
          info.className = "min-w-0";
          const name = document.createElement("span");
          name.className = "block text-[15px] leading-snug";
          name.textContent = s.name;
          const meta = document.createElement("span");
          meta.className = "mt-0.5 block text-sm text-muted";
          meta.textContent = [formatUAH(s.price), s.minutes ? formatDuration(s.minutes) : "час уточнюється"].join(" · ");
          info.append(name, meta);
          const icon = document.createElement("span");
          icon.setAttribute("aria-hidden", "true");
          icon.className = chosen
            ? "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage text-white"
            : "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sage text-xl leading-none text-sage transition group-hover/row:bg-sage group-hover/row:text-white";
          icon.textContent = chosen ? "✓" : "+";
          row.setAttribute("aria-label", `${s.name}, ${formatUAH(s.price)}${chosen ? ", у візиті — натисніть, щоб прибрати" : ""}`);
          row.append(info, icon);
          nodes.push(row);
        });
      });
      if (!nodes.length) {
        const empty = document.createElement("p");
        empty.className = "py-10 text-center text-muted";
        empty.textContent = "Нічого не знайдено. Спробуйте інше слово або напрям «Усі».";
        nodes.push(empty);
      }
      pickerList.replaceChildren(...nodes);
      const total = selected.reduce((sum, s) => sum + s.price, 0);
      picker.querySelector("[data-picker-count]").textContent = selected.length ? `Обрано: ${selected.length}` : "Нічого не обрано";
      picker.querySelector("[data-picker-total]").textContent = selected.length ? formatUAH(total) : "";
    }

    function closePicker() {
      if (!picker.open || picker.classList.contains("is-closing")) return;
      picker.classList.add("is-closing");
      setTimeout(() => {
        picker.classList.remove("is-closing");
        picker.close();
      }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180);
    }

    if (picker && typeof picker.showModal === "function") {
      el.open.addEventListener("click", () => {
        pickerSearch.value = "";
        pickerMessage("");
        renderChips();
        renderPicker();
        pickerList.scrollTop = 0;
        document.documentElement.classList.add("overflow-hidden");
        picker.showModal();
        // на телефоні не відкриваємо клавіатуру одразу — спершу видно список
        if (matchMedia("(pointer: fine)").matches) pickerSearch.focus();
      });
      pickerList.addEventListener("click", (event) => {
        const row = event.target.closest("button[data-id]");
        if (!row) return;
        const id = row.dataset.id;
        if (selected.some((s) => s.id === id)) {
          selected.splice(selected.findIndex((s) => s.id === id), 1);
          pickerMessage("");
          render();
        } else {
          pickerMessage(add(id));
        }
        renderPicker();
        pickerList.querySelector(`button[data-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
      });
      pickerSearch.addEventListener("input", () => {
        renderPicker();
        pickerList.scrollTop = 0;
      });
      picker.querySelectorAll("[data-picker-close]").forEach((b) => b.addEventListener("click", closePicker));
      picker.addEventListener("cancel", (event) => {
        event.preventDefault();
        closePicker();
      });
      picker.addEventListener("click", (event) => {
        if (event.target === picker) closePicker();
      });
      picker.addEventListener("close", () => {
        document.documentElement.classList.remove("overflow-hidden");
        el.open.focus();
      });
    }

    // ---------- Вікно підтвердження запису: ім'я, телефон, коментар ----------
    const dialog = document.getElementById("booking-dialog");
    const bookingForm = document.getElementById("booking-form");
    const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
    const bookingField = (id) => ({ input: document.getElementById(id), error: document.getElementById(`${id}-error`) });
    const nameField = bookingField("booking-name");
    const phoneField = bookingField("booking-phone");
    const showFieldError = (field, message) => setError(field.input, field.error, message);

    function normalizePhone(raw) {
      const digits = raw.replace(/\D/g, "");
      if (/^0\d{9}$/.test(digits)) return `+38${digits}`;
      if (/^380\d{9}$/.test(digits)) return `+${digits}`;
      return raw.trim();
    }
    function checkName() {
      const value = clean(nameField.input.value);
      const message = !value
        ? "Вкажіть ваше ім'я."
        : value.length < 2 || !NAME_RE.test(value)
          ? "Ім'я може містити лише літери, пробіл, апостроф або дефіс."
          : "";
      showFieldError(nameField, message);
      return !message;
    }
    function checkPhone() {
      const value = normalizePhone(phoneField.input.value);
      phoneField.input.value = value;
      const message = !value ? "Вкажіть номер телефону." : /^\+380\d{9}$/.test(value) ? "" : "Номер у форматі +380XXXXXXXXX.";
      showFieldError(phoneField, message);
      return !message;
    }

    function closeBooking() {
      if (!dialog.open || dialog.classList.contains("is-closing")) return;
      dialog.classList.add("is-closing");
      setTimeout(() => {
        dialog.classList.remove("is-closing");
        dialog.close();
      }, reduceMotion() ? 0 : 180);
    }

    function openBooking() {
      if (!selected.length || !dialog || typeof dialog.showModal !== "function") return;
      const recipient = recipientValue();
      const date = dateValue();
      if (recipient.error || date.error) return;
      const time = el.time ? el.time.value : "";
      const gift = el.gift && el.gift.checked;
      dialog.querySelector("[data-booking-summary]").replaceChildren(
        ...selected.map((s) => {
          const li = document.createElement("li");
          li.className = "flex justify-between gap-3";
          const name = document.createElement("span");
          name.textContent = s.name;
          const price = document.createElement("span");
          price.className = "shrink-0 font-semibold";
          price.textContent = formatUAH(s.price);
          li.append(name, price);
          return li;
        })
      );
      const when = [date.value, time && `о ${time}`].filter(Boolean).join(" ") || "час узгодимо телефоном";
      dialog.querySelector("[data-booking-meta]").textContent =
        `Разом ${el.total.textContent} · ${el.duration.textContent} · ${when}` +
        (gift ? ` · сертифікат${recipient.value ? ` на ім'я ${recipient.value}` : ""}` : "");
      dialog.querySelector('[data-booking-step="form"]').classList.remove("hidden");
      dialog.querySelector('[data-booking-step="done"]').classList.add("hidden");
      [nameField, phoneField].forEach((f) => showFieldError(f, ""));
      document.documentElement.classList.add("overflow-hidden");
      dialog.showModal();
      nameField.input.focus();
    }

    function resetCalculator() {
      selected.splice(0);
      if (el.gift) el.gift.checked = false;
      if (el.recipient) el.recipient.value = "";
      if (el.date) el.date.value = "";
      if (el.time) el.time.value = "";
      bookingForm.reset();
      render();
    }

    if (dialog && bookingForm) {
      bookingForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const ok = [checkName(), checkPhone()];
        if (ok.includes(false)) {
          (ok[0] ? phoneField : nameField).input.focus();
          return;
        }
        const button = bookingForm.querySelector('[type="submit"]');
        button.disabled = true;
        button.textContent = "Надсилаємо…";
        setTimeout(() => {
          button.disabled = false;
          button.textContent = "Підтвердити запис";
          const name = clean(nameField.input.value);
          const title = dialog.querySelector("[data-booking-done-title]");
          title.textContent = `Дякуємо, ${name}!`;
          dialog.querySelector("[data-booking-done-text]").textContent =
            `Запис прийнято. Адміністраторка зателефонує на номер ${phoneField.input.value}, щоб підтвердити час.`;
          dialog.querySelector('[data-booking-step="form"]').classList.add("hidden");
          dialog.querySelector('[data-booking-step="done"]').classList.remove("hidden");
          title.focus();
          resetCalculator();
        }, 600);
      });
      nameField.input.addEventListener("blur", () => nameField.input.value && checkName());
      phoneField.input.addEventListener("blur", () => phoneField.input.value && checkPhone());
      [nameField, phoneField].forEach((f) =>
        f.input.addEventListener("input", () => f.input.getAttribute("aria-invalid") === "true" && showFieldError(f, ""))
      );
      dialog.querySelectorAll("[data-booking-close]").forEach((b) => b.addEventListener("click", closeBooking));
      dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        closeBooking();
      });
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) closeBooking();
      });
      dialog.addEventListener("close", () => {
        document.documentElement.classList.remove("overflow-hidden");
        (el.send.disabled ? el.open : el.send).focus();
      });
    }

    el.form.addEventListener("submit", (event) => event.preventDefault());
    if (el.gift) el.gift.addEventListener("change", render);
    if (el.recipient) el.recipient.addEventListener("input", render);
    if (el.date) {
      el.date.min = todayISO();
      el.date.addEventListener("input", render);
      el.date.addEventListener("change", render);
    }
    el.send.addEventListener("click", openBooking);

    render();
  }

  const start = () => document.querySelectorAll("[data-visit-calculator]").forEach(initCalculator);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
