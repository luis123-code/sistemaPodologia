const soles = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Importes en soles (PEN), formato Perú. */
export function formatSoles(amount: number): string {
  return soles.format(amount);
}
