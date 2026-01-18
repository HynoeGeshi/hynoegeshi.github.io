/* ==========================================
   Hynoe Flicks — Luxury Site Logic
   ========================================== */

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

const sections = ["home","portfolio","services","editing","contact"];
const sectionEls = sections.map(id => document.getElementById(id)).filter(Boolean);

function setActive(id){
  // Mark sections
  sectionEls.forEach(s => s.dataset.active = (s.id === id) ? "true" : "false";

  // Mark tabs (desktop)
  $$(".tab").forEach(t => {
    const on = t.dataset.target === id;
    t.setAttribute("aria-current", on ? "true" : "false");
  });
}

function scrollToId(id){
  const el = document.getElementById(id);
  if(!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* Tabs click */
$$(".tab").forEach(t => {
  t.addEventListener("click", (e) => {
    e.preventDefault();
    const id = t.dataset.target;
    setActive(id);
    scrollToId(id);
  });
});

/* Editing only button should take you to Editing section and activate it */
const editOnly = $("#editOnly");
editOnly?.addEventListener("click", (e) => {
  e.preventDefault();
  setActive("editing");
  scrollToId("editing");
});

/* Active section based on scroll (intersection observer) */
const io = new IntersectionObserver((entries) => {
  const best = entries
    .filter(e => e.isIntersecting)
    .sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];
  if(best?.target?.id) setActive(best.target.id);
}, { threshold: [0.45, 0.6, 0.75] });

sectionEls.forEach(s => io.observe(s));

/* Portfolio gallery */
const portfolio = [
  { src: "assets/img/p1.jpg", label: "City Energy", alt: "Chicago city at night" },
  { src: "assets/img/p2.jpg", label: "Music Presence", alt: "Live music performance" },
  { src: "assets/img/p3.jpg", label: "Portrait Mood", alt: "Portrait with warm lighting" },
  { src: "assets/img/p4.jpg", label: "Brand Clean", alt: "Bright brand photo" },
  { src: "assets/img/p5.jpg", label: "Stage Moment", alt: "Performer on stage" },
  { src: "assets/img/p6.jpg", label: "Editorial", alt: "Editorial portrait" },
  { src: "assets/img/p7.jpg", label: "Close Detail", alt: "Close-up portrait" },
  { src: "assets/img/p8.jpg", label: "Action", alt: "Skater performing a trick" }
];

let idx = 0;
const heroImg = $("#heroImg");
const heroBadge = $("#heroBadge");
const thumbs = $("#thumbs");

function show(i){
  idx = (i + portfolio.length) % portfolio.length;
  const p = portfolio[idx];
  if(heroImg){
    heroImg.src = p.src;
    heroImg.alt = p.alt;
  }
  if(heroBadge) heroBadge.textContent = `Portfolio • ${p.label}`;
  if(thumbs){
    $$(".thumb", thumbs).forEach((t, n) => t.dataset.on = (n === idx) ? "true" : "false");
  }
}

function renderThumbs(){
  if(!thumbs) return;
  thumbs.innerHTML = "";
  portfolio.forEach((p, i) => {
    const b = document.createElement("button");
    b.className = "thumb";
    b.type = "button";
    b.dataset.on = i === idx ? "true" : "false";
    b.setAttribute("aria-label", `View portfolio image: ${p.label}`);
    b.innerHTML = `<img loading="lazy" src="${p.src}" alt="${p.alt}">`;
    b.addEventListener("click", () => show(i));
    b.addEventListener("dblclick", () => openLightbox(i));
    thumbs.appendChild(b);
  });
}

$("#prev")?.addEventListener("click", () => show(idx - 1));
$("#next")?.addEventListener("click", () => show(idx + 1));

/* Swipe on mobile */
let startX = 0;
heroImg?.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; }, { passive:true });
heroImg?.addEventListener("touchend", (e) => {
  const endX = e.changedTouches[0].clientX;
  const dx = endX - startX;
  if(Math.abs(dx) > 40) dx > 0 ? show(idx - 1) : show(idx + 1);
}, { passive:true });

/* Lightbox */
const lb = $("#lightbox");
const lbImg = $("#lightboxImg");
const lbTitle = $("#lightboxTitle");

function openLightbox(i){
  const p = portfolio[i];
  if(!lb || !lbImg) return;
  lb.dataset.open = "true";
  lbImg.innerHTML = `<img src="${p.src}" alt="${p.alt}">`;
  if(lbTitle) lbTitle.textContent = `Viewing • ${p.label}`;
}
function closeLightbox(){
  if(!lb) return;
  lb.dataset.open = "false";
  if(lbImg) lbImg.innerHTML = "";
}
$("#lbClose")?.addEventListener("click", closeLightbox);
lb?.addEventListener("click", (e) => {
  if(e.target === lb) closeLightbox();
});
window.addEventListener("keydown", (e) => {
  if(e.key === "Escape") closeLightbox();
  if(e.key === "ArrowLeft") show(idx - 1);
  if(e.key === "ArrowRight") show(idx + 1);
});

/* Click main image to open lightbox */
heroImg?.addEventListener("click", () => openLightbox(idx));

/* Footer year */
$("#year") && ($("#year").textContent = new Date().getFullYear());

/* Init */
renderThumbs();
show(0);
setActive("home");
