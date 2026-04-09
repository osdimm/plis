import { createDailyReportPdf, createMonthlyReportPdf } from './pdf-service.js';

export class ReportService {
  constructor(database) {
    this.database = database;
  }

  getDailyReport(reportDate, reportShift) {
    return this.database.all(
      `
        SELECT
          dr.id,
          b.Nama AS nama_barang,
          dr.gerbang,
          dr.gardu,
          dr.deskripsi,
          dr.tanggal,
          dr.shift
        FROM daily_report dr
        JOIN barang b ON dr.id_barang = b.ID
        WHERE DATE(dr.tanggal) = ? AND dr.shift = ?
        ORDER BY dr.gerbang, dr.gardu, b.Nama
      `,
      [reportDate, reportShift],
    );
  }

  getMonthlyReport(reportMonth, reportYear) {
    return this.database.all(
      `
        SELECT
          dr.id,
          b.Nama AS nama_barang,
          dr.gerbang,
          dr.gardu,
          dr.deskripsi,
          dr.tanggal,
          dr.shift
        FROM daily_report dr
        JOIN barang b ON dr.id_barang = b.ID
        WHERE strftime('%m', dr.tanggal) = ? AND strftime('%Y', dr.tanggal) = ?
        ORDER BY dr.gerbang, dr.tanggal, dr.shift, b.Nama
      `,
      [String(reportMonth).padStart(2, '0'), String(reportYear)],
    );
  }

  deleteDailyReportEntry(id) {
    const entry = this.database.get('SELECT * FROM daily_report WHERE id = ?', [id]);
    if (!entry) {
      return false;
    }

    this.database.transaction((transactionDb) => {
      transactionDb.run('DELETE FROM daily_report WHERE id = ?', [id]);
      transactionDb.run(
        `
          DELETE FROM Laporan_Harian
          WHERE ID_Barang = ?
            AND Gerbang = ?
            AND Gardu = ?
            AND Deskripsi = ?
            AND Tanggal = ?
            AND Shift = ?
        `,
        [entry.id_barang, entry.gerbang, entry.gardu, entry.deskripsi, entry.tanggal, entry.shift],
      );
    });
    return true;
  }

  createDailyPdf(reportDate, reportShift) {
    const rows = this.getDailyReport(reportDate, reportShift);
    return createDailyReportPdf(rows, reportDate, reportShift);
  }

  createMonthlyPdf(reportMonth, reportYear) {
    const rows = this.getMonthlyReport(reportMonth, reportYear);
    return createMonthlyReportPdf(rows, reportMonth, reportYear);
  }
}
