[English](/README.md) | [فارسی](/README.fa_IR.md) | [العربية](/README.ar_EG.md) | [中文](/README.zh_CN.md) | [Español](/README.es_ES.md) | [Русский](/README.ru_RU.md) | [Türkçe](/README.tr_TR.md)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./media/d-ui-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="./media/d-ui-light.png">
    <img alt="D-UI Preview" src="./media/d-ui-dark.png" width="100%">
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

**Daltoon-UI** — продвинутая веб-панель управления с открытым исходным кодом для управления серверами [Xray-core](https://github.com/XTLS/Xray-core). Она предоставляет аккуратный многоязычный интерфейс для развёртывания, настройки и мониторинга широкого спектра протоколов прокси и VPN — от одного VPS до развёртываний с несколькими узлами.

Созданный как улучшенный форк оригинального проекта Daltoon-UI, Daltoon-UI добавляет более широкую поддержку протоколов, повышенную стабильность, учёт трафика по каждому клиенту и множество функций для удобства использования.

> [!IMPORTANT]
> Этот проект предназначен только для личного использования. Пожалуйста, не используйте его в незаконных целях или в производственной среде.

## Возможности

- **Многопротокольные входящие подключения** — VLESS, VMess, Trojan, Shadowsocks, WireGuard, Hysteria2, HTTP, SOCKS (Mixed), Dokodemo-door / Tunnel и TUN.
- **Современные транспорты и безопасность** — TCP (Raw), mKCP, WebSocket, gRPC, HTTPUpgrade и XHTTP, защищённые с помощью TLS, XTLS и REALITY.
- **Fallback** — обслуживание нескольких протоколов на одном порту (например, VLESS и Trojan на 443) с помощью функции fallback в Xray.
- **Управление по каждому клиенту** — квоты трафика, даты истечения, лимиты IP, статус «онлайн» в реальном времени, а также ссылки для общего доступа, QR-коды и подписки в один клик.
- **Статистика трафика** — по каждому входящему, по каждому клиенту и по каждому исходящему, с возможностью сброса.
- **Поддержка нескольких узлов** — управление и масштабирование на несколько серверов из одной панели.
- **Исходящие подключения и маршрутизация** — WARP, NordVPN, пользовательские правила маршрутизации, балансировщики нагрузки и цепочки исходящих прокси.
- **Встроенный сервер подписок** с несколькими форматами вывода и [пользовательскими шаблонами страниц](docs/custom-subscription-templates.md).
- **Telegram-бот** для удалённого мониторинга и управления.
- **RESTful API** с документацией Swagger внутри панели.
- **Гибкое хранилище** — SQLite (по умолчанию) или PostgreSQL.
- **13 языков интерфейса** с тёмной и светлой темами.
- **Интеграция с Fail2ban** для применения лимитов IP по каждому клиенту.
- **Доступ администратора** для панели совместной работы.

## Быстрый старт

```bash
bash <(curl -Ls https://raw.githubusercontent.com/mdaltoon10/D-UI/main/install.sh)
```

Чтобы установить конкретную версию, добавьте её тег (например, `v1.4.1`):

```bash
bash <(curl -Ls https://raw.githubusercontent.com/mdaltoon10/D-UI/main/install.sh) v1.4.1
```

Чтобы установить скользящую **dev**-сборку (новейший предварительный релиз по каждому коммиту из ветки `main`, а не стабильный релиз), передайте `dev-latest`:

```bash
bash <(curl -Ls https://raw.githubusercontent.com/mdaltoon10/D-UI/main/install.sh) dev-latest
```

Во время установки генерируются случайные имя пользователя, пароль и путь доступа. После установки выполните `d-ui`, чтобы открыть меню управления, где можно запускать/останавливать сервис, просматривать или сбрасывать учётные данные для входа, управлять SSL-сертификатами и многое другое.

Полную документацию смотрите в [вики проекта](https://github.com/mdaltoon10/D-UI/wiki).

### Автоматическая установка

Установщик также работает в **неинтерактивном** режиме для cloud-init.
Задайте `DUI_NONINTERACTIVE=1` (или передайте по конвейеру без TTY), и установка пройдёт от начала до конца
без единого запроса: будут сгенерированы случайные учётные данные и записаны в
`/etc/d-ui/install-result.env`. Смотрите [`deploy/`](deploy/) для:

- [Cloud-init user-data](deploy/cloud-init/) — автоматическая установка в любом облаке (Hetzner/AWS/DO/Vultr/GCP/Azure/Oracle)
- [Заметки по Hetzner Cloud](deploy/marketplace/hetzner/) — развёртывание на Hetzner на базе cloud-init

## Поддерживаемые платформы

**Операционные системы:** Ubuntu, Debian, Armbian, Fedora, CentOS, RHEL, AlmaLinux, Rocky Linux, Oracle Linux, Amazon Linux, Virtuozzo, Arch, Manjaro, Parch, openSUSE (Tumbleweed / Leap), Alpine и Windows.

**Архитектуры:** `amd64` · `386` · `arm64` (aarch64) · `armv7` · `armv6` · `armv5` · `s390x`.

## Варианты базы данных

Daltoon-UI поддерживает два бэкенда, выбираемых при установке:

- **SQLite** (по умолчанию) — единый файл по пути `/etc/d-ui/d-ui.db`. Без настройки, идеально для небольших и средних развёртываний.
- **PostgreSQL** — рекомендуется при большом числе клиентов или конфигурациях с несколькими узлами. Установщик может установить PostgreSQL локально за вас или принять DSN к существующему серверу.

Во время выполнения бэкенд выбирается через переменные окружения (установщик записывает их за вас в `/etc/default/d-ui`):

```
DUI_DB_TYPE=postgres
DUI_DB_DSN=postgres://dui:duipass@127.0.0.1:5432/dui?sslmode=disable
```

### Перенос существующей установки SQLite в PostgreSQL

```bash
d-ui migrate-db --dsn "postgres://dui:duipass@127.0.0.1:5432/dui?sslmode=disable"
# затем задайте DUI_DB_TYPE и DUI_DB_DSN в /etc/default/d-ui и перезапустите:
systemctl restart d-ui
```

Исходный файл SQLite остаётся нетронутым; удалите его вручную после проверки нового бэкенда.

### Docker

Команда по умолчанию `docker compose up -d` продолжает использовать SQLite. Чтобы запустить со встроенным сервисом PostgreSQL, раскомментируйте две строки переменных окружения `DUI_DB_*` в `docker-compose.yml` и запустите с профилем:

```bash
docker compose --profile postgres up -d
```

Образ включает Fail2ban (включён по умолчанию) для применения **лимитов IP** по каждому клиенту. Fail2ban блокирует нарушителей с помощью `iptables`, что требует возможности `NET_ADMIN`. `docker-compose.yml` уже предоставляет её через `cap_add`; если вы вместо этого запускаете контейнер через `docker run`, добавьте возможности самостоятельно, иначе блокировки будут регистрироваться, но никогда не применяться:

```bash
docker run -d --cap-add=NET_ADMIN --cap-add=NET_RAW ... ghcr.io/mdaltoon10/D-UI
```

## Переменные окружения

| Переменная | Описание | По умолчанию |
| --- | --- | --- |
| `DUI_DB_TYPE` | Бэкенд базы данных: `sqlite` или `postgres` | `sqlite` |
| `DUI_DB_DSN` | Строка подключения PostgreSQL (когда `DUI_DB_TYPE=postgres`) | — |
| `DUI_DB_FOLDER` | Каталог для файла базы данных SQLite | `/etc/d-ui` |
| `DUI_DB_MAX_OPEN_CONNS` | Максимум открытых соединений (пул PostgreSQL) | — |
| `DUI_DB_MAX_IDLE_CONNS` | Максимум простаивающих соединений (пул PostgreSQL) | — |
| `DUI_INIT_WEB_BASE_PATH` | Начальный URI-путь для веб-панели | `/` |
| `DUI_ENABLE_FAIL2BAN` | Включить применение лимитов IP на основе Fail2ban | `true` |
| `DUI_LOG_LEVEL` | Уровень логирования (`debug`, `info`, `warning`, `error`) | `info` |
| `DUI_DEBUG` | Включить режим отладки | `false` |
| `DUI_TUNNEL_HEALTH_MONITOR` | Включить монитор состояния туннеля (опрашивает URL и перезапускает xray после многократных сбоев; перезапуск отключает всех клиентов) | `false` |
| `DUI_TUNNEL_HEALTH_PROXY` | Прокси, через который отправляется проба; укажите локальный входящий xray, чтобы проба проверяла туннель (например, `socks5://127.0.0.1:1080`). Пустое значение означает, что проба проверяет только связь с хостом | — |
| `DUI_TUNNEL_HEALTH_URL` | URL, опрашиваемый для проверки состояния туннеля | `https://www.cloudflare.com/cdn-cgi/trace` |
| `DUI_TUNNEL_HEALTH_INTERVAL` | Интервал между пробами | `30s` |
| `DUI_TUNNEL_HEALTH_TIMEOUT` | Таймаут на одну пробу | `10s` |
| `DUI_TUNNEL_HEALTH_FAILURES` | Число последовательных сбоев до запуска перезапуска | `3` |
| `DUI_TUNNEL_HEALTH_COOLDOWN` | Минимальная задержка между последовательными перезапусками | `5m` |

## Поддерживаемые языки

Интерфейс панели доступен на 13 языках:

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
