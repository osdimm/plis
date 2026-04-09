import {
  APP_TITLE,
  GARDU_KONDISI,
  REPORT_TYPES,
  STATUS_CLASS_MAP,
  TAB_OPTIONS,
} from './constants.js';
import {
  buildQueryString,
  escapeHtml,
  formatDisplayDate,
  formatDisplayDateTime,
} from './utils.js';

function renderSelect(name, options, selectedValue, attributes = '') {
  return `
    <select name="${escapeHtml(name)}" ${attributes}>
      ${options
        .map((option) => {
          const optionValue = typeof option === 'string' ? option : option.value;
          const optionLabel = typeof option === 'string' ? option : option.label;
          const selected = String(optionValue) === String(selectedValue) ? 'selected' : '';
          return `<option value="${escapeHtml(optionValue)}" ${selected}>${escapeHtml(optionLabel)}</option>`;
        })
        .join('')}
    </select>
  `;
}

function renderMessage(message) {
  if (!message?.message) {
    return '';
  }
  return `<div class="alert alert-${escapeHtml(message.type ?? 'info')}">${escapeHtml(message.message)}</div>`;
}

function renderNotifications(notifications = []) {
  return notifications.map((item) => renderMessage(item)).join('');
}

function renderStatusBadge(status) {
  const className = STATUS_CLASS_MAP[status] ?? '';
  return `<span class="status-pill ${className}">${escapeHtml(status ?? '-')}</span>`;
}

function renderTable(headers, rows, options = {}) {
  if (!rows || rows.length === 0) {
    return `<div class="empty-state">${escapeHtml(options.emptyMessage ?? 'Tidak ada data.')}</div>`;
  }

  return `
    <div class="table-shell">
      <table>
        <thead>
          <tr>${headers.map((header) => `<th>${escapeHtml(header.label)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows
            .map((row) => {
              const rowClass = options.rowClass ? options.rowClass(row) : '';
              return `
                <tr class="${escapeHtml(rowClass)}">
                  ${headers
                    .map((header) => {
                      const value = header.render ? header.render(row[header.key], row) : row[header.key];
                      return `<td>${value ?? '-'}</td>`;
                    })
                    .join('')}
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderDataTab(model) {
  const canActOnSpecificItem =
    model.filters.nama !== 'SEMUA' &&
    model.filters.gerbang !== 'SEMUA' &&
    model.filters.gardu !== 'SEMUA';
  const garduOptions =
    model.filters.gerbang && model.filters.gerbang !== 'SEMUA'
      ? ['SEMUA', ...(GARDU_KONDISI[model.filters.gerbang] ?? [])]
      : ['SEMUA'];

  return `
    <section class="panel">
      <h2>Daftar Semua Barang</h2>
      <form method="get" action="/app" class="grid-form">
        <input type="hidden" name="tab" value="data" />
        <label>
          <span>Nama Barang</span>
          ${renderSelect('nama', model.options.namaBarangOptions, model.filters.nama)}
        </label>
        <label>
          <span>Gerbang</span>
          ${renderSelect(
            'gerbang',
            model.options.gerbangOptions,
            model.filters.gerbang,
            'id="filter-gerbang"',
          )}
        </label>
        <label>
          <span>Gardu</span>
          ${renderSelect('gardu', garduOptions, model.filters.gardu, 'id="filter-gardu"')}
        </label>
        <label>
          <span>Status</span>
          ${renderSelect('status', model.options.statusOptions, model.filters.status)}
        </label>
        <div class="form-actions">
          <button type="submit">Terapkan Filter</button>
        </div>
      </form>

      ${renderTable(
        [
          { key: 'ID', label: 'ID', render: (value) => escapeHtml(value) },
          { key: 'Nama', label: 'Nama Barang', render: (value) => escapeHtml(value) },
          { key: 'Gerbang', label: 'Gerbang', render: (value) => escapeHtml(value) },
          { key: 'Gardu', label: 'Gardu', render: (value) => escapeHtml(value) },
          {
            key: 'Tanggal_Pelaporan',
            label: 'Tanggal',
            render: (value) => escapeHtml(formatDisplayDate(value, model.timeZone)),
          },
          { key: 'Deskripsi', label: 'Deskripsi', render: (value) => escapeHtml(value ?? '-') },
          { key: 'Shift', label: 'Shift', render: (value) => escapeHtml(value ?? '-') },
          { key: 'Status', label: 'Status', render: (value) => renderStatusBadge(value) },
          {
            key: 'Last_Update',
            label: 'Last Update',
            render: (value) => escapeHtml(formatDisplayDateTime(value, model.timeZone)),
          },
        ],
        model.barangRows,
        {
          emptyMessage: 'Tidak ada barang untuk filter yang dipilih.',
          rowClass: (row) => STATUS_CLASS_MAP[row.Status] ?? '',
        },
      )}

      <div class="action-row">
        <a
          class="button secondary"
          href="/app?${buildQueryString({
            tab: 'data',
            nama: model.filters.nama,
            gerbang: model.filters.gerbang,
            gardu: model.filters.gardu,
            status: model.filters.status,
            detail: '1',
          })}"
        >
          Lihat Detail
        </a>
        <form method="post" action="/barang/delete" class="inline-form">
          <input type="hidden" name="nama" value="${escapeHtml(model.filters.nama)}" />
          <input type="hidden" name="gerbang" value="${escapeHtml(model.filters.gerbang)}" />
          <input type="hidden" name="gardu" value="${escapeHtml(model.filters.gardu)}" />
          <input type="hidden" name="status" value="${escapeHtml(model.filters.status)}" />
          <button type="submit" class="danger" ${canActOnSpecificItem ? '' : 'disabled'}>Hapus Barang</button>
        </form>
        <form method="post" action="/barang/history/delete" class="inline-form">
          <input type="hidden" name="nama" value="${escapeHtml(model.filters.nama)}" />
          <input type="hidden" name="gerbang" value="${escapeHtml(model.filters.gerbang)}" />
          <input type="hidden" name="gardu" value="${escapeHtml(model.filters.gardu)}" />
          <input type="hidden" name="status" value="${escapeHtml(model.filters.status)}" />
          <button type="submit" class="warning" ${canActOnSpecificItem ? '' : 'disabled'}>Hapus Riwayat</button>
        </form>
      </div>

      ${
        model.detail
          ? `
            <section class="detail-shell">
              <div class="detail-header">
                <div>
                  <h3>Riwayat ${escapeHtml(model.detail.item.Nama)} di ${escapeHtml(model.detail.item.Gerbang)} Gardu ${escapeHtml(model.detail.item.Gardu)}</h3>
                  <p>Riwayat kerusakan, perbaikan, durasi, dan download PDF tetap dipertahankan.</p>
                </div>
                <a
                  class="button"
                  href="/barang/detail/pdf?${buildQueryString({
                    nama: model.detail.item.Nama,
                    gerbang: model.detail.item.Gerbang,
                    gardu: model.detail.item.Gardu,
                  })}"
                >
                  Download PDF
                </a>
              </div>

              <h4>Riwayat Kerusakan</h4>
              ${renderTable(
                [
                  { key: 'ID', label: 'ID', render: (value) => escapeHtml(value) },
                  {
                    key: 'Tanggal',
                    label: 'Tanggal',
                    render: (value) => escapeHtml(formatDisplayDateTime(value, model.timeZone)),
                  },
                  { key: 'Deskripsi', label: 'Deskripsi', render: (value) => escapeHtml(value) },
                  { key: 'Gardu', label: 'Gardu', render: (value) => escapeHtml(value) },
                ],
                model.detail.riwayatKerusakan,
                { emptyMessage: 'Belum ada riwayat kerusakan.' },
              )}

              <h4>Riwayat Perbaikan</h4>
              ${renderTable(
                [
                  { key: 'ID', label: 'ID', render: (value) => escapeHtml(value) },
                  {
                    key: 'Tanggal',
                    label: 'Tanggal',
                    render: (value) => escapeHtml(formatDisplayDateTime(value, model.timeZone)),
                  },
                  { key: 'Deskripsi', label: 'Deskripsi', render: (value) => escapeHtml(value) },
                  { key: 'Gardu', label: 'Gardu', render: (value) => escapeHtml(value) },
                ],
                model.detail.riwayatPerbaikan,
                { emptyMessage: 'Belum ada riwayat perbaikan.' },
              )}

              <h4>Durasi Perbaikan</h4>
              ${renderTable(
                [
                  { key: 'ID', label: 'ID Barang', render: (value) => escapeHtml(value) },
                  { key: 'Durasi', label: 'Durasi', render: (value) => escapeHtml(value) },
                ],
                model.detail.durasiPerbaikan,
                { emptyMessage: 'Durasi perbaikan belum dapat dihitung.' },
              )}
            </section>
          `
          : ''
      }
    </section>
  `;
}

function renderUpdateTab(model) {
  const gerbangUpdateOptions = model.options.gerbangOptions.filter((option) => option !== 'SEMUA');
  const namaBarangUpdateOptions = model.options.namaBarangOptions.filter((option) => option !== 'SEMUA');
  const garduOptions = GARDU_KONDISI[model.form.gerbang] ?? [];

  return `
    <section class="panel">
      <h2>Update Barang</h2>
      ${model.error ? `<div class="alert alert-error">${escapeHtml(model.error)}</div>` : ''}
      <form method="post" action="/barang/update" class="grid-form">
        <label>
          <span>Nama Barang</span>
          ${renderSelect('nama', namaBarangUpdateOptions, model.form.nama)}
        </label>
        <label>
          <span>Gerbang</span>
          ${renderSelect('gerbang', gerbangUpdateOptions, model.form.gerbang, 'id="update-gerbang"')}
        </label>
        <label>
          <span>Gardu</span>
          ${renderSelect('gardu', garduOptions, model.form.gardu, 'id="update-gardu"')}
        </label>
        <label>
          <span>Tanggal</span>
          <input type="date" name="tanggal" value="${escapeHtml(model.form.tanggal)}" min="${escapeHtml(model.form.today)}" />
        </label>
        <label class="full-width">
          <span>Deskripsi</span>
          <input type="text" name="deskripsi" value="${escapeHtml(model.form.deskripsi)}" />
        </label>
        <label>
          <span>Shift</span>
          ${renderSelect('shift', model.options.shiftOptions, model.form.shift)}
        </label>
        <label>
          <span>Status</span>
          ${renderSelect('status', model.options.statusUpdateOptions, model.form.status)}
        </label>
        <div class="status-preview ${escapeHtml(STATUS_CLASS_MAP[model.form.status] ?? '')}">
          ${escapeHtml(model.form.status)}
        </div>
        <div class="form-actions">
          <button type="submit">Update Data</button>
        </div>
      </form>
    </section>
  `;
}

function renderReportTabs(reportType) {
  return `
    <div class="subtab-row">
      ${REPORT_TYPES.map((tab) => {
        const active = reportType === tab.key ? 'subtab-active' : '';
        return `<a class="subtab ${active}" href="/app?tab=reports&reportType=${escapeHtml(tab.key)}">${escapeHtml(tab.label)}</a>`;
      }).join('')}
    </div>
  `;
}

function renderReportsTab(model) {
  const monthOptions = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const date = new Date(Date.UTC(2024, index, 1));
    return {
      value: String(month),
      label: new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(date),
    };
  });

  return `
    <section class="panel">
      <h2>Laporan</h2>
      ${renderReportTabs(model.reportType)}

      ${
        model.reportType === 'daily'
          ? `
            <form method="get" action="/app" class="grid-form compact-form">
              <input type="hidden" name="tab" value="reports" />
              <input type="hidden" name="reportType" value="daily" />
              <label>
                <span>Tanggal</span>
                <input type="date" name="reportDate" value="${escapeHtml(model.reportDate)}" />
              </label>
              <label>
                <span>Shift</span>
                ${renderSelect('reportShift', model.options.shiftOptions, model.reportShift)}
              </label>
              <div class="form-actions">
                <button type="submit">Tampilkan Laporan</button>
              </div>
            </form>
            ${
              model.dailyRows.length > 0
                ? `
                  <div class="action-row">
                    <a
                      class="button"
                      href="/reports/daily/pdf?${buildQueryString({
                        reportDate: model.reportDate,
                        reportShift: model.reportShift,
                      })}"
                    >
                      Download PDF Laporan Harian
                    </a>
                  </div>
                `
                : ''
            }
            ${renderTable(
              [
                { key: 'id', label: 'ID', render: (value) => escapeHtml(value) },
                { key: 'nama_barang', label: 'Nama Barang', render: (value) => escapeHtml(value) },
                { key: 'gerbang', label: 'Gerbang', render: (value) => escapeHtml(value) },
                { key: 'gardu', label: 'Gardu', render: (value) => escapeHtml(value) },
                { key: 'deskripsi', label: 'Deskripsi', render: (value) => escapeHtml(value) },
                {
                  key: 'tanggal',
                  label: 'Tanggal',
                  render: (value) => escapeHtml(formatDisplayDate(value, model.timeZone)),
                },
                { key: 'shift', label: 'Shift', render: (value) => escapeHtml(value) },
                {
                  key: 'action',
                  label: 'Aksi',
                  render: (_, row) => `
                    <form method="post" action="/reports/daily/delete" class="inline-form">
                      <input type="hidden" name="id" value="${escapeHtml(row.id)}" />
                      <input type="hidden" name="reportDate" value="${escapeHtml(model.reportDate)}" />
                      <input type="hidden" name="reportShift" value="${escapeHtml(model.reportShift)}" />
                      <button type="submit" class="danger">Hapus</button>
                    </form>
                  `,
                },
              ],
              model.dailyRows,
              { emptyMessage: 'Tidak ada data untuk tanggal dan shift yang dipilih.' },
            )}
          `
          : `
            <form method="get" action="/app" class="grid-form compact-form">
              <input type="hidden" name="tab" value="reports" />
              <input type="hidden" name="reportType" value="monthly" />
              <label>
                <span>Bulan</span>
                ${renderSelect('reportMonth', monthOptions, model.reportMonth)}
              </label>
              <label>
                <span>Tahun</span>
                <input type="number" name="reportYear" min="2000" max="2100" value="${escapeHtml(model.reportYear)}" />
              </label>
              <div class="form-actions">
                <button type="submit">Tampilkan Laporan</button>
              </div>
            </form>
            ${
              model.monthlyRows.length > 0
                ? `
                  <div class="action-row">
                    <a
                      class="button"
                      href="/reports/monthly/pdf?${buildQueryString({
                        reportMonth: model.reportMonth,
                        reportYear: model.reportYear,
                      })}"
                    >
                      Download PDF Laporan Bulanan
                    </a>
                  </div>
                `
                : ''
            }
            ${renderTable(
              [
                { key: 'id', label: 'ID', render: (value) => escapeHtml(value) },
                { key: 'nama_barang', label: 'Nama Barang', render: (value) => escapeHtml(value) },
                { key: 'gerbang', label: 'Gerbang', render: (value) => escapeHtml(value) },
                { key: 'gardu', label: 'Gardu', render: (value) => escapeHtml(value) },
                { key: 'deskripsi', label: 'Deskripsi', render: (value) => escapeHtml(value) },
                {
                  key: 'tanggal',
                  label: 'Tanggal',
                  render: (value) => escapeHtml(formatDisplayDate(value, model.timeZone)),
                },
                { key: 'shift', label: 'Shift', render: (value) => escapeHtml(value) },
              ],
              model.monthlyRows,
              { emptyMessage: 'Tidak ada data untuk bulan dan tahun yang dipilih.' },
            )}
          `
      }
    </section>
  `;
}

function renderTabs(activeTab) {
  return `
    <nav class="tab-row">
      ${TAB_OPTIONS.map((tab) => {
        const active = tab.key === activeTab ? 'tab-active' : '';
        return `<a class="tab-link ${active}" href="/app?tab=${escapeHtml(tab.key)}">${escapeHtml(tab.label)}</a>`;
      }).join('')}
    </nav>
  `;
}

function renderContent(model) {
  if (model.activeTab === 'update') {
    return renderUpdateTab(model.update);
  }
  if (model.activeTab === 'reports') {
    return renderReportsTab(model.reports);
  }
  return renderDataTab(model.data);
}

function renderAppLayout(content, { activeTab, flash, notifications, selectedGardu }) {
  return `
    <!doctype html>
    <html lang="id">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(APP_TITLE)}</title>
        <style>
          :root {
            --bg: #f4efe7;
            --surface: #fffaf2;
            --surface-alt: #ffffff;
            --border: #decfb6;
            --ink: #1f1b16;
            --muted: #6f6253;
            --primary: #0f766e;
            --danger: #b42318;
            --warning: #b54708;
            --kendala: #d92d20;
            --perbaikan: #f5b700;
            --monitor: #7c3aed;
            --normal: #039855;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
            background:
              radial-gradient(circle at top right, rgba(15, 118, 110, 0.12), transparent 24%),
              linear-gradient(180deg, #f9f4eb 0%, #f1e5d0 100%);
            color: var(--ink);
          }
          a { color: inherit; text-decoration: none; }
          .page { max-width: 1280px; margin: 0 auto; padding: 32px 20px 48px; }
          .hero { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 24px; }
          .hero h1 { margin: 0 0 6px; font-size: clamp(2rem, 4vw, 3rem); line-height: 1.05; }
          .hero p { margin: 0; color: var(--muted); max-width: 720px; }
          .logout-form { margin: 0; }
          .tab-row, .subtab-row, .action-row { display: flex; flex-wrap: wrap; gap: 10px; }
          .tab-link, .subtab, .button, button {
            border: 1px solid var(--border);
            background: var(--surface-alt);
            border-radius: 999px;
            padding: 10px 16px;
            color: var(--ink);
            font-weight: 600;
            cursor: pointer;
            transition: transform .12s ease, box-shadow .12s ease, background .12s ease;
          }
          .tab-link:hover, .subtab:hover, .button:hover, button:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(38, 30, 18, 0.08); }
          .tab-active, .subtab-active, .button, button[type="submit"] { background: var(--primary); border-color: var(--primary); color: white; }
          .button.secondary { background: var(--surface-alt); color: var(--ink); }
          button.warning { background: var(--warning); border-color: var(--warning); color: white; }
          button.danger { background: var(--danger); border-color: var(--danger); color: white; }
          button:disabled { opacity: .5; cursor: not-allowed; transform: none; box-shadow: none; }
          .panel { margin-top: 20px; padding: 22px; background: rgba(255, 250, 242, .92); border: 1px solid rgba(222, 207, 182, .9); border-radius: 24px; box-shadow: 0 18px 50px rgba(48, 39, 23, .08); backdrop-filter: blur(10px); }
          .panel h2, .panel h3, .panel h4 { margin-top: 0; }
          .grid-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 18px; }
          .compact-form { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
          label { display: grid; gap: 8px; color: var(--muted); font-weight: 600; }
          input, select { width: 100%; border: 1px solid var(--border); border-radius: 14px; padding: 12px 14px; font: inherit; background: white; color: var(--ink); }
          .full-width { grid-column: 1 / -1; }
          .form-actions { display: flex; align-items: end; }
          .status-preview { display: flex; align-items: center; justify-content: center; min-height: 48px; border-radius: 14px; color: white; font-weight: 700; }
          .alert { margin: 0 0 14px; padding: 14px 16px; border-radius: 16px; border: 1px solid transparent; font-weight: 600; }
          .alert-info { background: rgba(15,118,110,.12); border-color: rgba(15,118,110,.2); }
          .alert-success { background: rgba(3,152,85,.12); border-color: rgba(3,152,85,.2); }
          .alert-warning { background: rgba(181,71,8,.12); border-color: rgba(181,71,8,.2); }
          .alert-error { background: rgba(185,28,28,.12); border-color: rgba(185,28,28,.2); }
          .table-shell { overflow-x: auto; border: 1px solid rgba(222, 207, 182, .8); border-radius: 18px; background: rgba(255,255,255,.75); }
          table { width: 100%; border-collapse: collapse; min-width: 720px; }
          th, td { padding: 12px 14px; border-bottom: 1px solid rgba(222, 207, 182, .8); vertical-align: top; text-align: left; }
          thead th { background: rgba(250, 241, 226, .95); }
          .status-pill { display: inline-flex; align-items: center; justify-content: center; min-width: 94px; padding: 7px 12px; border-radius: 999px; color: white; font-weight: 700; }
          .status-kendala { background: var(--kendala); }
          .status-perbaikan { background: var(--perbaikan); color: #241f16; }
          .status-monitor { background: var(--monitor); }
          .status-normal { background: var(--normal); }
          tr.status-kendala td:first-child, tr.status-perbaikan td:first-child, tr.status-monitor td:first-child, tr.status-normal td:first-child { border-left: 6px solid transparent; }
          tr.status-kendala td:first-child { border-left-color: var(--kendala); }
          tr.status-perbaikan td:first-child { border-left-color: var(--perbaikan); }
          tr.status-monitor td:first-child { border-left-color: var(--monitor); }
          tr.status-normal td:first-child { border-left-color: var(--normal); }
          .detail-shell { margin-top: 22px; display: grid; gap: 18px; }
          .detail-header { display: flex; justify-content: space-between; gap: 16px; align-items: center; }
          .empty-state { padding: 18px; border: 1px dashed var(--border); border-radius: 18px; color: var(--muted); background: rgba(255,255,255,.55); }
          .inline-form { display: inline-flex; }
          @media (max-width: 720px) {
            .page { padding: 20px 14px 36px; }
            .hero { flex-direction: column; }
            .detail-header { flex-direction: column; align-items: flex-start; }
            .tab-link, .subtab, .button, button { width: 100%; justify-content: center; text-align: center; }
          }
        </style>
      </head>
      <body>
        <main class="page">
          <section class="hero">
            <div>
              <h1>${escapeHtml(APP_TITLE)}</h1>
              <p>Versi JavaScript yang mempertahankan fitur sistem lama, tetap memakai database SQLite yang sama, dan siap dijalankan sebagai layanan web produksi.</p>
            </div>
            <form method="post" action="/logout" class="logout-form">
              <button type="submit">Logout</button>
            </form>
          </section>
          ${renderMessage(flash)}
          ${renderNotifications(notifications)}
          ${renderTabs(activeTab)}
          ${content}
        </main>
        <script>
          const garduKondisi = ${JSON.stringify(GARDU_KONDISI)};
          const initialFilterGardu = ${JSON.stringify(selectedGardu ?? '')};
          function syncGardu(sourceId, targetId, includeAll, selectedValue) {
            const source = document.getElementById(sourceId);
            const target = document.getElementById(targetId);
            if (!source || !target) return;
            const gerbang = source.value;
            const options = includeAll ? ['SEMUA'] : [];
            if (gerbang && garduKondisi[gerbang]) options.push(...garduKondisi[gerbang]);
            target.innerHTML = options.map((value) => '<option value="' + value + '">' + value + '</option>').join('');
            const finalValue = options.includes(selectedValue) ? selectedValue : options[0];
            if (finalValue) target.value = finalValue;
          }
          const filterGerbang = document.getElementById('filter-gerbang');
          if (filterGerbang) {
            syncGardu('filter-gerbang', 'filter-gardu', true, initialFilterGardu || document.getElementById('filter-gardu').value);
            filterGerbang.addEventListener('change', () => syncGardu('filter-gerbang', 'filter-gardu', true, 'SEMUA'));
          }
          const updateGerbang = document.getElementById('update-gerbang');
          if (updateGerbang) {
            syncGardu('update-gerbang', 'update-gardu', false, document.getElementById('update-gardu').value);
            updateGerbang.addEventListener('change', () => syncGardu('update-gerbang', 'update-gardu', false, ''));
          }
        </script>
      </body>
    </html>
  `;
}

export function renderLoginPage({ error = '', username = '' } = {}) {
  return `
    <!doctype html>
    <html lang="id">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(APP_TITLE)} - Login</title>
        <style>
          body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; background: radial-gradient(circle at top left, rgba(15,118,110,.25), transparent 30%), linear-gradient(135deg, #f7f0e3 0%, #efe2cb 100%); color: #1f1b16; }
          .card { width: min(460px, calc(100vw - 32px)); padding: 28px; border-radius: 28px; background: rgba(255,250,242,.92); border: 1px solid rgba(222,207,182,.9); box-shadow: 0 24px 60px rgba(48,39,23,.12); }
          h1 { margin: 0 0 10px; font-size: 2rem; line-height: 1.05; }
          p { margin: 0 0 18px; color: #6f6253; }
          form { display: grid; gap: 14px; }
          label { display: grid; gap: 8px; font-weight: 600; color: #6f6253; }
          input { width: 100%; border: 1px solid #decfb6; border-radius: 14px; padding: 12px 14px; font: inherit; }
          button { border: 0; border-radius: 999px; padding: 12px 16px; font: inherit; font-weight: 700; cursor: pointer; background: #0f766e; color: white; }
          .error { margin-bottom: 12px; padding: 12px 14px; border-radius: 14px; background: rgba(185,28,28,.12); color: #7f1d1d; border: 1px solid rgba(185,28,28,.2); }
        </style>
      </head>
      <body>
        <section class="card">
          <h1>${escapeHtml(APP_TITLE)}</h1>
          <p>Masuk untuk mengelola data barang, status pemeliharaan, riwayat, dan laporan PDF.</p>
          ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
          <form method="post" action="/login">
            <label>
              <span>Username</span>
              <input type="text" name="username" value="${escapeHtml(username)}" />
            </label>
            <label>
              <span>Password</span>
              <input type="password" name="password" />
            </label>
            <button type="submit">Login</button>
          </form>
        </section>
      </body>
    </html>
  `;
}

export function renderAppPage(model) {
  return renderAppLayout(renderContent(model), {
    activeTab: model.activeTab,
    flash: model.flash,
    notifications: model.notifications,
    selectedGardu: model.data?.filters?.gardu ?? '',
  });
}

export function renderErrorPage(error) {
  return `
    <!doctype html>
    <html lang="id">
      <body style="font-family: Arial, sans-serif; padding: 24px;">
        <h1>Terjadi kesalahan</h1>
        <p>${escapeHtml(error)}</p>
      </body>
    </html>
  `;
}
