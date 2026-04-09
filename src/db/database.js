import { openDatabase } from './adapter.js';

function hasColumn(database, tableName, columnName) {
  const rows = database.all(`PRAGMA table_info(${tableName})`);
  return rows.some((row) => row.name === columnName || row.Name === columnName);
}

function ensureColumn(database, tableName, columnName, definition) {
  if (!hasColumn(database, tableName, columnName)) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
  }
}

function ensureSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS barang (
      ID INTEGER PRIMARY KEY AUTOINCREMENT,
      Nama TEXT,
      Gerbang TEXT,
      Gardu TEXT,
      Tanggal_Pelaporan TEXT,
      Deskripsi TEXT,
      Status TEXT,
      Last_Update TIMESTAMP,
      Shift TEXT
    );

    CREATE TABLE IF NOT EXISTS Durasi_Perbaikan (
      ID INTEGER PRIMARY KEY AUTOINCREMENT,
      ID_Barang INTEGER,
      Durasi TEXT,
      FOREIGN KEY (ID_Barang) REFERENCES barang(ID) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Riwayat_Kerusakan (
      ID INTEGER PRIMARY KEY AUTOINCREMENT,
      ID_Barang INTEGER,
      Tanggal TIMESTAMP,
      Deskripsi TEXT,
      Gardu TEXT,
      FOREIGN KEY (ID_Barang) REFERENCES barang(ID) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Riwayat_Perbaikan (
      ID INTEGER PRIMARY KEY AUTOINCREMENT,
      ID_Barang INTEGER,
      Tanggal TIMESTAMP,
      Deskripsi TEXT,
      Gardu TEXT,
      FOREIGN KEY (ID_Barang) REFERENCES barang(ID) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS daily_report (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_barang INTEGER,
      gerbang TEXT,
      gardu TEXT,
      deskripsi TEXT,
      tanggal DATE,
      shift INTEGER,
      FOREIGN KEY (id_barang) REFERENCES barang(ID)
    );

    CREATE TABLE IF NOT EXISTS Laporan_Harian (
      ID INTEGER PRIMARY KEY AUTOINCREMENT,
      ID_Barang INTEGER,
      Gerbang TEXT,
      Gardu TEXT,
      Deskripsi TEXT,
      Tanggal DATE,
      Shift INTEGER,
      FOREIGN KEY (ID_Barang) REFERENCES barang(ID)
    );
  `);

  ensureColumn(database, 'barang', 'Last_Update', 'Last_Update TIMESTAMP');
  ensureColumn(database, 'barang', 'Shift', 'Shift TEXT');

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_barang_lookup ON barang (Nama, Gerbang, Gardu);
    CREATE INDEX IF NOT EXISTS idx_barang_status ON barang (Status);
    CREATE INDEX IF NOT EXISTS idx_daily_report_date_shift ON daily_report (tanggal, shift);
    CREATE INDEX IF NOT EXISTS idx_daily_report_item ON daily_report (id_barang);
    CREATE INDEX IF NOT EXISTS idx_laporan_harian_date_shift ON Laporan_Harian (Tanggal, Shift);
  `);
}

function syncLegacyDailyReports(database) {
  database.exec(`
    INSERT INTO daily_report (id_barang, gerbang, gardu, deskripsi, tanggal, shift)
    SELECT
      lh.ID_Barang,
      lh.Gerbang,
      lh.Gardu,
      lh.Deskripsi,
      lh.Tanggal,
      lh.Shift
    FROM Laporan_Harian lh
    WHERE NOT EXISTS (
      SELECT 1
      FROM daily_report dr
      WHERE dr.id_barang = lh.ID_Barang
        AND dr.gerbang = lh.Gerbang
        AND dr.gardu = lh.Gardu
        AND dr.deskripsi = lh.Deskripsi
        AND dr.tanggal = lh.Tanggal
        AND dr.shift = lh.Shift
    );

    INSERT INTO Laporan_Harian (ID_Barang, Gerbang, Gardu, Deskripsi, Tanggal, Shift)
    SELECT
      dr.id_barang,
      dr.gerbang,
      dr.gardu,
      dr.deskripsi,
      dr.tanggal,
      dr.shift
    FROM daily_report dr
    WHERE NOT EXISTS (
      SELECT 1
      FROM Laporan_Harian lh
      WHERE lh.ID_Barang = dr.id_barang
        AND lh.Gerbang = dr.gerbang
        AND lh.Gardu = dr.gardu
        AND lh.Deskripsi = dr.deskripsi
        AND lh.Tanggal = dr.tanggal
        AND lh.Shift = dr.shift
    );
  `);
}

export function createDatabase(databasePath) {
  const database = openDatabase(databasePath);
  ensureSchema(database);
  syncLegacyDailyReports(database);
  return database;
}
