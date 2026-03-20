/**
 * True als online-datum parseerbaar is en max. `days` dagen geleden (niet in de toekomst).
 * Zelfde logica voor "New!"-pill op kaarten en rode pin op de kaart.
 */
export function isOnlineWithinLastDays(p, days = 7) {
  const raw = String(p?.onlineSince || p?.dateOnline || "").trim();
  if (!raw) return false;
  let d = null;
  const ts = Date.parse(raw);
  if (Number.isFinite(ts)) d = new Date(ts);
  if (!d || !Number.isFinite(d.getTime())) {
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      d = new Date(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10));
    }
  }
  if (!d || !Number.isFinite(d.getTime())) {
    const dmy = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/);
    if (dmy) {
      d = new Date(parseInt(dmy[3], 10), parseInt(dmy[2], 10) - 1, parseInt(dmy[1], 10));
    }
  }
  if (!d || !Number.isFinite(d.getTime())) return false;
  const age = Date.now() - d.getTime();
  if (age < 0) return false;
  return age <= days * 86400000;
}
