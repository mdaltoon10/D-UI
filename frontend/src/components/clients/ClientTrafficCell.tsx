import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Popover, Progress } from 'antd';

import InfinityIcon from '@/components/ui/InfinityIcon';
import { useTheme } from '@/hooks/useTheme';
import { computeTrafficDisplay } from '@/lib/clients/traffic-display';
import { SizeFormatter } from '@/utils';
import './ClientTrafficCell.css';

export interface ClientTrafficCellProps {
  up?: number;
  down?: number;
  total?: number;
  enabled?: boolean;
  trafficDiff?: number;
  compact?: boolean;
  speedUp?: number;
  speedDown?: number;
}

export default function ClientTrafficCell({
  up = 0,
  down = 0,
  total = 0,
  enabled = true,
  trafficDiff = 0,
  compact = false,
  speedUp = 0,
  speedDown = 0,
}: ClientTrafficCellProps) {
  const { t } = useTranslation();
  const { isDark } = useTheme();

  const display = useMemo(
    () => computeTrafficDisplay({ up, down, total, enabled, trafficDiff }, isDark),
    [up, down, total, enabled, trafficDiff, isDark],
  );

  const popover = (
    <table className="client-traffic-popover">
      <tbody>
        <tr>
          <td>↑</td>
          <td>{SizeFormatter.sizeFormat(up)}</td>
          <td>↓</td>
          <td>{SizeFormatter.sizeFormat(down)}</td>
        </tr>
        {(speedUp > 0 || speedDown > 0) && (
          <tr>
            <td>↑</td>
            <td>{SizeFormatter.speedFormat(speedUp)}</td>
            <td>↓</td>
            <td>{SizeFormatter.speedFormat(speedDown)}</td>
          </tr>
        )}
        {!display.isUnlimited && (
          <tr>
            <td colSpan={2}>{t('remained')}</td>
            <td colSpan={2}>{SizeFormatter.sizeFormat(display.remaining)}</td>
          </tr>
        )}
      </tbody>
    </table>
  );

  const rootClass = [
    'client-traffic-cell',
    compact ? 'is-compact' : '',
    display.isUnlimited ? 'is-unlimited' : '',
  ].filter(Boolean).join(' ');

  const hasSpeed = speedUp > 0 || speedDown > 0;

  const mainCell = (
    <div className={rootClass}>
      <span className="client-traffic-cell-used">{SizeFormatter.sizeFormat(display.used)}</span>
      <Progress
        className="client-traffic-cell-bar"
        percent={display.percent}
        showInfo={false}
        strokeColor={display.strokeColor}
        status={display.status}
        size={compact ? 'small' : 'medium'}
      />
      <span className="client-traffic-cell-limit">
        {display.isUnlimited ? (
          <span className="client-traffic-cell-infinity" aria-label={t('subscription.unlimited')}>
            <InfinityIcon />
          </span>
        ) : (
          SizeFormatter.sizeFormat(total)
        )}
      </span>
    </div>
  );

  return (
    <Popover content={popover} trigger={['hover', 'click']} placement="top">
      <div
        className={`client-traffic-container ${compact ? 'is-compact' : ''}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: compact ? 'flex-start' : 'center',
          width: '100%',
        }}
      >
        {mainCell}
        {hasSpeed && (
          <div
            className={`client-traffic-speed ${compact ? 'is-compact-badge' : ''}`}
            style={
              compact
                ? {
                    fontSize: '11px',
                    marginTop: '6px',
                    color: 'var(--ant-color-primary, #3b82f6)',
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                    display: 'inline-flex',
                    gap: '5px',
                    alignItems: 'center',
                    alignSelf: 'flex-start',
                    background: isDark ? 'rgba(22, 119, 255, 0.16)' : 'rgba(22, 119, 255, 0.09)',
                    border: isDark ? '1px solid rgba(22, 119, 255, 0.28)' : '1px solid rgba(22, 119, 255, 0.2)',
                    borderRadius: '6px',
                    padding: '2px 8px',
                    lineHeight: '1.4',
                  }
                : {
                    fontSize: '11px',
                    marginTop: '4px',
                    color: 'var(--ant-color-primary, #3b82f6)',
                    fontWeight: 500,
                    fontVariantNumeric: 'tabular-nums',
                    display: 'inline-flex',
                    gap: '4px',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isDark ? 'rgba(22, 119, 255, 0.12)' : 'rgba(22, 119, 255, 0.08)',
                    border: isDark ? '1px solid rgba(22, 119, 255, 0.2)' : '1px solid rgba(22, 119, 255, 0.15)',
                    borderRadius: '4px',
                    padding: '1px 6px',
                  }
            }
          >
            <span>↑ {SizeFormatter.speedFormat(speedUp)}</span>
            <span style={{ opacity: 0.4 }}>/</span>
            <span>↓ {SizeFormatter.speedFormat(speedDown)}</span>
          </div>
        )}
      </div>
    </Popover>
  );
}
