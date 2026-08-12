import { describe, expect, it, vi } from 'vitest';

vi.mock('@/api/queries/useOutboundTags', () => ({
  useOutboundTagGroups: () => ({
    data: { outbounds: [], balancers: [] },
  }),
}));
import { screen, act, render, cleanup } from '@testing-library/react';

import InboundFormModal, { buildAddModeValues } from '@/pages/inbounds/form/InboundFormModal';
import { DBInbound } from '@/models/dbinbound';
import { ThemeProvider } from '@/hooks/useTheme';
import {
  renderWithProviders,
  fieldLabels,
  listSelectOptions,
  chooseSelectOption,
} from './test-utils';

const emptyClientRectList = {
  length: 0,
  item: () => null,
  [Symbol.iterator]: function* () {},
} as unknown as DOMRectList;

const zeroDomRect = () => ({
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  toJSON: () => ({}),
}) as DOMRect;

// CodeMirror measures text ranges during modal rendering. jsdom does not fully
// implement Range geometry, so provide deterministic zero-sized geometry for tests.
if (typeof Range !== 'undefined') {
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value: () => emptyClientRectList,
  });

  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: zeroDomRect,
  });
}

if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
  const originalGetComputedStyle = window.getComputedStyle.bind(window);
  Object.defineProperty(window, 'getComputedStyle', {
    configurable: true,
    value: (element: Element) => originalGetComputedStyle(element),
  });
}

function renderModal() {
  return renderWithProviders(
    <InboundFormModal
      open
      mode="add"
      dbInbound={null}
      dbInbounds={[]}
      availableNodes={[]}
      onClose={() => {}}
      onSaved={() => {}}
    />,
  );
}

describe('InboundFormModal', () => {
  it('seeds the default profile with the inbound port', () => {
    const values = buildAddModeValues();
    const profiles = values.streamSettings?.externalProxy;

    expect(profiles).toHaveLength(1);
    expect(profiles?.[0]?.port).toBe(values.port);
    expect(profiles?.[0]?.port).not.toBe(1995);
    expect(profiles?.[0]?.dest).toBe('');
  });

  it('renders add mode without crashing', () => {
    renderModal();
    expect(document.querySelector('.ant-modal')).toBeTruthy();
    expect(fieldLabels().length).toBeGreaterThan(0);
  });

  it('field structure differs per protocol (not a vacuous snapshot loop)', async () => {
    renderModal();
    const protocols = listSelectOptions('protocol');
    expect(protocols.length).toBeGreaterThan(3);

    const labelsByProto: Record<string, string[]> = {};
    for (const proto of protocols) {
      chooseSelectOption('protocol', proto);
      // Flush antd Form.useWatch('protocol') before reading — without it every iteration
      // sees the same pre-update DOM and the loop asserts nothing (the original bug here).
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
      labelsByProto[proto] = fieldLabels();
    }

    // The loop must actually exercise protocol-specific rendering: distinct protocols
    // must yield distinct field sets (a vacuous loop makes them all identical).
    const distinctShapes = new Set(Object.values(labelsByProto).map((l) => l.join('|')));
    expect(distinctShapes.size).toBeGreaterThan(1);

    // Spot-check a protocol-distinguishing field that must appear after the switch.
    if (labelsByProto.shadowsocks) {
      expect(labelsByProto.shadowsocks).toContain('Encryption method');
    }
  }, 30000); // iterates every protocol, re-rendering a heavy modal each time — slow on CI runners

  it('preserves custom share address strategy when editing a local inbound', async () => {
    renderWithProviders(
      <InboundFormModal
        open
        mode="edit"
        dbInbound={new DBInbound({
          id: 1,
          port: 12345,
          listen: '',
          protocol: 'shadowsocks',
          remark: 'edge',
          enable: true,
          settings: {
            method: '2022-blake3-aes-128-gcm',
            password: 'server-password',
            network: 'tcp,udp',
            clients: [],
          },
          streamSettings: { network: 'tcp', security: 'none', tcpSettings: {} },
          sniffing: { enabled: false },
          nodeId: null,
          shareAddrStrategy: 'custom',
          shareAddr: 'edge.example.test',
        })}
        dbInbounds={[]}
        availableNodes={[]}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );

    const shareAddrInput = await screen.findByDisplayValue('edge.example.test');
    expect((shareAddrInput as HTMLInputElement).value).toBe('edge.example.test');
  });

  it('keeps the persisted node share strategy through the nodes-loading race (#5375)', async () => {
    const node = { id: 1, name: 'arm2', enable: true, status: 'online' } as never;
    const buildInbound = () => new DBInbound({
      id: 1,
      port: 23456,
      listen: '',
      protocol: 'vless',
      remark: 'noded',
      enable: true,
      settings: { clients: [] },
      streamSettings: { network: 'tcp', security: 'none', tcpSettings: {} },
      sniffing: { enabled: false },
      nodeId: 1,
      shareAddrStrategy: 'node',
    });
    const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
    const strategyItem = (title: string) =>
      document.querySelector(`.ant-select-content[title="${title}"]`);
    const modal = (nodes: never[], fetched: boolean) => (
      <ThemeProvider>
        <InboundFormModal
          open
          mode="edit"
          dbInbound={buildInbound()}
          dbInbounds={[]}
          availableNodes={nodes}
          availableNodesFetched={fetched}
          onClose={() => {}}
          onSaved={() => {}}
        />
      </ThemeProvider>
    );

    // Baseline: nodes already loaded, so the node option is offered and selected.
    render(modal([node], true));
    await flush();
    expect(strategyItem('Node address')).toBeTruthy();
    cleanup();

    // Race: the modal mounts before /nodes/list resolves (empty placeholder),
    // then nodes arrive. The persisted 'node' strategy must survive the gap and
    // stay selected once the option reappears — not silently revert to listen.
    const { rerender } = render(modal([], false));
    await flush();
    rerender(modal([node], true));
    await flush();
    expect(strategyItem('Node address')).toBeTruthy();
    expect(strategyItem('Inbound listen')).toBeFalsy();
  }, 15000);
});
