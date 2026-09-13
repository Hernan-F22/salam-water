/**
 * SALAM WATER - JAVASCRIPT CONTROLLER (VANILLA JS)
 * Fitur: Portal Pemesanan Publik, Lacak Pesanan, Sesi Admin,
 *        Manajemen Pesanan Masuk, Transaksi Kasir, Laporan Finansial & Print
 * File: assets/app.js
 */

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

const App = {
    // State aplikasi
    state: {
        currentTab: 'login',
        auth: {
            isAdmin: false,
            token: null,
            username: ''
        },
        adminNewOrderProduct: {
            jenis: 'isi_ulang',
            harga: 5000
        },
        categories: [],
        adminOrderStatusFilter: '',
        reportStartDate: '',
        reportEndDate: ''
    },

    // Inisialisasi awal
    init() {
        this.initDates();
        this.initAuth();
        this.initTabs();
        this.initLiveClock();
        this.initAdminNewOrderForm();
        this.initAdminOrderFilters();
        this.initSalesCalculations();
        this.initExpenseForm();
        this.initReportFilters();
        this.initPresets();
        this.initLoginModal();
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

    // ==========================================================
    // AUTENTIKASI & SESI ADMIN
    // ==========================================================
    async initAuth() {
        const savedToken = sessionStorage.getItem('salam_water_admin_token');
        if (savedToken) {
            try {
                const res = await fetch('api/auth.php?action=check', {
                    headers: { 'Authorization': `Bearer ${savedToken}` }
                });
                const result = await res.json();
                if (result.success && result.data && result.data.is_admin) {
                    this.setAdminState(true, savedToken, result.data.username);
                    return;
                }
            } catch (e) {
                console.warn('Gagal verifikasi token tersimpan:', e);
            }
        }
        this.setAdminState(false, null);
    },

    setAdminState(isAdmin, token, username = 'adminwater') {
        this.state.auth.isAdmin = isAdmin;
        this.state.auth.token = token;
        this.state.auth.username = username;

        const body = document.body;
        if (isAdmin) {
            body.classList.remove('role-guest');
            body.classList.add('role-admin');
            
            // Muat data khusus admin
            this.loadCategories();
            this.loadAdminOrders();
            this.loadDashboardData();
            this.loadPenjualanList();
            this.loadPengeluaranList();
            this.loadLaporanData();

            // Pindahkan tab ke antrean jika sebelumnya di login
            if (this.state.currentTab === 'login' || !this.state.currentTab) {
                this.switchTab('antrean');
            }
        } else {
            body.classList.remove('role-admin');
            body.classList.add('role-guest');

            // Saat logout / sesi habis, arahkan ke tab login
            this.switchTab('login');
        }
    },

    // Helper Fetch yang menyertakan Authorization Bearer Token
    async authFetch(url, options = {}) {
        const headers = options.headers || {};
        if (this.state.auth.token) {
            headers['Authorization'] = `Bearer ${this.state.auth.token}`;
        }
        if (!headers['Content-Type'] && options.body && typeof options.body === 'string') {
            headers['Content-Type'] = 'application/json';
        }
        options.headers = headers;

        const res = await fetch(url, options);
        if (res.status === 401) {
            this.setAdminState(false, null);
            sessionStorage.removeItem('salam_water_admin_token');
            this.showToast('Sesi admin berakhir. Silakan login kembali.', 'error');
            throw new Error('Unauthorized');
        }
        return res;
    },

    // Inisialisasi Autentikasi UI (Tab Login Dedikasi)
    initLoginModal() {
        const btnOpen = document.getElementById('btn-open-login');
        const btnLogout = document.getElementById('btn-logout');

        // Form Login Tab
        const formTab = document.getElementById('form-login-tab');
        const tabAlert = document.getElementById('login-alert-tab');
        const tabSubmitBtn = document.getElementById('btn-submit-login-tab');
        const tabPass = document.getElementById('login-tab-password');
        const tabUser = document.getElementById('login-tab-username');
        const btnToggleTabPass = document.getElementById('btn-toggle-tab-pass');

        // Klik tombol Login di Header -> Pindah ke Tab Login
        if (btnOpen) {
            btnOpen.addEventListener('click', () => {
                this.switchTab('login');
                if (tabPass && !tabPass.value) {
                    tabPass.focus();
                } else if (tabUser) {
                    tabUser.focus();
                }
            });
        }

        // Toggle intip password
        if (btnToggleTabPass && tabPass) {
            btnToggleTabPass.addEventListener('click', () => {
                const isPass = tabPass.type === 'password';
                tabPass.type = isPass ? 'text' : 'password';
                btnToggleTabPass.textContent = isPass ? '🙈' : '👁️';
            });
        }

        // Submit Form Login
        if (formTab) {
            formTab.addEventListener('submit', async (e) => {
                e.preventDefault();
                const username = tabUser.value.trim();
                const password = tabPass.value;

                if (!username || !password) {
                    if (tabAlert) {
                        tabAlert.style.display = 'block';
                        tabAlert.style.background = '#fee2e2';
                        tabAlert.style.color = '#991b1b';
                        tabAlert.style.border = '1px solid #fecaca';
                        tabAlert.textContent = 'Username dan password admin wajib diisi!';
                    }
                    return;
                }

                if (tabSubmitBtn) {
                    tabSubmitBtn.disabled = true;
                    tabSubmitBtn.innerHTML = '⏳ Memverifikasi...';
                }
                if (tabAlert) tabAlert.style.display = 'none';

                try {
                    const res = await fetch('api/auth.php?action=login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password })
                    });
                    const result = await res.json();

                    if (result.success && result.data && result.data.token) {
                        sessionStorage.setItem('salam_water_admin_token', result.data.token);
                        this.setAdminState(true, result.data.token, result.data.username);
                        tabPass.value = '';
                        this.showToast('Login Admin berhasil! Selamat datang, ' + result.data.username);
                        this.switchTab('antrean');
                    } else {
                        if (tabAlert) {
                            tabAlert.style.display = 'block';
                            tabAlert.style.background = '#fee2e2';
                            tabAlert.style.color = '#991b1b';
                            tabAlert.style.border = '1px solid #fecaca';
                            tabAlert.textContent = result.message || 'Username atau password salah.';
                        }
                    }
                } catch (err) {
                    if (tabAlert) {
                        tabAlert.style.display = 'block';
                        tabAlert.style.background = '#fee2e2';
                        tabAlert.style.color = '#991b1b';
                        tabAlert.textContent = 'Gagal terhubung ke server autentikasi.';
                    }
                } finally {
                    if (tabSubmitBtn) {
                        tabSubmitBtn.disabled = false;
                        tabSubmitBtn.innerHTML = '🚀 Masuk ke Panel Admin';
                    }
                }
            });
        }

        // Tombol Logout Admin
        if (btnLogout) {
            btnLogout.addEventListener('click', async () => {
                if (!confirm('Apakah Anda yakin ingin keluar dari akun Admin?')) return;
                try {
                    await fetch('api/auth.php?action=logout', { method: 'POST' });
                } catch (e) {}
                sessionStorage.removeItem('salam_water_admin_token');
                this.setAdminState(false, null);
                this.switchTab('login');
                this.showToast('Anda telah keluar dari mode admin.');
            });
        }
    },

    // ==========================================================
    // NAVIGASI TABS
    // ==========================================================
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
        if (tabId === 'antrean' && this.state.auth.isAdmin) {
            this.loadAdminOrders();
        } else if (tabId === 'dashboard' && this.state.auth.isAdmin) {
            this.loadDashboardData();
        } else if (tabId === 'penjualan' && this.state.auth.isAdmin) {
            this.loadPenjualanList();
        } else if (tabId === 'pengeluaran' && this.state.auth.isAdmin) {
            this.loadPengeluaranList();
        } else if (tabId === 'laporan' && this.state.auth.isAdmin) {
            this.loadLaporanData();
        }
    },

    // Notifikasi Toast Pop-up
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
    // FORM INPUT PESANAN BARU OLEH ADMIN (TELEPON / WA)
    // ==========================================================
    initAdminNewOrderForm() {
        const btnToggle = document.getElementById('btn-toggle-new-order');
        const btnClose = document.getElementById('btn-close-new-order');
        const btnCancel = document.getElementById('btn-cancel-admin-order');
        const boxNewOrder = document.getElementById('box-admin-new-order');
        const form = document.getElementById('form-admin-new-order');
        const dateInput = document.getElementById('admin-order-tanggal');
        const qtyInput = document.getElementById('admin-order-jumlah');
        const totalDisplay = document.getElementById('admin-order-total-display');
        const radioCards = document.querySelectorAll('#box-admin-new-order .product-radio-card');

        // Set default tanggal hari ini
        if (dateInput && !dateInput.value) {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            dateInput.value = `${yyyy}-${mm}-${dd}`;
        }

        // State produk pesanan admin
        this.state.adminNewOrderProduct = {
            jenis: 'isi_ulang',
            harga: 5000
        };

        const calculateAdminOrderTotal = () => {
            const qty = parseInt(qtyInput ? qtyInput.value : 1, 10) || 1;
            const price = this.state.adminNewOrderProduct ? this.state.adminNewOrderProduct.harga : 5000;
            const total = qty * price;
            if (totalDisplay) {
                totalDisplay.textContent = this.formatRupiah(total);
            }
        };

        const updateAdminAddressMode = (price) => {
            const labelEl = document.getElementById('label-admin-order-alamat');
            const textareaEl = document.getElementById('admin-order-alamat');
            const helperEl = document.getElementById('helper-admin-order-alamat');
            if (!textareaEl) return;

            if (parseFloat(price) === 5000) {
                if (labelEl) labelEl.innerHTML = '🏪 Info Pengambilan <small style="font-weight:400; color:var(--text-muted);">(Opsional - Ambil di Depot)</small>';
                textareaEl.placeholder = 'Bisa dikosongkan (ambil sendiri di depot) atau isi estimasi jam pengambilan';
                textareaEl.required = false;
                if (helperEl) {
                    helperEl.textContent = 'Tarif Rp 5.000 untuk pesanan yang diambil langsung di depot (tanpa pengantaran).';
                    helperEl.style.color = '#4338ca';
                }
            } else {
                if (labelEl) labelEl.innerHTML = '🚚 Alamat Pengantaran <span style="color:#ef4444;">*</span> <small style="font-weight:400; color:var(--text-muted);">(Pesan Antar)</small>';
                textareaEl.placeholder = 'Contoh: Jl. Mawar No. 15 RT 02/04 (Rumah pagar hitam)';
                textareaEl.required = true;
                if (helperEl) {
                    helperEl.textContent = 'Pesanan akan diantar langsung oleh kurir depot ke alamat pelanggan.';
                    helperEl.style.color = 'var(--text-muted)';
                }
            }
        };

        // Inisialisasi awal kalkulasi & mode alamat
        calculateAdminOrderTotal();
        updateAdminAddressMode(5000);

        // Toggle buka/tutup form
        const toggleBox = (show) => {
            if (!boxNewOrder) return;
            const isCurrentlyHidden = boxNewOrder.style.display === 'none' || !boxNewOrder.style.display;
            const willShow = show !== undefined ? show : isCurrentlyHidden;
            boxNewOrder.style.display = willShow ? 'block' : 'none';
            if (willShow) {
                boxNewOrder.scrollIntoView({ behavior: 'smooth', block: 'start' });
                const nameInput = document.getElementById('admin-order-nama');
                if (nameInput) nameInput.focus();
            }
        };

        if (btnToggle) btnToggle.addEventListener('click', () => toggleBox());
        if (btnClose) btnClose.addEventListener('click', () => toggleBox(false));
        if (btnCancel) btnCancel.addEventListener('click', () => toggleBox(false));

        // Radio Card Selection
        radioCards.forEach(card => {
            card.addEventListener('click', () => {
                radioCards.forEach(c => c.classList.remove('active'));
                card.classList.add('active');

                this.state.adminNewOrderProduct.jenis = card.dataset.jenis;
                this.state.adminNewOrderProduct.harga = parseFloat(card.dataset.harga);
                calculateAdminOrderTotal();
                updateAdminAddressMode(this.state.adminNewOrderProduct.harga);
            });
        });

        // Quantity input & preset buttons
        if (qtyInput) qtyInput.addEventListener('input', calculateAdminOrderTotal);

        document.querySelectorAll('.btn-preset-admin-qty').forEach(btn => {
            btn.addEventListener('click', () => {
                if (qtyInput) {
                    qtyInput.value = btn.dataset.qty;
                    calculateAdminOrderTotal();
                }
            });
        });

        // Submit Pesanan Baru oleh Admin
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitBtn = document.getElementById('btn-submit-admin-order');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '⏳ Menyimpan Pesanan...';
                }

                let alamatVal = (document.getElementById('admin-order-alamat')?.value || '').trim();
                const isAmbilDepot = parseFloat(this.state.adminNewOrderProduct.harga) === 5000;
                if (!alamatVal && isAmbilDepot) {
                    alamatVal = 'Ambil Sendiri di Depot';
                }

                const payload = {
                    tanggal: document.getElementById('admin-order-tanggal')?.value || '',
                    status: document.getElementById('admin-order-status')?.value || 'menunggu',
                    nama_pelanggan: document.getElementById('admin-order-nama')?.value.trim() || '',
                    no_hp: document.getElementById('admin-order-nohp')?.value.trim() || '',
                    alamat: alamatVal,
                    jenis_galon: this.state.adminNewOrderProduct.jenis,
                    harga_satuan: this.state.adminNewOrderProduct.harga,
                    jumlah_galon: parseInt(qtyInput ? qtyInput.value : 1, 10) || 1,
                    metode_pembayaran: document.getElementById('admin-order-metode')?.value || 'tunai',
                    catatan: (document.getElementById('admin-order-catatan')?.value || '').trim()
                };

                try {
                    const res = await this.authFetch('api/pesanan.php', {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });
                    const result = await res.json();

                    if (result.success && result.data) {
                        this.showToast(`Pesanan #${result.data.nomor_pesanan} berhasil disimpan ke antrean!`);
                        
                        // Reset formulir
                        form.reset();
                        if (dateInput) {
                            const today = new Date();
                            const yyyy = today.getFullYear();
                            const mm = String(today.getMonth() + 1).padStart(2, '0');
                            const dd = String(today.getDate()).padStart(2, '0');
                            dateInput.value = `${yyyy}-${mm}-${dd}`;
                        }
                        if (qtyInput) qtyInput.value = '1';
                        
                        // Kembalikan pilihan default ke 5000
                        radioCards.forEach((c, idx) => c.classList.toggle('active', idx === 0));
                        this.state.adminNewOrderProduct = { jenis: 'isi_ulang', harga: 5000 };
                        calculateAdminOrderTotal();
                        updateAdminAddressMode(5000);

                        // Sembunyikan form dan reload antrean
                        toggleBox(false);
                        this.loadAdminOrders();
                    } else {
                        this.showToast(result.message || 'Gagal menyimpan pesanan.', 'error');
                    }
                } catch (err) {
                    this.showToast('Gagal terhubung ke server saat menyimpan pesanan.', 'error');
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '💾 Simpan Pesanan ke Antrean';
                    }
                }
            });
        }
    },

    // ==========================================================
    // KELOLA PESANAN MASUK (KHUSUS ADMIN)
    // ==========================================================
    initAdminOrderFilters() {
        const pills = document.querySelectorAll('#order-status-filters .period-pill');
        pills.forEach(pill => {
            pill.addEventListener('click', () => {
                pills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                this.state.adminOrderStatusFilter = pill.dataset.status;
                this.loadAdminOrders();
            });
        });
    },

    async loadAdminOrders() {
        if (!this.state.auth.isAdmin) return;
        const tbody = document.getElementById('tbody-antrean-orders');
        const badgeCount = document.getElementById('badge-pending-count');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 2rem;">Memuat daftar pesanan masuk...</td></tr>';

        try {
            const statusParam = this.state.adminOrderStatusFilter ? `&status=${this.state.adminOrderStatusFilter}` : '';
            const res = await this.authFetch(`api/pesanan.php?all=1${statusParam}`);
            const result = await res.json();

            if (result.success && result.data) {
                const { orders, stats } = result.data;

                // Update Counter Menunggu di Nav Tab
                if (badgeCount && stats) {
                    const pending = parseInt(stats.pending_count, 10) || 0;
                    badgeCount.textContent = pending;
                    badgeCount.style.display = pending > 0 ? 'inline-block' : 'none';
                }

                if (Array.isArray(orders) && orders.length > 0) {
                    tbody.innerHTML = orders.map(item => {
                        let badgeStatus = '<span class="badge badge-menunggu">🟡 Menunggu</span>';
                        if (item.status === 'diproses') badgeStatus = '<span class="badge badge-diproses">⚙️ Sedang Diproses</span>';
                        if (item.status === 'selesai') badgeStatus = '<span class="badge badge-selesai">🟢 Selesai</span>';
                        if (item.status === 'dibatalkan') badgeStatus = '<span class="badge badge-dibatalkan">🔴 Batal</span>';

                        const jenis = item.jenis_galon === 'isi_ulang' ? '💧 Isi Ulang' : '🪣 Galon Baru';
                        const isAmbil = parseFloat(item.harga_satuan) === 5000;
                        const cleanPhone = item.no_hp.replace(/\D/g, '');
                        const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Halo Kak ${item.nama_pelanggan}, dari Depot Salam Water terkait pesanan #${item.nomor_pesanan}`)}`;

                        // Action Buttons
                        let actions = '';
                        if (item.status === 'menunggu') {
                            actions = `
                                <div style="display:flex; gap:0.3rem; align-items:center;">
                                    <button class="btn btn-sm btn-primary" onclick="App.updateOrderStatus(${item.id}, 'diproses', '${item.nomor_pesanan}')" title="Mulai Proses Pesanan">
                                        ⚙️ Proses
                                    </button>
                                    <button class="btn btn-sm btn-secondary" onclick="App.updateOrderStatus(${item.id}, 'dibatalkan', '${item.nomor_pesanan}')" title="Batalkan Pesanan">
                                        ❌ Batal
                                    </button>
                                    <button class="btn btn-sm btn-danger-outline" onclick="App.deleteOrder(${item.id}, '${item.nomor_pesanan}')" title="Hapus Pesanan">
                                        🗑️ Hapus
                                    </button>
                                </div>
                            `;
                        } else if (item.status === 'diproses') {
                            actions = `
                                <div style="display:flex; gap:0.3rem; align-items:center;">
                                    <button class="btn btn-sm btn-success" onclick="App.updateOrderStatus(${item.id}, 'selesai', '${item.nomor_pesanan}')" title="Selesaikan & Masukkan ke Buku Kas">
                                        ✅ Selesai
                                    </button>
                                    <button class="btn btn-sm btn-secondary" onclick="App.updateOrderStatus(${item.id}, 'dibatalkan', '${item.nomor_pesanan}')" title="Batalkan Pesanan">
                                        ❌ Batal
                                    </button>
                                    <button class="btn btn-sm btn-danger-outline" onclick="App.deleteOrder(${item.id}, '${item.nomor_pesanan}')" title="Hapus Pesanan">
                                        🗑️ Hapus
                                    </button>
                                </div>
                            `;
                        } else if (item.status === 'selesai') {
                            actions = `
                                <div style="display:flex; gap:0.4rem; align-items:center;">
                                    <span style="color:var(--success-dark); font-size:0.8rem; font-weight:700;">✔️ Masuk Buku Kas</span>
                                    <button class="btn btn-sm btn-danger-outline" onclick="App.deleteOrder(${item.id}, '${item.nomor_pesanan}')" title="Hapus Pesanan & Catatan Kas Terkait">
                                        🗑️ Hapus
                                    </button>
                                </div>
                            `;
                        } else {
                            actions = `
                                <div style="display:flex; gap:0.4rem; align-items:center;">
                                    <span style="color:var(--text-muted); font-size:0.8rem;">Dibatalkan</span>
                                    <button class="btn btn-sm btn-danger-outline" onclick="App.deleteOrder(${item.id}, '${item.nomor_pesanan}')" title="Hapus Pesanan">
                                        🗑️ Hapus
                                    </button>
                                </div>
                            `;
                        }

                        const layananBadge = isAmbil 
                            ? '<span class="badge" style="background:#e0e7ff; color:#3730a3; font-weight:700; margin-bottom:4px; display:inline-block;">🏪 Ambil di Depot</span>' 
                            : '<span class="badge" style="background:#fef3c7; color:#92400e; font-weight:700; margin-bottom:4px; display:inline-block;">🚚 Pesan Antar</span>';

                        const alamatTampil = isAmbil 
                            ? (item.alamat && item.alamat !== 'Ambil Sendiri di Depot' ? item.alamat : '<span style="color:var(--text-muted);">Diambil di depot</span>') 
                            : item.alamat;

                        return `
                            <tr>
                                <td><strong>${item.nomor_pesanan}</strong></td>
                                <td>${this.formatTanggal(item.tanggal)}</td>
                                <td>
                                    <div><strong>${item.nama_pelanggan}</strong></div>
                                    <a href="${waLink}" target="_blank" style="font-size:0.82rem; color:#16a34a; text-decoration:none;">
                                        📱 ${item.no_hp}
                                    </a>
                                </td>
                                <td style="max-width:210px; font-size:0.85rem;">
                                    ${layananBadge}
                                    <div>${alamatTampil}</div>
                                    ${item.catatan ? `<small style="color:var(--text-muted); display:block; margin-top:2px;">Ket: ${item.catatan}</small>` : ''}
                                </td>
                                <td>
                                    <div>${item.jumlah_galon}x ${jenis}</div>
                                    <small style="color:var(--text-muted);">@ ${this.formatRupiah(item.harga_satuan)}</small>
                                </td>
                                <td><strong class="text-masuk">${this.formatRupiah(item.total)}</strong></td>
                                <td><span class="badge badge-${item.metode_pembayaran}">${item.metode_pembayaran.toUpperCase()}</span></td>
                                <td>${badgeStatus}</td>
                                <td class="action-col">${actions}</td>
                            </tr>
                        `;
                    }).join('');
                } else {
                    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 2rem; color: #64748b;">Tidak ada pesanan pada status ini.</td></tr>';
                }
            }
        } catch (err) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 2rem; color: #ef4444;">Gagal memuat pesanan antrean.</td></tr>';
        }
    },

    async updateOrderStatus(orderId, newStatus, noPesanan = '') {
        const orderRef = noPesanan ? ` #${noPesanan}` : '';
        const confirmMsg = newStatus === 'selesai' 
            ? `Konfirmasi: Selesaikan pesanan${orderRef} dan masukkan totalnya otomatis ke Transaksi Penjualan Kas?`
            : (newStatus === 'dibatalkan' ? `Batalkan pesanan${orderRef} ini?` : `Ubah status pesanan${orderRef} menjadi Sedang Diproses?`);

        if (!confirm(confirmMsg)) return;

        try {
            const res = await this.authFetch('api/pesanan.php?action=update_status', {
                method: 'POST',
                body: JSON.stringify({ id: orderId, status: newStatus })
            });
            const result = await res.json();

            if (result.success) {
                this.showToast(result.message);
                this.loadAdminOrders();
                if (newStatus === 'selesai') {
                    this.loadDashboardData();
                    this.loadPenjualanList();
                }
            } else {
                this.showToast(result.message || 'Gagal mengubah status.', 'error');
            }
        } catch (err) {
            this.showToast('Gagal memproses pembaruan status.', 'error');
        }
    },

    async deleteOrder(orderId, noPesanan = '') {
        const orderRef = noPesanan ? ` #${noPesanan}` : '';
        const confirmMsg = `Apakah Anda yakin ingin menghapus pesanan${orderRef} ini secara permanen?\n\nPerhatian: Jika pesanan ini sudah berstatus selesai, catatan transaksi di buku kas yang terkait juga otomatis akan ikut dihapus agar pembukuan tetap sinkron.`;

        if (!confirm(confirmMsg)) return;

        try {
            const res = await this.authFetch(`api/pesanan.php?action=delete&id=${orderId}`, {
                method: 'POST'
            });
            const result = await res.json();

            if (result.success) {
                this.showToast(result.message || `Pesanan${orderRef} berhasil dihapus.`);
                this.loadAdminOrders();
                this.loadDashboardData();
                this.loadPenjualanList();
            } else {
                this.showToast(result.message || 'Gagal menghapus pesanan.', 'error');
            }
        } catch (err) {
            this.showToast('Terjadi kesalahan saat menghapus pesanan.', 'error');
        }
    },

    // ==========================================================
    // KASIR LANGSUNG / FORM PENJUALAN OFFLINE
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
                    const res = await this.authFetch('api/transaksi.php?type=penjualan', {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });
                    const result = await res.json();

                    if (result.success) {
                        this.showToast('Transaksi penjualan langsung berhasil disimpan!');
                        document.getElementById('penjualan-jumlah').value = '1';
                        document.getElementById('penjualan-catatan').value = '';
                        calculateTotal();
                        
                        this.loadPenjualanList();
                        this.loadDashboardData();
                    } else {
                        this.showToast(result.message || 'Gagal menyimpan transaksi.', 'error');
                    }
                } catch (err) {
                    this.showToast('Terjadi kesalahan saat menyimpan transaksi.', 'error');
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '💾 Simpan Transaksi Penjualan';
                }
            });
        }
    },

    // Tombol Preset Kasir
    initPresets() {
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
    // FORM PENGELUARAN OPERASIONAL (KHUSUS ADMIN)
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
                const res = await this.authFetch('api/transaksi.php?type=pengeluaran', {
                    method: 'POST',
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

    // Load Kategori
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
    // RIWAYAT PENJUALAN & PENGELUARAN (ADMIN)
    // ==========================================================
    async loadPenjualanList() {
        if (!this.state.auth.isAdmin) return;
        const tbody = document.getElementById('tbody-penjualan');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 2rem;">Memuat data penjualan...</td></tr>';

        try {
            const res = await this.authFetch('api/transaksi.php?type=penjualan&limit=50');
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

    async deletePenjualan(id) {
        if (!confirm('Apakah Anda yakin ingin menghapus data penjualan ini?')) return;

        try {
            const res = await this.authFetch(`api/transaksi.php?type=penjualan&id=${id}`, {
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

    async loadPengeluaranList() {
        if (!this.state.auth.isAdmin) return;
        const tbody = document.getElementById('tbody-pengeluaran');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">Memuat data pengeluaran...</td></tr>';

        try {
            const res = await this.authFetch('api/transaksi.php?type=pengeluaran&limit=50');
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

    async deletePengeluaran(id) {
        if (!confirm('Apakah Anda yakin ingin menghapus data pengeluaran ini?')) return;

        try {
            const res = await this.authFetch(`api/transaksi.php?type=pengeluaran&id=${id}`, {
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
    // DASHBOARD RINGKASAN DATA (ADMIN)
    // ==========================================================
    async loadDashboardData() {
        if (!this.state.auth.isAdmin) return;
        try {
            const res = await this.authFetch('api/laporan.php?action=dashboard');
            const result = await res.json();

            if (!result.success || !result.data) return;
            const data = result.data;

            const omzetHariIniEl = document.getElementById('dash-omzet-today');
            const omzetBulanIniEl = document.getElementById('dash-omzet-month');
            const omzetTahunIniEl = document.getElementById('dash-omzet-year');

            if (omzetHariIniEl) omzetHariIniEl.textContent = this.formatRupiah(data.hari_ini.omzet);
            if (omzetBulanIniEl) omzetBulanIniEl.textContent = this.formatRupiah(data.bulan_ini.omzet);
            if (omzetTahunIniEl) omzetTahunIniEl.textContent = this.formatRupiah(data.tahun_ini.omzet);

            const galonTodayEl = document.getElementById('dash-galon-today');
            const galonBreakdownEl = document.getElementById('dash-galon-breakdown');
            if (galonTodayEl) galonTodayEl.textContent = `${data.hari_ini.galon_terjual} Galon`;
            if (galonBreakdownEl) {
                galonBreakdownEl.textContent = `Bulan ini: ${data.bulan_ini.galon_isi_ulang} Isi Ulang | ${data.bulan_ini.galon_baru} Galon Baru`;
            }

            const keluarTodayEl = document.getElementById('dash-expense-today');
            const keluarMonthEl = document.getElementById('dash-expense-month');
            if (keluarTodayEl) keluarTodayEl.textContent = this.formatRupiah(data.hari_ini.pengeluaran);
            if (keluarMonthEl) keluarMonthEl.textContent = `Bulan Ini: ${this.formatRupiah(data.bulan_ini.pengeluaran)}`;

            const labaTodayEl = document.getElementById('dash-profit-today');
            const labaMonthEl = document.getElementById('dash-profit-month');
            const cardProfit = document.getElementById('card-profit');

            if (labaTodayEl) labaTodayEl.textContent = this.formatRupiah(data.hari_ini.laba_bersih);
            if (labaMonthEl) {
                const statusStr = data.bulan_ini.laba_bersih >= 0 ? 'Surplus' : 'Defisit';
                labaMonthEl.textContent = `Bulan Ini: ${this.formatRupiah(data.bulan_ini.laba_bersih)} (${statusStr})`;
            }

            if (cardProfit) {
                cardProfit.classList.remove('card-success', 'card-danger');
                cardProfit.classList.add(data.hari_ini.laba_bersih >= 0 ? 'card-success' : 'card-danger');
            }

            // Breakdown Kategori Pengeluaran
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

            // Breakdown Metode Bayar
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

            // Transaksi Terakhir di Dashboard
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
    // LAPORAN KEUANGAN & BUKU KAS (ADMIN)
    // ==========================================================
    initReportFilters() {
        const formFilter = document.getElementById('form-filter-laporan');
        const filterPills = document.querySelectorAll('.period-pills .period-pill');
        const btnPrint = document.getElementById('btn-print-laporan');

        filterPills.forEach(pill => {
            if (pill.closest('#order-status-filters')) return; // Jangan bentrok dengan filter antrean

            pill.addEventListener('click', () => {
                filterPills.forEach(p => {
                    if (!p.closest('#order-status-filters')) p.classList.remove('active');
                });
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

        if (formFilter) {
            formFilter.addEventListener('submit', (e) => {
                e.preventDefault();
                this.state.reportStartDate = document.getElementById('filter-start-date').value;
                this.state.reportEndDate = document.getElementById('filter-end-date').value;
                this.loadLaporanData();
            });
        }

        if (btnPrint) {
            btnPrint.addEventListener('click', () => {
                window.print();
            });
        }
    },

    async loadLaporanData() {
        if (!this.state.auth.isAdmin) return;
        const start = this.state.reportStartDate;
        const end = this.state.reportEndDate;
        const tbody = document.getElementById('tbody-laporan');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 2rem;">Memuat buku kas laporan keuangan...</td></tr>';

        try {
            const res = await this.authFetch(`api/laporan.php?action=laporan&start_date=${start}&end_date=${end}`);
            const result = await res.json();

            if (result.success && result.data) {
                const { ringkasan, buku_kas } = result.data;

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

                const printPeriodeEl = document.getElementById('print-periode-text');
                const printTglCetakEl = document.getElementById('print-tgl-cetak');
                if (printPeriodeEl) printPeriodeEl.textContent = `${this.formatTanggal(start)} s/d ${this.formatTanggal(end)}`;
                if (printTglCetakEl) printTglCetakEl.textContent = new Date().toLocaleString('id-ID');

                const printRepMasuk = document.getElementById('print-rep-masuk');
                const printRepKeluar = document.getElementById('print-rep-keluar');
                const printRepLaba = document.getElementById('print-rep-laba');
                if (printRepMasuk) printRepMasuk.textContent = this.formatRupiah(ringkasan.total_pemasukan);
                if (printRepKeluar) printRepKeluar.textContent = this.formatRupiah(ringkasan.total_pengeluaran);
                if (printRepLaba) printRepLaba.textContent = this.formatRupiah(ringkasan.laba_bersih);

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
