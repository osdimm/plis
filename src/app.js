import http from 'node:http';

import { formatDateInTimeZone } from './utils.js';
import { createDatabase } from './db/database.js';
import {
  applySecurityHeaders,
  clearFlash,
  clearSession,
  isAuthenticated,
  notFound,
  parseFormBody,
  readFlash,
  readSession,
  redirect,
  sendHtml,
  sendJson,
  sendPdf,
  writeFlash,
  writeSession,
} from './http.js';
import { InventoryService } from './services/inventory-service.js';
import { ReportService } from './services/report-service.js';
import { renderAppPage, renderErrorPage, renderLoginPage } from './view.js';

function safeFileSegment(value) {
  return String(value ?? '')
    .trim()
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'file';
}

function buildNotificationMessages(result) {
  const notifications = [];

  for (const item of result.updatedItems) {
    notifications.push({
      type: 'info',
      message: `Barang ${item.Nama} di Gerbang ${item.Gerbang} Gardu ${item.Gardu} telah diupdate dari Monitor ke status Normal.`,
    });
  }

  for (const item of result.newKendalaItems) {
    notifications.push({
      type: 'warning',
      message: `Barang ${item.Nama} di Gerbang ${item.Gerbang} Gardu ${item.Gardu} mengalami Kendala.`,
    });
  }

  return notifications;
}

function createDefaultUpdateForm(options, today) {
  const gerbang = options.gerbangOptions[1];
  return {
    nama: options.namaBarangOptions[1],
    gerbang,
    gardu: options.garduKondisi[gerbang][0],
    tanggal: today,
    today,
    deskripsi: '',
    shift: options.shiftOptions[0],
    status: options.statusUpdateOptions[0],
  };
}

function createViewModel(config, inventoryService, reportService, url, flash, overrides = {}) {
  const today = formatDateInTimeZone(new Date(), config.timeZone);
  const requestedTab = url.searchParams.get('tab');
  const activeTab = ['data', 'update', 'reports'].includes(requestedTab) ? requestedTab : 'data';
  const options = inventoryService.getStaticOptions();
  const notifications = buildNotificationMessages(inventoryService.runMonitorNormalization());

  const dataFilters = {
    nama: url.searchParams.get('nama') ?? 'SEMUA',
    gerbang: url.searchParams.get('gerbang') ?? 'SEMUA',
    gardu: url.searchParams.get('gardu') ?? 'SEMUA',
    status: url.searchParams.get('status') ?? 'SEMUA',
  };

  const data = {
    options,
    timeZone: config.timeZone,
    filters: dataFilters,
    barangRows: inventoryService.listBarang(dataFilters),
    detail:
      url.searchParams.get('detail') === '1' &&
      dataFilters.nama !== 'SEMUA' &&
      dataFilters.gerbang !== 'SEMUA' &&
      dataFilters.gardu !== 'SEMUA'
        ? inventoryService.getDetail(dataFilters.nama, dataFilters.gerbang, dataFilters.gardu)
        : null,
  };

  const defaultUpdateForm = createDefaultUpdateForm(options, today);
  const update = {
    options,
    form: {
      ...defaultUpdateForm,
      ...(overrides.updateForm ?? {}),
    },
    error: overrides.updateError ?? '',
  };

  const reportType = url.searchParams.get('reportType') === 'monthly' ? 'monthly' : 'daily';
  const reportDate = url.searchParams.get('reportDate') ?? today;
  const reportShift = url.searchParams.get('reportShift') ?? '1';
  const reportMonth = url.searchParams.get('reportMonth') ?? String(new Date().getUTCMonth() + 1);
  const reportYear = url.searchParams.get('reportYear') ?? String(new Date().getUTCFullYear());

  const reports = {
    options,
    timeZone: config.timeZone,
    reportType,
    reportDate,
    reportShift,
    reportMonth,
    reportYear,
    dailyRows: reportType === 'daily' ? reportService.getDailyReport(reportDate, reportShift) : [],
    monthlyRows:
      reportType === 'monthly' ? reportService.getMonthlyReport(reportMonth, reportYear) : [],
  };

  return {
    activeTab,
    flash,
    notifications,
    data,
    update,
    reports,
  };
}

function normalizeDataRedirect(formData) {
  const params = new URLSearchParams({
    tab: 'data',
    nama: formData.nama ?? 'SEMUA',
    gerbang: formData.gerbang ?? 'SEMUA',
    gardu: formData.gardu ?? 'SEMUA',
    status: formData.status ?? 'SEMUA',
  });
  return `/app?${params.toString()}`;
}

export function createHttpServer(config) {
  const database = createDatabase(config.databasePath);
  const inventoryService = new InventoryService(database, config);
  const reportService = new ReportService(database);

  const server = http.createServer(async (request, response) => {
    const startedAt = Date.now();
    applySecurityHeaders(response);

    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
    const session = readSession(request, config);
    const flash = readFlash(request, config);
    if (flash) {
      clearFlash(response, config);
    }

    response.on('finish', () => {
      if (config.requestLogging) {
        const duration = Date.now() - startedAt;
        console.log(`${request.method} ${url.pathname} ${response.statusCode} ${duration}ms`);
      }
    });

    try {
      if (request.method === 'GET' && url.pathname === '/healthz') {
        sendJson(response, 200, { ok: true, time: new Date().toISOString() });
        return;
      }

      if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/login')) {
        if (isAuthenticated(session, config)) {
          redirect(response, '/app?tab=data');
          return;
        }
        sendHtml(response, 200, renderLoginPage());
        return;
      }

      if (request.method === 'POST' && url.pathname === '/login') {
        const formData = await parseFormBody(request);
        if (
          formData.username === config.adminUsername &&
          formData.password === config.adminPassword
        ) {
          writeSession(response, config, {
            username: formData.username,
            loginAt: new Date().toISOString(),
          });
          writeFlash(response, config, { type: 'success', message: 'Login berhasil.' });
          redirect(response, '/app?tab=data');
          return;
        }

        sendHtml(
          response,
          401,
          renderLoginPage({
            error: 'Username atau password salah.',
            username: formData.username ?? '',
          }),
        );
        return;
      }

      if (!isAuthenticated(session, config)) {
        redirect(response, '/login');
        return;
      }

      if (request.method === 'POST' && url.pathname === '/logout') {
        clearSession(response, config);
        writeFlash(response, config, { type: 'success', message: 'Logout berhasil.' });
        redirect(response, '/login');
        return;
      }

      if (request.method === 'GET' && url.pathname === '/app') {
        const viewModel = createViewModel(config, inventoryService, reportService, url, flash);
        sendHtml(response, 200, renderAppPage(viewModel));
        return;
      }

      if (request.method === 'POST' && url.pathname === '/barang/update') {
        const formData = await parseFormBody(request);
        const options = inventoryService.getStaticOptions();
        const today = formatDateInTimeZone(new Date(), config.timeZone);
        const updateForm = {
          ...createDefaultUpdateForm(options, today),
          ...formData,
          today,
        };

        try {
          inventoryService.upsertBarang(formData);
          writeFlash(response, config, {
            type: 'success',
            message: 'Data berhasil diupdate.',
          });
          redirect(response, '/app?tab=update');
          return;
        } catch (error) {
          const rerenderUrl = new URL('/app?tab=update', 'http://localhost');
          const viewModel = createViewModel(config, inventoryService, reportService, rerenderUrl, flash, {
            updateForm,
            updateError: error.message,
          });
          sendHtml(response, 400, renderAppPage(viewModel));
          return;
        }
      }

      if (request.method === 'POST' && url.pathname === '/barang/delete') {
        const formData = await parseFormBody(request);
        if (inventoryService.deleteBarang(formData.nama, formData.gerbang, formData.gardu)) {
          writeFlash(response, config, {
            type: 'success',
            message: `Barang ${formData.nama} di ${formData.gerbang} gardu ${formData.gardu} berhasil dihapus.`,
          });
        } else {
          writeFlash(response, config, { type: 'warning', message: 'Barang tidak ditemukan.' });
        }
        redirect(response, normalizeDataRedirect(formData));
        return;
      }

      if (request.method === 'POST' && url.pathname === '/barang/history/delete') {
        const formData = await parseFormBody(request);
        if (inventoryService.deleteRiwayat(formData.nama, formData.gerbang, formData.gardu)) {
          writeFlash(response, config, {
            type: 'success',
            message: `Riwayat untuk barang ${formData.nama} di ${formData.gerbang} gardu ${formData.gardu} berhasil dihapus.`,
          });
        } else {
          writeFlash(response, config, { type: 'warning', message: 'Barang tidak ditemukan.' });
        }
        redirect(response, normalizeDataRedirect(formData));
        return;
      }

      if (request.method === 'GET' && url.pathname === '/barang/detail/pdf') {
        const nama = url.searchParams.get('nama');
        const gerbang = url.searchParams.get('gerbang');
        const gardu = url.searchParams.get('gardu');
        const pdfBuffer = inventoryService.createItemHistoryPdf(nama, gerbang, gardu);
        if (!pdfBuffer) {
          sendHtml(response, 404, renderErrorPage('Barang tidak ditemukan.'));
          return;
        }
        sendPdf(
          response,
          `Riwayat_${safeFileSegment(nama)}_${safeFileSegment(gerbang)}_${safeFileSegment(gardu)}.pdf`,
          pdfBuffer,
        );
        return;
      }

      if (request.method === 'GET' && url.pathname === '/reports/daily/pdf') {
        const reportDate = url.searchParams.get('reportDate');
        const reportShift = url.searchParams.get('reportShift') ?? '1';
        sendPdf(
          response,
          `Laporan_Harian_${reportDate}_${reportShift}.pdf`,
          reportService.createDailyPdf(reportDate, reportShift),
        );
        return;
      }

      if (request.method === 'GET' && url.pathname === '/reports/monthly/pdf') {
        const reportMonth = url.searchParams.get('reportMonth');
        const reportYear = url.searchParams.get('reportYear');
        sendPdf(
          response,
          `Laporan_Bulanan_${reportMonth}_${reportYear}.pdf`,
          reportService.createMonthlyPdf(reportMonth, reportYear),
        );
        return;
      }

      if (request.method === 'POST' && url.pathname === '/reports/daily/delete') {
        const formData = await parseFormBody(request);
        if (reportService.deleteDailyReportEntry(formData.id)) {
          writeFlash(response, config, {
            type: 'success',
            message: `Data laporan dengan ID ${formData.id} berhasil dihapus.`,
          });
        } else {
          writeFlash(response, config, {
            type: 'warning',
            message: 'Data laporan tidak ditemukan.',
          });
        }
        redirect(
          response,
          `/app?tab=reports&reportType=daily&reportDate=${encodeURIComponent(
            formData.reportDate,
          )}&reportShift=${encodeURIComponent(formData.reportShift ?? '1')}`,
        );
        return;
      }

      notFound(response);
    } catch (error) {
      console.error(error);
      sendHtml(response, 500, renderErrorPage(error.message ?? 'Unknown error'));
    }
  });

  return {
    server,
    close() {
      return new Promise((resolve, reject) => {
        server.close((error) => {
          database.close();
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}
