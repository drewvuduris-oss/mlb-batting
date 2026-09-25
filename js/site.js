// Shared page behavior for both pages: scroll-in reveals and the scoreboard
// number plates. Loaded at the end of <body>.

window.REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Runs fn once, the first time el scrolls into view (immediately if observers are unavailable).
function whenVisible(el, fn, rootMargin = "0px 0px -12% 0px") {
  if (window.REDUCED_MOTION || !("IntersectionObserver" in window)) { fn(); return; }
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      io.disconnect();
      fn();
    }
  }, { rootMargin });
  io.observe(el);
}

// Elements with .reveal fade and rise into place once they enter the viewport.
document.querySelectorAll(".reveal").forEach((el) => whenVisible(el, () => el.classList.add("in")));

// Sets a scoreboard plate's number. When the number changes, the new plate
// slides down into place, like a plate hung on a hand-operated board.
function setPlate(span, value) {
  if (span.textContent === value) return;
  const first = span.textContent === "";
  span.textContent = value;
  if (first || window.REDUCED_MOTION || !span.animate) return;
  span.animate(
    [{ transform: "translateY(-105%)" }, { transform: "translateY(0)" }],
    { duration: 520, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)" },
  );
}
