const revealElements = document.querySelectorAll(".reveal");

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
    }
  });
}, { threshold: 0.15 });

revealElements.forEach((el) => revealObserver.observe(el));

const chips = document.querySelectorAll(".chip");
chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    const parent = chip.parentElement;
    parent.querySelectorAll(".chip").forEach((btn) => btn.classList.remove("active"));
    chip.classList.add("active");
  });
});

const toggles = document.querySelectorAll(".toggle");
toggles.forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const parent = toggle.parentElement;
    parent.querySelectorAll(".toggle").forEach((btn) => btn.classList.remove("active"));
    toggle.classList.add("active");
  });
});

const yearRange = document.getElementById("yearRange");
const yearRangeValue = document.getElementById("yearRangeValue");

if (yearRange && yearRangeValue) {
  yearRange.addEventListener("input", () => {
    yearRangeValue.textContent = `1988 — ${yearRange.value}`;
  });
}

const progressBar = document.querySelector(".timeline-progress");

window.addEventListener("scroll", () => {
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = (scrollTop / docHeight) * 100;
  progressBar.style.width = `${progress}%`;
});

const yearCounter = document.getElementById("yearCounter");

window.addEventListener("scroll", () => {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const ratio = window.scrollY / maxScroll;
  const year = Math.round(1988 + ratio * (2025 - 1988));
  if (yearCounter) yearCounter.textContent = year;
});