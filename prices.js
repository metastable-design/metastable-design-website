// prices.js
// The ONLY place webinar prices should be edited. Both the storefront
// (script.js, via a dynamic import) and the Cloudflare Worker
// (src/create-order.js, via a static import) read from this file, so a
// price can never drift out of sync between what's displayed and what's
// actually charged.
//
// INR is derived from USD, not hand-typed, using the same rate/rounding
// both sides use — see usdToInr() below.

export const INR_MULTIPLIER = 96; // rupees per dollar, for pricing purposes (not a live FX rate)
export const INR_ROUND_TO = 50;   // round INR prices to the nearest 50

export function usdToInr(usd) {
  return Math.round((usd * INR_MULTIPLIER) / INR_ROUND_TO) * INR_ROUND_TO;
}

export const PRICES = {
  // id: usd (whole dollars unless noted)
  'dft-fundamentals': 0.001,
  'static-timing-analysis-part-1': 45,
  'static-timing-analysis-part-2': 45,
  'power-optimization-techniques': 40,
  'power-gating': 35,
  'special-physical-cells': 25,
  'antenna-effect': 20,
  'signal-routing': 35,
  'multi-input-switching-mis': 35, // NOTE: catalog copy says "available on request"
  'clock-tree-synthesis-part-1': 45,
  'clock-tree-synthesis-part-2': 40,
  'placement-part-1': 45,
  'placement-part-2': 45,
  'crosstalk-analysis': 45,
  'em-ir-drop-analysis': 45,
  'power-estimation-part-1': 40,
  'power-estimation-part-2': 45,
  'synthesis-2-0-part-1': 45,
  'synthesis-2-0-part-2': 45,
  'unified-power-format-upf-part-1': 45,
  'drc-part-1': 50,
  'drc-part-2': 45,
  'physical-implementation-scripting-tcl': 40,
  'tool-independent-scripting-tcl-python': 40,
  'pnr-mock': 40,
  'rcg-comp-arch-pd-mock': 35,
  'power-analysis-mock': 35,
  'analytical-cmos-mock': 30,
};
