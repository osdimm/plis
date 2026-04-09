import { pad } from '../utils.js';

function escapePdfText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r/g, ' ')
    .replace(/\n/g, ' ');
}

function wrapText(text, width) {
  const lines = [];
  const paragraphs = String(text ?? '').split(/\r?\n/);

  for (const paragraph of paragraphs) {
    if (!paragraph) {
      lines.push('');
      continue;
    }

    const words = paragraph.split(/\s+/);
    let current = '';

    for (const word of words) {
      if (!current) {
        current = word;
        continue;
      }

      const candidate = `${current} ${word}`;
      if (candidate.length <= width) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }

    if (current) {
      lines.push(current);
    }
  }

  return lines;
}

function chunkLines(lines, pageSize) {
  const pages = [];
  for (let index = 0; index < lines.length; index += pageSize) {
    pages.push(lines.slice(index, index + pageSize));
  }
  return pages.length > 0 ? pages : [[]];
}

function buildPdfBuffer(lines, { landscape = false } = {}) {
  const pageWidth = landscape ? 841.89 : 595.28;
  const pageHeight = landscape ? 595.28 : 841.89;
  const pageSize = landscape ? 40 : 58;
  const pages = chunkLines(lines, pageSize);
  const objects = [];

  const catalogId = 1;
  const pagesId = 2;
  const fontId = 3;
  let nextId = 4;
  const pageRefs = [];

  for (const pageLines of pages) {
    const contentId = nextId;
    const pageId = nextId + 1;
    nextId += 2;

    const textCommands = pageLines
      .map((line) => `(${escapePdfText(line)}) Tj`)
      .join(' T* ');

    const contentStream = `BT /F1 10 Tf 12 TL 40 ${pageHeight - 50} Td ${textCommands || '() Tj'} ET`;
    objects[contentId] = `<< /Length ${Buffer.byteLength(contentStream, 'utf8')} >>\nstream\n${contentStream}\nendstream`;
    objects[pageId] =
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
      `/Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    pageRefs.push(`${pageId} 0 R`);
  }

  objects[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId] = `<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pageRefs.length} >>`;
  objects[fontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>';

  let output = '%PDF-1.4\n';
  const offsets = [0];

  for (let id = 1; id < objects.length; id += 1) {
    const objectText = `${id} 0 obj\n${objects[id]}\nendobj\n`;
    offsets[id] = Buffer.byteLength(output, 'utf8');
    output += objectText;
  }

  const xrefOffset = Buffer.byteLength(output, 'utf8');
  output += `xref\n0 ${objects.length}\n`;
  output += '0000000000 65535 f \n';
  for (let id = 1; id < objects.length; id += 1) {
    output += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(output, 'utf8');
}

function tableToLines(headers, widths, rows, aligns = []) {
  const renderRow = (row) =>
    row
      .map((value, index) => pad(value ?? '', widths[index], aligns[index] ?? 'left'))
      .join(' | ');

  const separator = widths.map((width) => '-'.repeat(width)).join('-+-');
  const lines = [renderRow(headers), separator];

  for (const row of rows) {
    const cellLines = row.map((cell, index) => wrapText(cell, widths[index]));
    const maxHeight = Math.max(...cellLines.map((entry) => entry.length));

    for (let lineIndex = 0; lineIndex < maxHeight; lineIndex += 1) {
      lines.push(
        renderRow(
          cellLines.map((entry) => {
            return entry[lineIndex] ?? '';
          }),
        ),
      );
    }
  }

  return lines;
}

export function createDailyReportPdf(rows, reportDate, reportShift) {
  const lines = [
    `Laporan Harian - Tanggal: ${reportDate}, Shift: ${reportShift}`,
    '',
  ];

  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.gerbang)) {
      grouped.set(row.gerbang, []);
    }
    grouped.get(row.gerbang).push(row);
  }

  for (const [gerbang, groupRows] of grouped.entries()) {
    lines.push(`Gerbang: ${gerbang}`);
    lines.push(
      ...tableToLines(
        ['ID', 'Nama Barang', 'Gardu', 'Deskripsi'],
        [5, 20, 8, 55],
        groupRows.map((row) => [row.id, row.nama_barang, row.gardu, row.deskripsi]),
      ),
    );
    lines.push('');
  }

  return buildPdfBuffer(lines, { landscape: true });
}

export function createMonthlyReportPdf(rows, reportMonth, reportYear) {
  const lines = [`Laporan Bulanan - ${reportMonth} ${reportYear}`, ''];
  const grouped = new Map();

  for (const row of rows) {
    if (!grouped.has(row.gerbang)) {
      grouped.set(row.gerbang, []);
    }
    grouped.get(row.gerbang).push(row);
  }

  for (const [gerbang, groupRows] of grouped.entries()) {
    lines.push(`Gerbang: ${gerbang}`);
    lines.push(
      ...tableToLines(
        ['Tanggal', 'Shift', 'Nama Barang', 'Gardu', 'Deskripsi'],
        [12, 7, 20, 8, 55],
        groupRows.map((row) => [
          row.tanggal,
          row.shift,
          row.nama_barang,
          row.gardu,
          row.deskripsi,
        ]),
      ),
    );
    lines.push('');
  }

  return buildPdfBuffer(lines, { landscape: true });
}

export function createItemHistoryPdf(item, riwayatKerusakan, riwayatPerbaikan, durasiPerbaikan) {
  const lines = [
    `Riwayat ${item.Nama} di Gerbang ${item.Gerbang} Gardu ${item.Gardu}`,
    '',
    'Riwayat Kerusakan',
    ...tableToLines(
      ['ID', 'Tanggal', 'Deskripsi', 'Gardu'],
      [5, 20, 60, 8],
      riwayatKerusakan.map((row) => [row.ID, row.Tanggal, row.Deskripsi, row.Gardu]),
    ),
    '',
    'Riwayat Perbaikan',
    ...tableToLines(
      ['ID', 'Tanggal', 'Deskripsi', 'Gardu'],
      [5, 20, 60, 8],
      riwayatPerbaikan.map((row) => [row.ID, row.Tanggal, row.Deskripsi, row.Gardu]),
    ),
    '',
    'Durasi Perbaikan',
    ...tableToLines(
      ['ID Barang', 'Durasi'],
      [10, 70],
      durasiPerbaikan.map((row) => [row.ID, row.Durasi]),
    ),
  ];

  return buildPdfBuffer(lines, { landscape: true });
}
