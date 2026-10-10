(() => {
  const form = document.querySelector("[data-contact-form]");
  if (!form) return;

  const topicButtons = Array.from(document.querySelectorAll("[data-contact-topic]"));
  const selectedTopic = form.querySelector("[data-contact-topic-value]");
  const messageInput = form.querySelector("[data-contact-message]");
  const status = form.querySelector("[data-contact-status]");
  const fallbackLink = form.querySelector("[data-contact-fallback]");
  const whatsappNumber = "573043778188";

  const messagePlaceholders = {
    "Petición de oración": "Cuéntanos cómo podemos acompañarte en oración...",
    "Pregunta general": "Escribe aquí tu pregunta...",
    "Compartir mi testimonio": "Nos encantaría conocer lo que quieres compartir...",
    "Quiero ser voluntario": "Cuéntanos en qué área te gustaría servir...",
  };

  topicButtons.forEach((button) => {
    button.addEventListener("click", () => {
      topicButtons.forEach((topicButton) => {
        const isActive = topicButton === button;
        topicButton.classList.toggle("is-active", isActive);
        topicButton.setAttribute("aria-pressed", String(isActive));
      });

      selectedTopic.value = button.dataset.contactTopic;
      messageInput.placeholder = messagePlaceholders[selectedTopic.value];
      status.textContent = "";
      fallbackLink.hidden = true;
    });
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const location = String(formData.get("location") || "").trim();
    const message = String(formData.get("message") || "").trim();
    const topic = String(formData.get("topic") || "Pregunta general");

    const text = [
      `Hola, quisiera contactarme con Nazareno Cali.`,
      `Motivo: ${topic}`,
      `Nombre: ${name}`,
      `Correo: ${email}`,
      phone ? `Teléfono: ${phone}` : null,
      `Sede o grupo: ${location}`,
      `Mensaje: ${message}`,
    ].filter(Boolean).join("\n");

    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`;
    fallbackLink.href = whatsappUrl;
    fallbackLink.hidden = false;
    status.textContent = "Tu mensaje está listo. WhatsApp se abrirá para que lo revises y lo envíes.";

    const whatsappWindow = window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    if (whatsappWindow) whatsappWindow.opener = null;
  });
})();
