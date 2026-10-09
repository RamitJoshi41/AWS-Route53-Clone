// Dates as the console shows them.

/**
 * The API's timestamps are UTC without an offset ("2026-10-09T10:11:00.123456").
 * Date would read those as local time, so mark them as UTC first.
 */
export function parseApiDate(value: string): Date {
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
}

/** "October 09, 2026, 15:41 (UTC:+05:30)": the console's absolute format, in local time. */
export function formatConsoleDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "long" });
  // getTimezoneOffset is minutes *behind* UTC (-330 in India), so flip the sign.
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const utcOffset = `${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
  return (
    `${month} ${pad(date.getDate())}, ${date.getFullYear()}, ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())} (UTC:${utcOffset})`
  );
}
