export const APP_TITLE = 'Sistem Informasi Pemeliharaan Alat TOL Cijago';

export const NAMA_BARANG_OPTIONS = [
  'SEMUA',
  'TCT',
  'LTS',
  'READER',
  'ALB',
  'LPR',
  'CDF/TFI',
  'OBS',
  'CCTV LAJUR',
  'CCTV GANDAR',
  'LLA',
  'MONITOR GTO',
  'AVC',
];

export const GERBANG_OPTIONS = [
  'SEMUA',
  'CISALAK 1',
  'CISALAK 2',
  'CISALAK 3',
  'MARGONDA 1',
  'MARGONDA 2',
  'KUKUSAN 1',
  'KUKUSAN 2',
  'KRUKUT 3',
  'KRUKUT 4',
  'KRUKUT 5',
  'LIMO 1A',
  'LIMO 1B',
  'LIMO 2A',
  'LIMO 2B',
  'LIMO UTAMA 1',
  'LIMO UTAMA 2',
];

export const STATUS_OPTIONS = ['SEMUA', 'Kendala', 'Perbaikan', 'Monitor', 'Normal'];
export const STATUS_UPDATE_OPTIONS = ['Kendala', 'Perbaikan', 'Monitor', 'Normal'];
export const SHIFT_OPTIONS = ['1', '2', '3'];

export const GARDU_KONDISI = {
  'CISALAK 1': ['07', '09', '11'],
  'CISALAK 2': ['02', '04', '06', '08', '10'],
  'CISALAK 3': ['01', '03', '05'],
  'MARGONDA 1': ['01', '03', '05', '07'],
  'MARGONDA 2': ['02', '04', '06', '08'],
  'KUKUSAN 1': ['01', '03', '05'],
  'KUKUSAN 2': ['02', '04', '06'],
  'KRUKUT 3': ['01', '03', '05', '07', '09'],
  'KRUKUT 4': ['02', '04', '06'],
  'KRUKUT 5': ['01', '03', '05', '07', '09', '11', 'MR'],
  'LIMO 1A': ['02', '04', '06', '08'],
  'LIMO 1B': ['01', '03', '05', '07'],
  'LIMO 2A': ['02', '04', '06', '08'],
  'LIMO 2B': ['01', '03', '05', '07'],
  'LIMO UTAMA 1': ['01', '03', '05', '07', '09', '11', '13', '15'],
  'LIMO UTAMA 2': ['02', '04', '06', '08', '10', '12', '14', 'MR'],
};

export const TAB_OPTIONS = [
  { key: 'data', label: 'Data Barang' },
  { key: 'update', label: 'Update Barang' },
  { key: 'reports', label: 'Laporan' },
];

export const REPORT_TYPES = [
  { key: 'daily', label: 'Harian' },
  { key: 'monthly', label: 'Bulanan' },
];

export const STATUS_CLASS_MAP = {
  Kendala: 'status-kendala',
  Perbaikan: 'status-perbaikan',
  Monitor: 'status-monitor',
  Normal: 'status-normal',
};
