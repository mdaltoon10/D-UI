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

**Daltoon-UI** es un panel de control web avanzado y de código abierto para gestionar servidores [Xray-core](https://github.com/XTLS/Xray-core). Ofrece una interfaz limpia y multilingüe para desplegar, configurar y monitorear una amplia gama de protocolos de proxy y VPN — desde un único VPS hasta despliegues multinodo.

Construido como un fork mejorado del proyecto Daltoon-UI original, Daltoon-UI añade un soporte de protocolos más amplio, mayor estabilidad, contabilidad de tráfico por cliente y muchas funciones que mejoran la experiencia de uso.

> [!IMPORTANT]
> Este proyecto está destinado únicamente al uso personal. Por favor, no lo uses para fines ilegales ni en un entorno de producción.

## Características

- **Entradas multiprotocolo** — VLESS, VMess, Trojan, Shadowsocks, WireGuard, Hysteria2, HTTP, SOCKS (Mixed), Dokodemo-door / Tunnel y TUN.
- **Transportes y seguridad modernos** — TCP (Raw), mKCP, WebSocket, gRPC, HTTPUpgrade y XHTTP, protegidos con TLS, XTLS y REALITY.
- **Fallbacks** — sirve varios protocolos en un solo puerto (p. ej. VLESS y Trojan en el 443) usando la función de fallback de Xray.
- **Gestión por cliente** — cuotas de tráfico, fechas de caducidad, límites de IP, estado en línea en tiempo real y enlaces de compartición, códigos QR y suscripciones con un solo clic.
- **Estadísticas de tráfico** — por entrada, por cliente y por salida, con controles de reinicio.
- **Soporte multinodo** — gestiona y escala a través de varios servidores desde un único panel.
- **Salida y enrutamiento** — WARP, NordVPN, reglas de enrutamiento personalizadas, balanceadores de carga y encadenamiento de proxy de salida.
- **Servidor de suscripción integrado** con múltiples formatos de salida y [plantillas de página personalizables](docs/custom-subscription-templates.md).
- **Bot de Telegram** para monitorización y gestión remotas.
- **API RESTful** con documentación Swagger dentro del panel.
- **Almacenamiento flexible** — SQLite (predeterminado) o PostgreSQL.
- **13 idiomas de interfaz** con temas oscuro y claro.
- **Integración con Fail2ban** para aplicar límites de IP por cliente.
- **Acceso de administrador** para el panel de colaboración.

## Inicio Rápido

```bash
bash <(curl -Ls https://raw.githubusercontent.com/mdaltoon10/D-UI/main/install.sh)
```

Para instalar una versión específica, añade su etiqueta (p. ej. `v1.4.1`):

```bash
bash <(curl -Ls https://raw.githubusercontent.com/mdaltoon10/D-UI/main/install.sh) v1.4.1
```

Para instalar la versión **dev** continua (la última prelanzamiento por commit desde `main`, no una versión estable), pasa `dev-latest`:

```bash
bash <(curl -Ls https://raw.githubusercontent.com/mdaltoon10/D-UI/main/install.sh) dev-latest
```

Durante la instalación se generan un nombre de usuario, una contraseña y una ruta de acceso aleatorios. Tras la instalación, ejecuta `d-ui` para abrir el menú de gestión, donde puedes iniciar/detener el servicio, ver o restablecer tus credenciales de acceso, gestionar certificados SSL y mucho más.

Para la documentación completa, visita la [Wiki del proyecto](https://github.com/mdaltoon10/D-UI/wiki).

### Instalación desatendida

El instalador también se ejecuta de forma **no interactiva** para cloud-init.
Define `DUI_NONINTERACTIVE=1` (o canalízalo sin TTY) y realizará la instalación de principio a fin sin
ninguna pregunta, generando credenciales aleatorias y escribiéndolas en
`/etc/d-ui/install-result.env`. Consulta [`deploy/`](deploy/) para:

- [User-data de cloud-init](deploy/cloud-init/) — instalación desatendida en cualquier nube (Hetzner/AWS/DO/Vultr/GCP/Azure/Oracle)
- [Notas de Hetzner Cloud](deploy/marketplace/hetzner/) — despliegue basado en cloud-init en Hetzner

## Plataformas Compatibles

**Sistemas operativos:** Ubuntu, Debian, Armbian, Fedora, CentOS, RHEL, AlmaLinux, Rocky Linux, Oracle Linux, Amazon Linux, Virtuozzo, Arch, Manjaro, Parch, openSUSE (Tumbleweed / Leap), Alpine y Windows.

**Arquitecturas:** `amd64` · `386` · `arm64` (aarch64) · `armv7` · `armv6` · `armv5` · `s390x`.

## Opciones de Base de Datos

Daltoon-UI admite dos backends, que se eligen durante la instalación:

- **SQLite** (predeterminado) — un único archivo en `/etc/d-ui/d-ui.db`. Sin configuración, ideal para despliegues pequeños y medianos.
- **PostgreSQL** — recomendado para un gran número de clientes o configuraciones multinodo. El instalador puede instalar PostgreSQL localmente por ti, o aceptar un DSN a un servidor existente.

En tiempo de ejecución, el backend se selecciona mediante variables de entorno (el instalador las escribe por ti en `/etc/default/d-ui`):

```
DUI_DB_TYPE=postgres
DUI_DB_DSN=postgres://dui:duipass@127.0.0.1:5432/dui?sslmode=disable
```

### Migrar una instalación de SQLite existente a PostgreSQL

```bash
d-ui migrate-db --dsn "postgres://dui:duipass@127.0.0.1:5432/dui?sslmode=disable"
# luego define DUI_DB_TYPE y DUI_DB_DSN en /etc/default/d-ui y reinicia:
systemctl restart d-ui
```

El archivo SQLite de origen permanece intacto; elimínalo manualmente una vez que hayas verificado el nuevo backend.

### Docker

El comando predeterminado `docker compose up -d` sigue usando SQLite. Para ejecutarlo con el servicio PostgreSQL incluido, descomenta las dos líneas de variables de entorno `DUI_DB_*` en `docker-compose.yml` e inícialo con el perfil:

```bash
docker compose --profile postgres up -d
```

La imagen incluye Fail2ban (habilitado de forma predeterminada) para aplicar **límites de IP** por cliente. Fail2ban banea a los infractores con `iptables`, lo que requiere la capacidad `NET_ADMIN`. `docker-compose.yml` ya la concede mediante `cap_add`; si en su lugar inicias el contenedor con `docker run`, añade tú mismo las capacidades, de lo contrario los baneos se registran pero nunca se aplican:

```bash
docker run -d --cap-add=NET_ADMIN --cap-add=NET_RAW ... ghcr.io/mdaltoon10/D-UI
```

## Variables de Entorno

| Variable | Descripción | Predeterminado |
| --- | --- | --- |
| `DUI_DB_TYPE` | Backend de base de datos: `sqlite` o `postgres` | `sqlite` |
| `DUI_DB_DSN` | Cadena de conexión de PostgreSQL (cuando `DUI_DB_TYPE=postgres`) | — |
| `DUI_DB_FOLDER` | Directorio del archivo de base de datos SQLite | `/etc/d-ui` |
| `DUI_DB_MAX_OPEN_CONNS` | Máximo de conexiones abiertas (pool de PostgreSQL) | — |
| `DUI_DB_MAX_IDLE_CONNS` | Máximo de conexiones inactivas (pool de PostgreSQL) | — |
| `DUI_INIT_WEB_BASE_PATH` | La ruta URI inicial para el panel web | `/` |
| `DUI_ENABLE_FAIL2BAN` | Habilitar la aplicación de límites de IP basada en Fail2ban | `true` |
| `DUI_LOG_LEVEL` | Nivel de registro (`debug`, `info`, `warning`, `error`) | `info` |
| `DUI_DEBUG` | Habilitar el modo de depuración | `false` |
| `DUI_TUNNEL_HEALTH_MONITOR` | Habilitar el monitor de salud del túnel (sondea una URL y reinicia xray tras fallos repetidos; un reinicio desconecta a todos los clientes) | `false` |
| `DUI_TUNNEL_HEALTH_PROXY` | Proxy a través del cual se envía el sondeo; apúntalo a una entrada local de xray para que el sondeo pruebe el túnel (p. ej. `socks5://127.0.0.1:1080`). Vacío significa que el sondeo solo comprueba la conectividad del host | — |
| `DUI_TUNNEL_HEALTH_URL` | URL sondeada para verificar la salud del túnel | `https://www.cloudflare.com/cdn-cgi/trace` |
| `DUI_TUNNEL_HEALTH_INTERVAL` | Intervalo entre sondeos | `30s` |
| `DUI_TUNNEL_HEALTH_TIMEOUT` | Tiempo de espera por sondeo | `10s` |
| `DUI_TUNNEL_HEALTH_FAILURES` | Fallos consecutivos antes de que se active un reinicio | `3` |
| `DUI_TUNNEL_HEALTH_COOLDOWN` | Retardo mínimo entre reinicios consecutivos | `5m` |

## Idiomas Compatibles

La interfaz del panel está disponible en 13 idiomas:

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
