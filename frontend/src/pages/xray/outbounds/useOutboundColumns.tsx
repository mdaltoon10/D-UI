import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dropdown, Tag, Tooltip } from 'antd';
import {
  RetweetOutlined,
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
  VerticalAlignTopOutlined,
  ThunderboltOutlined,
  LoadingOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

import { SizeFormatter } from '@/utils';
import { OutboundProtocols as Protocols } from '@/schemas/primitives';
import { isUdpOutbound } from '@/hooks/useXraySetting';
import type { OutboundTestState, OutboundTrafficRow } from '@/hooks/useXraySetting';

import type { OutboundRow } from './outbounds-tab-types';
import TestResultPopover from './TestResultPopover';
import {
  isTesting,
  isUntestable,
  outboundAddresses,
  showSecurity,
  testResult,
  trafficFor,
} from './outbounds-tab-helpers';

interface OutboundColumnsParams {
  testMode: 'tcp' | 'http';
  rows: OutboundRow[];
  outboundsTraffic: OutboundTrafficRow[];
  outboundTestStates: Record<number, OutboundTestState>;
  openEdit: (idx: number) => void;
  setFirst: (idx: number) => void;
  moveUp: (idx: number) => void;
  moveDown: (idx: number) => void;
  confirmDelete: (idx: number) => void;
  onResetTraffic: (tag: string) => void;
  onTest: (index: number, mode: string) => void;
}

export function useOutboundColumns({
  testMode,
  rows,
  outboundsTraffic,
  outboundTestStates,
  openEdit,
  setFirst,
  moveUp,
  moveDown,
  confirmDelete,
  onResetTraffic,
  onTest,
}: OutboundColumnsParams): ColumnsType<OutboundRow> {
  const { t } = useTranslation();
  return useMemo(
    () => [
      {
        title: '#',
        key: 'action',
        align: 'center',
        width: 100,
        render: (_v, record, index) => {
          const targetIndex = record.key ?? index;
          return (
            <div className="action-cell">
              <span className="row-index">{index + 1}</span>
              <div className="action-buttons">
                <Button shape="circle" size="small" icon={<EditOutlined />} aria-label={t('edit')} onClick={() => openEdit(targetIndex)} />
                <Dropdown
                  trigger={['click']}
                  menu={{
                    items: [
                      ...(index > 0
                        ? [
                            { key: 'top', label: <><VerticalAlignTopOutlined /> {t('pages.xray.outbound.moveToTop')}</>, onClick: () => setFirst(targetIndex) },
                          ]
                        : []),
                      { key: 'up', label: <><ArrowUpOutlined /> {t('pages.inbounds.form.moveUp')}</>, disabled: index === 0, onClick: () => moveUp(targetIndex) },
                      { key: 'down', label: <><ArrowDownOutlined /> {t('pages.inbounds.form.moveDown')}</>, disabled: index === rows.length - 1, onClick: () => moveDown(targetIndex) },
                      { key: 'reset', label: <><RetweetOutlined /> {t('pages.inbounds.resetTraffic')}</>, onClick: () => onResetTraffic(record.tag || '') },
                      { key: 'del', danger: true, label: <><DeleteOutlined /> {t('delete')}</>, onClick: () => confirmDelete(targetIndex) },
                    ],
                  }}
                >
                  <Button shape="circle" size="small" icon={<MoreOutlined />} aria-label={t('more')} />
                </Dropdown>
              </div>
            </div>
          );
        },
      },
      {
        title: t('pages.xray.outbound.tag'),
        key: 'identity',
        align: 'left',
        render: (_v, record) => (
          <div className="identity-cell">
            <Tooltip title={record.tag}>
              <span className="tag-name">{record.tag}</span>
            </Tooltip>
            <div className="protocol-line">
              <Tag color="green">{record.protocol}</Tag>
              {[Protocols.VMess, Protocols.VLESS, Protocols.Trojan, Protocols.Shadowsocks].includes(record.protocol as never) && (
                <>
                  <Tag>{record.streamSettings?.network}</Tag>
                  {showSecurity(record.streamSettings?.security) && <Tag color="purple">{record.streamSettings?.security}</Tag>}
                </>
              )}
            </div>
          </div>
        ),
      },
      {
        title: t('pages.inbounds.address'),
        key: 'address',
        align: 'left',
        render: (_v, record) => {
          const addrs = outboundAddresses(record);
          return (
            <div className="address-list">
              {addrs.length === 0 ? (
                <span className="empty">—</span>
              ) : (
                addrs.map((addr) => (
                  <Tooltip key={addr} title={addr}>
                    <span className="address-pill">{addr}</span>
                  </Tooltip>
                ))
              )}
            </div>
          );
        },
      },
      {
        title: t('pages.inbounds.traffic'),
        key: 'traffic',
        align: 'left',
        width: 200,
        render: (_v, record) => {
          const tr = trafficFor(outboundsTraffic, record);
          return (
            <>
              <span className="traffic-up">↑ {SizeFormatter.sizeFormat(tr.up)}</span>
              <span className="traffic-sep" />
              <span className="traffic-down">↓ {SizeFormatter.sizeFormat(tr.down)}</span>
            </>
          );
        },
      },
      {
        title: t('pages.nodes.latency'),
        key: 'testResult',
        align: 'left',
        width: 140,
        render: (_v, record, index) => {
          const targetIndex = record.key ?? index;
          const r = testResult(outboundTestStates, targetIndex);
          if (!r) return isTesting(outboundTestStates, targetIndex) ? <LoadingOutlined /> : <span className="empty">—</span>;
          return <TestResultPopover result={r} />;
        },
      },
      {
        title: t('check'),
        key: 'test',
        align: 'center',
        width: 80,
        render: (_v, record, index) => {
          const targetIndex = record.key ?? index;
          return (
            <Tooltip title={`${t('check')} (${(isUdpOutbound(record) ? 'http' : testMode).toUpperCase()})`}>
              <Button
                type="primary"
                shape="circle"
                loading={isTesting(outboundTestStates, targetIndex)}
                disabled={isUntestable(record) || isTesting(outboundTestStates, targetIndex)}
                icon={<ThunderboltOutlined />}
                aria-label={t('check')}
                onClick={() => onTest(targetIndex, testMode)}
              />
            </Tooltip>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, testMode, rows, outboundTestStates, outboundsTraffic],
  );
}
