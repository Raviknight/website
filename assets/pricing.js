// Builds the pricing page from data/pricing.json. Edit prices with tools/price_editor.py.
// Set from the visitor's currency once the prices load.
let money = (n) => "$" + n.toLocaleString("en-US", {
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

// Every price is converted to the visitor's currency, with any regional price applied,
// so minimums and calculator totals follow from the converted prices.
// Each PM Tracker plan gets its own bands: the band price plus the plan's extra per machine.
function localise(pricing) {
  const local = typeof localPricing === "function" ? localPricing(pricing) : null;
  const convert = local ? local.convert : (n) => n;
  if (local) money = local.format;
  const copy = structuredClone(pricing);
  copy.forge.plans.forEach((plan) => { plan.price = convert(plan.price); });
  copy.forge.modules.forEach((module) => { module.price = convert(module.price); });
  const pm = copy.pm_tracker;
  pm.plans.forEach((plan) => {
    plan.tiers = pm.tiers.map((tier) => ({ up_to: tier.up_to, price: convert(tier.price + (plan.extra || 0)) }));
  });
  return { pricing: copy, note: local ? local.note : "" };
}

// A band's minimum is the most any smaller plant pays, so adding machines never lowers the bill.
const pmMinimum = (tiers, tier) =>
  Math.max(0, ...tiers.filter((t) => t.up_to < tier.up_to).map((t) => t.up_to * t.price));

// The band a plant falls in sets the price of all its machines.
function renderPm(pm) {
  document.querySelector("#pm-offer").textContent =
    "Two plans, both with unlimited users. The price per machine drops as you add more.";
  const trial = document.querySelector("#pm-trial");
  if (pm.free_months) {
    trial.textContent =
      `Contact us and we'll give you a ${pm.free_months}-month trial licence as a gift, ` +
      `followed by a ${pm.grace_days}-day grace period. If you don't buy a licence after that, ` +
      "PM Tracker goes read-only: you can still see all your data, and installing a licence unlocks it.";
  } else {
    trial.hidden = true;
  }

  const cards = document.querySelector("#pm-plans");
  pm.plans.forEach((plan) => {
    const card = el("article", "card product");
    card.append(el("h3", "", plan.name));
    const price = el("p", "price");
    const cheapest = plan.tiers[plan.tiers.length - 1].price;
    price.append("From ", el("strong", "", money(cheapest)), " per machine per month");
    card.append(price, el("p", "", plan.summary));
    const list = el("ul", "ticks");
    plan.includes.forEach((item) => list.append(el("li", "", item)));
    card.append(list);
    cards.append(card);
  });

  const head = document.querySelector("#pm-tiers-head");
  pm.plans.forEach((plan) => {
    const cell = el("th", "", plan.name);
    cell.scope = "col";
    head.append(cell);
  });
  const rows = document.querySelector("#pm-tiers");
  let from = 1;
  pm.tiers.forEach((tier, i) => {
    const row = el("tr");
    row.append(el("th", "", `${from} to ${tier.up_to} machines`));
    row.firstChild.scope = "row";
    pm.plans.forEach((plan) => {
      const band = plan.tiers[i];
      const minimum = pmMinimum(plan.tiers, band);
      const floor = minimum > from * band.price ? `, ${money(minimum)} minimum` : "";
      row.append(el("td", "", `${money(band.price)} per machine per month${floor}`));
    });
    rows.append(row);
    from = tier.up_to + 1;
  });
  const last = el("tr");
  last.append(el("th", "", `More than ${from - 1} machines`));
  last.firstChild.scope = "row";
  const contact = el("td", "", "Contact us");
  contact.colSpan = pm.plans.length;
  last.append(contact);
  rows.append(last);

  document.querySelector("#pm-band-note").textContent =
    "Your band's price applies to all your machines, subject to the minimum shown.";

  const select = document.querySelector("#pm-plan");
  pm.plans.forEach((plan, i) => select.append(new Option(plan.name, i)));
  const input = document.querySelector("#pm-machines");
  const result = document.querySelector("#pm-result");
  const update = () => {
    const tiers = pm.plans[select.value].tiers;
    const machines = Math.max(1, Math.floor(Number(input.value)) || 1);
    const tier = tiers.find((t) => machines <= t.up_to);
    if (!tier) {
      result.textContent = `For ${machines} machines, contact us for a quote.`;
    } else {
      const minimum = pmMinimum(tiers, tier);
      const monthly = Math.max(machines * tier.price, minimum);
      const how = monthly === minimum ? "this band's minimum charge" : `${machines} × ${money(tier.price)}`;
      result.textContent = `${money(monthly)} per month, or ${money(monthly * 12)} per year (${how}).`;
    }
  };
  select.addEventListener("change", update);
  input.addEventListener("input", update);
  update();
}

fetch("../data/pricing.json", { cache: "no-cache" })
  .then((response) => {
    if (!response.ok) throw new Error(response.status);
    return response.json();
  })
  .then((data) => {
    const { pricing, note } = localise(data);
    document.querySelector("#price-note").textContent = [note, pricing.note].filter(Boolean).join(" ");
    document.querySelector("#setup-note").textContent = pricing.setup_note;
    renderForge(pricing.forge);
    renderPm(pricing.pm_tracker);
  })
  .catch(() => {
    document.querySelector("#price-note").textContent =
      "We couldn't load the prices just now. Please contact us for a quote.";
  });
