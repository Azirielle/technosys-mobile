// The Manila calendar day (YYYY-MM-DD) of a moment. Its own file so scripts/check-manila-day.mjs can test it.
export const manilaDay = (iso: string | Date) => new Date(new Date(iso).getTime() + 8 * 3600000).toISOString().slice(0, 10);
