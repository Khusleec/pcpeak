/** Mongolian labels + explicit 24-hour clock (not locale-default AM/PM). */
export function formatMnDateTime(iso) {
  return new Date(iso).toLocaleString('mn-MN', { hour12: false });
}
