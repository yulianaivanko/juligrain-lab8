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
    const required = ["form", "category", "service", "list", "empty", "total", "count", "duration", "send"];
    const missing = required.filter((key) => !el[key]);
    if (missing.length) {
      console.warn("Калькулятор візиту: не знайдено елементи", missing);
      return;
    }

    const groups = readPriceList(document);
    if (!groups.length) {
      el.category.innerHTML = "";
      el.category.append(new Option("Прайс недоступний", ""));
      el.category.disabled = el.service.disabled = true;
      el.note.textContent = "Не вдалося завантажити прайс. Зателефонуйте нам, і ми все розрахуємо.";
      return;
    }
    const byId = new Map();
    groups.forEach((g) => g.services.forEach((s) => byId.set(s.id, { ...s, group: g.name })));
    const selected = [];

    // ---------- Списки напрямів і послуг ----------
    el.category.innerHTML = "";
    groups.forEach((g, index) => el.category.append(new Option(g.name, String(index))));

    function fillServices() {
      const group = groups[Number(el.category.value)] || groups[0];
      el.service.innerHTML = "";
      el.service.append(new Option("Оберіть послугу", ""));
      group.services.forEach((s) => {
        const time = s.minutes ? `, ${formatDuration(s.minutes)}` : "";
        el.service.append(new Option(`${s.name} — ${formatUAH(s.price)}${time}`, s.id));
      });
      setError(el.service, el.serviceError, "");
    }

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
    function add() {
      const service = byId.get(el.service.value);
      if (!service) return setError(el.service, el.serviceError, MSG.noService);
      if (selected.some((s) => s.id === service.id)) return setError(el.service, el.serviceError, MSG.duplicate);
      if (selected.length >= MAX_ITEMS) return setError(el.service, el.serviceError, MSG.tooMany);
      setError(el.service, el.serviceError, "");
      selected.push(service);
      el.service.value = "";
      render();
    }

    function remove(id) {
      const index = selected.findIndex((s) => s.id === id);
      if (index === -1) return;
      selected.splice(index, 1);
      render();
      const buttons = el.list.querySelectorAll("button");
      (buttons[Math.min(index, buttons.length - 1)] || el.service).focus();
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
          li.className = "flex items-start justify-between gap-3 rounded-lg border border-stone-300 bg-white px-4 py-3 text-sm";
          const info = document.createElement("div");
          info.className = "min-w-0 [overflow-wrap:anywhere]";
          const title = document.createElement("p");
          title.className = "font-semibold text-sage";
          title.textContent = s.name;
          const meta = document.createElement("p");
          meta.className = "text-muted";
          meta.textContent = [s.group, formatUAH(s.price), s.minutes ? formatDuration(s.minutes) : "час уточнюється"].join(" · ");
          info.append(title, meta);
          const del = document.createElement("button");
          del.type = "button";
          del.className = "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-stone-300 text-lg text-sage transition hover:border-sage hover:bg-linen";
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
      if (el.giftBox) el.giftBox.classList.toggle("hidden", !(el.gift && el.gift.checked));
      if (el.note) {
        el.note.textContent = el.gift && el.gift.checked && selected.length
          ? `Подарунковий сертифікат${recipient.value ? ` на ім'я: ${recipient.value}` : ""}`
          : "";
      }
      el.send.disabled = !selected.length || Boolean(recipient.error);
    }

    // ---------- Перенесення розрахунку у форму зворотного зв'язку ----------
    function sendToContactForm() {
      if (!selected.length) return;
      const recipient = recipientValue();
      if (recipient.error) return;
      const gift = el.gift && el.gift.checked;
      const lines = [
        gift ? "Хочу оформити подарунковий сертифікат на послуги:" : "Хочу записатися на послуги:",
        ...selected.map((s) => `• ${s.name} — ${formatUAH(s.price)}`),
        `Разом: ${el.total.textContent}, орієнтовно ${el.duration.textContent}.`,
      ];
      if (gift && recipient.value) lines.push(`Сертифікат на ім'я: ${recipient.value}.`);
      const message = document.getElementById("message");
      const topic = document.getElementById("topic");
      if (topic) topic.value = gift ? "certificate" : "consultation";
      if (message) {
        message.value = lines.join("\n").slice(0, Number(message.maxLength) > 0 ? message.maxLength : 1000);
        message.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const contact = document.getElementById("contact");
      if (contact) contact.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      const name = document.getElementById("username");
      if (name) setTimeout(() => name.focus({ preventScroll: true }), 400);
    }

    el.category.addEventListener("change", fillServices);
    el.service.addEventListener("change", () => setError(el.service, el.serviceError, ""));
    el.form.addEventListener("submit", (event) => {
      event.preventDefault();
      add();
    });
    if (el.gift) el.gift.addEventListener("change", render);
    if (el.recipient) el.recipient.addEventListener("input", render);
    el.send.addEventListener("click", sendToContactForm);

    fillServices();
    render();
  }

  const start = () => document.querySelectorAll("[data-visit-calculator]").forEach(initCalculator);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
