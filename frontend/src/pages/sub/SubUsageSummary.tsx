import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Progress, Tag, Row, Col } from 'antd';
import { ClockCircleOutlined, ThunderboltOutlined, GlobalOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';

import './SubUsageSummary.css';

interface SubUsageSummaryProps {
  usedByte: number;
  totalByte: number;
  usedLabel: string;
  totalLabel: string;
  remainedLabel: string;
  expireMs: number;
  isActive: boolean;
  upLimitMbps?: number;
  downLimitMbps?: number;
  ipLimit?: number;
  iranDirect?: boolean;
}

function pickStrokeColor(pct: number): { from: string; to: string } {
  if (pct >= 90) return { from: '#ff7875', to: '#ff4d4f' };
  if (pct >= 75) return { from: '#ffc53d', to: '#fa8c16' };
  return { from: '#5fc983', to: '#36b37e' };
}

function formatExpiryChip(expireMs: number): { label: string; color: string } | null {
  if (expireMs <= 0) return null;
  const diff = expireMs - Date.now();
  if (diff <= 0) return { label: 'Expired', color: 'red' };
  const days = Math.floor(diff / 86400000);
  if (days >= 1) return { label: `${days}d`, color: days <= 3 ? 'orange' : 'blue' };
  const hours = Math.max(1, Math.floor(diff / 3600000));
  return { label: `${hours}h`, color: 'orange' };
}

export default function SubUsageSummary({
  usedByte,
  totalByte,
  usedLabel,
  totalLabel,
  remainedLabel,
  expireMs,
  isActive,
  upLimitMbps = 40,
  downLimitMbps = 80,
  ipLimit: _ipLimit = 5,
  iranDirect = true,
}: SubUsageSummaryProps) {
  const { t } = useTranslation();
  const pct = useMemo(() => {
    if (totalByte <= 0) return 0;
    const v = (usedByte / totalByte) * 100;
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(100, v));
  }, [usedByte, totalByte]);

  const expiry = formatExpiryChip(expireMs);
  const isUnlimited = totalByte <= 0;
  const stroke = pickStrokeColor(pct);

  return (
    <div className={`usage-summary ${!isActive ? 'is-inactive' : ''}`}>
      <div className="usage-summary-head">
        <div className="usage-summary-labels">
          <span className="usage-summary-used">{usedLabel}</span>
          <span className="usage-summary-sep">/</span>
          <span className="usage-summary-total">{isUnlimited ? '∞' : totalLabel}</span>
        </div>
        <div className="usage-summary-chips">
          {iranDirect && (
            <Tag color="cyan" icon={<GlobalOutlined />}>
              Iran Direct Routing
            </Tag>
          )}
          {isUnlimited && (
            <Tag color="purple" icon={<ThunderboltOutlined />}>
              {t('subscription.unlimited')}
            </Tag>
          )}
          {expiry && (
            <Tag color={expiry.color} icon={<ClockCircleOutlined />}>
              {expiry.label}
            </Tag>
          )}
        </div>
      </div>
      {!isUnlimited && (
        <Progress
          percent={pct}
          showInfo={false}
          strokeColor={{ '0%': stroke.from, '100%': stroke.to }}
          trailColor="var(--ant-color-fill-secondary)"
          strokeWidth={10}
          className="usage-summary-bar"
        />
      )}
      <div className="usage-summary-foot">
        {!isUnlimited && (
          <>
            <span className="usage-summary-remained">{remainedLabel}</span>
            <span className="usage-summary-pct">{pct.toFixed(1)}%</span>
          </>
        )}
      </div>

      <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <div style={{ background: 'var(--ant-color-fill-quaternary)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--ant-color-border-secondary)' }}>
            <div style={{ fontSize: 11, color: 'var(--ant-color-text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ArrowDownOutlined style={{ color: '#10b981' }} /> Download Speed Limit
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>
              {downLimitMbps > 0 ? `${downLimitMbps} Mbps` : 'Unlimited'}
            </div>
          </div>
        </Col>
        <Col span={12}>
          <div style={{ background: 'var(--ant-color-fill-quaternary)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--ant-color-border-secondary)' }}>
            <div style={{ fontSize: 11, color: 'var(--ant-color-text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ArrowUpOutlined style={{ color: '#3b82f6' }} /> Upload Speed Limit
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>
              {upLimitMbps > 0 ? `${upLimitMbps} Mbps` : 'Unlimited'}
            </div>
          </div>
        </Col>
      </Row>
    </div>
  );
}
