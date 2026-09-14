// Builds a path that starts as decaying noise (the "metastable" region)
// and settles into a clean digital square wave, then draws it once on load.

function buildWaveformPath() {
  const midY = 110;
  const settleX = 230;
  const high = 50;
  const low = 170;
  const points = [];

  for (let x = 0; x <= settleX; x += 2) {
    const decay = Math.max(0, 1 - x / settleX);
    const wobble = Math.sin(x * 0.35) * 40 * decay + Math.sin(x * 0.9) * 15 * decay;
    points.push([x, midY - wobble]);
  }

  // after settling, a clean square wave — a defined logic level, not noise
  points.push([settleX, high]);
  points.push([300, high]);
  points.push([300, low]);
  points.push([350, low]);
  points.push([350, high]);
  points.push([480, high]);

  return points.reduce((d, [x, y], i) => {
    const cmd = i === 0 ? 'M' : 'L';
    return `${d} ${cmd} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }, '');
}

function animateWaveform() {
  const path = document.getElementById('wf-path');
  if (!path) return;

  path.setAttribute('d', buildWaveformPath());

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const length = path.getTotalLength();

  path.style.strokeDasharray = length;
  path.style.strokeDashoffset = reduceMotion ? 0 : length;

  if (!reduceMotion) {
    // force a reflow so the browser registers the starting offset before transitioning
    path.getBoundingClientRect();
    path.style.transition = 'stroke-dashoffset 1.8s cubic-bezier(0.16, 1, 0.3, 1)';
    requestAnimationFrame(() => {
      path.style.strokeDashoffset = '0';
    });
  }
}

document.addEventListener('DOMContentLoaded', animateWaveform);
