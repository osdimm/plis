import streamlit as st
import pandas as pd
import sqlite3
from datetime import datetime, timedelta
from fpdf import FPDF
import time
import pytz
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from contextlib import contextmanager
import io


@contextmanager
def get_db_connection():
    conn = sqlite3.connect('pemeliharaan_barang.db', timeout=10)
    try:
        yield conn
    finally:
        conn.close()

def execute_query(query, params=None):
    with get_db_connection() as conn:
        c = conn.cursor()
        if params:
            c.execute(query, params)
        else:
            c.execute(query)
        conn.commit()
        return c.fetchall()
def create_pdff(dataframe, report_date, report_shift):
    pdf = FPDF()
    pdf.add_page()

    # Judul PDF
    pdf.set_font("Arial", size=10)
    pdf.cell(200, 10, txt=f"Laporan Harian - Tanggal: {report_date}, Shift: {report_shift}", ln=True, align='C')

    # Header tabel
    pdf.set_font("Arial", size=8)  # Gunakan ukuran font lebih kecil
    col_widths = [10, 40, 30, 10, 50, 25]  # Lebar kolom yang lebih kecil
    headers = ["ID", "Nama Barang", "Gerbang", "Gardu", "Deskripsi", "Tanggal"]
    for i, header in enumerate(headers):
        pdf.cell(col_widths[i], 8, header, border=1, align='C')  # Tinggi baris lebih kecil
    pdf.ln()

    # Isi data tabel
    pdf.set_font("Arial", size=8)  # Gunakan ukuran font lebih kecil
    row_height = 8  # Tinggi baris lebih kecil
    num_rows_per_page = (pdf.h - 20) // row_height  # Menghitung berapa baris yang bisa muat dalam satu halaman
    row_count = 0

    for row in dataframe.itertuples(index=False):
        if row_count >= num_rows_per_page:
            pdf.add_page()  # Tambah halaman baru
            # Cetak header lagi di halaman baru
            pdf.set_font("Arial", size=8)
            for i, header in enumerate(headers):
                pdf.cell(col_widths[i], 8, header, border=1, align='C')
            pdf.ln()
            row_count = 0
        
        pdf.cell(col_widths[0], row_height, str(row.id), border=1)
        pdf.cell(col_widths[1], row_height, row.nama_barang, border=1)
        pdf.cell(col_widths[2], row_height, row.gerbang, border=1)
        pdf.cell(col_widths[3], row_height, row.gardu, border=1)
        pdf.cell(col_widths[4], row_height, row.deskripsi, border=1)
        pdf.cell(col_widths[5], row_height, row.tanggal, border=1)
        pdf.ln()
        row_count += 1

    # Simpan PDF ke buffer
    import tempfile
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmpfile:
        pdf.output(tmpfile.name)
        tmpfile.seek(0)
        pdf_content = tmpfile.read()

    return pdf_content
    
def execute_query_with_retry(query, params=None, max_retries=3):
    for attempt in range(max_retries):
        try:
            return execute_query(query, params)
        except sqlite3.OperationalError as e:
            if "database is locked" in str(e) and attempt < max_retries - 1:
                time.sleep(0.1 * (attempt + 1))  # Eksponensial backoff
            else:
                raise    
def kirim_email(penerima, subjek, pesan):
    # Konfigurasi email
    pengirim = "anakudadery@gmail.com"
    password = "rcxo xpcc tzhk rdzh"

    # Membuat pesan
    msg = MIMEMultipart()
    msg['From'] = pengirim
    msg['To'] = ', '.join(penerima)  # Gabungkan daftar penerima menjadi string
    msg['Subject'] = subjek

    # Menambahkan body email
    msg.attach(MIMEText(pesan, 'plain'))

    # Membuat koneksi ke server SMTP
    server = smtplib.SMTP('smtp.gmail.com', 587)
    server.starttls()
    server.login(pengirim, password)

    # Mengirim email
    text = msg.as_string()
    server.sendmail(pengirim, penerima, text)  # Penerima harus berupa list
    server.quit()
email_penerima = ['oslodinamoras@gmail.com']

# Definisikan zona waktu Jakarta
jakarta_tz = pytz.timezone('Asia/Jakarta')

conn = sqlite3.connect('pemeliharaan_barang.db')
c = conn.cursor()

# Kelas PDF kustom
class PDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 12)
        self.cell(0, 10, 'Riwayat Barang', 0, 1, 'C')

    def footer(self):
        self.set_y(-15)
        self.set_font('Arial', 'I', 8)
        self.cell(0, 10, f'Page {self.page_no()}', 0, 0, 'C')

# Fungsi export pdf
def create_pdf(riwayat_kerusakan, riwayat_perbaikan, durasi_df, nama_barang, nama_gerbang, nama_gardu):
    pdf = PDF('L', 'mm', 'A4')
    pdf.add_page()
    pdf.set_font('Arial', 'B', 16)
    pdf.cell(0, 10, f"Riwayat {nama_barang} di Gerbang {nama_gerbang} Gardu {nama_gardu}", 0, 1, 'C')
    pdf.ln(10)

    def add_table(df, title, col_widths):
        pdf.set_font('Arial', 'B', 12)
        pdf.cell(0, 10, title, 0, 1, 'L')
        pdf.set_font('Arial', '', 10)
        
        # Table header
        for i, col in enumerate(df.columns):
            pdf.cell(col_widths[i], 7, str(col), 1, 0, 'C')
        pdf.ln()
        
        # Table data
        for _, row in df.iterrows():
            for i, item in enumerate(row):
                pdf.cell(col_widths[i], 7, str(item), 1, 0, 'C')
            pdf.ln()
        
        pdf.ln(10)

    # Tentukan lebar kolom di sini
    col_widths_kerusakan = [20, 20, 170, 15, 40]  # Misalnya untuk Riwayat Kerusakan
    col_widths_perbaikan = [20, 20, 170, 15, 40]  # Misalnya untuk Riwayat Perbaikan
    col_widths_durasi = [20, 150]  # Misalnya untuk Durasi Perbaikan

    add_table(riwayat_kerusakan, "Riwayat Kerusakan", col_widths_kerusakan)
    add_table(riwayat_perbaikan, "Riwayat Perbaikan", col_widths_perbaikan)
    add_table(durasi_df, "Durasi Perbaikan", col_widths_durasi)

    # Instead of using BytesIO, we'll save to a temporary file
    import tempfile
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmpfile:
        pdf.output(tmpfile.name)
        tmpfile.seek(0)
        pdf_content = tmpfile.read()

    return pdf_content

# Fungsi untuk memeriksa kredensial
def check_credentials(username, password):
    return username == "admin" and password == "cijago"

# Fungsi untuk halaman login
def login_page():
    st.title("Halaman Login")
    
    username = st.text_input("Username")
    password = st.text_input("Password", type="password")
    
    if st.button("Login"):
        if check_credentials(username, password):
            st.success("Login berhasil!")
            st.session_state.logged_in = True
            st.rerun()
        else:
            st.error("Username atau password salah.")

def reset_sequence(table_name):
    global c
    c.execute(f"DELETE FROM sqlite_sequence WHERE name='{table_name}'")
def create_daily_report_table():
    c.execute('''
    CREATE TABLE IF NOT EXISTS daily_report (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_barang INTEGER,
        gerbang TEXT,
        gardu TEXT,
        deskripsi TEXT,
        tanggal DATE,
        shift INTEGER,
        FOREIGN KEY (id_barang) REFERENCES barang(ID)
    )
    ''')
    conn.commit()
# Fungsi utama aplikasi
def main_app():
    global c, conn
    create_daily_report_table()
    def add_last_update_column():
        c.execute("PRAGMA table_info(barang)")
        columns = [column[1] for column in c.fetchall()]
        if 'Last_Update' not in columns:
            c.execute('ALTER TABLE barang ADD COLUMN Last_Update TIMESTAMP')
            conn.commit()

    add_last_update_column()
    
    # Membuat tabel barang
    c.execute('''
    CREATE TABLE IF NOT EXISTS barang (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        Nama TEXT,
        Gerbang TEXT,
        Gardu TEXT,
        Tanggal_Pelaporan TEXT,
        Deskripsi TEXT,
        Status TEXT,
        Last_Update TIMESTAMP
    )
    ''')
    

    # Membuat tabel durasi perbaikan
    c.execute('''
    CREATE TABLE IF NOT EXISTS Durasi_Perbaikan (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        ID_Barang INTEGER,
        Durasi INTEGER,
        FOREIGN KEY (ID_Barang) REFERENCES barang(ID) ON DELETE CASCADE
    )
    ''')

    # Membuat tabel riwayat kerusakan
    c.execute('''
    CREATE TABLE IF NOT EXISTS Riwayat_Kerusakan (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        ID_Barang INTEGER,
        Tanggal TIMESTAMP,
        Deskripsi TEXT,
        Gardu TEXT,
        FOREIGN KEY (ID_Barang) REFERENCES barang(ID) ON DELETE CASCADE
    )
    ''')

    # Membuat tabel riwayat perbaikan
    c.execute('''
    CREATE TABLE IF NOT EXISTS Riwayat_Perbaikan (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        ID_Barang INTEGER,
        Tanggal TIMESTAMP,
        Deskripsi TEXT,
        Gardu TEXT,
        FOREIGN KEY (ID_Barang) REFERENCES barang(ID) ON DELETE CASCADE
    )
    ''')
    conn.commit()

    # Data untuk dropdown
    nama_barang_options = ['SEMUA', 'TCT', 'LTS', 'READER', 'ALB', 'LPR', 'CDF/TFI', 'OBS', 'CCTV LAJUR', 'CCTV GANDAR', 'LLA', 'MONITOR GTO', 'AVC']
    gerbang_options = ['SEMUA', 'CISALAK 1', 'CISALAK 2', 'CISALAK 3', 'MARGONDA 1', 'MARGONDA 2', 'KUKUSAN 1', 'KUKUSAN 2', 'KRUKUT 3', 'KRUKUT 4', 'KRUKUT 5', 'LIMO 1A', 'LIMO 1B', 'LIMO 2A', 'LIMO 2B', 'LIMO UTAMA 1', 'LIMO UTAMA 2']
    gardu_kondisi = {
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
        'LIMO UTAMA 2': ['02', '04', '06', '08', '10', '12', '14', 'MR']
    }

    # Fungsi untuk mengecek dan memperbarui status
    def check_and_update_status():
        current_time = datetime.now(jakarta_tz)

        # Update status Monitor ke Normal
        execute_query('''
        UPDATE barang
        SET Status = 'Normal', Last_Update = ?
        WHERE Status = 'Monitor' AND Last_Update < ? AND Last_Update IS NOT NULL
        ''', (current_time, current_time - timedelta(hours=24)))
        
        # Mendapatkan item yang diupdate dari Monitor ke Normal
        updated_items = execute_query('''
        SELECT ID, Nama, Gerbang, Gardu
        FROM barang
        WHERE Status = 'Normal' AND Last_Update = ?
        ''', (current_time,))
        
        # Mendapatkan item yang baru saja diupdate menjadi Kendala
        new_kendala_items = execute_query('''
        SELECT ID, Nama, Gerbang, Gardu, Deskripsi
        FROM barang
        WHERE Status = 'Kendala' AND Last_Update > ?
        ''', (current_time - timedelta(seconds=10),))

        # Kirim email untuk setiap item yang baru saja menjadi Kendala
        for item in new_kendala_items:
            id_barang, nama_barang, gerbang, gardu, deskripsi = item
            subjek = f"Kendala pada {nama_barang} di Gerbang {gerbang} Gardu {gardu}"
            pesan = f"Terdapat kendala pada {nama_barang} di Gerbang {gerbang}, Gardu {gardu}. Deskripsi kendala: {deskripsi}. Mohon segera ditindaklanjuti untuk memastikan operasional berjalan dengan baik. Terima kasih atas perhatian dan tindak lanjutnya. (https://sistem-pemeliharaan-alat-tol-cijago.streamlit.app/)"
            kirim_email(email_penerima, subjek, pesan)  # Kirim ke beberapa penerima

        return updated_items, new_kendala_items

    def calculate_repair_duration(riwayat_kerusakan, riwayat_perbaikan):
        durations = []
        for i in range(min(len(riwayat_kerusakan), len(riwayat_perbaikan))):
            try:
                tanggal_kerusakan = pd.to_datetime(riwayat_kerusakan.iloc[i]['Tanggal'])
                tanggal_perbaikan = pd.to_datetime(riwayat_perbaikan.iloc[i]['Tanggal'])
                
                duration_seconds = (tanggal_perbaikan - tanggal_kerusakan).total_seconds()
                
                # Konversi detik ke hari, jam, menit, dan detik
                formatted_duration = convert_seconds(duration_seconds)
                
                durations.append(formatted_duration)
            except Exception as e:
                st.error(f"Error calculating duration for row {i}: {e}. Kerusakan: {riwayat_kerusakan.iloc[i]['Tanggal']}, Perbaikan: {riwayat_perbaikan.iloc[i]['Tanggal']}")
                durations.append("N/A")  # Append "N/A" if there's an error

        return durations
    def delete_daily_report_entry(entry_id):
        c.execute("DELETE FROM daily_report WHERE id = ?", (entry_id,))
        conn.commit()
    
    def convert_seconds(duration_seconds):
        days, remainder = divmod(duration_seconds, 86400)  # 86400 detik dalam satu hari
        hours, remainder = divmod(remainder, 3600)  # 3600 detik dalam satu jam
        minutes, seconds = divmod(remainder, 60)  # 60 detik dalam satu menit
        
        formatted_duration = f"{int(days)} hari {int(hours)} jam {int(minutes)} menit {int(seconds)} detik"
        return formatted_duration
        
    st.title("Sistem Informasi Pemeliharaan Alat TOL Cijago")
    # Tab 1: Data Barang
    tab1, tab2, tab3 = st.tabs(["Data Barang", "Update Barang", "Laporan Harian"])

    with tab1:
        st.header("Daftar Semua Barang")
        
        # Cek dan update status
        updated_items, new_kendala_items = check_and_update_status()
        if updated_items:
            for item in updated_items:
                st.info(f"Barang {item[1]} di Gerbang {item[2]} Gardu {item[3]} telah diupdate dari 'Monitor' ke status 'Normal'.")
        
        if new_kendala_items:
            for item in new_kendala_items:
                st.warning(f"Barang {item[1]} di Gerbang {item[2]} Gardu {item[3]} mengalami 'Kendala'.")

        # Dropdown untuk memilih barang
        selected_barang = st.selectbox("Pilih Nama Barang", nama_barang_options, key="nama_barang")
        selected_gerbang = st.selectbox("Pilih Gerbang", gerbang_options, key="gerbang")
        
        gardu_options = ['SEMUA']
        if selected_gerbang != 'SEMUA':
            gardu_options += gardu_kondisi[selected_gerbang]
        selected_gardu = st.selectbox("Pilih Gardu", gardu_options, key="gardu")

        # Dropdown untuk memilih status
        selected_status = st.selectbox("Pilih Status", ["SEMUA", "Kendala", "Perbaikan", "Monitor", "Normal"], key="status_filter")
        

        # Ambil data dari tabel barang dengan filter
        query_barang = "SELECT * FROM barang WHERE 1=1"
        params = []

        if selected_barang != 'SEMUA':
            query_barang += " AND Nama = ?"
            params.append(selected_barang)
        
        if selected_gerbang != 'SEMUA':
            query_barang += " AND Gerbang = ?"
            params.append(selected_gerbang)
        
        if selected_gardu != 'SEMUA':
            query_barang += " AND Gardu = ?"
            params.append(selected_gardu)
        
        if selected_status != 'SEMUA':
            query_barang += " AND Status = ?"
            params.append(selected_status)

        barang_data = pd.read_sql(query_barang, conn, params=params)

        # Fungsi untuk mewarnai baris berdasarkan status
        def color_status(val):
            if val == 'Kendala':
                return 'background-color: red'
            elif val == 'Perbaikan':
                return 'background-color: yellow'
            elif val == 'Monitor':
                return 'background-color: orange'
            elif val == 'Normal':
                return 'background-color: green'
            return ''

        # Tampilkan tabel barang dengan warna latar belakang
        st.dataframe(barang_data.style.applymap(color_status, subset=['Status']), use_container_width=True)

        # Membuat kolom untuk tombol
        col1, col2, col3 = st.columns(3)
    
        with col1:
            if st.button("Lihat Detail"):
                if selected_barang != 'SEMUA' and selected_gerbang != 'SEMUA' and selected_gardu != 'SEMUA':
                    # Ambil ID barang yang dipilih
                    barang_id = c.execute("SELECT ID FROM barang WHERE Nama = ? AND Gerbang = ? AND Gardu = ?", 
                                          (selected_barang, selected_gerbang, selected_gardu)).fetchone()

                    if barang_id:
                        # Ambil riwayat kerusakan dan perbaikan berdasarkan ID_Barang
                        # Tampilkan tabel riwayat kerusakan
                        st.subheader("Riwayat Kerusakan")
                        riwayat_kerusakan = pd.read_sql(f"SELECT * FROM Riwayat_Kerusakan WHERE ID_Barang = {barang_id[0]}", conn)
                        riwayat_kerusakan['Tanggal'] = pd.to_datetime(riwayat_kerusakan['Tanggal'])
                        st.dataframe(riwayat_kerusakan)

                        # Tampilkan tabel riwayat perbaikan
                        st.subheader("Riwayat Perbaikan")
                        riwayat_perbaikan = pd.read_sql(f"SELECT * FROM Riwayat_Perbaikan WHERE ID_Barang = {barang_id[0]}", conn)
                        riwayat_perbaikan['Tanggal'] = pd.to_datetime(riwayat_perbaikan['Tanggal'])
                        st.dataframe(riwayat_perbaikan)

                        # Tampilkan tabel durasi perbaikan
                        st.subheader("Durasi Perbaikan")
                        durations = calculate_repair_duration(riwayat_kerusakan, riwayat_perbaikan)
                        
                        if durations:
                            durasi_df = pd.DataFrame({
                                'ID': [barang_id[0]] * len(durations),
                                'Durasi': durations
                            })

                            st.dataframe(durasi_df)

                            # Simpan durasi perbaikan ke dalam tabel Durasi_Perbaikan
                            for durasi in durations:
                                if durasi is not None:
                                    c.execute("INSERT INTO Durasi_Perbaikan (ID_Barang, Durasi) VALUES (?, ?)", 
                                              (barang_id[0], durasi))
                                    conn.commit()
                            pdf_buffer = create_pdf(riwayat_kerusakan, riwayat_perbaikan, durasi_df, 
                                                    selected_barang, selected_gerbang, selected_gardu)
                            file_name = f"Riwayat {selected_barang} di gerbang {selected_gerbang} gardu {selected_gardu}.pdf"
                            st.download_button(
                                label="Download PDF",
                                data=pdf_buffer,
                                file_name=file_name,
                                mime="application/pdf"
                            )
                        else:
                            st.warning("Tidak ada data durasi perbaikan yang dapat dihitung.")
                    else:
                        st.warning("Barang tidak ditemukan.")
                else:
                    st.warning("Silakan pilih barang, gerbang, dan gardu yang spesifik untuk melihat detail.")

        with col2:
            with st.popover("Hapus Barang"):
                st.write("Apakah Anda yakin ingin menghapus barang ini?")
                if st.button("Ya, Hapus Barang"):
                    if selected_barang != 'SEMUA' and selected_gerbang != 'SEMUA' and selected_gardu != 'SEMUA':
                        # Hapus barang yang dipilih beserta riwayat terkait
                        c.execute("DELETE FROM barang WHERE Nama = ? AND Gerbang = ? AND Gardu = ?", 
                                (selected_barang, selected_gerbang, selected_gardu))
                        conn.commit()
                        st.success(f"Barang '{selected_barang}' di {selected_gerbang} gardu {selected_gardu} berhasil dihapus!")
                        st.rerun()
                    else:
                        st.warning("Silakan pilih barang, gerbang, dan gardu yang spesifik untuk dihapus.")

            with col3:  # Menggunakan kolom ketiga
                with st.popover("Hapus Riwayat"):
                    st.write("Apakah Anda yakin ingin menghapus riwayat barang ini?")
                    if st.button("Ya, Hapus Riwayat"):
                        if selected_barang != 'SEMUA' and selected_gerbang != 'SEMUA' and selected_gardu != 'SEMUA':
                            # Ambil ID barang yang dipilih
                            barang_id = c.execute("SELECT ID FROM barang WHERE Nama = ? AND Gerbang = ? AND Gardu = ?", 
                                                (selected_barang, selected_gerbang, selected_gardu)).fetchone()
                            if barang_id:
                                # Hapus riwayat kerusakan dan perbaikan berdasarkan ID_Barang
                                c.execute("DELETE FROM Riwayat_Kerusakan WHERE ID_Barang = ?", (barang_id[0],))
                                c.execute("DELETE FROM Riwayat_Perbaikan WHERE ID_Barang = ?", (barang_id[0],))
                                c.execute("DELETE FROM Durasi_Perbaikan WHERE ID_Barang = ?", (barang_id[0],))
                                
                                # Reset sequence untuk setiap tabel
                                reset_sequence('Riwayat_Kerusakan')
                                reset_sequence('Riwayat_Perbaikan')
                                reset_sequence('Durasi_Perbaikan')
                                
                                conn.commit()
                                st.success(f"Riwayat untuk barang '{selected_barang}' di {selected_gerbang} gardu {selected_gardu} berhasil dihapus dan ID direset!")
                                st.rerun()
                            else:
                                st.warning("Barang tidak ditemukan.")
                        else:
                            st.warning("Silakan pilih barang, gerbang, dan gardu yang spesifik untuk menghapus riwayat.")

    with tab2:
        st.header("Update Barang")
        nama_barang_update = st.selectbox("Pilih Nama Barang", nama_barang_options[1:], key="nama_barang_update")
        gerbang_update = st.selectbox("Pilih Gerbang", gerbang_options[1:], key="gerbang_update")
        gardu_update = st.selectbox("Pilih Gardu", gardu_kondisi[gerbang_update], key="gardu_update")

        today = datetime.now(jakarta_tz).date()
        tanggal = st.date_input("Tanggal", today, min_value=today, key="tanggal")
        deskripsi = st.text_input("Deskripsi", key="deskripsi")

        shift = st.selectbox("Pilih Shift", [1, 2, 3], key="shift")

        warna = st.selectbox("Pilih Status", options=["Kendala", "Perbaikan", "Monitor", "Normal"], key="status_update")    

        if warna == "Kendala":
            st.markdown('<div style="background-color: red; color: white; padding: 10px; border-radius: 5px;">Kendala</div>', unsafe_allow_html=True)
        elif warna == "Perbaikan":
            st.markdown('<div style="background-color: yellow; color: black; padding: 10px; border-radius: 5px;">Perbaikan</div>', unsafe_allow_html=True)
        elif warna == "Monitor":
            st.markdown('<div style="background-color: orange; color: black; padding: 10px; border-radius: 5px;">Monitor</div>', unsafe_allow_html=True)
        elif warna == "Normal":
            st.markdown('<div style="background-color: green; color: white; padding: 10px; border-radius: 5px;">Normal</div>', unsafe_allow_html=True)

        if st.button("Update Data"):
            current_time = datetime.now(jakarta_tz)
            # Cek apakah barang sudah ada
            existing_entry = c.execute("SELECT * FROM barang WHERE Nama = ? AND Gerbang = ? AND Gardu = ?", 
                                        (nama_barang_update, gerbang_update, gardu_update)).fetchone()
            
            if existing_entry:
                current_status = existing_entry[6]  # Status saat ini
            
                # Logika pemilihan status
                if current_status == "Normal":
                    if warna == "Normal":
                        st.warning("Barang ini telah dalam status normal.")
                        st.stop()
                    elif warna in ["Perbaikan", "Monitor"]:
                        st.warning("Barang yang normal tidak bisa langsung ditandai sebagai perbaikan atau monitor.")
                        st.stop()
                    # Bisa pilih Kendala
                elif current_status == "Kendala":
                    if warna == "Kendala":
                        st.warning("Barang ini telah dilaporkan kendala.")
                        st.stop()
                    elif warna in ["Normal", "Monitor"]:
                        st.warning("Barang yang kendala tidak bisa langsung ditandai sebagai normal atau monitor.")
                        st.stop()
                    # Bisa pilih Perbaikan
                elif current_status == "Perbaikan":
                    if warna == "Perbaikan":
                        st.warning("Barang yang sedang diperbaiki tidak bisa ditandai sebagai perbaikan kembali.")
                        st.stop()
                    elif warna == "Normal":
                        st.warning("Barang yang sedang diperbaiki tidak bisa langsung ditandai sebagai normal.")
                        st.stop()
                    elif warna == "Kendala":
                        st.warning("Barang yang sedang diperbaiki tidak bisa ditandai sebagai kendala.")
                        st.stop()
                    # Bisa pilih Monitor
                elif current_status == "Monitor":
                    if warna == "Monitor":
                        st.warning("Barang yang sedang dimonitor tidak bisa ditandai sebagai monitor kembali.")
                        st.stop()
                    elif warna == "Perbaikan":
                        st.warning("Barang yang sedang dimonitor tidak bisa langsung ditandai sebagai perbaikan.")
                        st.stop()
                
                # Jika lolos pengecekan logika, lakukan update
                c.execute("""
                UPDATE barang 
                SET Tanggal_Pelaporan = ?, Deskripsi = ?, Status = ?, Last_Update = ?, Shift = ?
                WHERE Nama = ? AND Gerbang = ? AND Gardu = ?
                """, (tanggal.strftime("%Y-%m-%d"), deskripsi, warna, current_time.strftime("%Y-%m-%d %H:%M:%S"),
                      shift, nama_barang_update, gerbang_update, gardu_update))
                
                barang_id = existing_entry[0]
            else:
                # Insert new entry
                c.execute("""
                INSERT INTO barang 
                (Nama, Gerbang, Gardu, Tanggal_Pelaporan, Deskripsi, Status, Last_Update, Shift) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (nama_barang_update, gerbang_update, gardu_update, 
                      tanggal.strftime("%Y-%m-%d %H:%M:%S"), deskripsi, warna, current_time.strftime("%Y-%m-%d %H:%M:%S"), shift))
                
                barang_id = c.lastrowid

            # Update atau tambahkan ke tabel riwayat kerusakan atau perbaikan
            last_id = c.lastrowid if not existing_entry else existing_entry[0]
            current_time_str = current_time.strftime("%Y-%m-%d %H:%M:%S")

            if warna == "Kendala":
                c.execute("INSERT INTO Riwayat_Kerusakan (ID_Barang, Tanggal, Deskripsi, Gardu) VALUES (?, ?, ?, ?)", 
                        (last_id, current_time_str, deskripsi, gardu_update))
                
                c.execute("""
                INSERT INTO Laporan_Harian (ID_Barang, Gerbang, Gardu, Deskripsi, Tanggal, Shift)
                VALUES (?, ?, ?, ?, ?, ?)
                """, (last_id, gerbang_update, gardu_update, deskripsi, tanggal.strftime("%Y-%m-%d"), shift))
                
            elif warna == "Monitor":
                c.execute("INSERT INTO Riwayat_Perbaikan (ID_Barang, Tanggal, Deskripsi, Gardu) VALUES (?, ?, ?, ?)", 
                        (last_id, current_time_str, deskripsi, gardu_update))
            
            if warna == "Kendala":
                existing_report = c.execute("""
                SELECT * FROM daily_report 
                WHERE id_barang = ? AND DATE(tanggal) = ? AND shift = ?
                """, (barang_id, tanggal.strftime("%Y-%m-%d"), shift)).fetchone()

                if not existing_report:
                    # If not in daily_report, add it
                    c.execute("""
                    INSERT INTO daily_report (id_barang, gerbang, gardu, deskripsi, tanggal, shift)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """, (barang_id, gerbang_update, gardu_update, deskripsi, tanggal.strftime("%Y-%m-%d"), shift))
            conn.commit()
            st.success("Data berhasil diupdate!")
            st.rerun()

    with tab3:
        st.header("Laporan Harian")

        # Date and shift selection
        report_date = st.date_input("Pilih Tanggal", today, key="report_date")
        report_shift = st.selectbox("Pilih Shift", [1, 2, 3], key="report_shift")

        # Fetch and display the daily report
        
        daily_report_query = """
        SELECT dr.id, b.Nama as nama_barang, dr.gerbang, dr.gardu, dr.deskripsi, dr.tanggal, dr.shift
        FROM daily_report dr
        JOIN barang b ON dr.id_barang = b.ID
        WHERE DATE(dr.tanggal) = ? AND dr.shift = ?
        """
        daily_report = pd.read_sql(daily_report_query, conn, params=(report_date.strftime("%Y-%m-%d"), report_shift))

        if not daily_report.empty:
            st.dataframe(daily_report)

            # Tombol Download PDF
            
            pdf_bytes = create_pdff(daily_report, report_date, report_shift)
            st.download_button(
                label="Download PDF",
                data=pdf_bytes,
                file_name=f"Laporan_Harian_{report_date}_{report_shift}.pdf",
                mime="application/pdf"
                )

            # Loop untuk setiap baris dalam laporan harian dan menampilkan tombol hapus
            for index, row in daily_report.iterrows():
                if st.button(f"Hapus Data ID: {row['id']}", key=f"delete_{row['id']}"):
                    delete_daily_report_entry(row['id'])
                    st.success(f"Data dengan ID {row['id']} berhasil dihapus.")
                    st.rerun()  # Mereload halaman setelah data dihapus

        else:
            st.info("Tidak ada data untuk tanggal dan shift yang dipilih.")
    st.markdown(
        """
        <style>
        .logout-button {
            position: fixed;
            left: 15px;
            bottom: 15px;
        }
        </style>
        """,
        unsafe_allow_html=True
    )
    
    logout_placeholder = st.empty()
    with logout_placeholder.container():
        if st.button("Logout", key="logout_button"):
            st.session_state.logged_in = False
            st.rerun()
    # Tutup koneksi database
    conn.close()

# Fungsi utama
def main():
    if "logged_in" not in st.session_state:
        st.session_state.logged_in = False

    if not st.session_state.logged_in:
        login_page()
    else:
        main_app()

if __name__ == "__main__":
    st.set_page_config(page_title="Sistem Informasi Pemeliharaan Alat TOL Cijago", layout="wide")
    main()
    
