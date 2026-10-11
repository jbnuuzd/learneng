// Lingo — the animated owl. Pure SVG + CSS (no libraries): floats, blinks, follows the pointer with its eyes,
// waves, and moves its beak while it "talks".
const SVG = `
<svg viewBox="0 0 200 220" role="img" aria-label="Lingo — AI do'stingiz">
  <defs>
    <pattern id="lg-atlas" width="21" height="12" patternUnits="userSpaceOnUse">
      <rect width="21" height="12" fill="#e11d48"/><rect x="3" width="3.5" height="12" fill="#f59e0b"/><rect x="8" width="3.5" height="12" fill="#16a34a"/><rect x="13" width="3.5" height="12" fill="#2563eb"/><rect x="18" width="2" height="12" fill="#7c3aed"/>
    </pattern>
    <clipPath id="lg-clip"><ellipse cx="100" cy="120" rx="64" ry="78"/></clipPath>
    <linearGradient id="lg-body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--hero-b)"/><stop offset="1" stop-color="var(--hero-a)"/></linearGradient>
  </defs>
  <ellipse class="m-shadow" cx="100" cy="206" rx="52" ry="7" fill="#000" opacity=".16"/>
  <g class="m-body">
    <g class="m-wing-l"><ellipse cx="38" cy="118" rx="16" ry="38" fill="url(#lg-body)" transform="rotate(14 38 118)"/><path d="M26 112 Q38 104 50 112 L52 150 Q38 160 24 150Z" fill="url(#lg-atlas)" transform="rotate(14 38 130)"/></g>
    <g class="m-wing-r"><ellipse cx="162" cy="118" rx="16" ry="38" fill="url(#lg-body)" transform="rotate(-14 162 118)"/><path d="M150 112 Q162 104 174 112 L176 150 Q162 160 148 150Z" fill="url(#lg-atlas)" transform="rotate(-14 162 130)"/></g>
    <path d="M52 52 L44 22 L74 40Z M148 52 L156 22 L126 40Z" fill="url(#lg-body)"/>
    <ellipse cx="100" cy="120" rx="64" ry="78" fill="url(#lg-body)"/>
    <ellipse cx="100" cy="146" rx="38" ry="46" fill="#fff" opacity=".9"/>
    <g fill="var(--hero-a)" opacity=".28"><path d="M82 138q6 6 12 0M100 138q6 6 12 0M91 154q6 6 12 0M109 154q6 6 12 0M73 154q6 6 12 0M118 138q6 6 12 0"/></g>
    <g clip-path="url(#lg-clip)"><rect x="30" y="138" width="140" height="70" fill="url(#lg-atlas)"/><rect x="30" y="138" width="140" height="4" fill="#7f1d1d" opacity=".55"/></g>
    <path d="M100 138 L84 138 L100 188 L116 138Z" fill="#fff"/><path d="M100 138 V198" stroke="#7f1d1d" stroke-width="1.5" opacity=".5"/>
    <path d="M84 138 L100 188 M116 138 L100 188" stroke="#7f1d1d" stroke-width="2.2" opacity=".6"/>
    <g clip-path="url(#lg-clip)"><rect x="30" y="160" width="140" height="11" fill="#111827"/><rect x="30" y="162" width="140" height="2" fill="#f59e0b"/></g>
    <rect x="93" y="158" width="14" height="15" rx="3" fill="#f59e0b"/><rect x="96" y="161" width="8" height="9" rx="2" fill="#111827"/>
    <circle cx="72" cy="92" r="26" fill="#fff"/><circle cx="128" cy="92" r="26" fill="#fff"/>
    <g class="m-eye" data-cx="72" data-cy="92"><circle class="m-pupil" cx="72" cy="92" r="11" fill="#1b1f2a"/><circle class="m-glint" cx="76" cy="87" r="3.6" fill="#fff"/></g>
    <g class="m-eye" data-cx="128" data-cy="92"><circle class="m-pupil" cx="128" cy="92" r="11" fill="#1b1f2a"/><circle class="m-glint" cx="132" cy="87" r="3.6" fill="#fff"/></g>
    <g class="m-lids" fill="url(#lg-body)"><ellipse class="m-lid" cx="72" cy="92" rx="27" ry="27"/><ellipse class="m-lid" cx="128" cy="92" rx="27" ry="27"/></g>
    <path d="M92 108 L108 108 L100 124Z" fill="#ffb020"/>
    <ellipse class="m-mouth" cx="100" cy="119" rx="6" ry="4" fill="#c2410c"/>
    <path d="M70 196 q-6 10 4 10 h8 M130 196 q6 10 -4 10 h-8" stroke="#ffb020" stroke-width="6" stroke-linecap="round" fill="none"/>
    <g class="m-cap"><path d="M60 58 Q58 24 100 20 Q142 24 140 58Z" fill="#111827"/><path d="M58 58 L142 58 L146 46 L54 46Z" fill="#0b1020"/>
      <path d="M62 52 H138" stroke="#fff" stroke-width="1.6" stroke-dasharray="4 3"/>
      <g fill="#fff" opacity=".95"><path d="M100 28 q9 6 0 14 q-9 -8 0 -14Z"/><path d="M80 36 q7 3 3 11 q-8 -2 -3 -11Z"/><path d="M120 36 q-7 3 -3 11 q8 -2 3 -11Z"/><circle cx="100" cy="46" r="2"/><circle cx="70" cy="43" r="1.8"/><circle cx="130" cy="43" r="1.8"/></g></g>
  </g>
</svg>`;

export function createMascot({ size = 180 } = {}) {
  const el = document.createElement('div');
  el.className = 'mascot'; el.style.width = size + 'px'; el.innerHTML = SVG;
  const eyes = [...el.querySelectorAll('.m-eye')];
  const look = (x, y) => {          // move pupils toward a viewport point (max 6px)
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height * 0.42;
    const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1, k = Math.min(6, d / 30);
    eyes.forEach((e) => { e.style.transform = `translate(${(dx / d) * k}px, ${(dy / d) * k}px)`; });
  };
  const onMove = (e) => look(e.clientX, e.clientY);
  window.addEventListener('pointermove', onMove, { passive: true });
  const off = () => window.removeEventListener('pointermove', onMove);
  new MutationObserver((_, ob) => { if (!document.body.contains(el)) { off(); ob.disconnect(); } }).observe(document.body, { childList: true, subtree: true });
  let waveT = null;
  return {
    el,
    talk(on) { el.classList.toggle('talking', !!on); },
    think(on) { el.classList.toggle('thinking', !!on); },
    wave() { el.classList.add('waving'); clearTimeout(waveT); waveT = setTimeout(() => el.classList.remove('waving'), 2200); },
    // arrival show: drops in, bows (salom), waves, then dances/spins while the greeting is spoken
    greet() {
      el.classList.remove('m-enter', 'bowing', 'spin'); void el.offsetWidth; el.classList.add('m-enter');
      setTimeout(() => { el.classList.add('bowing'); }, 900);
      setTimeout(() => { el.classList.remove('bowing'); this.wave(); }, 1800);
      setTimeout(() => { el.classList.add('spin'); }, 4100);
      setTimeout(() => el.classList.remove('spin', 'm-enter'), 5200);
    },
    dance(on) { el.classList.toggle('dancing', !!on); },
    cheer() { el.classList.add('cheer'); setTimeout(() => el.classList.remove('cheer'), 900); },
  };
}
