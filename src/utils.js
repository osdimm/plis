const htmlMap = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => htmlMap[character]);
}

export function toParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const map = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }
  return map;
}

export function formatDateInTimeZone(date, timeZone) {
  const parts = toParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatDateTimeInTimeZone(date, timeZone) {
  const parts = toParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function parseLocalDateTime(value) {
  if (!value) {
    return null;
  }

  const match = String(value)
    .trim()
    .match(
      /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2})(?::(\d{2}))?(?::(\d{2}))?)?$/,
    );

  if (!match) {
    return null;
  }

  const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ),
  );
}

export function formatDisplayDateTime(value, timeZone) {
  const parsed = parseLocalDateTime(value);
  if (!parsed) {
    return value ? String(value) : '-';
  }

  return new Intl.DateTimeFormat('id-ID', {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(parsed);
}

export function formatDisplayDate(value, timeZone) {
  const parsed = parseLocalDateTime(value) ?? parseLocalDateTime(`${value} 00:00:00`);
  if (!parsed) {
    return value ? String(value) : '-';
  }

  return new Intl.DateTimeFormat('id-ID', {
    timeZone,
    dateStyle: 'medium',
  }).format(parsed);
}

export function convertSeconds(durationSeconds) {
  const totalSeconds = Math.max(0, Math.floor(durationSeconds));
  const days = Math.floor(totalSeconds / 86400);
  const remainderAfterDays = totalSeconds % 86400;
  const hours = Math.floor(remainderAfterDays / 3600);
  const remainderAfterHours = remainderAfterDays % 3600;
  const minutes = Math.floor(remainderAfterHours / 60);
  const seconds = remainderAfterHours % 60;

  return `${days} hari ${hours} jam ${minutes} menit ${seconds} detik`;
}

export function calculateDurations(riwayatKerusakan, riwayatPerbaikan) {
  const maxLength = Math.min(riwayatKerusakan.length, riwayatPerbaikan.length);
  const durations = [];

  for (let index = 0; index < maxLength; index += 1) {
    const start = parseLocalDateTime(riwayatKerusakan[index].Tanggal);
    const end = parseLocalDateTime(riwayatPerbaikan[index].Tanggal);

    if (!start || !end) {
      durations.push({ ID: riwayatKerusakan[index].ID_Barang, Durasi: 'N/A' });
      continue;
    }

    const diffInSeconds = Math.max(0, (end.getTime() - start.getTime()) / 1000);
    durations.push({
      ID: riwayatKerusakan[index].ID_Barang,
      Durasi: convertSeconds(diffInSeconds),
    });
  }

  return durations;
}

export function buildQueryString(values) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }
  return params.toString();
}

export function truncate(value, size) {
  const text = String(value ?? '');
  if (text.length <= size) {
    return text;
  }

  return `${text.slice(0, Math.max(0, size - 1))}…`;
}

export function pad(value, size, align = 'left') {
  const text = truncate(value ?? '', size);
  if (text.length === size) {
    return text;
  }

  if (align === 'right') {
    return text.padStart(size, ' ');
  }

  if (align === 'center') {
    const totalPadding = size - text.length;
    const left = Math.floor(totalPadding / 2);
    const right = totalPadding - left;
    return `${' '.repeat(left)}${text}${' '.repeat(right)}`;
  }

  return text.padEnd(size, ' ');
}
