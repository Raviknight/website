// Site settings. Paste each code here to switch the feature on.
const CONTACT = {
  formspreeId: "", // the "abcd1234" in formspree.io/f/abcd1234; until set, Send opens the visitor's email app
  email: ["26ravi.sharma", "gmail.com"], // split so simple scrapers miss it
  goatcounter: "", // the "yourcode" in yourcode.goatcounter.com; until set, no analytics run
};

const address = CONTACT.email.join("@");
const root = new URL("../", document.currentScript.src);

document.querySelectorAll("[data-email]").forEach((a) => {
  a.href = "mailto:" + address;
  a.textContent = address;
});

if (CONTACT.formspreeId) {
  document.querySelectorAll("[data-form-on]").forEach((node) => { node.hidden = false; });
  document.querySelectorAll("[data-form-off]").forEach((node) => { node.hidden = true; });
}

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
      const values = {
        "pm-free-months": pm.free_months,
        "pm-grace-days": pm.grace_days,
        "forge-from": "$" + Math.min(...forge.plans.map((plan) => plan.price)),
        "forge-seat": forge.seat_label,
      };
      document.querySelectorAll("[data-price]").forEach((node) => {
        node.textContent = values[node.dataset.price];
      });
    })
    .catch(() => {}); // the page already shows a sensible default
}

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

    if (!CONTACT.formspreeId) {
      openEmailApp(data);
      show("Your email app should open with your message. Press send there to reach us.", "ok");
      showDownloads(data);
      return;
    }

    data.delete("botcheck");
    data.set("_subject", subjectFor(data));
    button.disabled = true;
    show("Sending…", "");
    try {
      const response = await fetch(`https://formspree.io/f/${CONTACT.formspreeId}`, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: data,
      });
      if (!response.ok) throw new Error(response.status);
      show("Thanks, your message was sent. We'll reply by email.", "ok");
      showDownloads(data);
      countLead("lead-" + data.get("intent"));
      form.reset();
    } catch {
      show(`That didn't send. Please email ${address} instead.`, "err");
    } finally {
      button.disabled = false;
    }
  });
}
