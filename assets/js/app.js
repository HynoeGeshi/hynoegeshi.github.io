// IMPORTANT:
// Put your background image at: assets/img/bg.jpg
// Put portfolio images at: assets/img/01.jpg, 02.jpg, 03.jpg... (recommended)

const images = [
  { file: "01.jpg", type: "music", alt: "Music photography in Chicago" },
  { file: "02.jpg", type: "portrait", alt: "Portrait photography in Chicago" },
  { file: "03.jpg", type: "portrait", alt: "Cinematic portrait photography" },
  { file: "04.jpg", type: "music", alt: "Live performance photography" },
  { file: "05.jpg", type: "city", alt: "Chicago city photography" }
].map(x => ({
  ...x,
  src: "assets/img/" + x.file
}));

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

function label(t){
  if (t === "portrait") return "Portraits";
  if (t === "music") return "Music";
  if (t === "city") return "Chicago";
  return "All";
}

function renderDots() {
  dotsEl.innerHTML = "";
  filtered.forEach((_, i) => {
    const b = document.createElement("button");
    b.className = "dot" + (i === index ? " active" : "");
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

  imgEl.onerror = () => {
    imgEl.onerror = null;
    imgEl.alt = "Image not found. Check filename in assets/img/";
    imgEl.src =
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='800'>
        <rect width='100%' height='100%' fill='black'/>
        <text x='50%' y='45%' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='42' font-family='Arial'>
          Image not found
        </text>
        <text x='50%' y='55%' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='26' font-family='Arial'>
          Put images in assets/img/ and match filenames in app.js
        </text>
      </svg>`);
  };

  imgEl.src = item.src;
  imgEl.alt = item.alt || "Portfolio photo";

  countEl.textContent = `${index + 1} / ${filtered.length}`;
  typeEl.textContent = label(item.type);

  renderDots();
}

function next(){ index++; show(); }
function prev(){ index--; show(); }

prevBtn.addEventListener("click", () => { prev(); restartAutoplay(); });
nextBtn.addEventListener("click", () => { next(); restartAutoplay(); });

function startAutoplay(){
  stopAutoplay();
  if (!autoplay) return;
  timer = setInterval(next, 4500);
}
function stopAutoplay(){
  if (timer) clearInterval(timer);
  timer = null;
}
function restartAutoplay(){
  if (autoplay) startAutoplay();
}

toggleAutoBtn.addEventListener("click", () => {
  autoplay = !autoplay;
  toggleAutoBtn.textContent = autoplay ? "Pause" : "Play";
  startAutoplay();
});

// Filters
document.querySelectorAll(".filter-bar .pill").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-bar .pill").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const type = btn.dataset.filter;
    filtered = (type === "all") ? [...images] : images.filter(i => i.type === type);

    index = 0;
    show();
    restartAutoplay();
  });
});

// Swipe
let sx = 0;
imgEl.addEventListener("touchstart", e => { sx = e.touches[0].clientX; }, { passive:true });
imgEl.addEventListener("touchend", e => {
  const dx = e.changedTouches[0].clientX - sx;
  if (Math.abs(dx) > 40) {
    dx > 0 ? prev() : next();
    restartAutoplay();
  }
}, { passive:true });

// Mobile menu
const menuBtn = document.getElementById("menuBtn");
const mobileMenu = document.getElementById("mobileMenu");
if (menuBtn && mobileMenu) {
  menuBtn.addEventListener("click", () => {
    mobileMenu.classList.toggle("open");
    mobileMenu.setAttribute("aria-hidden", mobileMenu.classList.contains("open") ? "false" : "true");
  });

  mobileMenu.querySelectorAll("a").forEach(a => {
    a.addEventListener("click", () => mobileMenu.classList.remove("open"));
  });
}

// Footer year
document.getElementById("year").textContent = new Date().getFullYear();

show();
startAutoplay();
