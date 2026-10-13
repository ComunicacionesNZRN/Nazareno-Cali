/* ========================================================================
  1. NAVEGACION GLOBAL Y ESTADO DEL ENCABEZADO
  ======================================================================== */
const menuButton = document.querySelector(".menu-button");
const mobileNav = document.querySelector(".mobile-nav");
const header = document.querySelector("[data-header]");

if (menuButton) {
  while (menuButton.querySelectorAll("span").length < 3) {
    menuButton.append(document.createElement("span"));
  }
}

// Acceso global seguro a Supabase (compatible con cualquier cliente inicializado)
const getSupabaseClient = () => window._supabase || window.supabaseClient || window.supabaseAdmin?.client;

if (!document.querySelector('link[href*="font-awesome"]')) {
  const iconStylesheet = document.createElement("link");
  iconStylesheet.rel = "stylesheet";
  iconStylesheet.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css";
  document.head.appendChild(iconStylesheet);
}

/* ========================================================================
  NAVEGACIÓN SUPERIOR (DESKTOP)
  ======================================================================== */
/* Una sola etiqueta por destino (ver PR): se usa en desktop, en el menú
   móvil y en el HTML estático de cada página. */
const primaryNavigation = [
  ["Devocional", "devocional.html"],
  ["Tu Próximo Paso", "primera-vez.html"],
  ["Grupos", "grupos.html"],
  ["Encuentros", "encuentros.html"],
  ["Prédicas", "mensajes.html"],
  ["Eventos", "eventos.html"],
  ["Donaciones", "donar.html"],
  ["Nosotros", "nosotros.html"],
];

const currentPage = window.location.pathname.split("/").pop() || "index.html";

const navigationMarkup = (items, numbered = false) =>
  items
    .map(
      ([label, href], index) =>
        `<a${href === currentPage ? ' class="active"' : ""} href="${href}">${label}${href === "mensajes.html" ? ' <span class="live-dot nav-live-dot" role="img" aria-label="En vivo"></span>' : ""}${numbered ? ` <small>${String(index + 1).padStart(2, "0")}</small>` : ""}</a>`,
    )
    .join("");

if (header) {
  const mainNavigation = header.querySelector(".main-nav");
  if (mainNavigation) {
    mainNavigation.innerHTML = navigationMarkup(primaryNavigation);
  }
}

const updateNavigationLiveIndicator = async () => {
  const indicators = document.querySelectorAll(".nav-live-dot");
  if (!indicators.length) return;

  const client = getSupabaseClient();
  if (!client) return;

  try {
    const { data, error } = await client
      .from("sermones")
      .select("en_vivo")
      .eq("publicado", true)
      .eq("en_vivo", true)
      .limit(1);
    if (error) throw error;

    const isLive = Array.isArray(data) && data.some((sermon) => sermon.en_vivo === true);
    indicators.forEach((indicator) => indicator.classList.toggle("is-live", isLive));
  } catch (error) {
    indicators.forEach((indicator) => indicator.classList.remove("is-live"));
    console.warn("[nav] no se pudo consultar el estado de la transmisión en vivo:", error.message);
  }
};

updateNavigationLiveIndicator();

document
  .querySelectorAll('.site-footer .footer-links-list a[href="mensajes.html"], .site-footer .footer-links-list a[href="podcast.html"]')
  .forEach((link) => {
    const icon = link.querySelector("i");
    link.replaceChildren(...(icon ? [icon, document.createTextNode(" Prédicas")] : [document.createTextNode("Prédicas")]));
  });

/* ========================================================================
  CARRUSEL INTERACTIVO DE PORTADA ("DESCUBRE MÁS MANERAS DE CONECTAR")
  ======================================================================== */
const connectCarousel = document.querySelector("[data-connect-carousel]");
const connectDots = document.querySelector("[data-connect-dots]");
let connectItems = [];
let connectIndex = 0;
let connectAnimationTimer;
let connectPointerStart = null;
let suppressConnectClickUntil = 0;

const CONNECT_GAP = "var(--connect-gap, 24px)";
const connectTransformFor = (state) =>
  state === "active" ? "translateX(-50%)" :
  state === "prev" ? `translateX(calc(-150% - ${CONNECT_GAP}))` :
  state === "next" ? `translateX(calc(50% + ${CONNECT_GAP}))` :
  `translateX(calc(50% + ${CONNECT_GAP}))`;

const connectTitleSize = (title = "") =>
  title.length > 42 ? "clamp(30px, 4vw, 58px)" :
  title.length > 26 ? "clamp(35px, 5vw, 70px)" :
  "clamp(40px, 6vw, 84px)";

const applyConnectTitleSize = () =>
  connectCarousel?.querySelectorAll(".discover-card").forEach((slide) => {
    const title = slide.querySelector(".discover-card-overlay strong, :scope > strong");
    if (title) slide.style.setProperty("--connect-title-size", connectTitleSize(title.textContent.trim()));
  });

const updateConnectCarousel = () => {
  if (!connectCarousel) return;
  const slides = connectCarousel.querySelectorAll(".discover-card");
  const total = slides.length;
  if (!total) return;

  connectIndex = (connectIndex % total + total) % total;

  slides.forEach((slide, index) => {
    const previous = (connectIndex - 1 + total) % total;
    const next = (connectIndex + 1) % total;
    const state =
      index === connectIndex ? "active" :
      index === previous ? "prev" :
      index === next ? "next" :
      "hidden";

    slide.classList.toggle("is-active", index === connectIndex);
    slide.classList.toggle("is-prev", index === previous);
    slide.classList.toggle("is-next", index === next);
    slide.style.display = state === "hidden" ? "none" : "flex";
    slide.style.setProperty("opacity", state === "active" ? "1" : "0.62", "important");
    slide.style.pointerEvents = state === "hidden" ? "none" : "auto";
    slide.style.zIndex = state === "active" ? "2" : "1";
    slide.style.setProperty("transform", connectTransformFor(state), "important");
  });

  connectDots?.querySelectorAll("[data-connect-dot]").forEach((dot, index) =>
    dot.classList.toggle("is-active", index === connectIndex)
  );

  connectCarousel.style.setProperty("--connect-index", connectIndex);
  applyConnectTitleSize();

  window.clearTimeout(connectAnimationTimer);
  connectAnimationTimer = window.setTimeout(() => {
    slides.forEach((slide, index) => {
      const previous = (connectIndex - 1 + total) % total;
      const next = (connectIndex + 1) % total;
      const state =
        index === connectIndex ? "active" :
        index === previous ? "prev" :
        index === next ? "next" :
        "hidden";
      slide.style.setProperty("transform", connectTransformFor(state), "important");
      slide.style.transition = "none";
    });
    window.requestAnimationFrame(() => slides.forEach((slide) => { slide.style.transition = ""; }));
  }, 620);
};

const prevSlide = () => {
  const slides = connectCarousel?.querySelectorAll(".discover-card");
  const total = slides?.length || connectItems.length;
  if (!total) return;
  connectIndex = (connectIndex - 1 + total) % total;
  updateConnectCarousel();
};

const nextSlide = () => {
  const slides = connectCarousel?.querySelectorAll(".discover-card");
  const total = slides?.length || connectItems.length;
  if (!total) return;
  connectIndex = (connectIndex + 1) % total;
  updateConnectCarousel();
};

connectCarousel?.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  connectPointerStart = { x: event.clientX, y: event.clientY };
});

connectCarousel?.addEventListener("pointerup", (event) => {
  if (!connectPointerStart) return;
  const deltaX = event.clientX - connectPointerStart.x;
  const deltaY = event.clientY - connectPointerStart.y;
  connectPointerStart = null;

  if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
  suppressConnectClickUntil = Date.now() + 500;
  if (deltaX < 0) nextSlide();
  else prevSlide();
});

connectCarousel?.addEventListener("pointercancel", () => {
  connectPointerStart = null;
});

connectCarousel?.addEventListener("click", (event) => {
  if (Date.now() >= suppressConnectClickUntil) return;
  event.preventDefault();
  event.stopPropagation();
}, true);

// Enlazar botones prev y next
document.querySelectorAll("[data-connect-prev]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    prevSlide();
  });
});

document.querySelectorAll("[data-connect-next]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    nextSlide();
  });
});

const renderConnectCarousel = (items) => {
  if (!connectCarousel || !items.length) return;
  connectItems = items;
  connectCarousel.innerHTML = items
    .map(
      (item, index) =>
        `<a class="discover-card ${index === 0 ? "is-active" : ""}" href="${item.link_url || "contacto.html"}" data-connect-slide="${index}">
          <img src="${item.image_url || "Media/01.jpg"}" alt="${item.image_alt || item.titulo}" />
          <span class="discover-card-overlay">
            <small>${item.eyebrow || (item.tipo === "fijo" ? "Actividad fija" : "Actividad del mes")}</small>
            <strong>${item.titulo}</strong>
            <span>${item.descripcion || "Conoce más sobre esta actividad"} ↗</span>
          </span>
        </a>`
    )
    .join("");

  if (connectDots) {
    connectDots.innerHTML = items
      .map(
        (_, index) =>
          `<button type="button" class="discover-connect-dot${index === 0 ? " is-active" : ""}" data-connect-dot="${index}" aria-label="Ver contenido ${index + 1}"></button>`
      )
      .join("");
  }

  // Permitir hacer clic directamente sobre las tarjetas laterales para avanzar o retroceder
  connectCarousel.querySelectorAll("[data-connect-slide]").forEach((slide) =>
    slide.addEventListener("click", (event) => {
      const targetIndex = Number(slide.dataset.connectSlide);
      if (targetIndex !== connectIndex) {
        event.preventDefault();
        connectIndex = targetIndex;
        updateConnectCarousel();
      }
    })
  );

  connectDots?.querySelectorAll("[data-connect-dot]").forEach((dot) =>
    dot.addEventListener("click", (e) => {
      e.preventDefault();
      connectIndex = Number(dot.dataset.connectDot);
      updateConnectCarousel();
    })
  );

  updateConnectCarousel();
};

const loadConnectCarousel = async () => {
  const sb = getSupabaseClient();
  if (!connectCarousel || !sb) return;
  try {
    const month = new Date().getMonth() + 1;
    const { data, error } = await sb
      .from("carrusel_conexion")
      .select("*")
      .eq("activo", true)
      .order("orden", { ascending: true });

    if (error || !data?.length) return;
    const currentItems = data.filter((item) => item.tipo === "fijo" || item.mes === month);
    if (currentItems.length) renderConnectCarousel(currentItems);
  } catch (err) {
    console.warn("Aviso carrusel:", err);
  }
};

// Inicialización de respaldo si hay tarjetas estáticas en el HTML
if (connectCarousel) {
  const fallbackSlides = [...connectCarousel.querySelectorAll(".discover-card")];
  if (fallbackSlides.length) {
    connectItems = fallbackSlides;
    fallbackSlides.forEach((slide, index) => {
      slide.dataset.connectSlide = index;
    });

    if (connectDots) {
      connectDots.innerHTML = fallbackSlides
        .map(
          (_, index) =>
            `<button type="button" class="discover-connect-dot${index === 0 ? " is-active" : ""}" data-connect-dot="${index}" aria-label="Ver contenido ${index + 1}"></button>`
        )
        .join("");
    }

    fallbackSlides.forEach((slide) =>
      slide.addEventListener("click", (event) => {
        const targetIndex = Number(slide.dataset.connectSlide);
        if (targetIndex !== connectIndex) {
          event.preventDefault();
          connectIndex = targetIndex;
          updateConnectCarousel();
        }
      })
    );

    connectDots?.querySelectorAll("[data-connect-dot]").forEach((dot) =>
      dot.addEventListener("click", (e) => {
        e.preventDefault();
        connectIndex = Number(dot.dataset.connectDot);
        updateConnectCarousel();
      })
    );

    updateConnectCarousel();
  }
  loadConnectCarousel();
}

/* ========================================================================
  2. MENÚ LATERAL MÓVIL COMPLETO (CON "PRIMERA VEZ / PRÓXIMO PASO")
  ======================================================================== */
if (mobileNav) {
  const menuSections = [
    ["Descubre", [
      ["Tu Próximo Paso", "Qué esperar en tu primera visita", "primera-vez.html", "fa-compass"],
      ["Visítanos", "Horarios y cómo llegar", "visitanos.html", "fa-house"],
      ["Devocional", "Palabra de Vida, devocionales diarios", "devocional.html", "fa-book-open"],
      ["Prédicas", "En vivo, video y podcast", "mensajes.html", "fa-play"],
    ]],
    ["Comunidades", [
      ["JNI Jóvenes", "Sábados 5:30 PM", "jni.html", "fa-bolt"],
      ["Teens", "Adolescentes de 12 a 15 años", "teens.html", "fa-fire-flame-curved"],
      ["Kids", "Bebés a primaria", "kids.html", "fa-shapes"],
      ["Grupos", "Grupos de conexión en Cali", "grupos.html", "fa-people-group"],
      ["Encuentros", "Retiros de hombres y mujeres", "encuentros.html", "fa-users-between-lines"],
    ]],
    ["Participa", [
      ["Servir", "Equipos de ministerio", "ministerios.html", "fa-hands-helping"],
      ["Eventos", "Agenda de actividades", "eventos.html", "fa-calendar-days"],
      ["Donaciones", "Generosidad en acción", "donar.html", "fa-heart"],
      ["Nosotros", "Historia y equipo pastoral", "nosotros.html", "fa-church"],
      ["Contacto", "Hablemos por WhatsApp", "contacto.html", "fa-message"],
    ]],
  ];

  const menuSectionMarkup = menuSections
    .map(
      ([heading, items]) =>
        `<section class="menu-section">
          <h2>${heading}</h2>
          <div class="menu-section-items">
            ${items
              .map(
                ([label, description, href, icon]) =>
                  `<a class="menu-item" href="${href}">
                    <span class="menu-item-icon"><i class="fa-solid ${icon}" aria-hidden="true"></i></span>
                    <span><strong>${label}${href === "mensajes.html" ? ' <span class="live-dot nav-live-dot" role="img" aria-label="En vivo"></span>' : ""}</strong><small>${description}</small></span>
                    <b aria-hidden="true">↗</b>
                  </a>`
              )
              .join("")}
          </div>
        </section>`
    )
    .join("");

  mobileNav.innerHTML = `
    <div class="mobile-nav-head">
      <div>
        <span class="nav-kicker">Explora Nazareno</span>
        <h2>ENCUENTRA TU<br /><em>LUGAR.</em></h2>
      </div>
      <span class="nav-menu-label">MENÚ</span>
    </div>
    <p class="mobile-nav-intro">Conecta con la iglesia, encuentra información y da tu próximo paso.</p>
    ${menuSectionMarkup}
    <div class="mobile-nav-contact">
      <strong>Hablemos</strong>
      <a href="https://wa.link/62syyk" target="_blank" rel="noreferrer">WhatsApp ↗</a>
      <p>Cali · Colombia</p>
    </div>`;
}
if (header) {
  const headerActions = header.querySelector(".header-actions");
  headerActions?.querySelectorAll(".header-cta, .live-pill").forEach((element) => element.remove());
}

const mainContent = document.querySelector("main");
if (mainContent) {
  mainContent.id = mainContent.id || "contenido-principal";
  const skipLink = document.createElement("a");
  skipLink.className = "skip-link";
  skipLink.href = `#${mainContent.id}`;
  skipLink.textContent = "Saltar al contenido principal";
  document.body.prepend(skipLink);
}

const setMenu = (open) => {
  if (!menuButton || !mobileNav) return;
  const menuLines = menuButton.querySelectorAll("span");
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
  mobileNav.setAttribute("aria-hidden", String(!open));
  mobileNav.inert = !open;
  mobileNav.classList.toggle("is-open", open);
  document.body.classList.toggle("menu-open", open);
  if (menuLines.length) {
    menuLines[0].style.transform = open ? "translateY(7px) rotate(45deg)" : "";
    menuLines[menuLines.length - 1].style.transform = open ? "translateY(-7px) rotate(-45deg)" : "";
    if (menuLines.length > 2) {
      menuLines[1].style.opacity = open ? "0" : "";
    }
  }
  if (open) {
    mobileNav.querySelector("a[href]")?.focus();
  } else {
    menuButton.focus();
  }
};

if (menuButton && mobileNav) {
  mobileNav.setAttribute("role", "dialog");
  mobileNav.setAttribute("aria-modal", "true");
  mobileNav.setAttribute("aria-label", "Menú principal");
  mobileNav.inert = true;
  menuButton.addEventListener("click", () => setMenu(menuButton.getAttribute("aria-expanded") !== "true"));
  mobileNav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (event) => {
    if (menuButton.getAttribute("aria-expanded") !== "true") return;
    if (event.key !== "Tab") return;
    const focusable = [...mobileNav.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && (document.activeElement === first || document.activeElement === menuButton)) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === menuButton)) {
      event.preventDefault();
      first?.focus();
    }
  });
}

if (header) {
  const scrollMarker = document.createElement("span");
  scrollMarker.setAttribute("aria-hidden", "true");
  scrollMarker.style.cssText = "position:absolute;top:20px;left:0;width:1px;height:1px;pointer-events:none";
  document.body.prepend(scrollMarker);

  const headerObserver = new IntersectionObserver(([entry]) => {
    header.classList.toggle("is-scrolled", !entry.isIntersecting);
  });
  headerObserver.observe(scrollMarker);
}

/* ========================================================================
  2. TITULOS ANIMADOS SEGUN EL SCROLL
  ======================================================================== */
const scrollTitles = document.querySelectorAll(
  ".hero h1, .manifesto h2, .community-heading h2, .visit h2, .media-intro h2, .groups-intro h2, .inner-hero h1, .inner-band h2, .info-panel h2, .contact-grid h2, .feature-list h2, .feature-list h3, .dedicated-player .media-caption h2",
);
if (scrollTitles.length && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const titleObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.setProperty("--title-progress", "1");
        observer.unobserve(entry.target);
      }
    });
  }, { rootMargin: "0px 0px -12% 0px" });

  scrollTitles.forEach((title) => {
    title.style.setProperty("--title-progress", "0");
    titleObserver.observe(title);
  });
}

/* ========================================================================
  3. PESTAÑAS DE CONTENIDO AUDIOVISUAL DE LA PORTADA
  ======================================================================== */
const tabs = document.querySelectorAll("[data-media-tab]");
const panels = document.querySelectorAll("[data-media-panel]");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.mediaTab;

    tabs.forEach((item) => {
      const active = item === tab;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", String(active));
    });

    panels.forEach((panel) => {
      const active = panel.dataset.mediaPanel === target;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
  });
});

/* ========================================================================
  4. REPRODUCTORES DE LA PAGINA DE MENSAJES
  ======================================================================== */
const featuredMessage = document.querySelector("[data-featured-message]");

if (featuredMessage) {
  const featuredTitle = featuredMessage.querySelector("[data-featured-title]");
  const featuredEyebrow = featuredMessage.querySelector("[data-featured-eyebrow]");
  const featuredIframe = featuredMessage.querySelector("[data-featured-iframe]");
  const featuredState = featuredMessage.querySelector("[data-featured-state]");
  const featuredPreacher = featuredMessage.querySelector("[data-featured-preacher]");
  const featuredDate = featuredMessage.querySelector("[data-featured-date]");
  const featuredDescription = featuredMessage.querySelector("[data-featured-description]");
  const featuredYoutubeLink = featuredMessage.querySelector("[data-featured-youtube-link]");
  const shareFeaturedButton = featuredMessage.querySelector("[data-share-featured]");
  const shareState = featuredMessage.querySelector("[data-share-state]");
  const mode = new URLSearchParams(window.location.search).get("tipo") === "experiencia"
    ? "experiencia"
    : "sermones";
  const fullExperienceFallback = "LWOoJB_YuL8";
  const sermonFallback = "kZNdlw4Z4Nw";

  const getFeaturedVideoId = (value) => {
    if (!value) return "";
    const input = String(value).trim();
    if (/^[\w-]{11}$/.test(input)) return input;
    try {
      const url = new URL(input);
      const host = url.hostname.replace(/^www\./, "").toLowerCase();
      if (host === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] || "";
      if (!["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(host)) return "";
      return url.searchParams.get("v") || url.pathname.match(/\/(?:embed|shorts|live)\/([\w-]{11})/)?.[1] || "";
    } catch {
      return "";
    }
  };

  const showFeaturedVideo = (videoId, title, sermon = null) => {
    if (!featuredIframe || !videoId) return;
    featuredTitle.textContent = title;
    featuredEyebrow.textContent = mode === "experiencia" ? "Experiencia completa" : "Última prédica";
    featuredIframe.title = title;
    featuredIframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0`;
    featuredPreacher.textContent = sermon?.predicador || sermon?.pastor || "Iglesia del Nazareno Cali";
    const date = sermon?.fecha ? new Date(`${sermon.fecha}T12:00:00`) : null;
    featuredDate.textContent = date && !Number.isNaN(date.getTime())
      ? new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" }).format(date)
      : "Fecha por confirmar";
    featuredDescription.textContent = sermon?.descripcion || sermon?.resumen || "Escucha el mensaje y comparte lo que Dios habló a tu vida.";
    featuredYoutubeLink.href = sermon?.youtube_url && getFeaturedVideoId(sermon.youtube_url)
      ? new URL(sermon.youtube_url, window.location.href).href
      : "https://www.youtube.com/user/nazarenocali";
    featuredState.hidden = true;
    shareState.textContent = "";
  };

  if (mode === "experiencia") {
    showFeaturedVideo(fullExperienceFallback, "Experiencia completa de Iglesia del Nazareno Cali");
  } else {
    showFeaturedVideo(sermonFallback, "Última prédica de Iglesia del Nazareno Cali");
  }

  const mediaClient = getSupabaseClient();
  if (mediaClient) {
    const loadFeaturedMessage = async () => {
      try {
        const { data, error } = await mediaClient
          .from("sermones")
          .select("titulo, predicador, descripcion, resumen, youtube_url, fecha, en_vivo, publicado")
          .eq("publicado", true)
          .order("fecha", { ascending: false })
          .limit(100);
        if (error) throw error;

        const sermons = (data || []).filter((sermon) => Boolean(getFeaturedVideoId(sermon.youtube_url)));
        const liveSermon = sermons.find((sermon) => sermon.en_vivo === true);
        const selected = mode === "experiencia"
          ? liveSermon || sermons[0]
          : sermons.find((sermon) => sermon.en_vivo !== true) || sermons[0];

        if (selected) {
          const videoId = getFeaturedVideoId(selected.youtube_url);
          const title = mode === "experiencia"
            ? `Experiencia completa: ${selected.titulo || "Iglesia del Nazareno Cali"}`
            : selected.titulo || "Última prédica de Iglesia del Nazareno Cali";
          showFeaturedVideo(videoId, title, selected);
          if (mode === "experiencia" && !liveSermon) {
            featuredState.textContent = "No hay una transmisión en vivo activa. Reproduciendo la grabación más reciente.";
            featuredState.hidden = false;
          }
        }
      } catch (error) {
        console.warn("No se pudo cargar el video destacado:", error.message);
      }
    };

    loadFeaturedMessage();
  }

  shareFeaturedButton?.addEventListener("click", async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: featuredTitle.textContent, url: window.location.href });
        return;
      }
      await navigator.clipboard.writeText(window.location.href);
      shareState.textContent = "Enlace copiado.";
    } catch (error) {
      if (error.name !== "AbortError") shareState.textContent = "No se pudo compartir el enlace.";
    }
  });
}

/* ========================================================================
  5. BIBLIOTECA DE PREDICAS Y PODCASTS
  ======================================================================== */
const mediaLibrary = document.querySelector("[data-media-library]");

if (mediaLibrary) {
  const mediaClient = getSupabaseClient();
  const libraryTabs = [...mediaLibrary.querySelectorAll("[data-library-tab]")];
  const libraryPanels = [...mediaLibrary.querySelectorAll("[data-library-panel]")];
  const sermonGrid = mediaLibrary.querySelector("[data-sermon-grid]");
  const podcastGrid = mediaLibrary.querySelector("[data-podcast-grid]");
  const sermonState = mediaLibrary.querySelector("[data-sermon-state]");
  const podcastState = mediaLibrary.querySelector("[data-podcast-state]");
  const sermonOrderSelect = mediaLibrary.querySelector("[data-sermon-order]");
  const viewAllSermons = mediaLibrary.querySelector("[data-view-all-sermons]");
  const mediaDialog = document.querySelector("[data-media-dialog]");
  const mediaIframe = mediaDialog?.querySelector("[data-media-iframe]");
  const mediaDialogTitle = mediaDialog?.querySelector("#media-dialog-title");
  let sermonItems = [];
  let sermonOrder = sermonOrderSelect?.value || "desc";
  let sermonsExpanded = false;
  let sermonLoadFailed = false;
  let sermonRefreshInProgress = false;
  let lastSermonRefresh = 0;
  const SERMON_REFRESH_INTERVAL = 30 * 60 * 1000;

  const readMediaField = (record, ...keys) => {
    for (const key of keys) {
      const value = record?.[key];
      if (value !== undefined && value !== null && String(value).trim()) return value;
    }
    return "";
  };

  const getYouTubeId = (value) => {
    if (!value) return "";
    const input = String(value).trim();
    if (/^[\w-]{11}$/.test(input)) return input;

    try {
      const url = new URL(input);
      const host = url.hostname.replace(/^www\./, "").toLowerCase();
      if (host === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] || "";
      if (!["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(host)) return "";
      return url.searchParams.get("v") || url.pathname.match(/\/(?:embed|shorts|live)\/([\w-]{11})/)?.[1] || "";
    } catch {
      return "";
    }
  };

  const safeMediaUrl = (value) => {
    if (!value) return "";
    try {
      const url = new URL(String(value), window.location.href);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  };

  const formatMediaDate = (value) => {
    if (!value) return "";
    const dateValue = String(value);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
      ? new Date(`${dateValue}T12:00:00`)
      : new Date(dateValue);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" }).format(date);
  };

  const setMediaState = (element, message, state = "") => {
    if (!element) return;
    element.hidden = !message;
    element.textContent = message;
    element.classList.toggle("is-error", state === "error");
  };

  const openMediaPlayer = (videoId, title) => {
    if (!mediaDialog || !mediaIframe || !videoId) return;
    mediaDialogTitle.textContent = title || "Reproducción";
    mediaIframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`;
    mediaDialog.showModal();
  };

  const makeMediaCard = (record, kind) => {
    const title = String(readMediaField(record, "titulo", "title", "nombre") || "Contenido de Nazareno Cali");
    const videoUrl = readMediaField(record, "youtube_url", "url_youtube", "enlace_youtube", "video_url", "url_video", "url");
    const videoId = getYouTubeId(videoUrl);
    const imageUrl = safeMediaUrl(readMediaField(record, "thumbnail_url", "miniatura_url", "image_url", "imagen_url", "imagen"));
    const dateValue = readMediaField(record, "fecha", "published_at", "publicado_at", "created_at");
    const isLive = kind === "sermon" && (record.en_vivo === true || ["live", "en vivo"].includes(String(record.estado || "").toLowerCase()));
    const card = document.createElement("article");
    card.className = "media-card";
    card.classList.toggle("is-live", isLive);

    const thumbnail = document.createElement("div");
    thumbnail.className = "media-card-thumbnail";
    const image = document.createElement("img");
    const thumbnailSources = [
      imageUrl,
      videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : "",
      videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : "",
      "Media/01.jpg",
    ].filter((source, index, sources) => source && sources.indexOf(source) === index);
    let thumbnailIndex = 0;
    image.src = thumbnailSources[thumbnailIndex];
    image.addEventListener("error", () => {
      thumbnailIndex += 1;
      if (thumbnailSources[thumbnailIndex]) image.src = thumbnailSources[thumbnailIndex];
    });
    image.alt = "";
    image.loading = "lazy";
    thumbnail.append(image);

    if (videoId && isLive) {
      const livePlayer = document.createElement("iframe");
      livePlayer.className = "media-card-live-player";
      livePlayer.title = `Transmisión en vivo: ${title}`;
      livePlayer.loading = "eager";
      livePlayer.allow = "autoplay; encrypted-media; picture-in-picture; web-share";
      livePlayer.referrerPolicy = "strict-origin-when-cross-origin";
      livePlayer.allowFullscreen = true;
      livePlayer.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&mute=1&playsinline=1&rel=0`;
      thumbnail.append(livePlayer);
    } else if (videoId) {
      const playButton = document.createElement("button");
      playButton.className = "media-card-play";
      playButton.type = "button";
      playButton.setAttribute("aria-label", `${kind === "sermon" ? "Ver sermón" : "Reproducir podcast"}: ${title}`);
      playButton.innerHTML = '<i class="fa-solid fa-play" aria-hidden="true"></i>';
      playButton.addEventListener("click", () => openMediaPlayer(videoId, title));
      thumbnail.append(playButton);
    }

    const content = document.createElement("div");
    content.className = "media-card-content";
    const metadata = document.createElement("div");
    metadata.className = "media-card-metadata";

    if (kind === "sermon") {
      const preacher = document.createElement("p");
      preacher.className = "media-card-preacher";
      preacher.textContent = String(readMediaField(record, "predicador", "preacher", "pastor", "autor") || "Iglesia del Nazareno Cali");
      content.append(preacher);

      if (isLive) {
        const liveBadge = document.createElement("span");
        liveBadge.className = "media-card-live";
        liveBadge.textContent = "EN VIVO";
        metadata.append(liveBadge);
      } else if (sermonFilter === "latest") {
        const latestBadge = document.createElement("span");
        latestBadge.className = "media-card-latest";
        latestBadge.textContent = "ÚLTIMO SERMÓN";
        metadata.append(latestBadge);
      }
    } else {
      const show = document.createElement("p");
      show.className = "media-card-preacher";
      show.textContent = String(readMediaField(record, "programa", "show", "predicador", "autor") || "Nazareno Podcast");
      content.append(show);
    }

    if (dateValue) {
      const date = document.createElement("time");
      date.className = "media-card-date";
      date.dateTime = String(dateValue);
      date.textContent = formatMediaDate(dateValue);
      metadata.append(date);
    }

    const heading = document.createElement("h3");
    heading.className = "media-card-title";
    heading.textContent = title;
    content.append(metadata, heading);

    const description = readMediaField(record, "descripcion", "description", "resumen");
    if (description) {
      const summary = document.createElement("p");
      summary.className = "media-card-description";
      summary.textContent = String(description);
      content.append(summary);
    }

    const audioUrl = safeMediaUrl(readMediaField(record, "audio_url", "url_audio", "archivo_audio"));
    if (kind === "podcast" && audioUrl) {
      const audio = document.createElement("audio");
      audio.className = "media-card-audio";
      audio.controls = true;
      audio.preload = "none";
      audio.src = audioUrl;
      content.append(audio);
    } else if (videoId) {
      const action = document.createElement("button");
      action.className = "media-card-action";
      action.type = "button";
      action.textContent = kind === "sermon" ? "VER SERMÓN" : "VER EPISODIO";
      action.addEventListener("click", () => openMediaPlayer(videoId, title));
      content.append(action);
    }

    card.append(thumbnail, content);
    return card;
  };

  const isPublishedMedia = (record) => record.publicado !== false && record.activo !== false;
  const isLiveSermon = (record) => record.en_vivo === true || ["live", "en vivo"].includes(String(record.estado || "").toLowerCase());
  const sortMediaNewest = (items) => [...items].sort((first, second) => {
    const firstDate = new Date(readMediaField(first, "fecha", "published_at", "publicado_at", "created_at") || 0).getTime();
    const secondDate = new Date(readMediaField(second, "fecha", "published_at", "publicado_at", "created_at") || 0).getTime();
    return secondDate - firstDate;
  });

  const renderSermons = () => {
    sermonGrid.replaceChildren();
    const newestFirst = sortMediaNewest(sermonItems);
    const sorted = sermonOrder === "asc" ? [...newestFirst].reverse() : newestFirst;
    const latest = newestFirst.find(isLiveSermon) || newestFirst[0];
    const archive = sorted.filter((item) => item !== latest && !isLiveSermon(item));
    const visibleItems = sermonsExpanded ? archive : archive.slice(0, 4);

    if (viewAllSermons) viewAllSermons.hidden = sermonsExpanded || archive.length <= 4;

    if (!visibleItems.length) {
      setMediaState(sermonState, "Todavía no hay prédicas anteriores publicadas.");
      return;
    }

    setMediaState(sermonState, "");
    visibleItems.forEach((item) => sermonGrid.append(makeMediaCard(item, "sermon")));
  };

  const loadMediaTable = async (table, grid, state, kind) => {
    if (!mediaClient) {
      setMediaState(state, "No fue posible conectar con la biblioteca de medios.", "error");
      return [];
    }

    try {
      let mediaQuery = mediaClient.from(table).select("*");
      mediaQuery = kind === "sermon"
        ? mediaQuery.order("fecha", { ascending: sermonOrder === "asc" })
        : mediaQuery.order("fecha", { ascending: false });
      const { data, error } = await mediaQuery.limit(100);
      if (error) throw error;
      const items = (data || []).filter(isPublishedMedia);
      if (kind === "sermon") sermonLoadFailed = false;
      if (kind === "podcast") {
        grid.replaceChildren();
        if (!items.length) {
          setMediaState(state, "Todavía no hay podcasts publicados.");
        } else {
          setMediaState(state, "");
          sortMediaNewest(items).forEach((item) => grid.append(makeMediaCard(item, kind)));
        }
      }
      return items;
    } catch (error) {
      if (kind === "sermon") sermonLoadFailed = true;
      setMediaState(state, `No se pudo cargar ${kind === "sermon" ? "la lista de prédicas" : "la lista de podcasts"}. Revisa la tabla y los permisos de Supabase.`, "error");
      console.error(`Error al cargar ${table}:`, error.message);
      return [];
    }
  };

  libraryTabs.forEach((tab) => tab.addEventListener("click", () => {
    const selected = tab.dataset.libraryTab;
    libraryTabs.forEach((item) => {
      const active = item === tab;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", String(active));
    });
    libraryPanels.forEach((panel) => { panel.hidden = panel.dataset.libraryPanel !== selected; });
  }));

  viewAllSermons?.addEventListener("click", (event) => {
    event.preventDefault();
    sermonsExpanded = true;
    renderSermons();
  });
  sermonOrderSelect?.addEventListener("change", () => {
    sermonOrder = sermonOrderSelect.value === "desc" ? "desc" : "asc";
    refreshSermons();
  });

  mediaDialog?.querySelector("[data-media-dialog-close]").addEventListener("click", () => mediaDialog.close());
  mediaDialog?.addEventListener("click", (event) => {
    if (event.target === mediaDialog) mediaDialog.close();
  });
  mediaDialog?.addEventListener("close", () => { mediaIframe.src = "about:blank"; });

  if (new URLSearchParams(window.location.search).get("tipo") === "podcasts") {
    mediaLibrary.querySelector('[data-library-tab="podcasts"]')?.click();
  }

  const refreshSermons = async () => {
    if (sermonRefreshInProgress) return;
    sermonRefreshInProgress = true;

    try {
      if (mediaClient?.functions?.invoke) {
        try {
          const { error } = await mediaClient.functions.invoke("youtube-media-sync");
          if (error) console.warn("No se pudo sincronizar YouTube:", error.message);
        } catch (error) {
          console.warn("No se pudo sincronizar YouTube:", error.message);
        }
      }

      sermonItems = await loadMediaTable("sermones", sermonGrid, sermonState, "sermon");
      if (!sermonLoadFailed) renderSermons();
    } finally {
      lastSermonRefresh = Date.now();
      sermonRefreshInProgress = false;
    }
  };

  refreshSermons();
  loadMediaTable("podcasts", podcastGrid, podcastState, "podcast");
  window.setInterval(() => {
    if (!document.hidden) refreshSermons();
  }, SERMON_REFRESH_INTERVAL);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && Date.now() - lastSermonRefresh >= SERMON_REFRESH_INTERVAL) refreshSermons();
  });
}

/* ========================================================================
  5. EVENTOS (PORTADA BANNER + GRID ELEVATION EN EVENTOS.HTML)
  ======================================================================== */
const eventStatusLabels = { activo: "Activo", terminado: "Terminado" };

const escapeEventHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);

const safeEventUrl = (value) => {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim(), window.location.href);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
};

let publicEventsById = new Map();
let activeEventDetailTrigger = null;

const formatPublicTime = (time) => {
  if (!time) return "Hora por confirmar";
  const [hours = "00", minutes = "00"] = String(time).split(":");
  const date = new Date(1970, 0, 1, Number(hours), Number(minutes));
  return new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit" }).format(date);
};

const formatPublicDate = (date) => {
  if (!date) return "Fecha por confirmar";
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return "Fecha por confirmar";
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(parsed);
};

const formatFullPublicDate = (date) => {
  if (!date) return "Fecha por confirmar";
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return "Fecha por confirmar";
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" }).format(parsed);
};

const eventRequiresRegistration = (event) =>
  (event.requiere_inscripcion ?? event.requires_registration) === true;

const eventDetailDialog = document.querySelector("#event-detail-modal");

const openEventDetails = (event, trigger) => {
  if (!eventDetailDialog || !event) return;

  const title = eventDetailDialog.querySelector("[data-event-detail-title]");
  const image = eventDetailDialog.querySelector("[data-event-detail-image]");
  const date = eventDetailDialog.querySelector("[data-event-detail-date]");
  const time = eventDetailDialog.querySelector("[data-event-detail-time]");
  const location = eventDetailDialog.querySelector("[data-event-detail-location]");
  const description = eventDetailDialog.querySelector("[data-event-detail-description]");
  const requirements = eventDetailDialog.querySelector("[data-event-detail-requirements]");
  const registration = eventDetailDialog.querySelector("[data-event-detail-register]");
  const imageUrl = safeEventUrl(event.image_url);
  const registrationUrl = safeEventUrl(event.registration_url);
  const requiresRegistration = eventRequiresRegistration(event);
  const requirementsText = Array.isArray(event.requirements)
    ? event.requirements.join(" · ")
    : String(event.requirements || "").trim();

  title.textContent = event.title || "Evento";
  image.hidden = !imageUrl;
  image.removeAttribute("src");
  image.alt = event.title ? `Imagen de ${event.title}` : "Imagen del evento";
  if (imageUrl) image.src = imageUrl;
  date.textContent = `Fecha: ${formatFullPublicDate(event.date)}`;
  time.textContent = `Hora: ${formatPublicTime(event.time)}`;
  location.textContent = `Lugar: ${event.location || "Sede Cali"}`;
  description.textContent = event.description || "Pronto compartiremos más detalles de este evento.";
  requirements.hidden = !requirementsText;
  requirements.textContent = requirementsText ? `Requisitos: ${requirementsText}` : "";
  registration.hidden = !requiresRegistration;
  if (requiresRegistration && registrationUrl) {
    registration.href = registrationUrl;
  } else {
    registration.removeAttribute("href");
  }

  activeEventDetailTrigger = trigger;
  eventDetailDialog.showModal();
};

if (eventDetailDialog) {
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-event-detail]");
    if (!trigger) return;
    event.preventDefault();
    openEventDetails(publicEventsById.get(String(trigger.dataset.eventDetail)), trigger);
  });

  eventDetailDialog.querySelector("[data-close-event-modal]").addEventListener("click", () => {
    eventDetailDialog.close();
  });

  eventDetailDialog.addEventListener("click", (event) => {
    if (event.target === eventDetailDialog) eventDetailDialog.close();
  });

  eventDetailDialog.addEventListener("close", () => {
    activeEventDetailTrigger?.focus();
    activeEventDetailTrigger = null;
  });
}

const renderElevationEvents = (events) => {
  const featuredSlot = document.querySelector("[data-featured-event-slot]");
  const gridContainer = document.querySelector('[data-event-feed="page"]');
  if (!gridContainer && !featuredSlot) return;

  if (!events.length) {
    featuredSlot?.replaceChildren();
    if (gridContainer) {
      gridContainer.innerHTML = '<p class="events-empty" role="status">No hay eventos próximos programados. Vuelve pronto para consultar nuevas fechas.</p>';
    }
    return;
  }

  const featuredEvent = events.find((event) => event.is_featured) || events[0];
  publicEventsById = new Map(events.map((event) => [String(event.id), event]));
  const otherEvents = events.filter((event) => event.id !== featuredEvent.id);
  const imageUrl = safeEventUrl(featuredEvent.image_url) || "Media/01.jpg";
  const registrationUrl = safeEventUrl(featuredEvent.registration_url);

  if (featuredSlot) {
    featuredSlot.innerHTML = `
      <div class="event-featured-card">
        <div class="event-hero-banner" style="background-image: url(&quot;${escapeEventHtml(imageUrl)}&quot;)">
          <div class="event-hero-content">
            <div class="event-hero-info">
              <span class="event-hero-tag">★ Evento Destacado</span>
              <h2>${escapeEventHtml(featuredEvent.title)}</h2>
              ${featuredEvent.description ? `<p>${escapeEventHtml(featuredEvent.description)}</p>` : ""}
            </div>
          </div>
        </div>
        <div class="event-featured-footer">
          <div class="event-hero-meta">
            <span><i class="fa-regular fa-calendar"></i> ${formatPublicDate(featuredEvent.date)}</span>
            <span><i class="fa-regular fa-clock"></i> ${formatPublicTime(featuredEvent.time)}</span>
            <span><i class="fa-solid fa-location-dot"></i> ${escapeEventHtml(featuredEvent.location || "Sede Cali")}</span>
          </div>
          <div class="event-hero-actions">
            ${eventRequiresRegistration(featuredEvent) && registrationUrl
              ? `<a class="button button-light" href="${escapeEventHtml(registrationUrl)}" target="_blank" rel="noopener noreferrer">Inscribirme <span>↗</span></a>`
              : ""}
            <button class="button button-light event-detail-trigger" type="button" data-event-detail="${escapeEventHtml(featuredEvent.id)}">Más información <span>↗</span></button>
          </div>
        </div>
      </div>
    `;
  }

  if (gridContainer) {
    const listToRender = otherEvents.length ? otherEvents : events;
    gridContainer.innerHTML = listToRender.map((event) => `
      <article class="event-elevation-card site-card">
        <div class="event-elevation-thumb">
          <img src="${escapeEventHtml(safeEventUrl(event.image_url) || "Media/02.jpg")}" alt="${escapeEventHtml(event.title)}" loading="lazy" />
          <span class="event-elevation-status ${event.status || "activo"}">${eventStatusLabels[event.status] || "Activo"}</span>
        </div>
        <div class="event-elevation-body">
          <h3>${escapeEventHtml(event.title)}</h3>
          <p class="event-elevation-location">${escapeEventHtml(event.location || "Sede Principal Cali")}</p>
          <div class="event-elevation-footer">
            <div class="event-elevation-details">
              <span><i class="fa-regular fa-calendar"></i> ${formatPublicDate(event.date)}</span>
              <span><i class="fa-regular fa-clock"></i> ${formatPublicTime(event.time)}</span>
            </div>
            <button class="event-detail-trigger event-detail-card-button" type="button" data-event-detail="${escapeEventHtml(event.id)}">Más información <span aria-hidden="true">↗</span></button>
          </div>
        </div>
      </article>`).join("");
  }
};

const loadPublicEvents = async () => {
  const isEventsPage = document.querySelector('[data-event-feed="page"]') || document.querySelector("[data-featured-event-slot]");
  if (!isEventsPage) return;

  const supabase = getSupabaseClient();
  if (!supabase) {
    renderElevationEvents([]);
    return;
  }

  try {
    const { data, error } = await supabase
      .from("events")
      .select("id, title, description, date, time, location, image_url, registration_url, status, requirements, is_featured, requires_registration")
      .eq("status", "activo")
      .order("date", { ascending: true });
    if (error) throw error;

    const now = new Date();
    const activeEvents = (data || []).filter((event) => {
      if (!event.date) return false;
      const eventDate = new Date(`${event.date}T${event.time || "23:59:59"}`);
      return !Number.isNaN(eventDate.getTime()) && eventDate >= now;
    });
    renderElevationEvents(activeEvents);
  } catch (error) {
    console.error("No se pudieron cargar los eventos públicos:", error);
    renderElevationEvents([]);
  }
};

loadPublicEvents();

/* ========================================================================
  6. DEVOCIONALES Y FECHAS
  ======================================================================== */
const devotionalDate = document.querySelector("#devotional-date");

if (devotionalDate) {
  devotionalDate.textContent = new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

const loadPublishedDevotional = async () => {
  const devotionalSection = document.querySelector("[data-public-devotional]");
  const sb = getSupabaseClient();
  if (!devotionalSection || !sb) return;

  try {
    const { data } = await sb
      .from("devocionales")
      .select("titulo, resumen, contenido, imagen_url, publicar_at")
      .eq("publicado", true)
      .lte("publicar_at", new Date().toISOString())
      .order("publicar_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return;
    const title = document.querySelector("#today-title");
    const copy = document.querySelector("#devotional-copy");
    if (title) title.textContent = data.titulo;
    if (copy) copy.textContent = data.resumen || data.contenido;
  } catch (err) {
    console.warn("Aviso devocional:", err);
  }
};

loadPublishedDevotional();

const latestSermonLink = document.querySelector("[data-latest-sermon-link]");

if (latestSermonLink) {
  const client = getSupabaseClient();
  if (client) {
    client
      .from("sermones")
      .select("youtube_url")
      .eq("publicado", true)
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data?.youtube_url) return;
        try {
          const url = new URL(data.youtube_url);
          const host = url.hostname.replace(/^www\./, "").toLowerCase();
          if (["youtube.com", "m.youtube.com", "youtu.be"].includes(host)) latestSermonLink.href = url.href;
        } catch {
          console.warn("La última prédica no tiene una URL de YouTube válida.");
        }
      })
      .catch((error) => console.warn("No se pudo cargar la prédica más reciente:", error.message));
  }
}

/* ========================================================================
  7. REVELADO PROGRESIVO DE ELEMENTOS (.reveal)
  ======================================================================== */
const observer = new IntersectionObserver(
  (entries) =>
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }),
  { threshold: 0.08 },
);

document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));

const heroTextEl = document.querySelector(".hero-video-copy");
if (heroTextEl) {
  heroTextEl.style.opacity = "1";
  heroTextEl.style.visibility = "visible";
}

/* ========================================================================
  8. MINISTERIOS, DONACIONES, BANCOS, COPIA Y ORACION
  ======================================================================== */
const ministryData = [
  { title: "Niños", audience: "Niños", promise: "Un lugar seguro, alegre y preparado para conocer a Jesús y hacer amigos.", link: "contacto.html" },
  { title: "Jóvenes JNI", audience: "Jóvenes", promise: "Conversaciones honestas, comunidad y fe en movimiento.", link: "eventos.html" },
  { title: "Familias", audience: "Familias", promise: "Acompañamiento para crecer en la fe y construir comunidad en casa.", link: "contacto.html" },
  { title: "Servicio", audience: "Familias", promise: "Usa tus dones para cuidar personas y servir a nuestra ciudad.", link: "contacto.html" },
];

const ministryList = document.querySelector("[data-ministry-list]");
const renderMinistries = (audience = "Todos") => {
  if (!ministryList) return;
  ministryList.innerHTML = "";
  ministryData
    .filter((ministry) => audience === "Todos" || ministry.audience === audience)
    .forEach((ministry, index) => {
      const article = document.createElement("article");
      article.dataset.audience = ministry.audience;
      article.innerHTML = `<b>${String(index + 1).padStart(2, "0")}</b><h2>${ministry.title}</h2><p>${ministry.promise}</p><a class="text-link" href="${ministry.link}">Quiero conocer más <span>↗</span></a>`;
      ministryList.appendChild(article);
    });
};
renderMinistries();

document.querySelectorAll("[data-ministry-filter]").forEach((filterButton) => {
  filterButton.addEventListener("click", () => {
    document.querySelectorAll("[data-ministry-filter]").forEach((button) => button.classList.toggle("is-active", button === filterButton));
    renderMinistries(filterButton.dataset.ministryFilter);
  });
});

document.querySelectorAll("[data-donation-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.donationTab;
    document.querySelectorAll("[data-donation-tab]").forEach((item) => {
      const active = item === tab;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll("[data-donation-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.donationPanel !== target;
      panel.classList.toggle("is-active", !panel.hidden);
    });
  });
});

document.querySelectorAll("[data-bank-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.bankTab;
    document.querySelectorAll("[data-bank-tab]").forEach((item) => {
      const active = item === tab;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll("[data-bank-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.bankPanel !== target;
      panel.classList.toggle("is-active", !panel.hidden);
    });
  });
});

document.querySelectorAll("[data-copy-target]").forEach((copyButton) => {
  copyButton.addEventListener("click", async () => {
    const value = copyButton.dataset.copyTarget;
    try {
      await navigator.clipboard.writeText(value);
      copyButton.textContent = "Copiado";
    } catch {
      copyButton.textContent = "Selecciona el texto";
    }
  });
});

const prayerForm = document.querySelector("[data-prayer-form]");
if (prayerForm) {
  prayerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const status = prayerForm.querySelector("[data-form-status]");
    if (!prayerForm.checkValidity()) {
      prayerForm.reportValidity();
      if (status) status.textContent = "Revisa los campos antes de enviar.";
      return;
    }
    if (status) status.textContent = "Gracias. Recibimos tu pedido de oración.";
    prayerForm.reset();
  });
}

/* ========================================================================
  9. GRUPOS DE CONEXION Y MAPA (RECARGA INTELIGENTE SIN CUADROS ROTOS)
  ======================================================================== */
const mapElement = document.querySelector("#groups-map");
const groupsResults = document.querySelector("[data-groups-results]");
const groupCount = document.querySelector("[data-group-count]");
const groupSearch = document.querySelector("#group-search");

let groupsMapInstance = null;

const getZoneCoordinates = (zona = "", index = 0) => {
  const z = String(zona).toLowerCase();
  if (z.includes("sur") || z.includes("lili")) return [3.3720 + (index * 0.003), -76.5310];
  if (z.includes("norte") || z.includes("flora")) return [3.4750 + (index * 0.003), -76.5260];
  if (z.includes("oeste") || z.includes("peñon")) return [3.4480 + (index * 0.003), -76.5420];
  if (z.includes("oriente") || z.includes("aguablanca")) return [3.4210 + (index * 0.003), -76.4980];
  return [3.4341 + ((index % 2 === 0 ? 1 : -1) * 0.005 * index), -76.5455 + ((index % 2 === 0 ? -1 : 1) * 0.004 * index)];
};

const initGroupsApp = async () => {
  if (!mapElement || !window.L) return;

  if (groupsMapInstance) {
    groupsMapInstance.remove();
    groupsMapInstance = null;
  }

  // 1. Crear mapa de Leaflet
  const groupsMap = L.map("groups-map", {
    scrollWheelZoom: false,
    zoomControl: true,
    fadeAnimation: true
  }).setView([3.435, -76.535], 12);

  groupsMapInstance = groupsMap;

  // 2. OpenStreetMap oficial (100% libre y sin claves API)
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    tileSize: 256
  }).addTo(groupsMap);

  // Forzar a Leaflet a calcular el tamaño real de todos sus cuadros
  const fullMapRefresh = () => {
    if (groupsMap) {
      groupsMap.invalidateSize(true);
    }
  };

  // Reintentos automáticos
  setTimeout(fullMapRefresh, 100);
  setTimeout(fullMapRefresh, 500);
  setTimeout(fullMapRefresh, 1000);
  window.addEventListener("resize", fullMapRefresh);

  // Observador ANTICIPADO para index.html: precarga los cuadros 300px antes de llegar con el scroll
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          fullMapRefresh();
          sectionObserver.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "300px 0px 300px 0px", threshold: 0.01 }
  );

  const parentSection = document.querySelector("#grupos") || mapElement;
  sectionObserver.observe(parentSection);

  // 3. Cargar grupos de Supabase (sin direcciones exactas por seguridad)
  let activeGroups = [];
  const sb = getSupabaseClient();

  if (sb) {
    try {
      const { data, error } = await sb
        .from("grupos_conexion")
        .select("*")
        .eq("estado", "activo")
        .order("created_at", { ascending: false });

      if (!error && data) {
        activeGroups = data.map((g) => {
          const nameFinal = g.nombre || g.nombre_grupo || "Grupo de conexión";
          return {
            id: g.id,
            name: nameFinal,
            zone: g.zona || "Cali",
            day: [g.dia, g.hora ? formatPublicTime(g.hora) : ""].filter(Boolean).join(" · ") || "Por confirmar",
            leader: g.lider || "Líder de grupo",
            contact: g.contacto?.startsWith("http") ? g.contacto : (g.contacto ? `https://wa.me/${g.contacto.replace(/\D/g, '')}` : "contacto.html"),
            lat: Number(g.lat) || 3.435,
            lng: Number(g.lng) || -76.535
          };
        });
      }
    } catch (err) {
      console.error("Error cargando grupos de Supabase:", err);
    }
  }

  // 4. Marcadores en el mapa
  const markerIcon = L.divIcon({
    className: "custom-map-marker",
    html: `<div class="marker-pin"><i class="fa-solid fa-church"></i></div>`,
    iconSize: [34, 42],
    iconAnchor: [17, 42],
    popupAnchor: [0, -38],
  });

  const markers = new Map();

  activeGroups.forEach((group) => {
    const popupContent = `
      <article class="group-popup">
        <strong>${group.name}</strong>
        <p><b>Zona:</b> ${group.zone}</p>
        <p><b>Horario:</b> ${group.day}</p>
        <p><b>Líder:</b> ${group.leader}</p>
        <a href="${group.contact}" target="_blank" rel="noreferrer">Solicitar dirección al líder ↗</a>
      </article>
    `;
    const marker = L.marker([group.lat, group.lng], { icon: markerIcon })
      .addTo(groupsMap)
      .bindPopup(popupContent);
    markers.set(group.name, marker);
  });

  const focusGroup = (group) => {
    if (!group) return;
    const marker = markers.get(group.name);
    groupsMap.flyTo([group.lat, group.lng], 15, { duration: 0.65 });
    if (marker) marker.openPopup();
    document
      .querySelectorAll(".group-result")
      .forEach((item) => item.classList.toggle("is-active", item.dataset.group === group.name));
  };

  // 5. Lista lateral y buscador
  const renderGroups = (query = "") => {
    if (!groupsResults) return;
    const normalized = query.trim().toLowerCase();
    const filtered = activeGroups.filter((group) =>
      `${group.name} ${group.zone} ${group.day} ${group.leader}`.toLowerCase().includes(normalized)
    );

    if (groupCount) {
      groupCount.textContent = `${filtered.length} grupo${filtered.length === 1 ? "" : "s"} encontrado${filtered.length === 1 ? "" : "s"}`;
    }

    if (!filtered.length) {
      groupsResults.innerHTML = '<p style="padding: 24px 20px; color: #a8a5ad; font-size: 13px;">No hay grupos de conexión registrados actualmente.</p>';
      return;
    }

    groupsResults.innerHTML = filtered
      .map(
        (group) => `
        <button class="group-result site-card" type="button" data-group="${group.name}">
          <strong>${group.name}</strong>
          <span>${group.zone} · ${group.day}</span>
          <small>Ver en el mapa ↗</small>
        </button>`
      )
      .join("");

    groupsResults.querySelectorAll(".group-result").forEach((button) =>
      button.addEventListener("click", () =>
        focusGroup(activeGroups.find((group) => group.name === button.dataset.group))
      )
    );
  };

  renderGroups();

  if (groupSearch) {
    groupSearch.addEventListener("input", (event) => renderGroups(event.target.value));
  }
};

initGroupsApp();

/* ========================================================================
  11. FORMULARIO DE BOLETÍN EN EL FOOTER
  ======================================================================== */
const footerNewsletterForm = document.querySelector("[data-footer-newsletter]");
if (footerNewsletterForm) {
  footerNewsletterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const statusEl = footerNewsletterForm.querySelector("[data-newsletter-status]");
    if (statusEl) {
      statusEl.textContent = "¡Gracias por suscribirte! Te mantendremos informado.";
      footerNewsletterForm.reset();
      setTimeout(() => {
        statusEl.textContent = "";
      }, 6000);
    }
  });
}

/* ========================================================================
  MÓDULO NOSOTROS: SCROLLSPY, CARRUSEL DE EQUIPO Y PUNTOS INTERACTIVOS
  ======================================================================== */
const initAboutPage = () => {
  // 1. Scrollspy activo para el sidebar
  const sections = document.querySelectorAll(".about-section");
  const navLinks = document.querySelectorAll(".about-nav-link");

  if (sections.length && navLinks.length) {
    const intersectingSections = new Map();
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        intersectingSections.set(entry.target, entry.isIntersecting);
      });

      const activationPoint = window.innerHeight * 0.25;
      const visibleSections = [...intersectingSections]
        .filter(([, isIntersecting]) => isIntersecting)
        .map(([section]) => section)
        .sort((first, second) => first.getBoundingClientRect().top - second.getBoundingClientRect().top);
      const currentSection = visibleSections
        .filter((section) => section.getBoundingClientRect().top <= activationPoint)
        .at(-1) || visibleSections[0];
      if (!currentSection) return;

      navLinks.forEach((link) => {
        const isActive = link.getAttribute("href") === `#${currentSection.id}`;
        link.classList.toggle("is-active", isActive);
        if (isActive) {
          link.setAttribute("aria-current", "location");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    }, { rootMargin: "-20% 0px -65% 0px", threshold: 0 });

    sections.forEach((section) => sectionObserver.observe(section));
  }

  // 2. Controladores del Carrusel y Puntos Interactivos
  const track = document.getElementById("team-carousel-track");
  const btnPrev = document.getElementById("team-prev");
  const btnNext = document.getElementById("team-next");
  const dotsContainer = document.getElementById("team-dots");

  if (!track) return;

  const getCardStep = () => {
    const firstCard = track.querySelector(".cornerstone-member-card");
    return firstCard ? firstCard.offsetWidth + 24 : 300;
  };

  const updateActiveDot = () => {
    if (!dotsContainer) return;
    const cards = track.querySelectorAll(".cornerstone-member-card");
    if (!cards.length) return;

    const step = getCardStep();
    const activeIndex = Math.min(
      cards.length - 1,
      Math.max(0, Math.round(track.scrollLeft / step)),
    );

    const dots = dotsContainer.querySelectorAll(".cornerstone-dot");
    dots.forEach((dot, index) => {
      dot.classList.toggle("active", index === activeIndex);
    });
  };

  if (btnPrev && btnNext) {
    btnPrev.addEventListener("click", () => {
      track.scrollBy({ left: -getCardStep(), behavior: "smooth" });
    });
    btnNext.addEventListener("click", () => {
      track.scrollBy({ left: getCardStep(), behavior: "smooth" });
    });
  }

  track.addEventListener(
    "scroll",
    () => {
      window.requestAnimationFrame(updateActiveDot);
    },
    { passive: true },
  );

  const bindDotsClicks = () => {
    if (!dotsContainer) return;
    const dots = dotsContainer.querySelectorAll(".cornerstone-dot");
    const cards = track.querySelectorAll(".cornerstone-member-card");

    dots.forEach((dot, index) => {
      dot.addEventListener("click", () => {
        if (cards[index]) {
          const step = getCardStep();
          track.scrollTo({
            left: index * step,
            behavior: "smooth",
          });
        }
      });
    });
  };

  // 3. Renderizado y Carga desde Supabase
  const MIN_TEAM_CARDS = 7;
  const placeholderCardHTML = `
    <article class="cornerstone-member-card is-placeholder">
      <div class="placeholder-silhouette">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
        </svg>
      </div>
    </article>
  `;

  const renderTeamCards = (members = []) => {
    const realCards = members.map(
      (m) => `
      <article class="cornerstone-member-card">
        <img class="cornerstone-member-photo" src="${m.foto_url || "Media/02.jpg"}" alt="${m.nombre}" loading="lazy" />
        <div class="cornerstone-member-overlay"></div>
        <div class="cornerstone-member-text">
          <h4 class="cornerstone-member-name">${m.nombre}</h4>
          <p class="cornerstone-member-role">${m.cargo}</p>
        </div>
      </article>
    `,
    );

    const remainingPlaceholders = Math.max(0, MIN_TEAM_CARDS - realCards.length);
    const placeholders = Array.from({ length: remainingPlaceholders }, () => placeholderCardHTML);
    const allCards = [...realCards, ...placeholders];

    track.innerHTML = allCards.join("");

    if (dotsContainer) {
      dotsContainer.innerHTML = Array.from(
        { length: allCards.length },
        (_, i) =>
          `<button class="cornerstone-dot ${i === 0 ? "active" : ""}" aria-label="Posición ${i + 1}"></button>`,
      ).join("");

      bindDotsClicks();
      updateActiveDot();
    }
  };

  const loadTeam = async () => {
    const sb = window._supabase || window.supabaseClient;
    if (!sb) {
      bindDotsClicks();
      return;
    }

    try {
      const { data, error } = await sb
        .from("nosotros_equipo")
        .select("*")
        .eq("activo", true)
        .order("orden", { ascending: true });

      if (!error && data && data.length) {
        const lead = data.find((m) => m.categoria === "pastor_principal");
        if (lead) {
          const nameEl = document.querySelector("#lead-pastor-names");
          const imgEl = document.querySelector("#lead-pastor-img");
          const bioEl = document.querySelector("#lead-pastor-bio");

          if (nameEl) nameEl.textContent = lead.nombre;
          if (imgEl && lead.foto_url) imgEl.src = lead.foto_url;
          if (bioEl && lead.cargo) bioEl.textContent = `${lead.nombre} — ${lead.cargo}`;
        }

        renderTeamCards(data);
      } else {
        bindDotsClicks();
      }
    } catch (e) {
      console.warn("Aviso al cargar equipo:", e);
      bindDotsClicks();
    }
  };

  bindDotsClicks();
  loadTeam();
};

initAboutPage();