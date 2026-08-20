[English](/README.md) | [فارسی](/README.fa_IR.md) | [العربية](/README.ar_EG.md) | [中文](/README.zh_CN.md) | [Español](/README.es_ES.md) | [Русский](/README.ru_RU.md) | [Türkçe](/README.tr_TR.md)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mdaltoon10/D-UI/main/media/d-ui-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/mdaltoon10/D-UI/main/media/d-ui-light.png">
    <img alt="D-UI Preview" src="https://raw.githubusercontent.com/mdaltoon10/D-UI/main/media/d-ui-dark.png" width="100%">
  </picture>
</p>

<p align="center">
  <a href="https://github.com/mdaltoon10/D-UI/releases"><img src="https://img.shields.io/github/v/release/mdaltoon10/D-UI" alt="Release"></a>
  <a href="https://github.com/mdaltoon10/D-UI/actions"><img src="https://img.shields.io/github/actions/workflow/status/mdaltoon10/D-UI/release.yml.svg" alt="Build"></a>
  <a href="#"><img src="https://img.shields.io/github/go-mod/go-version/mdaltoon10/D-UI.svg" alt="GO Version"></a>
  <a href="https://github.com/mdaltoon10/D-UI/releases/latest"><img src="https://img.shields.io/github/downloads/mdaltoon10/D-UI/total.svg" alt="Downloads"></a>
  <a href="https://www.gnu.org/licenses/gpl-3.0.en.html"><img src="https://img.shields.io/badge/license-GPL%20V3-blue.svg?longCache=true" alt="License"></a>
  <a href="https://pkg.go.dev/github.com/mdaltoon10/D-UI/v3"><img src="https://pkg.go.dev/badge/github.com/mdaltoon10/D-UI/v3.svg" alt="Go Reference"></a>
  <a href="https://goreportcard.com/report/github.com/mdaltoon10/D-UI/v3"><img src="https://goreportcard.com/badge/github.com/mdaltoon10/D-UI/v3" alt="Go Report Card"></a>
</p>

**Daltoon-UI**, [Xray-core](https://github.com/XTLS/Xray-core) sunucularını yönetmek için geliştirilmiş profesyonel, açık kaynaklı bir web kontrol panelidir. Tek bir sanal sunucudan (VPS) çok düğümlü (multi-node) dağıtımlara kadar çok çeşitli proxy ve VPN protokollerini kurmak, yapılandırmak ve izlemek için temiz, çok dilli bir arayüz sağlar.

Orijinal Daltoon-UI projesinin geliştirilmiş bir çatallaması (fork) olarak inşa edilen Daltoon-UI; çok daha geniş protokol desteği, artırılmış kararlılık, kullanıcı başına trafik hesaplama ve kullanım kolaylığı sağlayan birçok yeni özellik sunar.

> [!IMPORTANT]
> Bu proje yalnızca kişisel kullanım için tasarlanmıştır. Lütfen yasadışı amaçlar için veya üretim (production) ortamında kullanmayın.

## Özellikler

- **Çoklu protokol destekli gelen bağlantılar (Inbounds)** — VLESS, VMess, Trojan, Shadowsocks, WireGuard, Hysteria2, HTTP, SOCKS (Karma), Dokodemo-door / Tunnel ve TUN.
- **Modern aktarımlar (transports) ve güvenlik** — TCP (Raw), mKCP, WebSocket, gRPC, HTTPUpgrade ve XHTTP; TLS, XTLS ve REALITY ile güvene alınmıştır.
- **Geri Dönüş (Fallbacks)** — Xray'in fallback desteğini kullanarak tek bir port üzerinde birden fazla protokole (ör. 443 üzerinde hem VLESS hem Trojan) hizmet verin.
- **Kullanıcı başına yönetim** — Trafik kotaları, bitiş tarihleri, IP sınırları, canlı çevrimiçi (online) durumu ve tek tıkla paylaşım bağlantıları, QR kodları ve abonelikler.
- **Trafik istatistikleri** — Gelen bağlantı (Inbound), istemci ve giden bağlantı (Outbound) bazında istatistikler ve sıfırlama kontrolleri.
- **Çoklu düğüm (Multi-node) desteği** — Tek bir panel üzerinden birden fazla sunucuyu yönetin ve ölçeklendirin.
- **Giden bağlantı (Outbound) ve yönlendirme** — WARP, NordVPN, özel yönlendirme kuralları, yük dengeleyiciler (load balancers) ve giden bağlantı proxy zincirleme (proxy chaining).
- **Dahili abonelik sunucusu** (Birden fazla çıktı formatı ve [özel sayfa şablonları](docs/custom-subscription-templates.md) ile).
- Uzaktan izleme ve yönetim için **Telegram botu**.
- Panel içi Swagger dokümantasyonuna sahip **RESTful API**.
- **Esnek depolama** — SQLite (varsayılan) veya PostgreSQL.
- Koyu ve açık tema seçenekleriyle **13 farklı UI dili**.
- Kullanıcı başına IP limitlerini zorunlu kılmak için **Fail2ban entegrasyonu**.
- İşbirliği paneli için **Yönetici erişimi**.

## Hızlı Başlangıç

```bash
bash <(curl -Ls https://raw.githubusercontent.com/mdaltoon10/D-UI/main/install.sh)
```

Belirli bir sürümü kurmak için, etiketini (ör. `v1.4.1`) ekleyin:

```bash
bash <(curl -Ls https://raw.githubusercontent.com/mdaltoon10/D-UI/main/install.sh) v1.4.1
```

Sürekli güncellenen **dev** sürümünü (kararlı bir sürüm değil; `main` dalından her commit'te oluşturulan en son ön sürüm) kurmak için `dev-latest` değerini geçirin:

```bash
bash <(curl -Ls https://raw.githubusercontent.com/mdaltoon10/D-UI/main/install.sh) dev-latest
```

Kurulum sırasında rastgele bir kullanıcı adı, şifre ve erişim yolu oluşturulur. Kurulumdan sonra, hizmeti başlatabileceğiniz/durdurabileceğiniz, giriş bilgilerinizi görüntüleyebileceğiniz veya sıfırlayabileceğiniz, SSL sertifikalarını yönetebileceğiniz ve çok daha fazlasını yapabileceğiniz yönetim menüsünü açmak için terminalde `d-ui` komutunu çalıştırın.

Tam dokümantasyon için lütfen [proje Wiki sayfasını](https://github.com/mdaltoon10/D-UI/wiki) ziyaret edin.

### Etkileşimsiz kurulum

Yükleyici, cloud-init için **etkileşimsiz** olarak da çalışır.
`DUI_NONINTERACTIVE=1` ayarlayın (veya TTY olmadan boru hattına aktarın); kurulum baştan
sona hiçbir soru sormadan tamamlanır, rastgele kimlik bilgileri oluşturup bunları
`/etc/d-ui/install-result.env` dosyasına yazar. Şunlar için [`deploy/`](deploy/) klasörüne bakın:

- [Cloud-init user-data](deploy/cloud-init/) — herhangi bir bulutta etkileşimsiz kurulum (Hetzner/AWS/DO/Vultr/GCP/Azure/Oracle)
- [Hetzner Cloud notları](deploy/marketplace/hetzner/) — Hetzner üzerinde cloud-init tabanlı dağıtım

## Desteklenen Platformlar

**İşletim sistemleri:** Ubuntu, Debian, Armbian, Fedora, CentOS, RHEL, AlmaLinux, Rocky Linux, Oracle Linux, Amazon Linux, Virtuozzo, Arch, Manjaro, Parch, openSUSE (Tumbleweed / Leap), Alpine ve Windows.

**Mimariler:** `amd64` · `386` · `arm64` (aarch64) · `armv7` · `armv6` · `armv5` · `s390x`.

## Veritabanı Seçenekleri

Daltoon-UI kurulum sırasında seçilebilecek iki arka uç (backend) destekler:

- **SQLite** (varsayılan) — `/etc/d-ui/d-ui.db` konumunda tek bir dosya. Kurulum gerektirmez, küçük ve orta ölçekli dağıtımlar için idealdir.
- **PostgreSQL** — Yüksek kullanıcı sayıları veya çoklu düğüm (multi-node) kurulumları için önerilir. Yükleyici sizin için yerel olarak PostgreSQL kurabilir veya mevcut bir sunucuya DSN bağlantısı kabul edebilir.

Çalışma anında veritabanı türü ortam değişkenleri (environment variables) ile seçilir (yükleyici bunları sizin için `/etc/default/d-ui` dosyasına yazar):

```
DUI_DB_TYPE=postgres
DUI_DB_DSN=postgres://dui:duipass@127.0.0.1:5432/dui?sslmode=disable
```

### Mevcut bir SQLite Kurulumunu PostgreSQL'e Taşıma

```bash
d-ui migrate-db --dsn "postgres://dui:duipass@127.0.0.1:5432/dui?sslmode=disable"
# ardından /etc/default/d-ui içindeki DUI_DB_TYPE ve DUI_DB_DSN değerlerini ayarlayıp yeniden başlatın:
systemctl restart d-ui
```

Kaynak SQLite dosyasına dokunulmaz; yeni veritabanının düzgün çalıştığını doğruladıktan sonra eski SQLite dosyasını manuel olarak silebilirsiniz.

### Docker

Varsayılan `docker compose up -d` komutu SQLite kullanmaya devam eder. Birlikte paketlenmiş PostgreSQL servisi ile çalıştırmak için, `docker-compose.yml` dosyasındaki iki `DUI_DB_*` değişken satırının yorumunu kaldırın ve profille başlatın:

```bash
docker compose --profile postgres up -d
```

Docker imajı, kullanıcı başına **IP limitlerini** zorunlu kılmak için Fail2ban ile (varsayılan olarak etkindir) paketlenmiştir. Fail2ban, ihlalcileri `iptables` ile engeller ve bunun için `NET_ADMIN` yetkisine ihtiyaç duyar. `docker-compose.yml` bunu zaten `cap_add` üzerinden vermektedir; ancak konteyneri bunun yerine `docker run` ile başlatırsanız bu yetkileri kendiniz eklemelisiniz, aksi takdirde yasaklamalar günlüğe kaydedilir ancak uygulanmaz:

```bash
docker run -d --cap-add=NET_ADMIN --cap-add=NET_RAW ... ghcr.io/mdaltoon10/D-UI
```

## Ortam Değişkenleri (Environment Variables)

| Değişken | Açıklama | Varsayılan |
| --- | --- | --- |
| `DUI_DB_TYPE` | Veritabanı türü: `sqlite` veya `postgres` | `sqlite` |
| `DUI_DB_DSN` | PostgreSQL bağlantı dizesi (eğer `DUI_DB_TYPE=postgres` ise) | — |
| `DUI_DB_FOLDER` | SQLite veritabanı dizini | `/etc/d-ui` |
| `DUI_DB_MAX_OPEN_CONNS` | Maksimum açık bağlantı sayısı (PostgreSQL havuzu) | — |
| `DUI_DB_MAX_IDLE_CONNS` | Maksimum boşta bekleme bağlantısı (PostgreSQL havuzu) | — |
| `DUI_INIT_WEB_BASE_PATH` | Web paneli için başlangıç URI yolu | `/` |
| `DUI_ENABLE_FAIL2BAN` | Fail2ban tabanlı IP limit uygulamasını etkinleştir | `true` |
| `DUI_LOG_LEVEL` | Günlük (Log) ayrıntı seviyesi (`debug`, `info`, `warning`, `error`) | `info` |
| `DUI_DEBUG` | Hata ayıklama (debug) modunu etkinleştir | `false` |
| `DUI_TUNNEL_HEALTH_MONITOR` | Tünel sağlık izleyicisini etkinleştir (bir URL'yi yoklar ve tekrarlanan başarısızlıklardan sonra xray'i yeniden başlatır; yeniden başlatma tüm istemcilerin bağlantısını düşürür) | `false` |
| `DUI_TUNNEL_HEALTH_PROXY` | Yoklamanın gönderildiği proxy; yoklamanın tüneli test etmesi için bunu yerel bir xray gelen bağlantısına yönlendirin (ör. `socks5://127.0.0.1:1080`). Boş bırakılırsa yoklama yalnızca ana makine bağlantısını kontrol eder | — |
| `DUI_TUNNEL_HEALTH_URL` | Tünel sağlığı için yoklanan URL | `https://www.cloudflare.com/cdn-cgi/trace` |
| `DUI_TUNNEL_HEALTH_INTERVAL` | Yoklamalar arasındaki aralık | `30s` |
| `DUI_TUNNEL_HEALTH_TIMEOUT` | Yoklama başına zaman aşımı | `10s` |
| `DUI_TUNNEL_HEALTH_FAILURES` | Yeniden başlatma tetiklenmeden önceki ardışık başarısızlık sayısı | `3` |
| `DUI_TUNNEL_HEALTH_COOLDOWN` | Ardışık yeniden başlatmalar arasındaki minimum gecikme | `5m` |

## Desteklenen Diller

Panel arayüzü 13 farklı dilde mevcuttur:

İngilizce · Farsça · Arapça · Çince (Basitleştirilmiş) · Çince (Geleneksel) · İspanyolca · Rusça · Ukraynaca · Türkçe · Vietnamca · Japonca · Endonezce · Portekizce (Brezilya)

## 💖 Support Us

If you find this project useful and would like to support its development, you can donate via the following crypto addresses:

**Bep20:**
```text
0x7316A874F562FBCe67Cd0540E6b0EA6001FA09c8
```

**Trx:**
```text
TEZtgumuwyRn8brLSbks5HQSsnJKnZc6cr
```

---

**Maintained by [mDaltoon](https://t.me/mDaltoon)**
