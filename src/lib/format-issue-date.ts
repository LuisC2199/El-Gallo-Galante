/**
 * Formats an issue date for display.
 *
 * Rules:
 *   - Single date (no endDate) → locale month + year, e.g. "octubre de 2023"
 *   - Start + end, different years → "YYYY–YYYY", e.g. "2018–2021"
 *   - Start + end, same year → just "YYYY", e.g. "2024"
 */
export function formatIssueDate(start: Date, end?: Date): string {
  if (!end) {
    return new Intl.DateTimeFormat("es-MX", {
      year: "numeric",
      month: "long",
    }).format(start);
  }

  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  if (startYear === endYear) {
    return String(startYear);
  }

  return `${startYear}\u2013${endYear}`; // en-dash
}
