// Put your portfolio images in: assets/img/
// Update the filenames below to match YOUR uploaded images exactly.

const images = [
  { src: "assets/img/08-chicago-skyline-1.jpg", type: "city", alt: "Chicago skyline at night - city photography" },
  { src: "assets/img/09-chicago-skyline-2.jpg", type: "city", alt: "Chicago skyline and river at night - city photography" },
  { src: "assets/img/10-chicago-street.jpg", type: "city", alt: "Downtown Chicago street at night - city photography" },

  { src: "assets/img/01-ringlight.jpg", type: "portrait", alt: "Studio portrait with ring light - Chicago portrait photography" },
  { src: "assets/img/02-bearded-portrait.jpg", type: "portrait", alt: "Cinematic portrait - Chicago photographer" },
  { src: "assets/img/03-yellow-dress.jpg", type: "portrait", alt: "Portrait session in Chicago - lifestyle portrait" },
  { src: "assets/img/04-indoor-portrait.jpg", type: "portrait", alt: "Indoor portrait photography - Chicago" },

  { src: "assets/img/05-bassist.jpg", type: "music", alt: "Live bassist performance - Chicago music photography" },
  { src: "assets/img/06-vocalist.jpg", type: "music", alt: "Live vocalist on stage - Chicago concert photography" },
  { src: "assets/img/07-performance.jpg", type: "music", alt: "Live performance moment - Chicago music photography" }
];

let filtered = [...images];
let index = 0;
let autoplay = true;
let timer = null;

const imgEl = document.getElementById("slideImg");
const countEl = document.getElementById("slideCount");
const typeEl = document.getElementById("slideType");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const toggleAutoBtn = document.getElementById("toggleAuto");
const dotsEl = document.getElementById("dots");

function getTypeLabel(t){
  if (t === "portrait") return "Portrait";
  if (t === "music") return "Music";
  if (t === "city") return "Chicago";
  return "All";
}

function renderDots() {
  dotsEl.innerHTML = "";
  filtered.forEach((_, i) => {
    const b = document.createElement("button");
    b.className = "dot" + (i === index ? " active" : "");
    b.setAttribute("aria-label", `Go to slide ${i + 1}`);
    b.addEventListener("click", () => {
      index = i;
      show();
      restartAutoplay();
    });
    dotsEl.appendChild(b);
  });
}

function show() {
  if (!filtered.length) return;

  if (index < 0) index = filtered.length - 1;
  if (index >= filtered.length) index = 0;

  const item = filtered[index];
  imgEl.src = item.src;
  imgEl.alt = item.alt || `Portfolio photo ${index + 1}`;
  countEl.textContent = `${index + 1} / ${filtered.length}`;
  typeEl.textContent = getTypeLabel(item.type);

  renderDots();
}

function next() { index += 1; show(); }
function prev() { index -= 1; show(); }

prevBtn.addEventListener("click", () => { prev(); restartAutoplay(); });
nextBtn.addEventListener("click", () => { next(); restartAutoplay(); });

function startAutoplay() {
  stopAutoplay();
  if (!autoplay) return;
  timer = setInterval(next, 4500);
}

function stopAutoplay() {
  if (timer) clearInterval(timer);
  timer = null;
}

function restartAutoplay() {
  if (autoplay) startAutoplay();
}

toggleAutoBtn.addEventListener("click", () => {
  autoplay = !autoplay;
  toggleAutoBtn.textContent = autoplay ? "Pause" : "Play";
  startAutoplay();
});

// Keyboard controls
window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") { prev(); restartAutoplay(); }
  if (e.key === "ArrowRight") { next(); restartAutoplay(); }
});

// Swipe (mobile)
let startX = 0;
imgEl.addEventListener("touchstart", (e) => {
  startX = e.touches[0].clientX;
}, { passive: true });

imgEl.addEventListener("touchend", (e) => {
  const endX = e.changedTouches[0].clientX;
  const dx = endX - startX;
  if (Math.abs(dx) > 40) {
    if (dx > 0) prev();
    else next();
    restartAutoplay();
  }
}, { passive: true });

// Filter buttons
const filterButtons = document.querySelectorAll(".filter-bar .pill");
filterButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    filterButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const type = btn.dataset.filter;
    filtered = type === "all" ? [...images] : images.filter(img => img.type === type);
    index = 0;
    show();
    restartAutoplay();
  });
});

// Footer year
document.getElementById("year").textContent = new Date().getFullYear();

// Init
show();
startAutoplay();
