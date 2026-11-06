// Builds the pricing page from data/pricing.json. Edit prices with tools/price_editor.py.
const money = (n) => "$" + n.toLocaleString("en-US", {
  minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  maximumFractionDigits: 2,
});
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

function renderForge(forge) {
  const plans = document.querySelector("#forge-plans");
  forge.plans.forEach((plan) => {
    const card = el("article", "card product");
    card.append(el("h3", "", plan.name));
    const price = el("p", "price");
    price.append(el("strong", "", money(plan.price)), ` per ${forge.seat_label} per month`);
    card.append(price, el("p", "", plan.summary));
    const list = el("ul", "ticks");
    plan.includes.forEach((item) => list.append(el("li", "", item)));
    card.append(list);
    plans.append(card);
  });

  document.querySelector("#modules-note").textContent = forge.modules_note;
  const rows = document.querySelector("#forge-modules");
  forge.modules.forEach((module) => {
    const row = el("tr");
    row.append(el("th", "", module.name), el("td", "", module.summary));
    const unit = module.unit || "month";
    const cost = module.price === null || module.price === undefined
      ? "Ask us"
      : module.unit
        ? `${money(module.price)} per ${unit} per month`
        : `${money(module.price)} per ${forge.seat_label} per month`;
    row.append(el("td", "", cost));
    row.firstChild.scope = "row";
    rows.append(row);
  });

  const select = document.querySelector("#forge-plan");
  forge.plans.forEach((plan, i) => select.append(new Option(`${plan.name} (${money(plan.price)})`, i)));
  const users = document.querySelector("#forge-users");
  const result = document.querySelector("#forge-result");
  const update = () => {
    const count = Math.max(1, Math.floor(Number(users.value)) || 1);
    const monthly = forge.plans[select.value].price * count;
    result.textContent = `${money(monthly)} per month, or ${money(monthly * 12)} per year, before modules.`;
  };
  select.addEventListener("change", update);
  users.addEventListener("input", update);
  update();
}

// Visitors in the regional price countries see every price scaled, so minimums and totals follow.
function regionalPrices(pricing) {
  const factor = typeof priceFactor === "function" ? priceFactor(pricing) : 1;
  if (factor === 1) return pricing;
  const scale = (price) => (price === null || price === undefined ? price : Math.round(price * factor * 100) / 100);
  const copy = structuredClone(pricing);
  copy.forge.plans.forEach((plan) => { plan.price = scale(plan.price); });
  copy.forge.modules.forEach((module) => { module.price = scale(module.price); });
  copy.pm_tracker.tiers.forEach((tier) => { tier.price = scale(tier.price); });
  return copy;
}

// A band's minimum is the most any smaller plant pays, so adding machines never lowers the bill.
const pmMinimum = (tiers, tier) =>
  Math.max(0, ...tiers.filter((t) => t.up_to < tier.up_to).map((t) => t.up_to * t.price));

// The band a plant falls in sets the price of all its machines.
function renderPm(pm) {
  document.querySelector("#pm-offer").textContent =
    "Every plan includes unlimited users, and the price per machine drops as you add more.";
  const trial = document.querySelector("#pm-trial");
  if (pm.free_months) {
    trial.textContent =
      `Contact us and we'll give you a ${pm.free_months}-month trial licence as a gift, ` +
      `followed by a ${pm.grace_days}-day grace period. If you don't buy a licence after that, ` +
      "PM Tracker goes read-only: you can still see all your data, and installing a licence unlocks it.";
  } else {
    trial.hidden = true;
  }

  const rows = document.querySelector("#pm-tiers");
  const addRow = (label, cost) => {
    const row = el("tr");
    row.append(el("th", "", label), el("td", "", cost));
    row.firstChild.scope = "row";
    rows.append(row);
  };
  let from = 1;
  pm.tiers.forEach((tier) => {
    const minimum = pmMinimum(pm.tiers, tier);
    const floor = minimum > from * tier.price ? `, ${money(minimum)} minimum` : "";
    addRow(`${from} to ${tier.up_to} machines`, `${money(tier.price)} per machine per month${floor}`);
    from = tier.up_to + 1;
  });
  addRow(`More than ${from - 1} machines`, "Contact us");

  document.querySelector("#pm-band-note").textContent =
    "Your band's price applies to all your machines, subject to the minimum shown.";

  const input = document.querySelector("#pm-machines");
  const result = document.querySelector("#pm-result");
  const update = () => {
    const machines = Math.max(1, Math.floor(Number(input.value)) || 1);
    const tier = pm.tiers.find((t) => machines <= t.up_to);
    if (!tier) {
      result.textContent = `For ${machines} machines, contact us for a quote.`;
    } else {
      const minimum = pmMinimum(pm.tiers, tier);
      const monthly = Math.max(machines * tier.price, minimum);
      const how = monthly === minimum ? "this band's minimum charge" : `${machines} × ${money(tier.price)}`;
      result.textContent = `${money(monthly)} per month, or ${money(monthly * 12)} per year (${how}).`;
    }
  };
  input.addEventListener("input", update);
  update();
}

fetch("../data/pricing.json", { cache: "no-cache" })
  .then((response) => {
    if (!response.ok) throw new Error(response.status);
    return response.json();
  })
  .then((data) => {
    const pricing = regionalPrices(data);
    document.querySelector("#price-note").textContent = pricing.note;
    document.querySelector("#setup-note").textContent = pricing.setup_note;
    renderForge(pricing.forge);
    renderPm(pricing.pm_tracker);
  })
  .catch(() => {
    document.querySelector("#price-note").textContent =
      "We couldn't load the prices just now. Please contact us for a quote.";
  });
