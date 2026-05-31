const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/resim', express.static(path.join(__dirname, 'resim')));
app.use(express.static(path.join(__dirname, 'html')));

app.use(session({
    secret: 'teknohaber_okul_projesi_gizli_anahtari',
    resave: false,
    saveUninitialized: false
}));

mongoose.connect('mongodb://127.0.0.1:27017/teknohaberDB')
    .then(() => console.log("MongoDB'ye başarıyla bağlanıldı!"))
    .catch((hata) => console.log("Veritabanı bağlantı hatası:", hata));

const kullaniciSemasi = new mongoose.Schema({
    adsoyad: { type: String, required: true },
    eposta: { type: String, required: true, unique: true },
    sifre: { type: String, required: true },
    rol: { type: String, default: 'kullanici' }
});
const Kullanici = mongoose.model('Kullanici', kullaniciSemasi, '251109019_kullanicilar');

const kategoriSemasi = new mongoose.Schema({
    kategoriAdi: { type: String, required: true }
});
const Kategori = mongoose.model('Kategori', kategoriSemasi, '251109019_kategoriler');

const tavsiyeSemasi = new mongoose.Schema({
    urunAdi: { type: String, required: true },
    incelemeMetni: { type: String, required: true },
    fiyat: String,
    satinAlmaLinki: String,
    gorselURL: String,
    eklenmeTarihi: { type: Date, default: Date.now },
    kategori_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Kategori', required: true },
    ekleyen_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Kullanici', required: true }
});
const Tavsiye = mongoose.model('Tavsiye', tavsiyeSemasi, '251109019_tavsiyeler');
async function varsayilanKategorileriEkle() {
    try {
        const sayi = await Kategori.countDocuments();
        if (sayi === 0) {
            await Kategori.insertMany([
                { kategoriAdi: 'Yapay Zeka (AI)' }, { kategoriAdi: 'Yazılım & Kodlama' },
                { kategoriAdi: 'Donanım İnceleme' }, { kategoriAdi: 'Siber Güvenlik' },
                { kategoriAdi: 'Mobil' }, { kategoriAdi: 'Tavsiye Ürünler' }
            ]);
            console.log("Varsayılan kategoriler eklendi!");
        }
    } catch (hata) { console.log(hata); }
}
varsayilanKategorileriEkle();

async function adminHesabiOlustur() {
    try {
        const adminVarMi = await Kullanici.findOne({ eposta: 'admin@mail.com' });
        if (!adminVarMi) {
            const yeniAdmin = new Kullanici({
                adsoyad: 'Sistem Yöneticisi', eposta: 'admin@mail.com', sifre: '123456', rol: 'admin'
            });
            await yeniAdmin.save();
            console.log("Otomatik Admin hesabı oluşturuldu! (Giriş için E-posta: admin@mail.com | Şifre: 123456)");
        }
    } catch (hata) { console.log("Admin hesabı oluşturulurken hata:", hata); }
}
adminHesabiOlustur();

const adminKontrol = (req, res, next) => {
    if (req.session.kullaniciId && req.session.rol === 'admin') { next(); }
    else { res.status(403).send('<h2>Erişim Engellendi!</h2><a href="/">Giriş Sayfasına Dön</a>'); }
};

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'html', 'Kayit_giris.html')));

app.post('/kayit', async (req, res) => {
    try {
        let atanacakRol = req.body.eposta === 'admin@mail.com' ? 'admin' : 'kullanici';
        const yeniKullanici = new Kullanici({ ...req.body, rol: atanacakRol });
        await yeniKullanici.save();
        res.send('<h2>Kayıt Başarılı!</h2><a href="/">Giriş Sayfasına Dön</a>');
    } catch (h) { res.send("Kayıt hatası oluştu."); }
});

app.post('/giris', async (req, res) => {
    try {
        const kullanici = await Kullanici.findOne({ eposta: req.body.eposta, sifre: req.body.sifre });
        if (kullanici) {
            req.session.kullaniciId = kullanici._id;
            req.session.rol = kullanici.rol;
            res.redirect(kullanici.rol === 'admin' ? '/admin' : '/anasayfa.html');
        } else {
            res.send('<h2>Hata! Yanlış bilgi.</h2><a href="/">Tekrar Dene</a>');
        }
    } catch (h) { res.send("Giriş hatası."); }
});

app.get('/cikis', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.post('/api/251109019/tavsiyeler', adminKontrol, async (req, res) => {
    try {
        const secilenKategori = await Kategori.findOne({ kategoriAdi: req.body.kategoriAdi });
        if (!secilenKategori) return res.send("Kategori bulunamadı.");

        const yeniUrun = new Tavsiye({
            urunAdi: req.body.urunAdi, incelemeMetni: req.body.incelemeMetni,
            fiyat: req.body.fiyat, satinAlmaLinki: req.body.satinAlmaLinki,
            gorselURL: req.body.gorselURL, kategori_id: secilenKategori._id,
            ekleyen_id: req.session.kullaniciId
        });

        await yeniUrun.save();
        res.send(`
            <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
                <h2 style="color: green;">Tavsiye Ürün Başarıyla Eklendi!</h2>
                <a href="/admin" style="display: inline-block; padding: 10px 20px; background: #34495e; color: white; text-decoration: none; border-radius: 5px;">Admin Paneline Dön</a>
            </div>
        `);
    } catch (hata) { res.status(500).send("Ürün eklenirken hata oluştu."); }
});

// Admin panelinde tüm kullanıcıları gözükmesi için yazdım hocam
app.get('/api/251109019/kullanicilar', adminKontrol, async (req, res) => {
    try {
        const kullanicilar = await Kullanici.find({}, { sifre: 0 });
        res.json(kullanicilar);
    } catch (hata) {
        res.status(500).json({ mesaj: "Kullanıcılar yüklenemedi." });
    }
});

// hatalı veya istemeyen kullanııcları silmek için yazıldı
app.delete('/api/251109019/kullanicilar/:id', adminKontrol, async (req, res) => {
    try {
        await Kullanici.findByIdAndDelete(req.params.id);
        res.json({ mesaj: "Kullanıcı başarıyla silindi." });
    } catch (hata) {
        res.status(500).json({ mesaj: "Silme hatası." });
    }
});

app.get('/api/251109019/tavsiyeler', async (req, res) => {
    try {
        const urunler = await Tavsiye.find().populate('kategori_id', 'kategoriAdi').populate('ekleyen_id', 'adsoyad');
        res.json(urunler);
    } catch (hata) { res.status(500).json({ mesaj: "Sunucu hatası." }); }
    // Kullanıcılara yapılanın aynısı ürünleri silmek için kullanılıyor
    app.delete('/api/251109019/tavsiyeler/:id', adminKontrol, async (req, res) => {
        try {
            await Tavsiye.findByIdAndDelete(req.params.id);
            res.json({ mesaj: "Ürün başarıyla silindi." });
        } catch (hata) {
            res.status(500).json({ mesaj: "Silme işlemi sırasında hata oluştu." });
        }
    });

    // seçili ürünün fiyatını günceller
    app.put('/api/251109019/tavsiyeler/:id', adminKontrol, async (req, res) => {
        try {
            // Gelen yeni verilerle ürünü günceller
            await Tavsiye.findByIdAndUpdate(req.params.id, req.body);
            res.json({ mesaj: "Ürün başarıyla güncellendi." });
        } catch (hata) {
            res.status(500).json({ mesaj: "Güncelleme sırasında hata oluştu." });
        }
    });
});
app.get('/api/oturum-kontrol', async (req, res) => {
    if (req.session.kullaniciId) {
        try {
            const kullanici = await Kullanici.findById(req.session.kullaniciId);
            if (kullanici) {
                res.json({
                    girisYapildi: true,
                    adsoyad: kullanici.adsoyad,
                    rol: kullanici.rol
                });
            } else {
                res.json({ girisYapildi: false });
            }
        } catch (hata) {
            res.json({ girisYapildi: false });
        }
    } else {

        res.json({ girisYapildi: false });
    }
});

app.get('/admin', adminKontrol, (req, res) => res.sendFile(path.join(__dirname, 'admin', 'admin.html')));
app.get('/haber-ekle', adminKontrol, (req, res) => res.sendFile(path.join(__dirname, 'admin', 'ekleme.html')));

app.listen(PORT, () => console.log(`Sunucu çalışıyor! http://localhost:${PORT}`));