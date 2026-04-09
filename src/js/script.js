document.addEventListener("DOMContentLoaded", () => {
    const heroViewport = document.querySelector("[data-carousel]");
    const heroTrack = heroViewport?.querySelector(".appleTv__track");
    const miniViewport = document.querySelector(".appleTv__miniViewport");
    const miniTrack = miniViewport?.querySelector("[data-mini-carousel]");
    const dotsContainer = document.querySelector("#carouselDots");
    const prevButton = heroViewport?.querySelector('[data-direction="prev"]');
    const nextButton = heroViewport?.querySelector('[data-direction="next"]');
    const toggleButton = document.querySelector("[data-carousel-toggle]");
    const toggleIcon = toggleButton?.querySelector(".appleTv__toggleIcon");
    const interactionRoot = document.querySelector(".appleTv");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const startIndexValue = Number.parseInt(heroViewport?.dataset.startIndex ?? "0", 10);

    if (!heroViewport || !heroTrack || !miniViewport || !miniTrack || !dotsContainer || !prevButton || !nextButton) {
        return;
    }

    const startIndex = Number.isNaN(startIndexValue) ? 0 : startIndexValue;
    let autoplayId = 0;
    let isUserPaused = false;

    const wrapIndex = (index, total) => (index + total) % total;

    const createLoopTrack = ({
        viewport,
        track,
        itemSelector,
        startAt = 0,
        align = "center",
        duration = 680,
        onChange
    }) => {
        const originalItems = Array.from(track.querySelectorAll(itemSelector));

        if (!originalItems.length) {
            return null;
        }

        originalItems.forEach((item, index) => {
            item.dataset.logicalIndex = String(index);
        });

        const cloneCount = originalItems.length;
        const prependFragment = document.createDocumentFragment();
        const appendFragment = document.createDocumentFragment();

        originalItems.forEach((item) => {
            const beforeClone = item.cloneNode(true);
            const afterClone = item.cloneNode(true);

            beforeClone.dataset.clone = "true";
            afterClone.dataset.clone = "true";

            prependFragment.appendChild(beforeClone);
            appendFragment.appendChild(afterClone);
        });

        track.prepend(prependFragment);
        track.append(appendFragment);

        const items = Array.from(track.querySelectorAll(itemSelector));
        let physicalIndex = wrapIndex(startAt, originalItems.length) + cloneCount;
        let logicalIndex = wrapIndex(startAt, originalItems.length);
        let isAnimating = false;

        const getTranslate = (index) => {
            const item = items[index];

            if (!item) {
                return 0;
            }

            const baseOffset = -item.offsetLeft;

            if (align === "center") {
                return baseOffset + ((viewport.clientWidth - item.offsetWidth) / 2);
            }

            return baseOffset;
        };

        const updateVisualState = () => {
            if (align !== "center") {
                return;
            }

            const previousIndex = physicalIndex - 1;
            const nextIndex = physicalIndex + 1;

            items.forEach((item, index) => {
                const isActive = index === physicalIndex;
                const isNeighbor = index === previousIndex || index === nextIndex;

                item.classList.toggle("is-active", isActive);
                item.classList.toggle("is-neighbor", !isActive && isNeighbor);
            });
        };

        const applyTransform = (animate) => {
            track.style.transition = animate
                ? `transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`
                : "none";
            track.style.transform = `translate3d(${getTranslate(physicalIndex)}px, 0, 0)`;
            updateVisualState();
        };

        const syncLogical = () => {
            const item = items[physicalIndex];
            logicalIndex = Number.parseInt(item?.dataset.logicalIndex ?? "0", 10);
            onChange?.(logicalIndex);
        };

        const jumpTo = (nextPhysicalIndex) => {
            physicalIndex = nextPhysicalIndex;
            applyTransform(false);
            syncLogical();
            isAnimating = false;
        };

        track.addEventListener("transitionend", (event) => {
            if (event.target !== track) {
                return;
            }

            if (physicalIndex < cloneCount) {
                jumpTo(physicalIndex + originalItems.length);
                return;
            }

            if (physicalIndex >= cloneCount + originalItems.length) {
                jumpTo(physicalIndex - originalItems.length);
                return;
            }

            isAnimating = false;
            syncLogical();
        });

        const api = {
            get count() {
                return originalItems.length;
            },
            get logicalIndex() {
                return logicalIndex;
            },
            next() {
                if (isAnimating) {
                    return;
                }

                physicalIndex += 1;
                logicalIndex = wrapIndex(logicalIndex + 1, originalItems.length);
                isAnimating = true;
                onChange?.(logicalIndex);
                applyTransform(true);
            },
            prev() {
                if (isAnimating) {
                    return;
                }

                physicalIndex -= 1;
                logicalIndex = wrapIndex(logicalIndex - 1, originalItems.length);
                isAnimating = true;
                onChange?.(logicalIndex);
                applyTransform(true);
            },
            goTo(index, animate = true) {
                const nextIndex = wrapIndex(index, originalItems.length);

                logicalIndex = nextIndex;
                physicalIndex = nextIndex + cloneCount;
                isAnimating = animate;
                onChange?.(logicalIndex);
                applyTransform(animate);
            },
            refresh() {
                isAnimating = false;
                applyTransform(false);
            }
        };

        applyTransform(false);
        syncLogical();

        return api;
    };

    const heroDots = [];
    const updateDots = (activeIndex, total) => {
        if (heroDots.length === 0) {
            dotsContainer.replaceChildren();

            for (let index = 0; index < total; index += 1) {
                const dot = document.createElement("button");

                dot.type = "button";
                dot.className = "appleTv__dot";
                dot.setAttribute("aria-label", `Go to slide ${index + 1}`);
                dot.setAttribute("aria-pressed", "false");
                dot.addEventListener("click", () => {
                    hero?.goTo(index, true);
                    mini?.goTo(index, true);
                    restartAutoplayIfAllowed();
                });

                heroDots.push(dot);
                dotsContainer.appendChild(dot);
            }
        }

        heroDots.forEach((dot, index) => {
            const isActive = index === activeIndex;

            dot.classList.toggle("is-active", isActive);
            dot.setAttribute("aria-pressed", String(isActive));
        });
    };

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

    if (!hero || !mini) {
        return;
    }

    const updateToggle = () => {
        if (!toggleButton || !toggleIcon) {
            return;
        }

        const autoplayEnabled = !isUserPaused && !reducedMotion.matches;

        toggleButton.setAttribute("aria-label", autoplayEnabled ? "Pause autoplay" : "Start autoplay");
        toggleButton.setAttribute("aria-pressed", String(!autoplayEnabled));
        toggleIcon.textContent = autoplayEnabled ? "||" : ">";
    };

    const autoplayStep = (direction = "next") => {
        if (direction === "prev") {
            hero.prev();
            mini.prev();
            return;
        }

        hero.next();
        mini.next();
    };

    const startAutoplay = () => {
        window.clearInterval(autoplayId);

        if (reducedMotion.matches || isUserPaused) {
            autoplayId = 0;
            updateToggle();
            return;
        }

        autoplayId = window.setInterval(() => {
            autoplayStep("next");
        }, 4300);

        updateToggle();
    };

    const stopAutoplay = () => {
        window.clearInterval(autoplayId);
        autoplayId = 0;
        updateToggle();
    };

    const restartAutoplayIfAllowed = () => {
        if (isUserPaused) {
            updateToggle();
            return;
        }

        startAutoplay();
    };

    prevButton.addEventListener("click", () => {
        autoplayStep("prev");
        restartAutoplayIfAllowed();
    });

    nextButton.addEventListener("click", () => {
        autoplayStep("next");
        restartAutoplayIfAllowed();
    });

    toggleButton?.addEventListener("click", () => {
        if (isUserPaused) {
            isUserPaused = false;
            startAutoplay();
            return;
        }

        isUserPaused = true;
        stopAutoplay();
    });

    interactionRoot?.addEventListener("mouseenter", stopAutoplay);
    interactionRoot?.addEventListener("mouseleave", restartAutoplayIfAllowed);
    interactionRoot?.addEventListener("focusin", stopAutoplay);
    interactionRoot?.addEventListener("focusout", () => {
        if (!interactionRoot.contains(document.activeElement)) {
            restartAutoplayIfAllowed();
        }
    });
    interactionRoot?.addEventListener("touchstart", stopAutoplay, { passive: true });
    interactionRoot?.addEventListener("touchend", restartAutoplayIfAllowed, { passive: true });

    window.addEventListener("resize", () => {
        hero.refresh();
        mini.refresh();
    });

    if (typeof reducedMotion.addEventListener === "function") {
        reducedMotion.addEventListener("change", () => {
            if (reducedMotion.matches) {
                stopAutoplay();
                hero.refresh();
                mini.refresh();
                return;
            }

            startAutoplay();
        });
    }

    updateDots(hero.logicalIndex, hero.count);
    updateToggle();

    window.requestAnimationFrame(() => {
        hero.goTo(startIndex, false);
        mini.goTo(startIndex, false);
        startAutoplay();
    });
});
