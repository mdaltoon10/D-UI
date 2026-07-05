import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';

import PanelLayout from '@/layouts/PanelLayout';

const IndexPage = lazy(() => import('@/pages/index/IndexPage'));
const InboundsPage = lazy(() => import('@/pages/inbounds/InboundsPage'));
const ClientsPage = lazy(() => import('@/pages/clients/ClientsPage'));
const GroupsPage = lazy(() => import('@/pages/groups/GroupsPage'));
const NodesPage = lazy(() => import('@/pages/nodes/NodesPage'));
const HostsPage = lazy(() => import('@/pages/hosts/HostsPage'));
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'));
const XrayPage = lazy(() => import('@/pages/xray/XrayPage'));
const ApiDocsPage = lazy(() => import('@/pages/api-docs/ApiDocsPage'));
const AdminAccessPage = lazy(() => import('@/pages/admin/AdminAccessPage'));
const ClientsAdminPage = lazy(() => import('@/pages/admin/ClientsAdminPage'));
const AdminPortalRedirect = lazy(() => import('@/pages/admin/AdminPortalRedirect'));

function withSuspense(node: React.ReactNode) {
  return <Suspense fallback={null}>{node}</Suspense>;
}

function ResellerGuard({ children }: { children: React.ReactNode }) {
  const currentAdminRaw = localStorage.getItem('daltoon_current_admin');
  const isReseller = !!(currentAdminRaw || (typeof window !== 'undefined' && window.X_UI_IS_RESELLER));
  if (isReseller) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function computeBasename() {
  const raw = (typeof window !== 'undefined' && window.X_UI_BASE_PATH) || '/';
  // Remove multiple trailing slashes and ensure it starts with / if not empty
  const trimmed = raw.replace(/\/+$/, '');
  if (trimmed === '' || trimmed === '/') return '';
  return trimmed.startsWith('/') ? trimmed : '/' + trimmed;
}

const routes: RouteObject[] = [
  {
    path: '/',
    element: <PanelLayout />,
    children: [
      { index: true, element: withSuspense(<IndexPage />) },
      { path: 'panel', element: withSuspense(<IndexPage />) },
      { path: 'inbounds', element: withSuspense(<ResellerGuard>{withSuspense(<InboundsPage />)}</ResellerGuard>) },
      { path: 'panel/inbounds', element: withSuspense(<ResellerGuard>{withSuspense(<InboundsPage />)}</ResellerGuard>) },
      { path: 'clients', element: withSuspense(<ClientsPage />) },
      { path: 'panel/clients', element: withSuspense(<ClientsPage />) },
      { path: 'groups', element: withSuspense(<ResellerGuard>{withSuspense(<GroupsPage />)}</ResellerGuard>) },
      { path: 'panel/groups', element: withSuspense(<ResellerGuard>{withSuspense(<GroupsPage />)}</ResellerGuard>) },
      { path: 'nodes', element: withSuspense(<ResellerGuard>{withSuspense(<NodesPage />)}</ResellerGuard>) },
      { path: 'panel/nodes', element: withSuspense(<ResellerGuard>{withSuspense(<NodesPage />)}</ResellerGuard>) },
      { path: 'hosts', element: withSuspense(<ResellerGuard>{withSuspense(<HostsPage />)}</ResellerGuard>) },
      { path: 'panel/hosts', element: withSuspense(<ResellerGuard>{withSuspense(<HostsPage />)}</ResellerGuard>) },
      { path: 'settings', element: withSuspense(<ResellerGuard>{withSuspense(<SettingsPage />)}</ResellerGuard>) },
      { path: 'panel/settings', element: withSuspense(<ResellerGuard>{withSuspense(<SettingsPage />)}</ResellerGuard>) },
      { path: 'xray', element: withSuspense(<ResellerGuard>{withSuspense(<XrayPage />)}</ResellerGuard>) },
      { path: 'panel/xray', element: withSuspense(<ResellerGuard>{withSuspense(<XrayPage />)}</ResellerGuard>) },
      { path: 'outbound', element: withSuspense(<ResellerGuard>{withSuspense(<XrayPage />)}</ResellerGuard>) },
      { path: 'panel/outbound', element: withSuspense(<ResellerGuard>{withSuspense(<XrayPage />)}</ResellerGuard>) },
      { path: 'routing', element: withSuspense(<ResellerGuard>{withSuspense(<XrayPage />)}</ResellerGuard>) },
      { path: 'panel/routing', element: withSuspense(<ResellerGuard>{withSuspense(<XrayPage />)}</ResellerGuard>) },
      { path: 'api-docs', element: withSuspense(<ResellerGuard>{withSuspense(<ApiDocsPage />)}</ResellerGuard>) },
      { path: 'panel/api-docs', element: withSuspense(<ResellerGuard>{withSuspense(<ApiDocsPage />)}</ResellerGuard>) },
      { path: 'admin-access', element: withSuspense(<ResellerGuard>{withSuspense(<AdminAccessPage />)}</ResellerGuard>) },
      { path: 'panel/admin-access', element: withSuspense(<ResellerGuard>{withSuspense(<AdminAccessPage />)}</ResellerGuard>) },
      { path: 'clients-admin', element: withSuspense(<ResellerGuard>{withSuspense(<ClientsAdminPage />)}</ResellerGuard>) },
      { path: 'panel/clients-admin', element: withSuspense(<ResellerGuard>{withSuspense(<ClientsAdminPage />)}</ResellerGuard>) },
      { path: 'portal/:webPath', element: withSuspense(<AdminPortalRedirect />) },
      { path: 'panel/portal/:webPath', element: withSuspense(<AdminPortalRedirect />) },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];

export const router = createBrowserRouter(routes, {
  basename: computeBasename(),
});
