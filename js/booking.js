// Покроковий запис: вибір зберігається в пам’яті до перезавантаження сторінки.
(() => {
  const section = document.querySelector("#booking");
  if (!section) return;
  const panel = section.querySelector(".booking-panel");
  const titles = [
    "Оберіть послугу",
    "Оберіть параметри",
    "Оберіть майстра",
    "Дата і час",
    "Перевірте запис",
  ];
  const services = [...panel.querySelectorAll(".booking-option")].map((button) => ({
    name: button.querySelector("strong").textContent,
    detail: button.querySelector("span").textContent,
  }));
  const parameters = [
    ["Без укладки", "З укладкою"],
    ["Натуральний образ", "Виразний образ"],
    ["Зволоження", "Очищення"],
  ];
  const masters = [
    "Будь-який майстер — демоприклад",
    "Майстер 1 — демоприклад",
    "Майстер 2 — демоприклад",
  ];
  const state = { service: null, parameter: null, master: null, date: "", time: "" };
  let step = 0;

  // Перетворюємо індикатори кроків на доступні з клавіатури кнопки.
  const steps = [...section.querySelectorAll(".booking-step")].map((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = item.className;
    button.innerHTML = item.innerHTML;
    button.addEventListener("click", () => go(index));
    item.replaceWith(button);
    return button;
  });

  const today = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  };
  const complete = (index) =>
    [
      state.service !== null,
      state.parameter !== null,
      state.master !== null,
      Boolean(state.date && state.date >= today() && state.time),
    ][index];

  function go(target) {
    // Назад можна перейти завжди; вперед — після заповнення попередніх кроків.
    if (target > step) {
      for (let index = 0; index < target; index++) {
        if (!complete(index)) {
          step = index;
          render();
          panel.querySelector(".booking-message").textContent = "Спочатку заповніть цей крок.";
          panel.querySelector("h3").focus();
          return;
        }
      }
    }
    step = target;
    render();
    panel.querySelector("h3").focus();
  }

  function choices(items, key) {
    const group = document.createElement("div");
    group.className = "booking-options grid gap-3";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", titles[step]);
    items.forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className =
        "booking-option flex min-h-16 flex-col justify-between gap-2 rounded-lg border border-stone-400 p-4 text-left transition hover:bg-linen aria-pressed:bg-sage aria-pressed:text-white aria-pressed:border-sage sm:flex-row sm:items-center";
      button.classList.toggle("selected", state[key] === index);
      button.setAttribute("aria-pressed", String(state[key] === index));
      const name = document.createElement("strong");
      name.textContent = typeof item === "string" ? item : item.name;
      button.append(name);
      if (item.detail) {
        const detail = document.createElement("span");
        detail.textContent = item.detail;
        button.append(detail);
      }
      button.addEventListener("click", () => {
        if (key === "service" && state.service !== index) state.parameter = null;
        state[key] = index;
        [...group.children].forEach((option, optionIndex) => {
          option.classList.toggle("selected", optionIndex === index);
          option.setAttribute("aria-pressed", String(optionIndex === index));
        });
        panel.querySelector(".booking-message").textContent = "";
      });
      group.append(button);
    });
    return group;
  }

  function render() {
    steps.forEach((button, index) => {
      button.classList.toggle("active", index === step);
      button.classList.toggle("completed", index < step);
      if (index === step) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
    panel.innerHTML = `<div class="booking-panel-heading mb-6"><span class="step-label text-sm text-muted">Крок ${step + 1} із 5</span><h3 class="mb-4 font-display text-2xl font-semibold" tabindex="-1">${titles[step]}</h3></div>`;
    if (step === 0) panel.append(choices(services, "service"));
    if (step === 1) panel.append(choices(parameters[state.service], "parameter"));
    if (step === 2) panel.append(choices(masters, "master"));
    if (step === 3) {
      const fields = document.createElement("div");
      fields.className =
        "booking-fields grid gap-6 sm:grid-cols-2 [&_label]:grid [&_label]:gap-2 [&_input]:min-h-12 [&_input]:min-w-0 [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-stone-400 [&_input]:bg-cream [&_input]:p-3 [&_select]:min-h-12 [&_select]:min-w-0 [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-stone-400 [&_select]:bg-cream [&_select]:p-3 [&_input]:focus-visible:outline-sage [&_select]:focus-visible:outline-sage";
      fields.innerHTML =
        '<label>Дата візиту<input type="date" required></label><label>Час візиту<select required><option value="">Оберіть час</option><option>09:00</option><option>11:00</option><option>13:00</option><option>15:00</option><option>17:00</option></select></label>';
      const date = fields.querySelector("input");
      const time = fields.querySelector("select");
      date.min = today();
      date.value = state.date;
      time.value = state.time;
      date.addEventListener("input", () => {
        state.date = date.value;
      });
      time.addEventListener("change", () => {
        state.time = time.value;
      });
      panel.append(fields);
    }
    if (step === 4) {
      const summary = document.createElement("dl");
      summary.className = "booking-summary mb-6 grid gap-2 sm:grid-cols-2 [&_dt]:font-semibold";
      const date = state.date.split("-").reverse().join(".");
      const entries = {
        Послуга: services[state.service].name,
        "Уточнення послуги": services[state.service].detail,
        Параметри: parameters[state.service][state.parameter],
        Майстер: masters[state.master],
        "Дата і час": `${date}, ${state.time}`,
      };
      Object.entries(entries).forEach(([label, value]) => {
        const dt = document.createElement("dt");
        const dd = document.createElement("dd");
        dt.textContent = label;
        dd.textContent = value;
        summary.append(dt, dd);
      });
      panel.append(summary);
      const note = document.createElement("p");
      note.textContent =
        "Це демонстраційний запис. Дані не надсилаються до студії; майстри й години наведені для прикладу.";
      panel.append(note);
    }
    const message = document.createElement("p");
    message.className = "booking-message my-4 min-h-6 text-sm text-red-800";
    message.setAttribute("role", "status");
    panel.append(message);
    const footer = document.createElement("div");
    footer.className = "booking-footer mt-6 flex flex-wrap items-center justify-between gap-3";
    const back = document.createElement("button");
    back.type = "button";
    back.className =
      "button inline-flex min-h-11 items-center justify-center rounded-lg bg-transparent px-6 py-3 text-center font-semibold text-sage transition duration-200 hover:bg-linen active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 border border-sage";
    back.textContent = "Назад";
    back.disabled = step === 0;
    back.addEventListener("click", () => go(step - 1));
    const next = document.createElement("button");
    next.type = "button";
    next.className =
      "button inline-flex min-h-11 items-center justify-center rounded-lg bg-sage px-6 py-3 text-center font-semibold text-white transition duration-200 hover:bg-deep active:scale-95 disabled:cursor-not-allowed disabled:opacity-50";
    next.textContent = step === 4 ? "Завершити демозапис" : "Продовжити";
    next.addEventListener("click", () => {
      if (step < 4) return go(step + 1);
      panel.innerHTML =
        '<h3 class="mb-4 font-display text-2xl font-semibold" tabindex="-1">Демозапис завершено</h3><p role="status">Ви пройшли всі кроки. Реальне бронювання не створено.</p><button class="button inline-flex min-h-11 items-center justify-center rounded-lg bg-sage px-6 py-3 text-center font-semibold text-white transition duration-200 hover:bg-deep active:scale-95 disabled:cursor-not-allowed disabled:opacity-50" type="button">Почати заново</button>';
      panel.querySelector("h3").focus();
      steps.forEach((button) => {
        button.disabled = true;
      });
      panel.querySelector("button").addEventListener("click", () => {
        Object.assign(state, { service: null, parameter: null, master: null, date: "", time: "" });
        steps.forEach((button) => {
          button.disabled = false;
        });
        go(0);
      });
    });
    footer.append(back, next);
    panel.append(footer);
  }
  render();
})();
