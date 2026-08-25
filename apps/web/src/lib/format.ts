export function formatKr(amount: number): string {
  return new Intl.NumberFormat("da-DK", {
    maximumFractionDigits: 0,
  }).format(amount) + " kr.";
}

export function formatDate(iso: string | null): string {
  if (!iso) return "endnu ikke kørt";
  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Copenhagen",
  }).format(new Date(iso));
}

export function formatDataGb(dataGb: number | "unlimited" | undefined): string {
  if (dataGb == null) return "ukendt data";
  return dataGb === "unlimited" ? "fri data" : `${dataGb} GB`;
}
