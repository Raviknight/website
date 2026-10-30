// Contact settings. Paste the Web3Forms access key here to turn the form on.
// Until then the form opens the visitor's email app instead.
const CONTACT = {
  web3formsKey: "",
  email: ["26ravi.sharma", "gmail.com"], // split so simple scrapers miss it
};

const address = CONTACT.email.join("@");

document.querySelectorAll("[data-email]").forEach((a) => {
  a.href = "mailto:" + address;
  a.textContent = address;
});

const form = document.querySelector("#contact-form");
if (form) {
  const status = form.querySelector(".status");
  const button = form.querySelector("button[type=submit]");

  const product = new URLSearchParams(location.search).get("product");
  if (product && form.product.querySelector(`option[value="${CSS.escape(product)}"]`)) {
    form.product.value = product;
  }

  const show = (text, kind) => {
    status.textContent = text;
    status.className = "status " + kind;
  };

  const openEmailApp = (data) => {
    const subject = `Website enquiry: ${data.get("product")}`;
    const body = ["name", "email", "company", "phone"]
      .map((k) => `${k}: ${data.get(k) || "-"}`)
      .concat("", data.get("message"))
      .join("\n");
    location.href = `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    if (data.get("botcheck")) return; // honeypot: only bots fill this

    if (!CONTACT.web3formsKey) {
      openEmailApp(data);
      show("Your email app should open with your message. Press send there to reach us.", "ok");
      return;
    }

    data.set("access_key", CONTACT.web3formsKey);
    data.set("subject", `Website enquiry: ${data.get("product")}`);
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
      form.reset();
      show("Thanks, your message was sent. We'll reply by email.", "ok");
    } catch {
      show(`That didn't send. Please email ${address} instead.`, "err");
    } finally {
      button.disabled = false;
    }
  });
}
