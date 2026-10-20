/** Select only dates backed by actual meeting records; never generate calendar dates. */
export function meetingOptions(rows: { date: string; venue?: string | undefined }[]) {
  return [...new Map(rows.filter(row => /^\d{4}-\d{2}-\d{2}$/.test(row.date)).map(row => [row.date, row])).values()]
    .sort((a, b) => b.date.localeCompare(a.date));
}