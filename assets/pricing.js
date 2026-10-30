// Builds the pricing page from data/pricing.json. Edit prices with tools/price_editor.py.
const money = (n) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 2 });
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

// The band a plant falls in sets the price of all its machines.
function renderPm(pm) {
  const gift = pm.free_months ? `New customers get their first ${pm.free_months} months as a gift. ` : "";
  document.querySelector("#pm-offer").textContent =
    `${gift}Every plan includes unlimited users, and the price per machine drops as you add more.`;

  const rows = document.querySelector("#pm-tiers");
  const addRow = (label, cost) => {
    const row = el("tr");
    row.append(el("th", "", label), el("td", "", cost));
    row.firstChild.scope = "row";
    rows.append(row);
  };
  let from = 1;
  pm.tiers.forEach((tier) => {
    addRow(`${from} to ${tier.up_to} machines`, `${money(tier.price)} per machine per month`);
    from = tier.up_to + 1;
  });
  addRow(`More than ${from - 1} machines`, "Contact us");

  const top = pm.tiers[pm.tiers.length - 1];
  document.querySelector("#pm-band-note").textContent =
    `Your band's price applies to all your machines. For example, ${top.up_to} machines at ` +
    `${money(top.price)} comes to ${money(top.up_to * top.price)} per month.`;

  const input = document.querySelector("#pm-machines");
  const result = document.querySelector("#pm-result");
  const update = () => {
    const machines = Math.max(1, Math.floor(Number(input.value)) || 1);
    const tier = pm.tiers.find((t) => machines <= t.up_to);
    if (!tier) {
      result.textContent = `For ${machines} machines, contact us for a quote.`;
    } else {
      const monthly = machines * tier.price;
      const after = pm.free_months ? `, after your ${pm.free_months}-month gift` : "";
      result.textContent =
        `${money(monthly)} per month, or ${money(monthly * 12)} per year${after} ` +
        `(${machines} × ${money(tier.price)}).`;
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
  .then((pricing) => {
    document.querySelector("#price-note").textContent = pricing.note;
    document.querySelector("#setup-note").textContent = pricing.setup_note;
    renderForge(pricing.forge);
    renderPm(pricing.pm_tracker);
  })
  .catch(() => {
    document.querySelector("#price-note").textContent =
      "We couldn't load the prices just now. Please contact us for a quote.";
  });
