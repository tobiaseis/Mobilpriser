export function formatKr(amount: number): string {
  return (
    new Intl.NumberFormat("da-DK", {
      maximumFractionDigits: 0,
    }).format(amount) + " kr."
  );
}

/** Fortegn foran, så en stigning ikke kan forveksles med selve prisen. */
export function formatKrSigned(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "±";
  return sign + formatKr(Math.abs(rounded));
}

export function formatDate(iso: string | null): string {
  if (!iso) return "endnu ikke kørt";
  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Copenhagen",
  }).format(new Date(iso));
}

/** Kort form til mærket i toplinjen, hvor der ikke er plads til et klokkeslæt. */
export function formatDayMonth(iso: string | null): string {
  if (!iso) return "endnu ikke";
  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Copenhagen",
  }).format(new Date(iso));
}

export function formatDataGb(dataGb: number | "unlimited" | undefined): string {
  if (dataGb == null) return "ukendt data";
  return dataGb === "unlimited" ? "fri data" : `${dataGb} GB`;
}
