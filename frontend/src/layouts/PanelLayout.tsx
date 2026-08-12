import { ConfigProvider, Layout } from 'antd';
import { Outlet } from 'react-router-dom';

import { useWebSocketBridge } from '@/api/websocketBridge';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useTheme } from '@/hooks/useTheme';
import AppSidebar from '@/layouts/AppSidebar';

export default function PanelLayout() {
  useWebSocketBridge();
  usePageTitle();
  const { antdThemeConfig } = useTheme();

  return (
    <ConfigProvider theme={antdThemeConfig}>
      <Layout style={{ minHeight: '100vh' }}>
        <AppSidebar />
        <Layout style={{ minWidth: 0 }}>
          <Outlet />
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
