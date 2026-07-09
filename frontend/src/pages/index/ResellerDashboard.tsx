import { useEffect, useMemo, useState } from 'react';
import { Card, Col, Progress, Row, Statistic } from 'antd';
import { useTranslation } from 'react-i18next';
import { SwapOutlined, ArrowUpOutlined, ArrowDownOutlined, CloudUploadOutlined, CloudDownloadOutlined } from '@ant-design/icons';
import { HttpUtil, SizeFormatter } from '@/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useTheme } from '@/hooks/useTheme';
import type { Status } from '@/models/status';
import './StatusCard.css';

interface ResellerAdmin {
  id: string;
  remark?: string;
  username: string;
  volumeGB: number;
  days: number;
  trafficUsedBytes: number;
  clientsCount: number;
  createdAt: number;
  expiryTime: number;
  enable: boolean;
}

export default function ResellerDashboard({ currentAdminRaw, status }: { currentAdminRaw: string; status: Status }) {
  const { t, i18n } = useTranslation();
  const isFa = i18n.language === 'fa-IR';
  const { isMobile } = useMediaQuery();
  const { isDark, isUltra } = useTheme();
  const [adminInfo, setAdminInfo] = useState<ResellerAdmin | null>(null);

  const parsedAdmin = useMemo(() => {
    try {
      return JSON.parse(currentAdminRaw);
    } catch {
      return null;
    }
  }, [currentAdminRaw]);

  useEffect(() => {
    // Attempt to fetch admins list 
    HttpUtil.get<ResellerAdmin[]>('/panel/api/admins/list', undefined, { silent: true })
      .then(res => {
        if (res.success && Array.isArray(res.obj)) {
          let me = null;
          if (parsedAdmin?.username) {
            me = res.obj.find(a => a.username === parsedAdmin.username);
          }
          if (!me && res.obj.length > 0) {
             // Fallback for real backend where resellers usually only get their own info
             me = res.obj[0];
          }
          if (me) setAdminInfo(me);
        }
      })
      .catch(() => {});
  }, [parsedAdmin?.username]);

  const dict = {
    volumeUsage: isFa ? 'ترافیک کل' : 'Total Traffic',
    used: isFa ? 'مصرف شده' : 'Used',
    remaining: isFa ? 'باقیمانده' : 'Remaining',
    daysRemaining: isFa ? 'زمان باقیمانده' : 'Time Remaining',
    daysLabel: isFa ? 'روز' : 'Days',
    timeUsage: isFa ? 'زمان مصرفی' : 'Time Usage',
    unlimited: isFa ? 'نامحدود' : 'Unlimited',
  };

  const volumeTotal = adminInfo?.volumeGB ? adminInfo.volumeGB * 1073741824 : 0;
  const volumeUsed = adminInfo?.trafficUsedBytes || 0;
  const volumePercent = volumeTotal > 0 ? (volumeUsed / volumeTotal) * 100 : 0;
  const isUnlimitedVolume = !adminInfo || volumeTotal <= 0;

  const expiryTime = adminInfo?.expiryTime || 0;
  const createdAt = adminInfo?.createdAt || 0;
  const now = Date.now();
  const isUnlimitedTime = !adminInfo || expiryTime <= 0;
  
  let totalDays = adminInfo?.days || 30;
  let daysRemaining = 0;
  let timePercent = 0;

  if (!isUnlimitedTime) {
    daysRemaining = Math.max(0, Math.ceil((expiryTime - now) / 86400000));
    if (totalDays <= 0) {
      totalDays = Math.max(1, Math.ceil((expiryTime - (createdAt || now)) / 86400000));
    }
    const daysUsed = Math.max(0, totalDays - daysRemaining);
    timePercent = Math.min(100, (daysUsed / totalDays) * 100);
  }

  const gaugeSize = isMobile ? 60 : 90;
  const strokeWidth = isMobile ? 7 : 5;
  const railColor = isDark
    ? isUltra ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.16)'
    : 'rgba(0, 0, 0, 0.08)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 16 }}>
      <Card hoverable className="status-card">
        <Row gutter={[0, isMobile ? 16 : 0]}>
          <Col xs={24}>
            <Row>
              <Col span={12} className="text-center">
                <Progress
                  type="dashboard"
                  status="normal"
                  strokeColor={isUnlimitedVolume ? 'var(--ant-color-success)' : volumePercent > 90 ? 'var(--ant-color-error)' : volumePercent > 75 ? 'var(--ant-color-warning)' : 'var(--ant-color-primary)'}
                  railColor={railColor}
                  strokeWidth={strokeWidth}
                  percent={isUnlimitedVolume ? 100 : Number(volumePercent.toFixed(1))}
                  size={gaugeSize}
                  format={isUnlimitedVolume ? () => <SwapOutlined style={{ fontSize: isMobile ? 16 : 24, color: 'var(--ant-color-success)' }} /> : undefined}
                />
                <div>
                  <b>{dict.volumeUsage}:</b><br/> {isUnlimitedVolume ? dict.unlimited : `${SizeFormatter.sizeFormat(volumeUsed)} / ${SizeFormatter.sizeFormat(volumeTotal)}`}
                </div>
              </Col>
              
              <Col span={12} className="text-center">
                <Progress
                  type="dashboard"
                  status="normal"
                  strokeColor={isUnlimitedTime ? 'var(--ant-color-success)' : timePercent > 90 ? 'var(--ant-color-error)' : timePercent > 75 ? 'var(--ant-color-warning)' : 'var(--ant-color-primary)'}
                  railColor={railColor}
                  strokeWidth={strokeWidth}
                  percent={isUnlimitedTime ? 100 : Number(timePercent.toFixed(1))}
                  size={gaugeSize}
                  format={isUnlimitedTime ? () => <SwapOutlined style={{ fontSize: isMobile ? 16 : 24, color: 'var(--ant-color-success)' }} /> : undefined}
                />
                <div>
                  <b>{dict.daysRemaining}:</b><br/> {isUnlimitedTime ? dict.unlimited : `${daysRemaining} ${dict.daysLabel}`}
                </div>
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]}>
        <Col xs={24}>
          <Card title={isFa ? 'تعداد کاربران' : 'Clients Count'} hoverable>
            <Row gutter={isMobile ? [8, 8] : 0}>
              <Col span={24}>
                <Statistic
                  title={isFa ? 'تعداد کاربران ایجاد شده' : 'Created Clients'}
                  value={adminInfo?.clientsCount || 0}
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
