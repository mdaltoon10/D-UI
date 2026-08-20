export interface CommonClientTranslations {
  uploadLimit: string;
  uploadLimitDesc: string;
  downloadLimit: string;
  downloadLimitDesc: string;
  speedLimitTitle: string;
  ipLimit: string;
  ipLimitDesc: string;
  ipLog: string;
  clearIpLog: string;
}

const speedTranslationsMap: Record<string, CommonClientTranslations> = {
  'en': {
    uploadLimit: 'Upload Limit (Mbps)',
    uploadLimitDesc: 'Per-client upload speed limit (0 = unlimited)',
    downloadLimit: 'Download Limit (Mbps)',
    downloadLimitDesc: 'Per-client download speed limit (0 = unlimited)',
    speedLimitTitle: 'Speed Limit (Up / Down)',
    ipLimit: 'IP Limit',
    ipLimitDesc: 'Maximum simultaneous IPs (0 = unlimited)',
    ipLog: 'IP Logs',
    clearIpLog: 'Clear Logs',
  },
  'fa': {
    uploadLimit: 'محدودیت سرعت آپلود (Mbps)',
    uploadLimitDesc: 'سقف سرعت آپلود برای هر کلاینت (۰ = نامحدود)',
    downloadLimit: 'محدودیت سرعت دانلود (Mbps)',
    downloadLimitDesc: 'سقف سرعت دانلود برای هر کلاینت (۰ = نامحدود)',
    speedLimitTitle: 'محدودیت سرعت (آپلود / دانلود)',
    ipLimit: 'محدودیت IP',
    ipLimitDesc: 'حداکثر تعداد IP همزمان (۰ = نامحدود)',
    ipLog: 'گزارش IPها',
    clearIpLog: 'پاک کردن گزارش‌ها',
  },
  'ar': {
    uploadLimit: 'حد سرعة الرفع (Mbps)',
    uploadLimitDesc: 'حد أقصى لسرعة الرفع لكل عميل (0 = غير محدود)',
    downloadLimit: 'حد سرعة التحميل (Mbps)',
    downloadLimitDesc: 'حد أقصى لسرعة التحميل لكل عميل (0 = غير محدود)',
    speedLimitTitle: 'حد السرعة (رفع / تحميل)',
    ipLimit: 'حد عناوين IP',
    ipLimitDesc: 'الحد الأقصى لعناوين IP المتزامنة (0 = غير محدود)',
    ipLog: 'سجلات IP',
    clearIpLog: 'مسح السجلات',
  },
  'zh': {
    uploadLimit: '上传限速 (Mbps)',
    uploadLimitDesc: '每个客户端的上传速率限制（0 为不限制）',
    downloadLimit: '下载限速 (Mbps)',
    downloadLimitDesc: '每个客户端的下载速率限制（0 为不限制）',
    speedLimitTitle: '速率限制（上行 / 下行）',
    ipLimit: 'IP 限制',
    ipLimitDesc: '最大同时在线 IP 数（0 为不限制）',
    ipLog: 'IP 连接日志',
    clearIpLog: '清除日志',
  },
  'ru': {
    uploadLimit: 'Лимит отдачи (Мбит/с)',
    uploadLimitDesc: 'Ограничение скорости отдачи для клиента (0 = без ограничений)',
    downloadLimit: 'Лимит загрузки (Мбит/с)',
    downloadLimitDesc: 'Ограничение скорости загрузки для клиента (0 = без ограничений)',
    speedLimitTitle: 'Лимит скорости (Отдача / Загрузка)',
    ipLimit: 'Лимит IP',
    ipLimitDesc: 'Максимальное количество одновременных IP (0 = без ограничений)',
    ipLog: 'Журнал IP',
    clearIpLog: 'Очистить журнал',
  },
  'tr': {
    uploadLimit: 'Yükleme Limiti (Mbps)',
    uploadLimitDesc: 'İstemci başına yükleme hız limiti (0 = sınırsız)',
    downloadLimit: 'İndirme Limiti (Mbps)',
    downloadLimitDesc: 'İstemci başına indirme hız limiti (0 = sınırsız)',
    speedLimitTitle: 'Hız Limiti (Yükleme / İndirme)',
    ipLimit: 'IP Limiti',
    ipLimitDesc: 'Maksimum eşzamanlı IP sayısı (0 = sınırsız)',
    ipLog: 'IP Günlükleri',
    clearIpLog: 'Günlükleri Temizle',
  },
  'es': {
    uploadLimit: 'Límite de Subida (Mbps)',
    uploadLimitDesc: 'Límite de velocidad de subida por cliente (0 = ilimitado)',
    downloadLimit: 'Límite de Bajada (Mbps)',
    downloadLimitDesc: 'Límite de velocidad de bajada por cliente (0 = ilimitado)',
    speedLimitTitle: 'Límite de Velocidad (Subida / Bajada)',
    ipLimit: 'Límite de IP',
    ipLimitDesc: 'Máximo de IPs simultáneas (0 = ilimitado)',
    ipLog: 'Registros de IP',
    clearIpLog: 'Limpiar Registros',
  },
  'pt': {
    uploadLimit: 'Limite de Upload (Mbps)',
    uploadLimitDesc: 'Limite de velocidade de upload por cliente (0 = ilimitado)',
    downloadLimit: 'Limite de Download (Mbps)',
    downloadLimitDesc: 'Limite de velocidade de download por cliente (0 = ilimitado)',
    speedLimitTitle: 'Limite de Velocidade (Upload / Download)',
    ipLimit: 'Limite de IP',
    ipLimitDesc: 'Máximo de IPs simultâneos (0 = ilimitado)',
    ipLog: 'Registros de IP',
    clearIpLog: 'Limpar Registros',
  },
  'vi': {
    uploadLimit: 'Giới hạn Tải lên (Mbps)',
    uploadLimitDesc: 'Giới hạn tốc độ tải lên cho mỗi client (0 = không giới hạn)',
    downloadLimit: 'Giới hạn Tải xuống (Mbps)',
    downloadLimitDesc: 'Giới hạn tốc độ tải xuống cho mỗi client (0 = không giới hạn)',
    speedLimitTitle: 'Giới hạn Tốc độ (Tải lên / Tải xuống)',
    ipLimit: 'Giới hạn IP',
    ipLimitDesc: 'Số lượng IP đồng thời tối đa (0 = không giới hạn)',
    ipLog: 'Nhật ký IP',
    clearIpLog: 'Xóa Nhật ký',
  },
  'ja': {
    uploadLimit: 'アップロード制限 (Mbps)',
    uploadLimitDesc: 'クライアントごとのアップロード速度制限 (0 = 無制限)',
    downloadLimit: 'ダウンロード制限 (Mbps)',
    downloadLimitDesc: 'クライアントごとのダウンロード速度制限 (0 = 無制限)',
    speedLimitTitle: '速度制限 (アップロード / ダウンロード)',
    ipLimit: 'IP制限',
    ipLimitDesc: '最大同時接続IP数 (0 = 無制限)',
    ipLog: 'IPログ',
    clearIpLog: 'ログを消去',
  },
  'uk': {
    uploadLimit: 'Ліміт віддачі (Мбіт/с)',
    uploadLimitDesc: 'Обмеження швидкості віддачі для клієнта (0 = без обмежень)',
    downloadLimit: 'Ліміт завантаження (Мбіт/с)',
    downloadLimitDesc: 'Обмеження швидкості завантаження для клієнта (0 = без обмежень)',
    speedLimitTitle: 'Ліміт швидкості (Віддача / Завантаження)',
    ipLimit: 'Ліміт IP',
    ipLimitDesc: 'Максимальна кількість одночасних IP (0 = без обмежень)',
    ipLog: 'Журнал IP',
    clearIpLog: 'Очистити журнал',
  },
  'id': {
    uploadLimit: 'Batas Unggah (Mbps)',
    uploadLimitDesc: 'Batas kecepatan unggah per klien (0 = tidak terbatas)',
    downloadLimit: 'Batas Unduh (Mbps)',
    downloadLimitDesc: 'Batas kecepatan unduh per klien (0 = tidak terbatas)',
    speedLimitTitle: 'Batas Kecepatan (Unggah / Unduh)',
    ipLimit: 'Batas IP',
    ipLimitDesc: 'Maksimum IP simultan (0 = tidak terbatas)',
    ipLog: 'Log IP',
    clearIpLog: 'Bersihkan Log',
  },
};

export function getSpeedTranslations(lang?: string): CommonClientTranslations {
  if (!lang) return speedTranslationsMap['en'];

  if (speedTranslationsMap[lang]) {
    return speedTranslationsMap[lang];
  }

  const prefix = lang.split('-')[0].toLowerCase();
  if (speedTranslationsMap[prefix]) {
    return speedTranslationsMap[prefix];
  }

  return speedTranslationsMap['en'];
}
