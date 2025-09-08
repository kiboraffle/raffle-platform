import React from 'react';
import './App.css';

function App() {
  return (
    <div className="App">
      {/* Header */}
      <header className="gradient-bg text-white">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <i className="fas fa-gift text-2xl"></i>
              <h1 className="text-2xl font-bold">Raffle Platform</h1>
            </div>
            <nav className="hidden md:flex space-x-6">
              <a href="#" className="hover:text-blue-200 transition-colors">Beranda</a>
              <a href="#" className="hover:text-blue-200 transition-colors">Undian</a>
              <a href="#" className="hover:text-blue-200 transition-colors">Pemenang</a>
              <a href="#" className="hover:text-blue-200 transition-colors">Masuk</a>
            </nav>
            <button className="md:hidden text-white">
              <i className="fas fa-bars text-xl"></i>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 to-purple-50 py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-6xl font-bold text-gray-800 mb-6">
            Platform Undian Digital
            <span className="gradient-text block">Terpercaya</span>
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Menangkan hadiah menarik dengan sistem undian yang aman, transparan, dan terjamin. 
            Verifikasi WhatsApp, pembayaran mudah, dan notifikasi real-time.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors">
              <i className="fas fa-play mr-2"></i>
              Mulai Sekarang
            </button>
            <button className="border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white px-8 py-3 rounded-lg font-semibold transition-colors">
              <i className="fas fa-info-circle mr-2"></i>
              Pelajari Lebih Lanjut
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-gray-800 mb-4">Fitur Unggulan</h3>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Platform undian digital dengan teknologi terdepan untuk pengalaman yang aman dan menyenangkan
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="text-center p-6 rounded-lg border border-gray-100 hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-shield-alt text-2xl text-blue-600"></i>
              </div>
              <h4 className="text-xl font-semibold text-gray-800 mb-3">Aman & Terpercaya</h4>
              <p className="text-gray-600">
                Sistem keamanan tingkat enterprise dengan verifikasi WhatsApp OTP dan enkripsi data
              </p>
            </div>

            {/* Feature 2 */}
            <div className="text-center p-6 rounded-lg border border-gray-100 hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-qrcode text-2xl text-green-600"></i>
              </div>
              <h4 className="text-xl font-semibold text-gray-800 mb-3">Tiket Digital</h4>
              <p className="text-gray-600">
                Setiap tiket dilengkapi barcode unik untuk verifikasi dan klaim hadiah yang mudah
              </p>
            </div>

            {/* Feature 3 */}
            <div className="text-center p-6 rounded-lg border border-gray-100 hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-credit-card text-2xl text-purple-600"></i>
              </div>
              <h4 className="text-xl font-semibold text-gray-800 mb-3">Pembayaran Mudah</h4>
              <p className="text-gray-600">
                Berbagai metode pembayaran: Bank Transfer, E-wallet, Kartu Kredit, dan QRIS
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Active Raffles Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-gray-800 mb-4">Undian Aktif</h3>
            <p className="text-gray-600">Jangan lewatkan kesempatan memenangkan hadiah menarik</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Sample Raffle Card */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              <div className="h-48 bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                <i className="fas fa-gift text-6xl text-white"></i>
              </div>
              <div className="p-6">
                <h4 className="text-xl font-semibold text-gray-800 mb-2">iPhone 15 Pro Max</h4>
                <p className="text-gray-600 mb-4">Menangkan iPhone terbaru dengan teknologi canggih</p>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-gray-500">Harga Tiket</span>
                  <span className="font-semibold text-blue-600">Rp 50.000</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                  <div className="bg-blue-600 h-2 rounded-full" style={{width: '65%'}}></div>
                </div>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-gray-500">Terjual: 650/1000</span>
                  <span className="text-sm text-red-500">⏰ 3 hari lagi</span>
                </div>
                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold transition-colors">
                  Beli Tiket
                </button>
              </div>
            </div>

            {/* More sample cards can be added here */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              <div className="h-48 bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center">
                <i className="fas fa-car text-6xl text-white"></i>
              </div>
              <div className="p-6">
                <h4 className="text-xl font-semibold text-gray-800 mb-2">Honda PCX 160</h4>
                <p className="text-gray-600 mb-4">Motor matic premium untuk mobilitas harian</p>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-gray-500">Harga Tiket</span>
                  <span className="font-semibold text-blue-600">Rp 25.000</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                  <div className="bg-green-600 h-2 rounded-full" style={{width: '45%'}}></div>
                </div>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-gray-500">Terjual: 450/1000</span>
                  <span className="text-sm text-red-500">⏰ 5 hari lagi</span>
                </div>
                <button className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition-colors">
                  Beli Tiket
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              <div className="h-48 bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                <i className="fas fa-coins text-6xl text-white"></i>
              </div>
              <div className="p-6">
                <h4 className="text-xl font-semibold text-gray-800 mb-2">Uang Tunai 10 Juta</h4>
                <p className="text-gray-600 mb-4">Hadiah uang tunai untuk kebutuhan Anda</p>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-gray-500">Harga Tiket</span>
                  <span className="font-semibold text-blue-600">Rp 15.000</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                  <div className="bg-yellow-600 h-2 rounded-full" style={{width: '80%'}}></div>
                </div>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-gray-500">Terjual: 800/1000</span>
                  <span className="text-sm text-red-500">⏰ 1 hari lagi</span>
                </div>
                <button className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-lg font-semibold transition-colors">
                  Beli Tiket
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-gray-800 mb-4">Cara Kerja</h3>
            <p className="text-gray-600">Ikuti langkah mudah untuk berpartisipasi dalam undian</p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                1
              </div>
              <h4 className="text-lg font-semibold text-gray-800 mb-2">Daftar & Verifikasi</h4>
              <p className="text-gray-600">Daftar dengan nomor WhatsApp dan verifikasi dengan OTP</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                2
              </div>
              <h4 className="text-lg font-semibold text-gray-800 mb-2">Pilih Undian</h4>
              <p className="text-gray-600">Browse undian aktif dan pilih yang menarik untuk Anda</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                3
              </div>
              <h4 className="text-lg font-semibold text-gray-800 mb-2">Beli Tiket</h4>
              <p className="text-gray-600">Bayar dengan metode favorit dan dapatkan tiket digital</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                4
              </div>
              <h4 className="text-lg font-semibold text-gray-800 mb-2">Menang & Klaim</h4>
              <p className="text-gray-600">Tunggu pengundian dan klaim hadiah jika Anda menang</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <i className="fas fa-gift text-2xl"></i>
                <h4 className="text-xl font-bold">Raffle Platform</h4>
              </div>
              <p className="text-gray-400 mb-4">
                Platform undian digital terpercaya dengan sistem yang aman dan transparan.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <i className="fab fa-facebook text-xl"></i>
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <i className="fab fa-twitter text-xl"></i>
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <i className="fab fa-instagram text-xl"></i>
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <i className="fab fa-whatsapp text-xl"></i>
                </a>
              </div>
            </div>
            
            <div>
              <h5 className="text-lg font-semibold mb-4">Undian</h5>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Undian Aktif</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Undian Selesai</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pemenang</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Cara Bermain</a></li>
              </ul>
            </div>
            
            <div>
              <h5 className="text-lg font-semibold mb-4">Bantuan</h5>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">FAQ</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Kontak</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Syarat & Ketentuan</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Kebijakan Privasi</a></li>
              </ul>
            </div>
            
            <div>
              <h5 className="text-lg font-semibold mb-4">Kontak</h5>
              <div className="space-y-2 text-gray-400">
                <p><i className="fas fa-envelope mr-2"></i> support@raffleplatform.com</p>
                <p><i className="fas fa-phone mr-2"></i> +62 812-3456-7890</p>
                <p><i className="fas fa-map-marker-alt mr-2"></i> Jakarta, Indonesia</p>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 Raffle Platform. Semua hak dilindungi.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;