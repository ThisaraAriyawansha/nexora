export function toCSVValue(value: any): string {
  if (value === null || value === undefined) return "";
  if (value && typeof value === "object" && typeof value.toDate === "function") {
    value = value.toDate().toISOString();
  } else if (value instanceof Date) {
    value = value.toISOString();
  } else if (typeof value === "object") {
    value = JSON.stringify(value);
  }
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function rowsToCSV(rows: Record<string, any>[]): string {
  if (rows.length === 0) return "";
  const headerSet = new Set<string>();
  rows.forEach((r) => Object.keys(r).forEach((k) => headerSet.add(k)));
  const headers = Array.from(headerSet);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => toCSVValue(row[h])).join(","));
  }
  return lines.join("\n");
}

export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
