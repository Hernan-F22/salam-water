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
        currentTab: 'pesan',
        auth: {
            isAdmin: false,
            token: null,
            username: ''
        },
        orderProduct: {
            jenis: 'isi_ulang',
            harga: 5000
        },
        categories: [],
        adminOrderStatusFilter: '',
        pinjamStatusFilter: '',
        pinjamSearch: '',
        reportStartDate: '',
        reportEndDate: ''
    },

    // Inisialisasi awal
    init() {
        this.initDates();
        this.initAuth();
        this.initTabs();
        this.initLiveClock();
        this.initPublicOrderForm();
        this.initAdminOrderFilters();
        this.initPinjamGalon();
        this.initQrisViewer();
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
            this.loadPinjamGalonList();
            this.loadDashboardData();
            this.loadPenjualanList();
            this.loadPengeluaranList();
            this.loadLaporanData();

            // Pindahkan tab ke antrean saat admin aktif
            this.switchTab('antrean');
        } else {
            body.classList.remove('role-admin');
            body.classList.add('role-guest');

            // Saat logout / sesi habis / belum login, arahkan ke tab pemesanan publik
            this.switchTab('pesan');
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
        const btnBack = document.getElementById('btn-back-to-order');
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
                if (tabAlert) tabAlert.style.display = 'none';
                if (tabPass && !tabPass.value) {
                    tabPass.focus();
                } else if (tabUser) {
                    tabUser.focus();
                }
            });
        }

        // Klik tombol Kembali ke Formulir Pemesanan di Tab Login
        if (btnBack) {
            btnBack.addEventListener('click', () => {
                this.switchTab('pesan');
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
                } catch (e) { }
                sessionStorage.removeItem('salam_water_admin_token');
                this.setAdminState(false, null);
                this.switchTab('pesan');
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
        } else if (tabId === 'pinjam' && this.state.auth.isAdmin) {
            this.loadPinjamGalonList();
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
    // FORMULIR PEMESANAN GALON (PELANGGAN TANPA LOGIN - GAMBAR 1)
    // ==========================================================
    initPublicOrderForm() {
        const form = document.getElementById('form-pesan-online');
        const nameInput = document.getElementById('order-nama');
        const phoneInput = document.getElementById('order-nohp');
        const addressInput = document.getElementById('order-alamat');
        const addressLabel = document.getElementById('label-order-alamat');
        const addressHelper = document.getElementById('helper-order-alamat');
        const qtyInput = document.getElementById('order-jumlah');
        const notesInput = document.getElementById('order-catatan');
        const paymentSelect = document.getElementById('order-metode');
        const totalDisplay = document.getElementById('order-total-display');
        const submitBtn = document.getElementById('btn-submit-order');
        const radioCards = document.querySelectorAll('#pane-pesan .product-radio-card');
        const boxSuccess = document.getElementById('box-order-success');
        const successNo = document.getElementById('success-ord-no');
        const successDetails = document.getElementById('success-ord-details');
        const btnWa1 = document.getElementById('btn-wa-confirm-1');
        const btnWa2 = document.getElementById('btn-wa-confirm-2');

        // Elemen Google Maps & QRIS
        const btnGps = document.getElementById('btn-detect-gps');
        const mapsInput = document.getElementById('order-maps-url');
        const btnPreviewMaps = document.getElementById('btn-preview-maps');
        const latInput = document.getElementById('order-latitude');
        const lngInput = document.getElementById('order-longitude');
        const gpsStatus = document.getElementById('gps-status-indicator');
        const qrisPreviewBox = document.getElementById('box-qris-customer-preview');
        const qrisNominalDisplay = document.getElementById('qris-nominal-display');

        // State produk pesanan default
        this.state.orderProduct = {
            jenis: 'isi_ulang',
            harga: 5000
        };

        const calculateTotal = () => {
            const qty = parseInt(qtyInput ? qtyInput.value : 1, 10) || 1;
            const price = this.state.orderProduct ? this.state.orderProduct.harga : 5000;
            const total = qty * price;
            if (totalDisplay) {
                totalDisplay.textContent = this.formatRupiah(total);
            }
            if (qrisNominalDisplay) {
                qrisNominalDisplay.textContent = this.formatRupiah(total);
            }
        };

        const updateAddressMode = (price) => {
            if (!addressInput) return;
            const isAmbil = parseFloat(price) === 5000;
            const mapsGroup = document.getElementById('group-order-maps');

            if (isAmbil) {
                if (addressLabel) addressLabel.innerHTML = '🏪 Info Pengambilan <small style="font-weight:400; color:var(--text-muted);">(Opsional - Ambil di Depot)</small>';
                addressInput.placeholder = 'Bisa dikosongkan (ambil sendiri di depot) atau isi estimasi jam pengambilan';
                addressInput.required = false;
                if (addressHelper) {
                    addressHelper.textContent = 'Tarif Rp 5.000 untuk pesanan yang diambil langsung di depot (tanpa pengantaran).';
                    addressHelper.style.color = '#4338ca';
                }
                if (mapsGroup) mapsGroup.style.display = 'none';
            } else {
                if (addressLabel) addressLabel.innerHTML = '🚚 Alamat Pengantaran <span style="color:#ef4444;">*</span> <small style="font-weight:400; color:var(--text-muted);">(Pesan Antar)</small>';
                addressInput.placeholder = 'Contoh: Jl. Mawar No. 15 RT 02/04 (Rumah pagar hitam)';
                addressInput.required = true;
                if (addressHelper) {
                    addressHelper.textContent = 'Pesanan akan diantar langsung oleh kurir depot ke alamat Anda.';
                    addressHelper.style.color = 'var(--text-muted)';
                }
                if (mapsGroup) mapsGroup.style.display = 'block';
            }
        };

        // Inisialisasi awal kalkulasi & mode alamat
        calculateTotal();
        updateAddressMode(5000);

        // Toggle Tampilan QRIS jika metode pembayaran QRIS dipilih
        if (paymentSelect) {
            paymentSelect.addEventListener('change', () => {
                const isQris = paymentSelect.value === 'qris';
                if (qrisPreviewBox) qrisPreviewBox.style.display = isQris ? 'block' : 'none';
                calculateTotal();
            });
        }

        // Fitur Deteksi Titik GPS Google Maps
        if (btnGps && mapsInput) {
            btnGps.addEventListener('click', () => {
                if (!navigator.geolocation) {
                    this.showToast('Browser Anda tidak mendukung geolokasi GPS.', 'error');
                    return;
                }
                btnGps.disabled = true;
                btnGps.innerHTML = '⏳ Mendeteksi GPS...';
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const lat = pos.coords.latitude;
                        const lng = pos.coords.longitude;
                        const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
                        mapsInput.value = mapsUrl;
                        if (latInput) latInput.value = lat;
                        if (lngInput) lngInput.value = lng;
                        if (btnPreviewMaps) {
                            btnPreviewMaps.href = mapsUrl;
                            btnPreviewMaps.style.display = 'inline-flex';
                        }
                        if (gpsStatus) {
                            gpsStatus.style.display = 'block';
                            gpsStatus.textContent = `🎯 Titik GPS akurat berhasil dideteksi! (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
                        }
                        btnGps.disabled = false;
                        btnGps.innerHTML = '✅ Titik GPS Terdeteksi';
                        this.showToast('Titik lokasi GPS berhasil dicatat!');
                    },
                    (err) => {
                        btnGps.disabled = false;
                        btnGps.innerHTML = '🎯 Ambil Titik GPS Saya';
                        this.showToast('Gagal mendeteksi lokasi GPS: ' + err.message, 'error');
                    },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                );
            });
        }

        if (mapsInput && btnPreviewMaps) {
            mapsInput.addEventListener('input', (e) => {
                const val = e.target.value.trim();
                if (val.startsWith('http://') || val.startsWith('https://')) {
                    btnPreviewMaps.href = val;
                    btnPreviewMaps.style.display = 'inline-flex';
                } else {
                    btnPreviewMaps.style.display = 'none';
                }
            });
        }

        // Radio Card Selection
        radioCards.forEach(card => {
            card.addEventListener('click', () => {
                radioCards.forEach(c => c.classList.remove('active'));
                card.classList.add('active');

                this.state.orderProduct.jenis = card.dataset.jenis;
                this.state.orderProduct.harga = parseFloat(card.dataset.harga);
                calculateTotal();
                updateAddressMode(this.state.orderProduct.harga);
            });
        });

        // Quantity input & preset buttons
        if (qtyInput) qtyInput.addEventListener('input', calculateTotal);

        document.querySelectorAll('.btn-preset-order-qty').forEach(btn => {
            btn.addEventListener('click', () => {
                if (qtyInput) {
                    qtyInput.value = btn.dataset.qty;
                    calculateTotal();
                }
            });
        });

        // Submit Pesanan Pelanggan (Publik, Tanpa Login)
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                const nama = nameInput ? nameInput.value.trim() : '';
                const nohp = phoneInput ? phoneInput.value.trim() : '';
                let alamat = addressInput ? addressInput.value.trim() : '';
                const isAmbil = parseFloat(this.state.orderProduct.harga) === 5000;

                if (!nama || !nohp) {
                    this.showToast('Nama dan nomor HP/WhatsApp wajib diisi!', 'error');
                    return;
                }

                if (!alamat && isAmbil) {
                    alamat = 'Ambil Sendiri di Depot';
                } else if (!alamat && !isAmbil) {
                    this.showToast('Alamat pengantaran wajib diisi untuk layanan pesan antar!', 'error');
                    if (addressInput) addressInput.focus();
                    return;
                }

                const qty = parseInt(qtyInput ? qtyInput.value : 1, 10) || 1;
                const today = new Date();
                const yyyy = today.getFullYear();
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const dd = String(today.getDate()).padStart(2, '0');
                const todayStr = `${yyyy}-${mm}-${dd}`;

                const payload = {
                    tanggal: todayStr,
                    status: 'menunggu',
                    nama_pelanggan: nama,
                    no_hp: nohp,
                    alamat: alamat,
                    maps_url: mapsInput ? mapsInput.value.trim() : '',
                    latitude: latInput ? latInput.value.trim() : '',
                    longitude: lngInput ? lngInput.value.trim() : '',
                    jenis_galon: this.state.orderProduct.jenis,
                    harga_satuan: this.state.orderProduct.harga,
                    jumlah_galon: qty,
                    metode_pembayaran: paymentSelect ? paymentSelect.value : 'tunai',
                    catatan: notesInput ? notesInput.value.trim() : ''
                };

                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '⏳ Mengirim Pesanan...';
                }

                try {
                    const res = await fetch('api/pesanan.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const result = await res.json();

                    if (result.success && result.data) {
                        const ord = result.data;
                        this.showToast(`Pesanan #${ord.nomor_pesanan} berhasil dikirim!`);

                        // Tampilkan box sukses
                        if (boxSuccess) {
                            boxSuccess.style.display = 'block';
                            if (successNo) successNo.textContent = ord.nomor_pesanan;
                            if (successDetails) {
                                const jenisLabel = ord.jenis_galon === 'isi_ulang' ? 'Isi Ulang Air' : 'Galon Baru';
                                const layananLabel = parseFloat(ord.harga_satuan) === 5000 ? '🏪 Ambil di Depot' : '🚚 Pesan Antar';
                                const isQris = ord.metode === 'qris';
                                const metodeBadge = isQris ? '📲 QRIS (Non-Tunai)' : '💵 Tunai / Cash (Bayar di Tempat)';

                                let mapsHtml = '';
                                if (ord.maps_url) {
                                    mapsHtml = `<div><strong>Titik Maps:</strong> <a href="${ord.maps_url}" target="_blank" style="color:#0284c7; font-weight:700; text-decoration:underline;">Lihat di Google Maps 📍</a></div>`;
                                }

                                let qrisNotice = '';
                                if (isQris) {
                                    qrisNotice = `
                                        <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; padding:0.65rem; margin-top:0.65rem; color:#1e40af; font-size:0.83rem; line-height:1.4;">
                                            <strong>⚡ Pembayaran QRIS:</strong><br>
                                            Harap lampirkan foto / screenshot bukti transfer pembayaran Anda ke chat WhatsApp agar pesanan segera diverifikasi dan diproses oleh depot.
                                        </div>
                                    `;
                                }

                                successDetails.innerHTML = `
                                    <div><strong>Pelanggan:</strong> ${ord.nama} (${ord.no_hp})</div>
                                    <div><strong>Layanan:</strong> ${layananLabel}</div>
                                    <div><strong>Pesanan:</strong> ${ord.jumlah_galon}x ${jenisLabel} (@ ${this.formatRupiah(ord.harga_satuan)})</div>
                                    <div><strong>Total Tagihan:</strong> <strong style="color:var(--primary); font-size:1.05rem;">${this.formatRupiah(ord.total)}</strong></div>
                                    <div><strong>Metode Bayar:</strong> ${metodeBadge}</div>
                                    <div><strong>Alamat / Info:</strong> ${ord.alamat}</div>
                                    ${mapsHtml}
                                    ${ord.catatan ? `<div><strong>Catatan:</strong> ${ord.catatan}</div>` : ''}
                                    ${qrisNotice}
                                `;
                            }

                            if (btnWa1 && ord.wa_url_1) btnWa1.href = ord.wa_url_1;
                            if (btnWa2 && ord.wa_url_2) btnWa2.href = ord.wa_url_2;

                            boxSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }

                        // Reset formulir input text (biarkan pilihan default)
                        if (nameInput) nameInput.value = '';
                        if (phoneInput) phoneInput.value = '';
                        if (addressInput) addressInput.value = '';
                        if (notesInput) notesInput.value = '';
                        if (mapsInput) mapsInput.value = '';
                        if (latInput) latInput.value = '';
                        if (lngInput) lngInput.value = '';
                        if (btnPreviewMaps) btnPreviewMaps.style.display = 'none';
                        if (gpsStatus) gpsStatus.style.display = 'none';
                        if (qtyInput) qtyInput.value = '1';
                        if (paymentSelect) paymentSelect.value = 'tunai';
                        if (qrisPreviewBox) qrisPreviewBox.style.display = 'none';

                        radioCards.forEach((c, idx) => c.classList.toggle('active', idx === 0));
                        this.state.orderProduct = { jenis: 'isi_ulang', harga: 5000 };
                        calculateTotal();
                        updateAddressMode(5000);

                    } else {
                        this.showToast(result.message || 'Gagal mengirim pesanan.', 'error');
                    }
                } catch (err) {
                    this.showToast('Gagal terhubung ke server saat mengirim pesanan.', 'error');
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '🚀 Kirim Pesanan Sekarang';
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
            const isQrisFilter = this.state.adminOrderStatusFilter === 'qris';
            const statusParam = (this.state.adminOrderStatusFilter && !isQrisFilter) 
                ? `&status=${this.state.adminOrderStatusFilter}` 
                : '';
            const res = await this.authFetch(`api/pesanan.php?all=1${statusParam}`);
            const result = await res.json();

            if (result.success && result.data) {
                let { orders, stats } = result.data;

                // Update Counter Menunggu di Nav Tab
                if (badgeCount && stats) {
                    const pending = parseInt(stats.pending_count, 10) || 0;
                    badgeCount.textContent = pending;
                    badgeCount.style.display = pending > 0 ? 'inline-block' : 'none';
                }

                // Tampilkan Banner Notifikasi QRIS jika ada pesanan QRIS menunggu
                const bannerQris = document.getElementById('banner-qris-alert');
                const badgeQrisCount = document.getElementById('qris-pending-count-badge');
                if (stats && stats.qris_pending_count) {
                    const qrisCount = parseInt(stats.qris_pending_count, 10) || 0;
                    if (badgeQrisCount) badgeQrisCount.textContent = qrisCount;
                    if (bannerQris) bannerQris.style.display = qrisCount > 0 ? 'block' : 'none';
                } else if (bannerQris) {
                    bannerQris.style.display = 'none';
                }

                if (isQrisFilter && Array.isArray(orders)) {
                    orders = orders.filter(item => item.metode_pembayaran === 'qris');
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

                        // Google Maps button
                        let mapsBtn = '';
                        if (item.maps_url) {
                            mapsBtn = `<div style="margin-top: 4px;"><a href="${item.maps_url}" target="_blank" class="btn-xs btn-maps" title="Buka Titik Lokasi di Google Maps">📍 Rute Maps</a></div>`;
                        } else if (!isAmbil && item.alamat && item.alamat !== 'Ambil Sendiri di Depot') {
                            mapsBtn = `<div style="margin-top: 4px;"><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.alamat)}" target="_blank" class="btn-xs" style="color:#0284c7; background:#e0f2fe; text-decoration:none;" title="Cari Alamat di Google Maps">🔍 Cari Maps</a></div>`;
                        }

                        // Badge Metode Pembayaran
                        let metodeBadge = `<span class="badge badge-${item.metode_pembayaran}">${item.metode_pembayaran.toUpperCase()}</span>`;
                        if (item.metode_pembayaran === 'qris') {
                            metodeBadge = `
                                <div>
                                    <span class="badge badge-qris pulse-qris">📲 QRIS</span>
                                    <button type="button" class="btn-xs" onclick="App.showQrisModal(${item.total}, '${item.nomor_pesanan}')" style="margin-top:3px; background:#e0e7ff; color:#3730a3; border:none; width:100%; justify-content:center; cursor:pointer;" title="Lihat QRIS Toko">
                                        👁️ QRIS
                                    </button>
                                </div>
                            `;
                        }

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
                                    ${mapsBtn}
                                    ${item.catatan ? `<small style="color:var(--text-muted); display:block; margin-top:2px;">Ket: ${item.catatan}</small>` : ''}
                                </td>
                                <td>
                                    <div>${item.jumlah_galon}x ${jenis}</div>
                                    <small style="color:var(--text-muted);">@ ${this.formatRupiah(item.harga_satuan)}</small>
                                </td>
                                <td><strong class="text-masuk">${this.formatRupiah(item.total)}</strong></td>
                                <td>${metodeBadge}</td>
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

    filterQrisOrders() {
        const pills = document.querySelectorAll('#order-status-filters .period-pill');
        pills.forEach(p => p.classList.toggle('active', p.dataset.status === 'qris'));
        this.state.adminOrderStatusFilter = 'qris';
        this.loadAdminOrders();
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
    // SISTEM PINJAM GALON (KHUSUS ADMIN)
    // ==========================================================
    initPinjamGalon() {
        const btnToggle = document.getElementById('btn-toggle-pinjam-form');
        const btnClose = document.getElementById('btn-close-pinjam-form');
        const btnCancel = document.getElementById('btn-cancel-pinjam');
        const boxForm = document.getElementById('box-pinjam-form');
        const form = document.getElementById('form-pinjam-galon');
        const tglInput = document.getElementById('pinjam-tanggal');
        const jmlInput = document.getElementById('pinjam-jumlah');
        const jaminanInput = document.getElementById('pinjam-jaminan');
        const btnGps = document.getElementById('btn-pinjam-gps');
        const mapsInput = document.getElementById('pinjam-maps-url');
        const searchInput = document.getElementById('pinjam-search-input');

        const openForm = () => {
            if (boxForm) {
                boxForm.style.display = 'block';
                if (tglInput && !tglInput.value) {
                    const today = new Date();
                    const yyyy = today.getFullYear();
                    const mm = String(today.getMonth() + 1).padStart(2, '0');
                    const dd = String(today.getDate()).padStart(2, '0');
                    tglInput.value = `${yyyy}-${mm}-${dd}`;
                }
                const nameInput = document.getElementById('pinjam-nama');
                if (nameInput) nameInput.focus();
                boxForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        };

        const closeForm = () => {
            if (boxForm) boxForm.style.display = 'none';
        };

        if (btnToggle) btnToggle.addEventListener('click', openForm);
        if (btnClose) btnClose.addEventListener('click', closeForm);
        if (btnCancel) btnCancel.addEventListener('click', closeForm);

        // Preset Jumlah Galon
        document.querySelectorAll('.btn-preset-pinjam-qty').forEach(btn => {
            btn.addEventListener('click', () => {
                if (jmlInput) jmlInput.value = btn.dataset.qty;
            });
        });

        // Preset Uang Jaminan
        document.querySelectorAll('.btn-preset-jaminan').forEach(btn => {
            btn.addEventListener('click', () => {
                if (jaminanInput) jaminanInput.value = btn.dataset.val;
            });
        });

        // GPS Peminjam
        if (btnGps && mapsInput) {
            btnGps.addEventListener('click', () => {
                if (!navigator.geolocation) {
                    this.showToast('Browser tidak mendukung geolokasi GPS.', 'error');
                    return;
                }
                btnGps.disabled = true;
                btnGps.innerHTML = '⏳ Mengambil GPS...';
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const lat = pos.coords.latitude;
                        const lng = pos.coords.longitude;
                        mapsInput.value = `https://www.google.com/maps?q=${lat},${lng}`;
                        btnGps.disabled = false;
                        btnGps.innerHTML = '✅ GPS Didapat';
                        this.showToast('Titik koordinat berhasil didapatkan!');
                    },
                    (err) => {
                        btnGps.disabled = false;
                        btnGps.innerHTML = '🎯 Ambil Titik GPS Saya';
                        this.showToast('Gagal mendapatkan GPS: ' + err.message, 'error');
                    },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                );
            });
        }

        // Status Filter Pills
        const pills = document.querySelectorAll('#pinjam-status-filters .period-pill');
        pills.forEach(pill => {
            pill.addEventListener('click', () => {
                pills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                this.state.pinjamStatusFilter = pill.dataset.status;
                this.loadPinjamGalonList();
            });
        });

        // Search Input
        if (searchInput) {
            let debounceTimer = null;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.state.pinjamSearch = e.target.value.trim();
                    this.loadPinjamGalonList();
                }, 300);
            });
        }

        // Submit Form Pinjam Galon
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitBtn = document.getElementById('btn-submit-pinjam');
                const nama = document.getElementById('pinjam-nama').value.trim();
                const nohp = document.getElementById('pinjam-nohp').value.trim();
                const alamat = document.getElementById('pinjam-alamat').value.trim();
                const tanggal = document.getElementById('pinjam-tanggal').value;
                const jumlah = parseInt(jmlInput.value, 10) || 1;
                const jaminan = parseFloat(jaminanInput.value) || 0;
                const maps = mapsInput ? mapsInput.value.trim() : '';
                const catatan = document.getElementById('pinjam-catatan').value.trim();

                if (!nama || !nohp || !alamat) {
                    this.showToast('Nama, nomor HP, dan alamat peminjam wajib diisi!', 'error');
                    return;
                }

                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '⏳ Menyimpan Data...';
                }

                try {
                    const res = await this.authFetch('api/pinjam_galon.php?action=create', {
                        method: 'POST',
                        body: JSON.stringify({
                            tanggal_pinjam: tanggal,
                            nama_peminjam: nama,
                            no_hp: nohp,
                            alamat: alamat,
                            maps_url: maps,
                            jumlah_galon: jumlah,
                            uang_jaminan: jaminan,
                            catatan: catatan
                        })
                    });
                    const result = await res.json();

                    if (result.success) {
                        this.showToast(`Peminjaman ${jumlah} galon untuk ${nama} berhasil dicatat!`);
                        form.reset();
                        if (boxForm) boxForm.style.display = 'none';
                        this.loadPinjamGalonList();
                    } else {
                        this.showToast(result.message || 'Gagal mencatat peminjaman galon.', 'error');
                    }
                } catch (err) {
                    this.showToast('Gagal menghubungi server.', 'error');
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '💾 Simpan Data Peminjaman';
                    }
                }
            });
        }
    },

    async loadPinjamGalonList() {
        if (!this.state.auth.isAdmin) return;
        const tbody = document.getElementById('tbody-pinjam-galon');
        const badgeCount = document.getElementById('badge-pinjam-count');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 2rem;">Memuat data peminjaman galon...</td></tr>';

        try {
            const statusParam = this.state.pinjamStatusFilter ? `&status=${this.state.pinjamStatusFilter}` : '';
            const searchParam = this.state.pinjamSearch ? `&q=${encodeURIComponent(this.state.pinjamSearch)}` : '';
            const res = await this.authFetch(`api/pinjam_galon.php?${statusParam}${searchParam}`);
            const result = await res.json();

            if (result.success && result.data) {
                const { items, stats } = result.data;

                // Update 4 Metrik
                if (stats) {
                    const statGalon = document.getElementById('pinjam-stat-total-galon');
                    const statPeminjam = document.getElementById('pinjam-stat-total-peminjam');
                    const statJaminan = document.getElementById('pinjam-stat-total-jaminan');
                    const statKembali = document.getElementById('pinjam-stat-total-kembali');

                    const totalDipinjam = parseInt(stats.total_galon_dipinjam, 10) || 0;
                    const totalPeminjam = parseInt(stats.total_orang_meminjam, 10) || 0;
                    const totalJaminan = parseFloat(stats.total_uang_jaminan) || 0;
                    const totalKembali = parseInt(stats.total_galon_kembali, 10) || 0;

                    if (statGalon) statGalon.textContent = `${totalDipinjam} Galon`;
                    if (statPeminjam) statPeminjam.textContent = `${totalPeminjam} Orang`;
                    if (statJaminan) statJaminan.textContent = this.formatRupiah(totalJaminan);
                    if (statKembali) statKembali.textContent = `${totalKembali} Galon`;

                    if (badgeCount) {
                        badgeCount.textContent = totalDipinjam;
                        badgeCount.style.display = totalDipinjam > 0 ? 'inline-block' : 'none';
                    }
                }

                // Render Baris Tabel
                if (Array.isArray(items) && items.length > 0) {
                    tbody.innerHTML = items.map(item => {
                        const isDipinjam = item.status === 'dipinjam';
                        const badgeStatus = isDipinjam
                            ? '<span class="badge badge-dipinjam">🟡 Sedang Dipinjam</span>'
                            : '<span class="badge badge-dikembalikan">🟢 Sudah Dikembalikan</span>';

                        const cleanPhone = item.no_hp.replace(/\D/g, '');
                        const waReminderMsg = `Halo Kak ${item.nama_peminjam}, kami dari Depot Salam Water ingin menanyakan perihal galon depot kami sebanyak ${item.jumlah_galon} buah yang dipinjam pada tanggal ${this.formatTanggal(item.tanggal_pinjam)}. Apakah sudah selesai digunakan untuk kami ambil / dikembalikan? Terima kasih banyak ya Kak. 🙏`;
                        const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waReminderMsg)}`;

                        let mapsBtn = '';
                        if (item.maps_url) {
                            mapsBtn = `<div style="margin-top:4px;"><a href="${item.maps_url}" target="_blank" class="btn-xs btn-maps" title="Buka Titik Lokasi Google Maps">📍 Rute Maps</a></div>`;
                        } else if (item.alamat) {
                            mapsBtn = `<div style="margin-top:4px;"><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.alamat)}" target="_blank" class="btn-xs" style="color:#0284c7; background:#e0f2fe; text-decoration:none;" title="Cari Alamat di Google Maps">🔍 Cari Maps</a></div>`;
                        }

                        let tglKembaliTampil = '-';
                        if (item.tanggal_kembali) {
                            tglKembaliTampil = `<div><strong>Kembali:</strong> ${this.formatTanggal(item.tanggal_kembali)}</div>`;
                        }

                        let actions = '';
                        if (isDipinjam) {
                            actions = `
                                <div style="display:flex; gap:0.3rem; align-items:center; flex-wrap:wrap;">
                                    <button class="btn btn-sm btn-success" onclick="App.returnPinjamGalon(${item.id}, '${item.nama_peminjam.replace(/'/g, "\\'")}', ${item.jumlah_galon})" title="Tandai Galon Sudah Dikembalikan">
                                        ✅ Kembali
                                    </button>
                                    <a href="${waLink}" target="_blank" class="btn btn-sm btn-secondary" style="color:#15803d; text-decoration:none; font-weight:700;" title="Kirim Pengingat WhatsApp ke Peminjam">
                                        📱 WA
                                    </a>
                                    <button class="btn btn-sm btn-danger-outline" onclick="App.deletePinjamGalon(${item.id}, '${item.nama_peminjam.replace(/'/g, "\\'")}')" title="Hapus Data Peminjaman">
                                        🗑️
                                    </button>
                                </div>
                            `;
                        } else {
                            actions = `
                                <div style="display:flex; gap:0.4rem; align-items:center;">
                                    <span style="color:var(--success-dark); font-size:0.8rem; font-weight:700;">✔️ Selesai</span>
                                    <button class="btn btn-sm btn-danger-outline" onclick="App.deletePinjamGalon(${item.id}, '${item.nama_peminjam.replace(/'/g, "\\'")}')" title="Hapus Data">
                                        🗑️ Hapus
                                    </button>
                                </div>
                            `;
                        }

                        return `
                            <tr>
                                <td>
                                    <div><strong>${item.nomor_pinjam}</strong></div>
                                    <small style="color:var(--text-muted);">${this.formatTanggal(item.tanggal_pinjam)}</small>
                                </td>
                                <td>
                                    <div><strong>${item.nama_peminjam}</strong></div>
                                    <a href="${waLink}" target="_blank" style="font-size:0.82rem; color:#16a34a; text-decoration:none;">
                                        📱 ${item.no_hp}
                                    </a>
                                </td>
                                <td style="max-width:220px; font-size:0.85rem;">
                                    <div>${item.alamat}</div>
                                    ${mapsBtn}
                                </td>
                                <td>
                                    <strong style="font-size:1.05rem; color:#4338ca;">${item.jumlah_galon}</strong> galon
                                </td>
                                <td>
                                    <strong class="text-masuk">${this.formatRupiah(item.uang_jaminan)}</strong>
                                </td>
                                <td>${badgeStatus}</td>
                                <td style="font-size:0.85rem;">
                                    ${tglKembaliTampil}
                                    ${item.catatan ? `<small style="color:var(--text-muted); display:block; margin-top:2px;">Ket: ${item.catatan}</small>` : ''}
                                </td>
                                <td class="action-col">${actions}</td>
                            </tr>
                        `;
                    }).join('');
                } else {
                    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 2rem; color:#64748b;">Belum ada data peminjaman galon pada filter ini.</td></tr>';
                }
            }
        } catch (err) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 2rem; color:#ef4444;">Gagal memuat data peminjaman galon.</td></tr>';
        }
    },

    async returnPinjamGalon(id, nama, jumlah) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;

        if (!confirm(`Konfirmasi Pengembalian:\nTandai bahwa ${nama} telah mengembalikan ${jumlah} galon ke depot Salam Water?`)) {
            return;
        }

        try {
            const res = await this.authFetch('api/pinjam_galon.php?action=return', {
                method: 'POST',
                body: JSON.stringify({ id: id, tanggal_kembali: todayStr })
            });
            const result = await res.json();

            if (result.success) {
                this.showToast(result.message || 'Galon berhasil ditandai telah kembali!');
                this.loadPinjamGalonList();
            } else {
                this.showToast(result.message || 'Gagal memproses pengembalian.', 'error');
            }
        } catch (err) {
            this.showToast('Gagal menghubungi server.', 'error');
        }
    },

    async deletePinjamGalon(id, nama) {
        if (!confirm(`Apakah Anda yakin ingin menghapus catatan peminjaman galon atas nama ${nama}? Data yang dihapus tidak dapat dipulihkan.`)) {
            return;
        }

        try {
            const res = await this.authFetch(`api/pinjam_galon.php?action=delete&id=${id}`, {
                method: 'POST'
            });
            const result = await res.json();

            if (result.success) {
                this.showToast(result.message || 'Catatan peminjaman galon berhasil dihapus.');
                this.loadPinjamGalonList();
            } else {
                this.showToast(result.message || 'Gagal menghapus catatan.', 'error');
            }
        } catch (err) {
            this.showToast('Gagal menghapus data.', 'error');
        }
    },

    // ==========================================================
    // QRIS VIEWER POP-UP
    // ==========================================================
    initQrisViewer() {
        const modal = document.getElementById('modal-qris-viewer');

        // Mode Switcher untuk Gambar QR (Customer Preview & Modal)
        document.querySelectorAll('.btn-qris-mode').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.target; // 'customer' or 'modal'
                const src = btn.dataset.src;

                // Update active state visual
                document.querySelectorAll(`.btn-qris-mode[data-target="${target}"]`).forEach(b => {
                    const isActive = (b === btn);
                    b.classList.toggle('active', isActive);
                    if (isActive) {
                        b.style.background = '#2563eb';
                        b.style.color = '#ffffff';
                        b.style.border = 'none';
                    } else {
                        b.style.background = '#ffffff';
                        b.style.color = '#1e40af';
                        b.style.border = '1px solid #bfdbfe';
                    }
                });

                if (target === 'customer') {
                    const img = document.getElementById('customer-qris-img');
                    const link = document.getElementById('customer-qris-open-link');
                    if (img) img.src = src;
                    if (link) link.href = src;
                } else if (target === 'modal') {
                    const img = document.getElementById('modal-qris-img');
                    const link = document.getElementById('modal-qris-open-link');
                    if (img) img.src = src;
                    if (link) link.href = src;
                }
            });
        });

        if (!modal) return;

        // Tutup jika klik di luar box (overlay)
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeQrisModal();
            }
        });

        // Tutup dengan tombol Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'flex') {
                this.closeQrisModal();
            }
        });
    },

    showQrisModal(amount, ref = '') {
        const modal = document.getElementById('modal-qris-viewer');
        const amountEl = document.getElementById('modal-qris-amount');
        const refEl = document.getElementById('modal-qris-ref');
        const imgModal = document.getElementById('modal-qris-img');
        const linkModal = document.getElementById('modal-qris-open-link');

        if (amountEl) {
            amountEl.textContent = this.formatRupiah(amount || 0);
        }
        if (refEl) {
            refEl.textContent = ref ? `Nomor Referensi: #${ref}` : '';
        }

        // Default ke qris-card.png yang tajam dan besar
        if (imgModal && !imgModal.src.includes('qris-clean') && !imgModal.src.includes('qris-card')) {
            imgModal.src = 'assets/qris-card.png';
        }
        if (linkModal && !linkModal.href.includes('qris-clean') && !linkModal.href.includes('qris-card')) {
            linkModal.href = 'assets/qris-card.png';
        }

        if (modal) {
            modal.style.display = 'flex';
        }
    },

    closeQrisModal() {
        const modal = document.getElementById('modal-qris-viewer');
        if (modal) {
            modal.style.display = 'none';
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

        // Preset Harga Satuan (5.000 Ambil di Depot & 6.000 Pesan Antar)
        document.querySelectorAll('.btn-preset-price').forEach(btn => {
            btn.addEventListener('click', () => {
                const price = parseFloat(btn.dataset.price);
                const input = document.getElementById('penjualan-harga');
                const jenisSelect = document.getElementById('penjualan-jenis');

                input.value = price;
                if (jenisSelect) {
                    jenisSelect.value = 'isi_ulang';
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
