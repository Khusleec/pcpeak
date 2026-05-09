/**
 * Value for <input type="datetime-local"> — uses the device's local wall clock,
 * not UTC (avoid `date.toISOString().slice(0, 16)` which feeds UTC into local-only inputs).
 */
export function toDatetimeLocalValue(input) {
  if (input == null || input === '') return '';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
