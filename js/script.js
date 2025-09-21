// script.js — efeito de fade/parallax suave e robusto em mobile
document.addEventListener('DOMContentLoaded', () => {
  const hero = document.querySelector('.hero');
  const heroImg = document.querySelector('.hero-img');
  const heroContent = document.querySelector('.hero-content');
  const overlay = document.querySelector('.overlay');

  if (!hero) return;

  let lastScrollY = window.scrollY;
  let ticking = false;

  function getHeroHeight() {
    // getBoundingClientRect() lida melhor com 100dvh/variações de barra
    return hero.getBoundingClientRect().height || window.innerHeight;
  }

  function update() {
    const scrollY = lastScrollY;
    const heroHeight = getHeroHeight();
    let progress = scrollY / heroHeight; // 0..1
    if (progress < 0) progress = 0;
    if (progress > 1) progress = 1;

    const opacity = 1 - progress;

    if (heroImg) {
      heroImg.style.opacity = String(opacity);
      heroImg.style.transform = `translateY(${progress * -15}px) scale(${1 + progress * 0.02})`;
      heroImg.style.willChange = 'transform, opacity';
    }
    if (overlay) {
      overlay.style.opacity = String(Math.max(0, opacity * 0.6));
      overlay.style.willChange = 'opacity';
    }
    if (heroContent) {
      heroContent.style.opacity = String(opacity);
      heroContent.style.transform = `translateY(${progress * -10}px)`;
      heroContent.style.willChange = 'transform, opacity';
    }

    ticking = false;
  }

  function onScroll() {
    lastScrollY = window.scrollY;
    if (!ticking) {
      window.requestAnimationFrame(update);
      ticking = true;
    }
  }

  // Recalcula em resize/orientação (útil para 1920x1080 e mobile)
  const recalc = () => { lastScrollY = window.scrollY; update(); };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', recalc, { passive: true });
  window.addEventListener('orientationchange', recalc);

  update(); // estado inicial
});
