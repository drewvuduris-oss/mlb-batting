// Shared page behavior for both pages: night/day theme, reading progress bar,
// and scroll-reveal animations. Loaded in <head> so the saved theme applies
// before the page paints (no flash of the wrong theme).

(function () {
  const root = document.documentElement;
  const KEY = "mlb-theme";

  function saved() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function save(theme) {
    try { localStorage.setItem(KEY, theme); } catch (e) { /* private mode: theme just won't persist */ }
  }

  // Night game is the default look.
  root.dataset.theme = saved() === "day" ? "day" : "night";

  window.REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setTheme(theme) {
    root.dataset.theme = theme;
    save(theme);
    updateToggle();
    window.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
  }

  function updateToggle() {
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;
    const night = root.dataset.theme === "night";
    btn.querySelector(".txt").textContent = night ? "Night game" : "Day game";
    btn.setAttribute("aria-label", night ? "Switch to day game (light theme)" : "Switch to night game (dark theme)");
  }

  document.addEventListener("DOMContentLoaded", () => {
    // Theme toggle
    const btn = document.getElementById("theme-toggle");
    if (btn) {
      updateToggle();
      btn.addEventListener("click", () => setTheme(root.dataset.theme === "night" ? "day" : "night"));
    }

    // Reading progress bar
    const bar = document.querySelector(".progress");
    if (bar) {
      const update = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
      };
      window.addEventListener("scroll", update, { passive: true });
      window.addEventListener("resize", update);
      update();
    }

    // Scroll reveal: elements with .reveal fade/slide in once they enter the viewport.
    const items = document.querySelectorAll(".reveal");
    if (window.REDUCED_MOTION || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("in"));
    } else {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      }, { rootMargin: "0px 0px -10% 0px" });
      items.forEach((el) => io.observe(el));
    }
  });
})();

// Runs fn once, the first time el scrolls into view (immediately if observers are unavailable).
function whenVisible(el, fn, rootMargin = "0px 0px -15% 0px") {
  if (!("IntersectionObserver" in window)) { fn(); return; }
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      io.disconnect();
      fn();
    }
  }, { rootMargin });
  io.observe(el);
}

// Split-flap scoreboard text: renders value into el as character cells and
// flips each cell through random characters before it settles.
function flapTo(el, value, { stagger = 70, spins = 6 } = {}) {
  const text = String(value);
  el.setAttribute("aria-label", text);
  const DIGITS = "0123456789";
  const cells = [...text].map((ch) => {
    const span = document.createElement("span");
    const isDigit = DIGITS.includes(ch);
    span.className = "cell" + (isDigit || /[A-Za-z]/.test(ch) ? "" : " punct");
    span.setAttribute("aria-hidden", "true");
    span.textContent = isDigit ? "0" : ch;
    return { span, ch, isDigit };
  });
  el.replaceChildren(...cells.map((c) => c.span));
  if (window.REDUCED_MOTION) {
    cells.forEach((c) => (c.span.textContent = c.ch));
    return;
  }
  cells.forEach((c, i) => {
    if (!c.isDigit) return;
    let n = 0;
    const total = spins + i;
    const tick = () => {
      c.span.classList.remove("flap");
      void c.span.offsetWidth; // restart the flap animation
      c.span.classList.add("flap");
      n++;
      c.span.textContent = n >= total ? c.ch : DIGITS[Math.floor(Math.random() * 10)];
      if (n < total) setTimeout(tick, stagger);
    };
    setTimeout(tick, i * 30);
  });
}
