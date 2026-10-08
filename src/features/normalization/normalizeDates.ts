const months: Record<string, string> = {
  jan: '01',
  january: '01',
  feb: '02',
  february: '02',
  mar: '03',
  march: '03',
  apr: '04',
  april: '04',
  may: '05',
  jun: '06',
  june: '06',
  jul: '07',
  july: '07',
  aug: '08',
  august: '08',
  sep: '09',
  sept: '09',
  september: '09',
  oct: '10',
  october: '10',
  nov: '11',
  november: '11',
  dec: '12',
  december: '12',
};

export function normalizeDate(input: string): string {
  const s = input.trim();

  if (!s) {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }

  let m = s.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/);

  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = m[3];

    // DD/MM/YYYY is the default (India and most of the world). Only when the
    // second number cannot be a month (> 12) is it read as MM/DD/YYYY.
    const day = b > 12 ? b : a;
    const month = b > 12 ? a : b;

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return '';
    }

    return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);

  if (m) {
    const month = months[m[2].toLowerCase()];

    if (month) {
      return `${m[3]}-${month}-${m[1].padStart(2, '0')}`;
    }
  }

  m = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);

  if (m) {
    const month = months[m[1].toLowerCase()];

    if (month) {
      return `${m[3]}-${month}-${m[2].padStart(2, '0')}`;
    }
  }

  return '';
}

