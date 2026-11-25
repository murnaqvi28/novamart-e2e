/** "Rs 6,998" -> 6998, "−Rs 699.8" -> 699.8, "Free" -> 0 */
function parsePrice(text) {
  if (/free/i.test(text)) return 0;
  const n = parseFloat(String(text).replace(/[^0-9.]/g, ''));
  if (Number.isNaN(n)) throw new Error(`Cannot parse price from "${text}"`);
  return n;
}

const round2 = (n) => Math.round(n * 100) / 100;

/** Mirrors the app's pricing rules, used as the test oracle. */
function expectedTotals({ subtotal, coupon, rules }) {
  let discount = 0;
  if (coupon) discount = coupon.type === 'percent' ? round2((subtotal * coupon.value) / 100) : Math.min(coupon.value, subtotal);
  const shippingFee = subtotal === 0 || subtotal >= rules.freeShippingThreshold ? 0 : rules.shippingFee;
  return { subtotal: round2(subtotal), discount: round2(discount), shippingFee, total: round2(subtotal - discount + shippingFee) };
}

module.exports = { parsePrice, expectedTotals, round2 };
