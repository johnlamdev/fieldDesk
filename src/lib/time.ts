export function hongKongDayBounds(now = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const start = new Date(`${day}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  // PostgreSQL DATE values are represented by Prisma as UTC-midnight Date objects.
  const dateStart = new Date(`${day}T00:00:00Z`);
  const dateEnd = new Date(dateStart.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, dateStart, dateEnd };
}

export function formatHongKongDateTime(value: Date | null | undefined) {
  return value ? new Intl.DateTimeFormat("zh-HK", { timeZone: "Asia/Hong_Kong", dateStyle: "medium", timeStyle: "short" }).format(value) : "—";
}

export function formatDateOnly(value: Date | null | undefined) {
  return value ? new Intl.DateTimeFormat("zh-HK", { timeZone: "UTC", dateStyle: "medium" }).format(value) : "—";
}

export function parseHongKongLocalDateTime(value: string): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("日期時間無效");
  const date = new Date(`${value}:00+08:00`);
  if (Number.isNaN(date.getTime()) || formatHongKongInput(date) !== value) throw new Error("日期時間無效");
  return date;
}

export function formatHongKongInput(value: Date | null | undefined): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Hong_Kong", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(value).replace(" ", "T");
}

export function tentativeDateFromInput(value: string): Date | null {
  if (!value) return null;
  return new Date(`${value.slice(0, 10)}T00:00:00Z`);
}
