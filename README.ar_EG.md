[English](/README.md) | [فارسی](/README.fa_IR.md) | [العربية](/README.ar_EG.md) | [中文](/README.zh_CN.md) | [Español](/README.es_ES.md) | [Русский](/README.ru_RU.md) | [Türkçe](/README.tr_TR.md)

<p align="center">
  <img src="./media/preview.png" alt="D-UI Preview" width="100%">
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

**Daltoon-UI** هي لوحة تحكم ويب متقدمة ومفتوحة المصدر لإدارة خوادم [Xray-core](https://github.com/XTLS/Xray-core). توفّر واجهة نظيفة ومتعددة اللغات لنشر وتكوين ومراقبة مجموعة واسعة من بروتوكولات الوكيل وVPN — من خادم VPS واحد إلى عمليات النشر متعددة العقد.

تم بناء Daltoon-UI كنسخة محسّنة (fork) من مشروع Daltoon-UI الأصلي، وتضيف دعمًا أوسع للبروتوكولات، واستقرارًا محسّنًا، ومحاسبة للترافيك لكل عميل، والعديد من ميزات تحسين تجربة الاستخدام.

> [!IMPORTANT]
> هذا المشروع مخصص للاستخدام الشخصي فقط. يرجى عدم استخدامه لأغراض غير قانونية أو في بيئة إنتاجية.

## الميزات

- **اتصالات واردة متعددة البروتوكولات** — VLESS، VMess، Trojan، Shadowsocks، WireGuard، Hysteria2، HTTP، SOCKS (Mixed)، Dokodemo-door / Tunnel و TUN.
- **وسائل نقل وأمان حديثة** — TCP (Raw)، mKCP، WebSocket، gRPC، HTTPUpgrade و XHTTP، مؤمَّنة بـ TLS و XTLS و REALITY.
- **Fallback** — تقديم عدة بروتوكولات على منفذ واحد (مثل VLESS و Trojan على المنفذ 443) باستخدام ميزة fallback في Xray.
- **إدارة لكل عميل** — حصص الترافيك، تواريخ انتهاء الصلاحية، حدود IP، حالة الاتصال المباشرة، وروابط مشاركة وأكواد QR واشتراكات بنقرة واحدة.
- **إحصائيات الترافيك** — لكل اتصال وارد، ولكل عميل، ولكل اتصال صادر، مع عناصر تحكم لإعادة التعيين.
- **دعم العقد المتعددة** — إدارة وتوسيع عبر عدة خوادم من لوحة واحدة.
- **الاتصالات الصادرة والتوجيه** — WARP، NordVPN، قواعد توجيه مخصصة، موازنات تحميل، وتسلسل الوكلاء الصادرة.
- **خادم اشتراك مدمج** بصيغ إخراج متعددة و[قوالب صفحات مخصصة](docs/custom-subscription-templates.md).
- **روبوت تيليجرام** للمراقبة والإدارة عن بُعد.
- **واجهة RESTful API** مع توثيق Swagger داخل اللوحة.
- **تخزين مرن** — SQLite (افتراضي) أو PostgreSQL.
- **13 لغة لواجهة المستخدم** مع سمات داكنة وفاتحة.
- **تكامل مع Fail2ban** لفرض حدود IP لكل عميل.
- **وصول المسؤول** للوحة التعاون.

## البدء السريع

```bash
bash <(curl -Ls https://raw.githubusercontent.com/mdaltoon10/D-UI/main/install.sh)
```

لتثبيت إصدار محدد، أضِف وسمه (مثل `v1.0.1`):

```bash
bash <(curl -Ls https://raw.githubusercontent.com/mdaltoon10/D-UI/main/install.sh) v1.0.1
```

لتثبيت بنية **dev** المتجددة (أحدث إصدار أولي لكل التزام (commit) من `main`، وليس إصدارًا مستقرًا)، مرّر `dev-latest`:

```bash
bash <(curl -Ls https://raw.githubusercontent.com/mdaltoon10/D-UI/main/install.sh) dev-latest
```

أثناء التثبيت، يتم إنشاء اسم مستخدم وكلمة مرور ومسار وصول عشوائية. بعد التثبيت، شغّل `d-ui` لفتح قائمة الإدارة، حيث يمكنك بدء/إيقاف الخدمة، وعرض أو إعادة تعيين بيانات تسجيل الدخول، وإدارة شهادات SSL، والمزيد.

للحصول على الوثائق الكاملة، يرجى زيارة [ويكي المشروع](https://github.com/mdaltoon10/D-UI/wiki).

### التثبيت غير التفاعلي

يعمل المثبِّت أيضًا **بشكل غير تفاعلي** لـ cloud-init.
عيّن `DUI_NONINTERACTIVE=1` (أو مرّره عبر أنبوب دون TTY) وسيتولى التثبيت من البداية إلى النهاية
دون أي مطالبات، مُنشئًا بيانات اعتماد عشوائية وكاتبًا إياها في
`/etc/d-ui/install-result.env`. راجع [`deploy/`](deploy/) لـ:

- [بيانات مستخدم cloud-init](deploy/cloud-init/) — تثبيت غير تفاعلي على أي سحابة (Hetzner/AWS/DO/Vultr/GCP/Azure/Oracle)
- [ملاحظات Hetzner Cloud](deploy/marketplace/hetzner/) — نشر يعتمد على cloud-init على Hetzner

## المنصات المدعومة

**أنظمة التشغيل:** Ubuntu، Debian، Armbian، Fedora، CentOS، RHEL، AlmaLinux، Rocky Linux، Oracle Linux، Amazon Linux، Virtuozzo، Arch، Manjaro، Parch، openSUSE (Tumbleweed / Leap)، Alpine و Windows.

**المعماريات:** `amd64` · `386` · `arm64` (aarch64) · `armv7` · `armv6` · `armv5` · `s390x`.

## خيارات قاعدة البيانات

يدعم Daltoon-UI خلفيتين (backends) يتم اختيارهما أثناء التثبيت:

- **SQLite** (افتراضي) — ملف واحد في `/etc/d-ui/d-ui.db`. بدون إعداد، مثالي لعمليات النشر الصغيرة والمتوسطة.
- **PostgreSQL** — موصى به لأعداد العملاء الكبيرة أو الإعدادات متعددة العقد. يمكن للمثبِّت تثبيت PostgreSQL محليًا لك، أو قبول DSN لخادم موجود.

في وقت التشغيل، يتم اختيار الخلفية عبر متغيرات البيئة (يكتبها المثبِّت لك في `/etc/default/d-ui`):

```
DUI_DB_TYPE=postgres
DUI_DB_DSN=postgres://dui:duipass@127.0.0.1:5432/dui?sslmode=disable
```

### ترحيل تثبيت SQLite موجود إلى PostgreSQL

```bash
d-ui migrate-db --dsn "postgres://dui:duipass@127.0.0.1:5432/dui?sslmode=disable"
# ثم عيّن DUI_DB_TYPE و DUI_DB_DSN في /etc/default/d-ui وأعد التشغيل:
systemctl restart d-ui
```

يبقى ملف SQLite الأصلي دون تغيير؛ احذفه يدويًا بعد التحقق من الخلفية الجديدة.

### Docker

يستمر الأمر الافتراضي `docker compose up -d` في استخدام SQLite. للتشغيل مع خدمة PostgreSQL المرفقة، أزِل التعليق عن سطري متغيرات البيئة `DUI_DB_*` في `docker-compose.yml` وشغّل باستخدام البروفايل:

```bash
docker compose --profile postgres up -d
```

تتضمن الصورة Fail2ban (مُفعَّل افتراضيًا) لفرض **حدود IP** لكل عميل. يحظر Fail2ban المخالفين باستخدام `iptables`، الذي يتطلب صلاحية `NET_ADMIN`. يمنح `docker-compose.yml` هذه الصلاحية مسبقًا عبر `cap_add`؛ إذا شغّلت الحاوية باستخدام `docker run` بدلاً من ذلك، فأضِف الصلاحيات بنفسك، وإلا فسيتم تسجيل عمليات الحظر دون تطبيقها أبدًا:

```bash
docker run -d --cap-add=NET_ADMIN --cap-add=NET_RAW ... ghcr.io/mdaltoon10/D-UI
```

## متغيرات البيئة

| المتغير | الوصف | الافتراضي |
| --- | --- | --- |
| `DUI_DB_TYPE` | خلفية قاعدة البيانات: `sqlite` أو `postgres` | `sqlite` |
| `DUI_DB_DSN` | سلسلة اتصال PostgreSQL (عندما `DUI_DB_TYPE=postgres`) | — |
| `DUI_DB_FOLDER` | مجلد ملف قاعدة بيانات SQLite | `/etc/d-ui` |
| `DUI_DB_MAX_OPEN_CONNS` | الحد الأقصى للاتصالات المفتوحة (تجمّع PostgreSQL) | — |
| `DUI_DB_MAX_IDLE_CONNS` | الحد الأقصى للاتصالات الخاملة (تجمّع PostgreSQL) | — |
| `DUI_INIT_WEB_BASE_PATH` | مسار URI الأولي للوحة الويب | `/` |
| `DUI_ENABLE_FAIL2BAN` | تفعيل فرض حدود IP المعتمد على Fail2ban | `true` |
| `DUI_LOG_LEVEL` | مستوى السجل (`debug`، `info`، `warning`، `error`) | `info` |
| `DUI_DEBUG` | تفعيل وضع التصحيح | `false` |
| `DUI_TUNNEL_HEALTH_MONITOR` | تفعيل مراقب صحة النفق (يفحص عنوان URL ويعيد تشغيل xray بعد فشل متكرر؛ إعادة التشغيل تقطع جميع العملاء) | `false` |
| `DUI_TUNNEL_HEALTH_PROXY` | الوكيل الذي يُرسَل عبره الفحص؛ وجّهه إلى اتصال xray وارد محلي ليختبر الفحص النفق (مثل `socks5://127.0.0.1:1080`). القيمة الفارغة تعني أن الفحص يتحقق فقط من اتصال المضيف | — |
| `DUI_TUNNEL_HEALTH_URL` | عنوان URL الذي يُفحَص لمعرفة صحة النفق | `https://www.cloudflare.com/cdn-cgi/trace` |
| `DUI_TUNNEL_HEALTH_INTERVAL` | الفترة بين عمليات الفحص | `30s` |
| `DUI_TUNNEL_HEALTH_TIMEOUT` | مهلة كل عملية فحص | `10s` |
| `DUI_TUNNEL_HEALTH_FAILURES` | عدد حالات الفشل المتتالية قبل تشغيل إعادة التشغيل | `3` |
| `DUI_TUNNEL_HEALTH_COOLDOWN` | الحد الأدنى للتأخير بين عمليات إعادة التشغيل المتتالية | `5m` |

## اللغات المدعومة

تتوفر واجهة اللوحة بـ 13 لغة:

English · فارسی · العربية · 中文（简体） · 中文（繁體） · Español · Русский · Українська · Türkçe · Tiếng Việt · 日本語 · Bahasa Indonesia · Português (Brasil)

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
