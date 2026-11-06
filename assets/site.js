// Site settings. Paste each code here to switch the feature on.
const CONTACT = {
  web3formsKey: "eacdeee0-60fd-43c5-8980-fc4e0c8dc4c5", // public by design; it can only send to our inbox
  email: ["26ravi.sharma", "gmail.com"], // split so simple scrapers miss it
  goatcounter: "", // the "yourcode" in yourcode.goatcounter.com; until set, no analytics run
};

const address = CONTACT.email.join("@");
const root = new URL("../", document.currentScript.src);

document.querySelectorAll("[data-email]").forEach((a) => {
  a.href = "mailto:" + address;
  a.textContent = address;
});

if (CONTACT.goatcounter) {
  const counter = document.createElement("script");
  counter.async = true;
  counter.src = "https://gc.zgo.at/count.js";
  counter.dataset.goatcounter = `https://${CONTACT.goatcounter}.goatcounter.com/count`;
  document.head.append(counter);
  document.querySelectorAll("[data-analytics-on]").forEach((node) => { node.hidden = false; });
  document.querySelectorAll("[data-analytics-off]").forEach((node) => { node.hidden = true; });
}

// Keep prices quoted in page text in step with data/pricing.json.
if (document.querySelector("[data-price]")) {
  fetch(new URL("data/pricing.json", root), { cache: "no-cache" })
    .then((response) => response.json())
    .then(({ forge, pm_tracker: pm }) => {
      const from = Math.min(...forge.plans.map((plan) => plan.price));
      const values = {
        "pm-free-months": pm.free_months,
        "pm-grace-days": pm.grace_days,
        "forge-from": "$" + (Number.isInteger(from) ? from : from.toFixed(2)),
        "forge-seat": forge.seat_label,
      };
      document.querySelectorAll("[data-price]").forEach((node) => {
        node.textContent = values[node.dataset.price];
      });
    })
    .catch(() => {}); // the page already shows a sensible default
}

// The phone menu.
const head = document.querySelector(".site-head");
const toggle = head && head.querySelector(".menu-toggle");
if (toggle) {
  toggle.addEventListener("click", () => {
    const open = head.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? "Close" : "Menu";
  });
}

// Product tours: a row of tabs, each showing one panel.
document.querySelectorAll("[data-tabs]").forEach((tour) => {
  const tabs = [...tour.querySelectorAll("[role=tab]")];
  const select = (chosen, focus) => {
    tabs.forEach((tab) => {
      const on = tab === chosen;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      document.getElementById(tab.getAttribute("aria-controls")).hidden = !on;
    });
    if (focus) chosen.focus();
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => select(tab));
    tab.addEventListener("keydown", (event) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (step) select(tabs[(i + step + tabs.length) % tabs.length], true);
    });
  });
  select(tabs[0]);
});

const countLead = (name) => {
  if (window.goatcounter && window.goatcounter.count) {
    window.goatcounter.count({ path: name, title: name, event: true });
  }
};

const form = document.querySelector("#contact-form");
if (form) {
  const status = form.querySelector(".status");
  const button = form.querySelector("button[type=submit]");
  const downloads = form.querySelector(".downloads");
  const OVERVIEWS = {
    forge: [["Forge overview (PDF)", "assets/docs/forge-overview.pdf"]],
    "pm-tracker": [["PM Tracker overview (PDF)", "assets/docs/pm-tracker-overview.pdf"]],
  };
  OVERVIEWS.both = [...OVERVIEWS.forge, ...OVERVIEWS["pm-tracker"]];
  OVERVIEWS["not-sure"] = OVERVIEWS.both;

  const params = new URLSearchParams(location.search);
  for (const name of ["product", "intent"]) {
    const value = params.get(name);
    if (value && form[name].querySelector(`option[value="${CSS.escape(value)}"]`)) {
      form[name].value = value;
    }
  }

  // The trial licence is only offered for PM Tracker.
  const matchProductToIntent = () => {
    const trial = form.intent.value === "trial";
    if (trial) form.product.value = "pm-tracker";
    for (const option of form.product.options) {
      option.disabled = trial && option.value !== "pm-tracker";
    }
  };
  form.intent.addEventListener("change", matchProductToIntent);
  matchProductToIntent();

  const show = (text, kind) => {
    status.textContent = text;
    status.className = "status " + kind;
  };

  const showDownloads = (data) => {
    downloads.replaceChildren();
    if (data.get("intent") !== "overview") return;
    OVERVIEWS[data.get("product")].forEach(([label, path]) => {
      const link = document.createElement("a");
      link.href = new URL(path, root);
      link.textContent = label;
      link.target = "_blank";
      link.rel = "noopener";
      downloads.append(link);
    });
  };

  const subjectFor = (data) => {
    const intent = form.intent.options[form.intent.selectedIndex].text;
    const product = form.product.options[form.product.selectedIndex].text;
    return `Website: ${intent} (${product})`;
  };

  const openEmailApp = (data) => {
    const body = ["name", "email", "company", "phone"]
      .map((k) => `${k}: ${data.get(k) || "-"}`)
      .concat("", data.get("message") || "")
      .join("\n");
    location.href = `mailto:${address}?subject=${encodeURIComponent(subjectFor(data))}&body=${encodeURIComponent(body)}`;
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    if (data.get("botcheck")) return; // honeypot: only bots fill this

    if (!CONTACT.web3formsKey) {
      openEmailApp(data);
      show("Your email app should open with your message. Press send there to reach us.", "ok");
      showDownloads(data);
      return;
    }

    data.set("access_key", CONTACT.web3formsKey);
    data.set("subject", subjectFor(data));
    data.set("from_name", "Forge + PM Tracker website"); // otherwise the email is from "Notifications"
    button.disabled = true;
    show("Sending…", "");
    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: data,
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message);
      show("Thanks, your message was sent. We'll reply by email.", "ok");
      showDownloads(data);
      countLead("lead-" + data.get("intent"));
      form.reset();
      matchProductToIntent();
    } catch {
      show(`That didn't send. Please email ${address} instead.`, "err");
    } finally {
      button.disabled = false;
    }
  });
}
