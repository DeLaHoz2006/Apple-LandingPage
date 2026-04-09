// Espera a que todo el HTML esté cargado antes de ejecutar el script
document.addEventListener("DOMContentLoaded", () => {

    // ==============================
    // SELECTORES DEL DOM
    // ==============================

    // Contenedor principal del carrusel
    const heroViewport = document.querySelector("[data-carousel]");

    // Track (pista) donde están los slides principales
    const heroTrack = heroViewport?.querySelector(".appleTv__trac k");

    // Contenedor del carrusel pequeño (miniaturas)
    const miniViewport = document.querySelector(".appleTv__miniViewport");

    // Track de las miniaturas
    const miniTrack = miniViewport?.querySelector("[data-mini-carousel]");

    // Contenedor de los dots (indicadores)
    const dotsContainer = document.querySelector("#carouselDots");

    // Botones de navegación
    const prevButton = heroViewport?.querySelector('[data-direction="prev"]');
    const nextButton = heroViewport?.querySelector('[data-direction="next"]');

    // Botón de autoplay (play/pausa)
    const toggleButton = document.querySelector("[data-carousel-toggle]");
    const toggleIcon = toggleButton?.querySelector(".appleTv__toggleIcon");

    // Contenedor general (para detectar hover, focus, etc.)
    const interactionRoot = document.querySelector(".appleTv");

    // Detecta si el usuario prefiere menos animaciones (accesibilidad)
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    // Índice inicial (si viene definido en HTML)
    const startIndexValue = Number.parseInt(heroViewport?.dataset.startIndex ?? "0", 10);

    // Si falta algo importante, se detiene todo
    if (!heroViewport || !heroTrack || !miniViewport || !miniTrack || !dotsContainer || !prevButton || !nextButton) {
        return;
    }

    // ==============================
    // VARIABLES DE CONTROL
    // ==============================

    const startIndex = Number.isNaN(startIndexValue) ? 0 : startIndexValue;

    let autoplayId = 0;       // ID del setInterval
    let isUserPaused = false; // Si el usuario pausó manualmente

    // Función para hacer loop infinito (ej: -1 → último elemento)
    const wrapIndex = (index, total) => (index + total) % total;

    // ==============================
    // FUNCIÓN PRINCIPAL DEL CARRUSEL
    // ==============================
    const createLoopTrack = ({
        viewport,
        track,
        itemSelector,
        startAt = 0,
        align = "center",
        duration = 680,
        onChange
    }) => {

        // Obtiene todos los slides originales
        const originalItems = Array.from(track.querySelectorAll(itemSelector));

        if (!originalItems.length) {
            return null;
        }

        // Asigna índice lógico a cada item
        originalItems.forEach((item, index) => {
            item.dataset.logicalIndex = String(index);
        });

        // Clona primero y último para efecto infinito
        const firstClone = originalItems[0].cloneNode(true);
        const lastClone = originalItems[originalItems.length - 1].cloneNode(true);

        firstClone.dataset.clone = "true";
        lastClone.dataset.clone = "true";

        track.prepend(lastClone);
        track.append(firstClone);

        // Lista final de items (incluye clones)
        const items = Array.from(track.querySelectorAll(itemSelector));

        // Índices
        let physicalIndex = wrapIndex(startAt, originalItems.length) + 1;
        let logicalIndex = wrapIndex(startAt, originalItems.length);

        let isAnimating = false;

        // Calcula el desplazamiento en px
        const getTranslate = (index) => {
            const item = items[index];
            if (!item) return 0;

            const baseOffset = -item.offsetLeft;

            // Centra el elemento activo
            if (align === "center") {
                return baseOffset + ((viewport.clientWidth - item.offsetWidth) / 2);
            }

            return baseOffset;
        };

        // Actualiza clases visuales
        const updateVisualState = () => {
            if (align !== "center") return;

            const previousIndex = physicalIndex - 1;
            const nextIndex = physicalIndex + 1;

            items.forEach((item, index) => {
                const isActive = index === physicalIndex;
                const isNeighbor = index === previousIndex || index === nextIndex;

                item.classList.toggle("is-active", isActive);
                item.classList.toggle("is-neighbor", !isActive && isNeighbor);
            });
        };

        // Aplica transformación CSS
        const applyTransform = (animate) => {
            track.style.transition = animate
                ? `transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`
                : "none";

            track.style.transform = `translate3d(${getTranslate(physicalIndex)}px, 0, 0)`;

            updateVisualState();
        };

        // Sincroniza índice lógico
        const syncLogical = () => {
            const item = items[physicalIndex];
            logicalIndex = Number.parseInt(item?.dataset.logicalIndex ?? "0", 10);

            // Callback externo (ej: actualizar dots)
            onChange?.(logicalIndex);
        };

        // Salto interno (cuando llega a clones)
        const jumpTo = (nextPhysicalIndex) => {
            physicalIndex = nextPhysicalIndex;
            applyTransform(false);
            syncLogical();
            isAnimating = false;
        };

        // Evento al terminar animación
        track.addEventListener("transitionend", (event) => {
            if (event.target !== track) return;

            // Si llegó al clone del inicio
            if (physicalIndex === 0) {
                jumpTo(originalItems.length);
                return;
            }

            // Si llegó al clone del final
            if (physicalIndex === items.length - 1) {
                jumpTo(1);
                return;
            }

            isAnimating = false;
            syncLogical();
        });

        // API del carrusel
        const api = {
            get count() {
                return originalItems.length;
            },
            get logicalIndex() {
                return logicalIndex;
            },
            next() {
                if (isAnimating) return;

                physicalIndex += 1;
                logicalIndex = wrapIndex(logicalIndex + 1, originalItems.length);
                isAnimating = true;

                onChange?.(logicalIndex);
                applyTransform(true);
            },
            prev() {
                if (isAnimating) return;

                physicalIndex -= 1;
                logicalIndex = wrapIndex(logicalIndex - 1, originalItems.length);
                isAnimating = true;

                onChange?.(logicalIndex);
                applyTransform(true);
            },
            goTo(index, animate = true) {
                const nextIndex = wrapIndex(index, originalItems.length);

                logicalIndex = nextIndex;
                physicalIndex = nextIndex + 1;
                isAnimating = animate;

                onChange?.(logicalIndex);
                applyTransform(animate);
            },
            refresh() {
                isAnimating = false;
                applyTransform(false);
            }
        };

        // Inicialización
        applyTransform(false);
        syncLogical();

        return api;
    };

    // ==============================
    // DOTS (INDICADORES)
    // ==============================

    const heroDots = [];

    const updateDots = (activeIndex, total) => {

        // Crear dots solo una vez
        if (heroDots.length === 0) {
            dotsContainer.replaceChildren();

            for (let index = 0; index < total; index += 1) {
                const dot = document.createElement("button");

                dot.type = "button";
                dot.className = "appleTv__dot";

                dot.setAttribute("aria-label", `Go to slide ${index + 1}`);
                dot.setAttribute("aria-pressed", "false");

                // Click en dot
                dot.addEventListener("click", () => {
                    hero?.goTo(index, true);
                    mini?.goTo(index, true);
                    restartAutoplayIfAllowed();
                });

                heroDots.push(dot);
                dotsContainer.appendChild(dot);
            }
        }

        // Actualizar estado activo
        heroDots.forEach((dot, index) => {
            const isActive = index === activeIndex;

            dot.classList.toggle("is-active", isActive);
            dot.setAttribute("aria-pressed", String(isActive));
        });
    };

    // ==============================
    // INSTANCIAS DEL CARRUSEL
    // ==============================

    const heroSlideCount = heroTrack.querySelectorAll(".appleTv__item").length;

    const hero = createLoopTrack({
        viewport: heroViewport,
        track: heroTrack,
        itemSelector: ".appleTv__item",
        startAt: startIndex,
        align: "center",
        duration: 760,
        onChange: (index) => updateDots(index, heroSlideCount)
    });

    const mini = createLoopTrack({
        viewport: miniViewport,
        track: miniTrack,
        itemSelector: ".appleTv__miniCard",
        startAt: startIndex,
        align: "start",
        duration: 680
    });

    if (!hero || !mini) return;

    // ==============================
    // AUTOPLAY
    // ==============================

    const startAutoplay = () => {
        clearInterval(autoplayId);

        if (reducedMotion.matches || isUserPaused) {
            autoplayId = 0;
            return;
        }

        autoplayId = setInterval(() => {
            hero.next();
            mini.next();
        }, 4300);
    };

    const stopAutoplay = () => {
        clearInterval(autoplayId);
        autoplayId = 0;
    };

    const restartAutoplayIfAllowed = () => {
        if (!isUserPaused) {
            startAutoplay();
        }
    };

    // ==============================
    // EVENTOS
    // ==============================

    prevButton.addEventListener("click", () => {
        hero.prev();
        mini.prev();
        restartAutoplayIfAllowed();
    });

    nextButton.addEventListener("click", () => {
        hero.next();
        mini.next();
        restartAutoplayIfAllowed();
    });

    // ==============================
    // INICIALIZACIÓN FINAL
    // ==============================

    updateDots(hero.logicalIndex, hero.count);

    requestAnimationFrame(() => {
        hero.goTo(startIndex, false);
        mini.goTo(startIndex, false);
        startAutoplay();
    });
});