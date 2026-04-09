import {
  GARDU_KONDISI,
  GERBANG_OPTIONS,
  NAMA_BARANG_OPTIONS,
  STATUS_OPTIONS,
  STATUS_UPDATE_OPTIONS,
  SHIFT_OPTIONS,
} from '../constants.js';
import {
  addHours,
  calculateDurations,
  formatDateInTimeZone,
  formatDateTimeInTimeZone,
} from '../utils.js';
import { createItemHistoryPdf } from './pdf-service.js';

function validateStatusTransition(currentStatus, nextStatus) {
  if (currentStatus === 'Normal') {
    if (nextStatus === 'Normal') {
      return 'Barang ini telah dalam status normal.';
    }
    if (nextStatus === 'Perbaikan' || nextStatus === 'Monitor') {
      return 'Barang yang normal tidak bisa langsung ditandai sebagai perbaikan atau monitor.';
    }
  }

  if (currentStatus === 'Kendala') {
    if (nextStatus === 'Kendala') {
      return 'Barang ini telah dilaporkan kendala.';
    }
    if (nextStatus === 'Normal' || nextStatus === 'Monitor') {
      return 'Barang yang kendala tidak bisa langsung ditandai sebagai normal atau monitor.';
    }
  }

  if (currentStatus === 'Perbaikan') {
    if (nextStatus === 'Perbaikan') {
      return 'Barang yang sedang diperbaiki tidak bisa ditandai sebagai perbaikan kembali.';
    }
    if (nextStatus === 'Normal') {
      return 'Barang yang sedang diperbaiki tidak bisa langsung ditandai sebagai normal.';
    }
    if (nextStatus === 'Kendala') {
      return 'Barang yang sedang diperbaiki tidak bisa ditandai sebagai kendala.';
    }
  }

  if (currentStatus === 'Monitor') {
    if (nextStatus === 'Monitor') {
      return 'Barang yang sedang dimonitor tidak bisa ditandai sebagai monitor kembali.';
    }
    if (nextStatus === 'Perbaikan') {
      return 'Barang yang sedang dimonitor tidak bisa langsung ditandai sebagai perbaikan.';
    }
  }

  return null;
}

function ensureDate(value, fallback) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

export class InventoryService {
  constructor(database, config) {
    this.database = database;
    this.config = config;
  }

  getStaticOptions() {
    return {
      namaBarangOptions: NAMA_BARANG_OPTIONS,
      gerbangOptions: GERBANG_OPTIONS,
      garduKondisi: GARDU_KONDISI,
      statusOptions: STATUS_OPTIONS,
      statusUpdateOptions: STATUS_UPDATE_OPTIONS,
      shiftOptions: SHIFT_OPTIONS,
    };
  }

  runMonitorNormalization() {
    const now = new Date();
    const nowString = formatDateTimeInTimeZone(now, this.config.timeZone);
    const threshold = formatDateTimeInTimeZone(addHours(now, -24), this.config.timeZone);
    const updatedItems = this.database.all(
      `
        SELECT ID, Nama, Gerbang, Gardu
        FROM barang
        WHERE Status = 'Monitor'
          AND Last_Update IS NOT NULL
          AND Last_Update < ?
      `,
      [threshold],
    );

    if (updatedItems.length > 0) {
      this.database.run(
        `
          UPDATE barang
          SET Status = 'Normal', Last_Update = ?
          WHERE Status = 'Monitor'
            AND Last_Update IS NOT NULL
            AND Last_Update < ?
        `,
        [nowString, threshold],
      );
    }

    const recentThreshold = formatDateTimeInTimeZone(addHours(now, -(10 / 3600)), this.config.timeZone);
    const newKendalaItems = this.database.all(
      `
        SELECT ID, Nama, Gerbang, Gardu, Deskripsi
        FROM barang
        WHERE Status = 'Kendala'
          AND Last_Update IS NOT NULL
          AND Last_Update > ?
      `,
      [recentThreshold],
    );

    return { updatedItems, newKendalaItems };
  }

  listBarang(filters) {
    const query = ['SELECT * FROM barang WHERE 1=1'];
    const params = [];

    if (filters.nama && filters.nama !== 'SEMUA') {
      query.push('AND Nama = ?');
      params.push(filters.nama);
    }

    if (filters.gerbang && filters.gerbang !== 'SEMUA') {
      query.push('AND Gerbang = ?');
      params.push(filters.gerbang);
    }

    if (filters.gardu && filters.gardu !== 'SEMUA') {
      query.push('AND Gardu = ?');
      params.push(filters.gardu);
    }

    if (filters.status && filters.status !== 'SEMUA') {
      query.push('AND Status = ?');
      params.push(filters.status);
    }

    query.push('ORDER BY Gerbang, Gardu, Nama');
    return this.database.all(query.join(' '), params);
  }

  findBarang(nama, gerbang, gardu) {
    return this.database.get(
      `
        SELECT *
        FROM barang
        WHERE Nama = ? AND Gerbang = ? AND Gardu = ?
      `,
      [nama, gerbang, gardu],
    );
  }

  getDetail(nama, gerbang, gardu) {
    const item = this.findBarang(nama, gerbang, gardu);
    if (!item) {
      return null;
    }

    const riwayatKerusakan = this.database.all(
      `
        SELECT ID, ID_Barang, Tanggal, Deskripsi, Gardu
        FROM Riwayat_Kerusakan
        WHERE ID_Barang = ?
        ORDER BY Tanggal ASC, ID ASC
      `,
      [item.ID],
    );
    const riwayatPerbaikan = this.database.all(
      `
        SELECT ID, ID_Barang, Tanggal, Deskripsi, Gardu
        FROM Riwayat_Perbaikan
        WHERE ID_Barang = ?
        ORDER BY Tanggal ASC, ID ASC
      `,
      [item.ID],
    );
    const durasiPerbaikan = calculateDurations(riwayatKerusakan, riwayatPerbaikan);

    this.database.transaction((transactionDb) => {
      transactionDb.run('DELETE FROM Durasi_Perbaikan WHERE ID_Barang = ?', [item.ID]);
      for (const durasi of durasiPerbaikan) {
        transactionDb.run(
          'INSERT INTO Durasi_Perbaikan (ID_Barang, Durasi) VALUES (?, ?)',
          [item.ID, durasi.Durasi],
        );
      }
    });

    return { item, riwayatKerusakan, riwayatPerbaikan, durasiPerbaikan };
  }

  deleteBarang(nama, gerbang, gardu) {
    const item = this.findBarang(nama, gerbang, gardu);
    if (!item) {
      return false;
    }

    this.database.transaction((transactionDb) => {
      transactionDb.run('DELETE FROM daily_report WHERE id_barang = ?', [item.ID]);
      transactionDb.run('DELETE FROM Laporan_Harian WHERE ID_Barang = ?', [item.ID]);
      transactionDb.run('DELETE FROM barang WHERE ID = ?', [item.ID]);
    });
    return true;
  }

  deleteRiwayat(nama, gerbang, gardu) {
    const item = this.findBarang(nama, gerbang, gardu);
    if (!item) {
      return false;
    }

    this.database.transaction((transactionDb) => {
      transactionDb.run('DELETE FROM Riwayat_Kerusakan WHERE ID_Barang = ?', [item.ID]);
      transactionDb.run('DELETE FROM Riwayat_Perbaikan WHERE ID_Barang = ?', [item.ID]);
      transactionDb.run('DELETE FROM Durasi_Perbaikan WHERE ID_Barang = ?', [item.ID]);
      transactionDb.exec(`
        DELETE FROM sqlite_sequence
        WHERE name IN ('Riwayat_Kerusakan', 'Riwayat_Perbaikan', 'Durasi_Perbaikan')
      `);
    });

    return true;
  }

  upsertBarang(formData) {
    const now = new Date();
    const today = formatDateInTimeZone(now, this.config.timeZone);
    const tanggal = ensureDate(formData.tanggal, today);
    const currentTime = formatDateTimeInTimeZone(now, this.config.timeZone);
    const shift = String(formData.shift ?? '1');
    const status = formData.status;
    const nama = formData.nama;
    const gerbang = formData.gerbang;
    const gardu = formData.gardu;
    const deskripsi = formData.deskripsi?.trim() ?? '';

    if (!nama || !gerbang || !gardu || !status) {
      throw new Error('Nama barang, gerbang, gardu, dan status wajib diisi.');
    }

    const existingEntry = this.findBarang(nama, gerbang, gardu);
    if (existingEntry) {
      const transitionError = validateStatusTransition(existingEntry.Status, status);
      if (transitionError) {
        throw new Error(transitionError);
      }
    }

    return this.database.transaction((transactionDb) => {
      let barangId = existingEntry?.ID ?? null;

      if (existingEntry) {
        transactionDb.run(
          `
            UPDATE barang
            SET Tanggal_Pelaporan = ?, Deskripsi = ?, Status = ?, Last_Update = ?, Shift = ?
            WHERE ID = ?
          `,
          [tanggal, deskripsi, status, currentTime, shift, existingEntry.ID],
        );
        barangId = existingEntry.ID;
      } else {
        const insertResult = transactionDb.run(
          `
            INSERT INTO barang (Nama, Gerbang, Gardu, Tanggal_Pelaporan, Deskripsi, Status, Last_Update, Shift)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [nama, gerbang, gardu, tanggal, deskripsi, status, currentTime, shift],
        );
        barangId = insertResult.lastInsertRowid;
      }

      if (status === 'Kendala') {
        transactionDb.run(
          `
            INSERT INTO Riwayat_Kerusakan (ID_Barang, Tanggal, Deskripsi, Gardu)
            VALUES (?, ?, ?, ?)
          `,
          [barangId, currentTime, deskripsi, gardu],
        );

        const reportExists = transactionDb.get(
          `
            SELECT id
            FROM daily_report
            WHERE id_barang = ? AND DATE(tanggal) = ? AND shift = ?
          `,
          [barangId, tanggal, shift],
        );

        if (!reportExists) {
          transactionDb.run(
            `
              INSERT INTO daily_report (id_barang, gerbang, gardu, deskripsi, tanggal, shift)
              VALUES (?, ?, ?, ?, ?, ?)
            `,
            [barangId, gerbang, gardu, deskripsi, tanggal, shift],
          );
        }

        const legacyExists = transactionDb.get(
          `
            SELECT ID
            FROM Laporan_Harian
            WHERE ID_Barang = ? AND DATE(Tanggal) = ? AND Shift = ?
          `,
          [barangId, tanggal, shift],
        );

        if (!legacyExists) {
          transactionDb.run(
            `
              INSERT INTO Laporan_Harian (ID_Barang, Gerbang, Gardu, Deskripsi, Tanggal, Shift)
              VALUES (?, ?, ?, ?, ?, ?)
            `,
            [barangId, gerbang, gardu, deskripsi, tanggal, shift],
          );
        }
      } else if (status === 'Monitor') {
        transactionDb.run(
          `
            INSERT INTO Riwayat_Perbaikan (ID_Barang, Tanggal, Deskripsi, Gardu)
            VALUES (?, ?, ?, ?)
          `,
          [barangId, currentTime, deskripsi, gardu],
        );
      }

      return {
        barangId,
        tanggal,
        shift,
        status,
      };
    });
  }

  createItemHistoryPdf(nama, gerbang, gardu) {
    const detail = this.getDetail(nama, gerbang, gardu);
    if (!detail) {
      return null;
    }

    return createItemHistoryPdf(
      detail.item,
      detail.riwayatKerusakan,
      detail.riwayatPerbaikan,
      detail.durasiPerbaikan,
    );
  }
}
