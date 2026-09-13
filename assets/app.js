/**
 * SALAM WATER - JAVASCRIPT CONTROLLER (VANILLA JS)
 * Fitur: AJAX Fetch API, Realtime Calculation, Responsive Tabs, Print Ready
 * File: assets/app.js
 */

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

const App = {
    // State aplikasi
    state: {
        currentTab: 'dashboard',
        categories: [],
        filterPeriod: 'bulan_ini',
        reportStartDate: '',
        reportEndDate: ''
    },

    // Inisialisasi awal
    init() {
        this.initDates();
        this.initTabs();
        this.initLiveClock();
        this.initSalesCalculations();
        this.initExpenseForm();
        this.initReportFilters();
        this.initPresets();
        
        // Muat data awal
        this.loadCategories();
        this.loadDashboardData();
        this.loadPenjualanList();
        this.loadPengeluaranList();
        this.loadLaporanData();
    },

    // Format Rupiah (IDR)
    formatRupiah(nominal) {
        const num = parseFloat(nominal) || 0;
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(num);
    },

    // Format Tanggal Indonesia (DD MMMM YYYY)
    formatTanggal(dateString) {
        if (!dateString) return '-';
        const parts = dateString.split('-');
        if (parts.length === 3) {
            const months = [
                'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
            ];
            const day = parseInt(parts[2], 10);
            const monthIdx = parseInt(parts[1], 10) - 1;
            const year = parts[0];
            return `${day} ${months[monthIdx]} ${year}`;
        }
        return dateString;
    },

    // Inisialisasi Tanggal Default
    initDates() {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;
        const firstDayMonthStr = `${yyyy}-${mm}-01`;

        this.state.reportStartDate = firstDayMonthStr;
        this.state.reportEndDate = todayStr;

        // Pasang tanggal hari ini pada input tanggal form
        const inputTglJual = document.getElementById('penjualan-tanggal');
        const inputTglKeluar = document.getElementById('pengeluaran-tanggal');
        const filterStart = document.getElementById('filter-start-date');
        const filterEnd = document.getElementById('filter-end-date');

        if (inputTglJual) inputTglJual.value = todayStr;
        if (inputTglKeluar) inputTglKeluar.value = todayStr;
        if (filterStart) filterStart.value = firstDayMonthStr;
        if (filterEnd) filterEnd.value = todayStr;
    },

    // Jam & Tanggal Aktif Header
    initLiveClock() {
        const clockEl = document.getElementById('live-clock-badge');
        if (!clockEl) return;

        const updateTime = () => {
            const now = new Date();
            const options = { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'short', 
                year: 'numeric' 
            };
            const dateStr = now.toLocaleDateString('id-ID', options);
            clockEl.innerHTML = `📅 ${dateStr}`;
        };

        updateTime();
        setInterval(updateTime, 60000);
    },

    // Navigasi Tab
    initTabs() {
        const tabButtons = document.querySelectorAll('.nav-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.tab;
                this.switchTab(target);
            });
        });
    },

    switchTab(tabId) {
        this.state.currentTab = tabId;

        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });

        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === `pane-${tabId}`);
        });

        // Trigger refresh data saat tab dibuka
        if (tabId === 'dashboard') {
            this.loadDashboardData();
        } else if (tabId === 'penjualan') {
            this.loadPenjualanList();
        } else if (tabId === 'pengeluaran') {
            this.loadPengeluaranList();
        } else if (tabId === 'laporan') {
            this.loadLaporanData();
        }
    },

    // ==========================================================
    // NOTIFIKASI TOAST
    // ==========================================================
    showToast(message, type = 'success') {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️');
        toast.innerHTML = `<span>${icon}</span> <div>${message}</div>`;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3200);
    },

    // ==========================================================
    // LOAD KATEGORI DARI API
    // ==========================================================
    async loadCategories() {
        try {
            const res = await fetch('api/transaksi.php?type=kategori');
            const result = await res.json();
            if (result.success && Array.isArray(result.data)) {
                this.state.categories = result.data;
                const selectEl = document.getElementById('pengeluaran-kategori');
                if (selectEl) {
                    selectEl.innerHTML = '<option value="">-- Pilih Kategori --</option>' + 
                        result.data.map(cat => `<option value="${cat.id}">${cat.nama_kategori}</option>`).join('');
                }
            }
        } catch (err) {
            console.error('Gagal mengambil kategori:', err);
        }
    },

    // ==========================================================
    // FORM PENJUALAN & KALKULASI REALTIME
    // ==========================================================
    initSalesCalculations() {
        const form = document.getElementById('form-penjualan');
        const jenisSelect = document.getElementById('penjualan-jenis');
        const jumlahInput = document.getElementById('penjualan-jumlah');
        const hargaInput = document.getElementById('penjualan-harga');
        const totalDisplay = document.getElementById('penjualan-total-display');

        const calculateTotal = () => {
            const qty = parseInt(jumlahInput.value, 10) || 0;
            const price = parseFloat(hargaInput.value) || 0;
            const total = qty * price;
            if (totalDisplay) {
                totalDisplay.textContent = this.formatRupiah(total);
            }
        };

        if (jumlahInput) jumlahInput.addEventListener('input', calculateTotal);
        if (hargaInput) hargaInput.addEventListener('input', calculateTotal);

        // Auto ganti default harga ketika jenis transaksi berganti
        if (jenisSelect) {
            jenisSelect.addEventListener('change', () => {
                if (jenisSelect.value === 'isi_ulang') {
                    hargaInput.value = '5000';
                } else if (jenisSelect.value === 'galon_baru') {
                    hargaInput.value = '65000';
                }
                calculateTotal();
            });
        }

        // Handle Submit Form Penjualan
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitBtn = form.querySelector('button[type="submit"]');
                submitBtn.disabled = true;
                submitBtn.innerHTML = '⏳ Menyimpan...';

                const payload = {
                    tanggal: document.getElementById('penjualan-tanggal').value,
                    jenis_transaksi: document.getElementById('penjualan-jenis').value,
                    jumlah_galon: parseInt(document.getElementById('penjualan-jumlah').value, 10),
                    harga_satuan: parseFloat(document.getElementById('penjualan-harga').value),
                    metode_pembayaran: document.getElementById('penjualan-metode').value,
                    catatan: document.getElementById('penjualan-catatan').value
                };

                try {
                    const res = await fetch('api/transaksi.php?type=penjualan', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const result = await res.json();

                    if (result.success) {
                        this.showToast('Transaksi penjualan berhasil dicatat!');
                        // Reset input kecuali tanggal
                        document.getElementById('penjualan-jumlah').value = '1';
                        document.getElementById('penjualan-catatan').value = '';
                        calculateTotal();
                        
                        this.loadPenjualanList();
                        this.loadDashboardData();
                    } else {
                        this.showToast(result.message || 'Gagal menyimpan transaksi.', 'error');
                    }
                } catch (err) {
                    this.showToast('Terjadi kesalahan jaringan.', 'error');
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '💾 Simpan Transaksi Penjualan';
                }
            });
        }
    },

    // Tombol Preset Harga dan Kuantitas
    initPresets() {
        // Preset Kuantitas Galon
        document.querySelectorAll('.btn-preset-qty').forEach(btn => {
            btn.addEventListener('click', () => {
                const addQty = parseInt(btn.dataset.qty, 10);
                const input = document.getElementById('penjualan-jumlah');
                if (btn.dataset.mode === 'set') {
                    input.value = addQty;
                } else {
                    const current = parseInt(input.value, 10) || 0;
                    input.value = current + addQty;
                }
                input.dispatchEvent(new Event('input'));
            });
        });

        // Preset Harga Satuan (5000, 6000, 22000, 65000)
        document.querySelectorAll('.btn-preset-price').forEach(btn => {
            btn.addEventListener('click', () => {
                const price = parseFloat(btn.dataset.price);
                const input = document.getElementById('penjualan-harga');
                const jenisSelect = document.getElementById('penjualan-jenis');
                
                input.value = price;
                if (jenisSelect) {
                    if (price <= 6000) {
                        jenisSelect.value = 'isi_ulang';
                    } else {
                        jenisSelect.value = 'galon_baru';
                    }
                }
                input.dispatchEvent(new Event('input'));
            });
        });
    },

    // ==========================================================
    // FORM PENGELUARAN OPERASIONAL
    // ==========================================================
    initExpenseForm() {
        const form = document.getElementById('form-pengeluaran');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '⏳ Menyimpan...';

            const payload = {
                tanggal: document.getElementById('pengeluaran-tanggal').value,
                id_kategori: parseInt(document.getElementById('pengeluaran-kategori').value, 10),
                nominal: parseFloat(document.getElementById('pengeluaran-nominal').value),
                catatan: document.getElementById('pengeluaran-catatan').value
            };

            try {
                const res = await fetch('api/transaksi.php?type=pengeluaran', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await res.json();

                if (result.success) {
                    this.showToast('Pengeluaran operasional berhasil dicatat!');
                    document.getElementById('pengeluaran-nominal').value = '';
                    document.getElementById('pengeluaran-catatan').value = '';
                    
                    this.loadPengeluaranList();
                    this.loadDashboardData();
                } else {
                    this.showToast(result.message || 'Gagal menyimpan pengeluaran.', 'error');
                }
            } catch (err) {
                this.showToast('Terjadi kesalahan jaringan.', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '💾 Simpan Pengeluaran';
            }
        });
    },

    // ==========================================================
    // LOAD DATA PENJUALAN (TAB PENJUALAN)
    // ==========================================================
    async loadPenjualanList() {
        const tbody = document.getElementById('tbody-penjualan');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 2rem;">Memuat data penjualan...</td></tr>';

        try {
            const res = await fetch('api/transaksi.php?type=penjualan&limit=50');
            const result = await res.json();

            if (result.success && result.data.length > 0) {
                tbody.innerHTML = result.data.map((item, idx) => {
                    const badgeJenis = item.jenis_transaksi === 'isi_ulang'
                        ? '<span class="badge badge-isi-ulang">💧 Isi Ulang</span>'
                        : '<span class="badge badge-galon-baru">🪣 Galon Baru</span>';

                    const badgeMetode = `<span class="badge badge-${item.metode_pembayaran}">${item.metode_pembayaran.toUpperCase()}</span>`;

                    return `
                        <tr>
                            <td>${idx + 1}</td>
                            <td><strong>${this.formatTanggal(item.tanggal)}</strong></td>
                            <td>${badgeJenis}</td>
                            <td><strong>${item.jumlah_galon}</strong> galon</td>
                            <td>${this.formatRupiah(item.harga_satuan)}</td>
                            <td><strong class="text-masuk">${this.formatRupiah(item.total)}</strong></td>
                            <td>${badgeMetode}</td>
                            <td>${item.catatan || '-'}</td>
                            <td class="action-col">
                                <button class="btn btn-sm btn-danger-outline" onclick="App.deletePenjualan(${item.id})">
                                    🗑️ Hapus
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');
            } else {
                tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 2rem; color: #64748b;">Belum ada riwayat transaksi penjualan.</td></tr>';
            }
        } catch (err) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 2rem; color: #ef4444;">Gagal memuat data penjualan.</td></tr>';
        }
    },

    // Hapus Penjualan
    async deletePenjualan(id) {
        if (!confirm('Apakah Anda yakin ingin menghapus data penjualan ini?')) return;

        try {
            const res = await fetch(`api/transaksi.php?type=penjualan&id=${id}`, {
                method: 'DELETE'
            });
            const result = await res.json();

            if (result.success) {
                this.showToast('Data penjualan berhasil dihapus.');
                this.loadPenjualanList();
                this.loadDashboardData();
            } else {
                this.showToast(result.message || 'Gagal menghapus.', 'error');
            }
        } catch (err) {
            this.showToast('Gagal terhubung ke server.', 'error');
        }
    },

    // ==========================================================
    // LOAD DATA PENGELUARAN (TAB PENGELUARAN)
    // ==========================================================
    async loadPengeluaranList() {
        const tbody = document.getElementById('tbody-pengeluaran');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">Memuat data pengeluaran...</td></tr>';

        try {
            const res = await fetch('api/transaksi.php?type=pengeluaran&limit=50');
            const result = await res.json();

            if (result.success && result.data.length > 0) {
                tbody.innerHTML = result.data.map((item, idx) => {
                    return `
                        <tr>
                            <td>${idx + 1}</td>
                            <td><strong>${this.formatTanggal(item.tanggal)}</strong></td>
                            <td><span class="badge" style="background:#f1f5f9; color:#334155;">📁 ${item.nama_kategori}</span></td>
                            <td><strong class="text-keluar">${this.formatRupiah(item.nominal)}</strong></td>
                            <td>${item.catatan || '-'}</td>
                            <td class="action-col">
                                <button class="btn btn-sm btn-danger-outline" onclick="App.deletePengeluaran(${item.id})">
                                    🗑️ Hapus
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');
            } else {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem; color: #64748b;">Belum ada riwayat pengeluaran operasional.</td></tr>';
            }
        } catch (err) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem; color: #ef4444;">Gagal memuat data pengeluaran.</td></tr>';
        }
    },

    // Hapus Pengeluaran
    async deletePengeluaran(id) {
        if (!confirm('Apakah Anda yakin ingin menghapus data pengeluaran ini?')) return;

        try {
            const res = await fetch(`api/transaksi.php?type=pengeluaran&id=${id}`, {
                method: 'DELETE'
            });
            const result = await res.json();

            if (result.success) {
                this.showToast('Data pengeluaran berhasil dihapus.');
                this.loadPengeluaranList();
                this.loadDashboardData();
            } else {
                this.showToast(result.message || 'Gagal menghapus.', 'error');
            }
        } catch (err) {
            this.showToast('Gagal terhubung ke server.', 'error');
        }
    },

    // ==========================================================
    // DASHBOARD RINGKASAN DATA
    // ==========================================================
    async loadDashboardData() {
        try {
            const res = await fetch('api/laporan.php?action=dashboard');
            const result = await res.json();

            if (!result.success || !result.data) return;
            const data = result.data;

            // 1. Pemasukan Hari Ini & Bulan Ini
            const omzetHariIniEl = document.getElementById('dash-omzet-today');
            const omzetBulanIniEl = document.getElementById('dash-omzet-month');
            const omzetTahunIniEl = document.getElementById('dash-omzet-year');

            if (omzetHariIniEl) omzetHariIniEl.textContent = this.formatRupiah(data.hari_ini.omzet);
            if (omzetBulanIniEl) omzetBulanIniEl.textContent = this.formatRupiah(data.bulan_ini.omzet);
            if (omzetTahunIniEl) omzetTahunIniEl.textContent = this.formatRupiah(data.tahun_ini.omzet);

            // 2. Galon Terjual
            const galonTodayEl = document.getElementById('dash-galon-today');
            const galonBreakdownEl = document.getElementById('dash-galon-breakdown');
            if (galonTodayEl) galonTodayEl.textContent = `${data.hari_ini.galon_terjual} Galon`;
            if (galonBreakdownEl) {
                galonBreakdownEl.textContent = `Bulan ini: ${data.bulan_ini.galon_isi_ulang} Isi Ulang | ${data.bulan_ini.galon_baru} Galon Baru`;
            }

            // 3. Pengeluaran Operasional
            const keluarTodayEl = document.getElementById('dash-expense-today');
            const keluarMonthEl = document.getElementById('dash-expense-month');
            if (keluarTodayEl) keluarTodayEl.textContent = this.formatRupiah(data.hari_ini.pengeluaran);
            if (keluarMonthEl) keluarMonthEl.textContent = `Bulan Ini: ${this.formatRupiah(data.bulan_ini.pengeluaran)}`;

            // 4. Laba Bersih
            const labaTodayEl = document.getElementById('dash-profit-today');
            const labaMonthEl = document.getElementById('dash-profit-month');
            const cardProfit = document.getElementById('card-profit');

            if (labaTodayEl) {
                labaTodayEl.textContent = this.formatRupiah(data.hari_ini.laba_bersih);
            }
            if (labaMonthEl) {
                const statusStr = data.bulan_ini.laba_bersih >= 0 ? 'Surplus' : 'Defisit';
                labaMonthEl.textContent = `Bulan Ini: ${this.formatRupiah(data.bulan_ini.laba_bersih)} (${statusStr})`;
            }

            // Warna kartu laba bersih
            if (cardProfit) {
                cardProfit.classList.remove('card-success', 'card-danger');
                cardProfit.classList.add(data.hari_ini.laba_bersih >= 0 ? 'card-success' : 'card-danger');
            }

            // 5. Breakdown Kategori Pengeluaran Bulan Ini
            const listKategoriEl = document.getElementById('dash-breakdown-kategori');
            if (listKategoriEl && Array.isArray(data.kategori_pengeluaran_bulan_ini)) {
                const totalBulanKeluar = data.bulan_ini.pengeluaran || 1;
                
                if (data.kategori_pengeluaran_bulan_ini.length === 0 || data.bulan_ini.pengeluaran === 0) {
                    listKategoriEl.innerHTML = '<li style="color:#94a3b8; font-size:0.85rem;">Belum ada pengeluaran di bulan ini.</li>';
                } else {
                    listKategoriEl.innerHTML = data.kategori_pengeluaran_bulan_ini
                        .filter(item => parseFloat(item.total_nominal) > 0)
                        .map(item => {
                            const pct = Math.round((parseFloat(item.total_nominal) / totalBulanKeluar) * 100);
                            return `
                                <li class="breakdown-item">
                                    <div class="breakdown-meta">
                                        <span class="breakdown-name">${item.nama_kategori}</span>
                                        <span class="breakdown-amount">${this.formatRupiah(item.total_nominal)} (${pct}%)</span>
                                    </div>
                                    <div class="progress-bar-bg">
                                        <div class="progress-bar-fill" style="width: ${pct}%;"></div>
                                    </div>
                                </li>
                            `;
                        }).join('');
                }
            }

            // 6. Breakdown Metode Pembayaran
            const listPayEl = document.getElementById('dash-breakdown-metode');
            if (listPayEl && Array.isArray(data.metode_pembayaran_bulan_ini)) {
                if (data.metode_pembayaran_bulan_ini.length === 0) {
                    listPayEl.innerHTML = '<li style="color:#94a3b8; font-size:0.85rem;">Belum ada transaksi di bulan ini.</li>';
                } else {
                    listPayEl.innerHTML = data.metode_pembayaran_bulan_ini.map(item => {
                        return `
                            <li class="breakdown-item">
                                <div class="breakdown-meta">
                                    <span class="breakdown-name">💳 ${item.metode_pembayaran.toUpperCase()} (${item.jumlah_transaksi}x)</span>
                                    <span class="breakdown-amount">${this.formatRupiah(item.total_nominal)}</span>
                                </div>
                            </li>
                        `;
                    }).join('');
                }
            }

            // 7. Transaksi Terakhir di Dashboard
            const dashRecentTbody = document.getElementById('dash-tbody-recent');
            if (dashRecentTbody) {
                const sales = (data.aktivitas_terkini && data.aktivitas_terkini.penjualan) || [];
                if (sales.length > 0) {
                    dashRecentTbody.innerHTML = sales.map(item => {
                        const jenis = item.jenis_transaksi === 'isi_ulang' ? '💧 Isi Ulang' : '🪣 Galon Baru';
                        return `
                            <tr>
                                <td>${this.formatTanggal(item.tanggal)}</td>
                                <td>${jenis} (${item.jumlah_galon} galon)</td>
                                <td><strong class="text-masuk">${this.formatRupiah(item.total)}</strong></td>
                                <td><span class="badge badge-${item.metode_pembayaran}">${item.metode_pembayaran.toUpperCase()}</span></td>
                            </tr>
                        `;
                    }).join('');
                } else {
                    dashRecentTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#94a3b8;">Belum ada transaksi.</td></tr>';
                }
            }

        } catch (err) {
            console.error('Gagal mengambil ringkasan dashboard:', err);
        }
    },

    // ==========================================================
    // LAPORAN KEUANGAN & BUKU KAS
    // ==========================================================
    initReportFilters() {
        const formFilter = document.getElementById('form-filter-laporan');
        const filterPills = document.querySelectorAll('.period-pill');
        const btnPrint = document.getElementById('btn-print-laporan');

        // Preset Periode (Hari ini, 7 hari, Bulan ini, Bulan lalu)
        filterPills.forEach(pill => {
            pill.addEventListener('click', () => {
                filterPills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');

                const mode = pill.dataset.period;
                const now = new Date();
                let start = '';
                let end = '';

                const toDateInput = (d) => {
                    const yyyy = d.getFullYear();
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const dd = String(d.getDate()).padStart(2, '0');
                    return `${yyyy}-${mm}-${dd}`;
                };

                if (mode === 'hari_ini') {
                    start = toDateInput(now);
                    end = toDateInput(now);
                } else if (mode === '7_hari') {
                    const past7 = new Date();
                    past7.setDate(now.getDate() - 6);
                    start = toDateInput(past7);
                    end = toDateInput(now);
                } else if (mode === 'bulan_ini') {
                    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                    start = toDateInput(firstDay);
                    end = toDateInput(now);
                } else if (mode === 'bulan_lalu') {
                    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
                    start = toDateInput(firstDayLastMonth);
                    end = toDateInput(lastDayLastMonth);
                }

                document.getElementById('filter-start-date').value = start;
                document.getElementById('filter-end-date').value = end;
                this.state.reportStartDate = start;
                this.state.reportEndDate = end;

                this.loadLaporanData();
            });
        });

        // Filter Form Submit
        if (formFilter) {
            formFilter.addEventListener('submit', (e) => {
                e.preventDefault();
                filterPills.forEach(p => p.classList.remove('active'));
                this.state.reportStartDate = document.getElementById('filter-start-date').value;
                this.state.reportEndDate = document.getElementById('filter-end-date').value;
                this.loadLaporanData();
            });
        }

        // Cetak Laporan
        if (btnPrint) {
            btnPrint.addEventListener('click', () => {
                window.print();
            });
        }
    },

    async loadLaporanData() {
        const start = this.state.reportStartDate;
        const end = this.state.reportEndDate;
        const tbody = document.getElementById('tbody-laporan');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 2rem;">Memuat buku kas laporan keuangan...</td></tr>';

        try {
            const res = await fetch(`api/laporan.php?action=laporan&start_date=${start}&end_date=${end}`);
            const result = await res.json();

            if (result.success && result.data) {
                const { ringkasan, buku_kas } = result.data;

                // Update Ringkasan Laporan
                const elPemasukan = document.getElementById('rep-total-masuk');
                const elPengeluaran = document.getElementById('rep-total-keluar');
                const elLaba = document.getElementById('rep-laba-bersih');
                const elGalon = document.getElementById('rep-total-galon');

                if (elPemasukan) elPemasukan.textContent = this.formatRupiah(ringkasan.total_pemasukan);
                if (elPengeluaran) elPengeluaran.textContent = this.formatRupiah(ringkasan.total_pengeluaran);
                if (elLaba) {
                    elLaba.textContent = this.formatRupiah(ringkasan.laba_bersih);
                    elLaba.style.color = ringkasan.laba_bersih >= 0 ? 'var(--success-dark)' : 'var(--danger-dark)';
                }
                if (elGalon) {
                    elGalon.textContent = `${ringkasan.total_galon_terjual} Galon (${ringkasan.total_galon_isi_ulang} Isi Ulang, ${ringkasan.total_galon_baru} Baru)`;
                }

                // Update Print Header Info
                const printPeriodeEl = document.getElementById('print-periode-text');
                const printTglCetakEl = document.getElementById('print-tgl-cetak');
                if (printPeriodeEl) {
                    printPeriodeEl.textContent = `${this.formatTanggal(start)} s/d ${this.formatTanggal(end)}`;
                }
                if (printTglCetakEl) {
                    printTglCetakEl.textContent = new Date().toLocaleString('id-ID');
                }

                // Render Print Summary Box
                const printRepMasuk = document.getElementById('print-rep-masuk');
                const printRepKeluar = document.getElementById('print-rep-keluar');
                const printRepLaba = document.getElementById('print-rep-laba');
                if (printRepMasuk) printRepMasuk.textContent = this.formatRupiah(ringkasan.total_pemasukan);
                if (printRepKeluar) printRepKeluar.textContent = this.formatRupiah(ringkasan.total_pengeluaran);
                if (printRepLaba) printRepLaba.textContent = this.formatRupiah(ringkasan.laba_bersih);

                // Render Tabel Buku Kas
                if (buku_kas.length > 0) {
                    tbody.innerHTML = buku_kas.map((item, idx) => {
                        const isMasuk = item.arus === 'masuk';
                        const masukVal = isMasuk ? `<strong class="text-masuk">+${this.formatRupiah(item.nominal_masuk)}</strong>` : '-';
                        const keluarVal = !isMasuk ? `<strong class="text-keluar">-${this.formatRupiah(item.nominal_keluar)}</strong>` : '-';
                        const icon = isMasuk ? '📈' : '📉';

                        return `
                            <tr>
                                <td>${idx + 1}</td>
                                <td><strong>${this.formatTanggal(item.tanggal)}</strong></td>
                                <td>${icon} ${item.deskripsi}</td>
                                <td>${item.catatan || '-'}</td>
                                <td style="text-align: right;">${masukVal}</td>
                                <td style="text-align: right;">${keluarVal}</td>
                                <td style="text-align: right; font-weight:700;">${this.formatRupiah(item.saldo_berjalan)}</td>
                            </tr>
                        `;
                    }).join('');
                } else {
                    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 2rem; color: #64748b;">Tidak ada data transaksi pada rentang tanggal yang dipilih.</td></tr>';
                }
            }
        } catch (err) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 2rem; color: #ef4444;">Gagal memuat laporan arus kas.</td></tr>';
        }
    }
};
