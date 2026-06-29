

export function splitIsoDate(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
}

export function monthStartIso(referenceIso: string): string {
  const [y, m] = splitIsoDate(referenceIso);
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

export function addMonthsMonthStart(monthStartIso: string, delta: number): string {
  const [y, m] = splitIsoDate(monthStartIso);
  const d = new Date(y, m - 1 + delta, 1);
  const ny = d.getFullYear();
  const nm = d.getMonth() + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-01`;
}

export function addDaysIso(iso: string, delta: number): string {
  const [y, m, dd] = splitIsoDate(iso);
  const d = new Date(y, m - 1, dd + delta);
  const ny = d.getFullYear();
  const nm = d.getMonth() + 1;
  const nd = d.getDate();
  return `${ny}-${String(nm).padStart(2, "0")}-${String(nd).padStart(2, "0")}`;
}
