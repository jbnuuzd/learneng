// Lingo — the animated owl. Pure SVG + CSS (no libraries): floats, blinks, follows the pointer with its eyes,
// waves, and moves its beak while it "talks".
const SVG = `
<svg viewBox="0 0 200 220" role="img" aria-label="Lingo — AI do'stingiz">
  <defs>
    <linearGradient id="lg-body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--hero-b)"/><stop offset="1" stop-color="var(--hero-a)"/></linearGradient>
  </defs>
  <ellipse class="m-shadow" cx="100" cy="206" rx="52" ry="7" fill="#000" opacity=".16"/>
  <g class="m-body">
    <g class="m-wing-l"><ellipse cx="38" cy="118" rx="16" ry="38" fill="url(#lg-body)" transform="rotate(14 38 118)"/></g>
    <g class="m-wing-r"><ellipse cx="162" cy="118" rx="16" ry="38" fill="url(#lg-body)" transform="rotate(-14 162 118)"/></g>
    <path d="M52 52 L44 22 L74 40Z M148 52 L156 22 L126 40Z" fill="url(#lg-body)"/>
    <ellipse cx="100" cy="120" rx="64" ry="78" fill="url(#lg-body)"/>
    <ellipse cx="100" cy="146" rx="38" ry="46" fill="#fff" opacity=".9"/>
    <g fill="var(--hero-a)" opacity=".28"><path d="M82 138q6 6 12 0M100 138q6 6 12 0M91 154q6 6 12 0M109 154q6 6 12 0M73 154q6 6 12 0M118 138q6 6 12 0"/></g>
    <circle cx="72" cy="92" r="26" fill="#fff"/><circle cx="128" cy="92" r="26" fill="#fff"/>
    <g class="m-eye" data-cx="72" data-cy="92"><circle class="m-pupil" cx="72" cy="92" r="11" fill="#1b1f2a"/><circle class="m-glint" cx="76" cy="87" r="3.6" fill="#fff"/></g>
    <g class="m-eye" data-cx="128" data-cy="92"><circle class="m-pupil" cx="128" cy="92" r="11" fill="#1b1f2a"/><circle class="m-glint" cx="132" cy="87" r="3.6" fill="#fff"/></g>
    <g class="m-lids" fill="url(#lg-body)"><ellipse class="m-lid" cx="72" cy="92" rx="27" ry="27"/><ellipse class="m-lid" cx="128" cy="92" rx="27" ry="27"/></g>
    <path d="M92 108 L108 108 L100 124Z" fill="#ffb020"/>
    <ellipse class="m-mouth" cx="100" cy="119" rx="6" ry="4" fill="#c2410c"/>
    <path d="M70 196 q-6 10 4 10 h8 M130 196 q6 10 -4 10 h-8" stroke="#ffb020" stroke-width="6" stroke-linecap="round" fill="none"/>
    <g class="m-cap"><path d="M56 40 L100 22 L144 40 L100 56Z" fill="#1b1f2a"/><path d="M76 48 v14 q24 12 48 0 v-14" fill="#2b3042"/><path d="M144 40 v22" stroke="#ffb020" stroke-width="3"/><circle cx="144" cy="64" r="4" fill="#ffb020"/></g>
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
    cheer() { el.classList.add('cheer'); setTimeout(() => el.classList.remove('cheer'), 900); },
  };
}
