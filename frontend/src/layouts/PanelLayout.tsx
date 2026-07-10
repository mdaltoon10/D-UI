import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useWebSocketBridge } from '@/api/websocketBridge';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function PanelLayout() {
  useWebSocketBridge();
  usePageTitle();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // If we are in the master admin panel of the real backend, clear any stale reseller localStorage
    const isResellerBackend = typeof window !== 'undefined' && !!window.X_UI_IS_RESELLER;
    const isProductionBackend = typeof window !== 'undefined' && !!window.X_UI_CUR_VER;
    if (!isResellerBackend && isProductionBackend) {
      localStorage.removeItem('daltoon_current_admin');
    }
  }, []);

  const isAllowedPath = (p: string) => {
    return p === '/' || p === '/clients' || p === '/authentication' || p.startsWith('/portal');
  };

  useEffect(() => {
    const isReseller = (typeof window !== 'undefined' && typeof window.X_UI_BASE_PATH !== 'undefined')
      ? !!window.X_UI_IS_RESELLER
      : !!localStorage.getItem('daltoon_current_admin');

    if (isReseller) {
      try {
        const basePath = (typeof window !== 'undefined' && window.X_UI_BASE_PATH) || '/';
        const path = location.pathname;
        
        // Normalize: if path starts with basePath, strip it to get the internal route
        const normalizedBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
        let internalPath = path;
        if (normalizedBase && internalPath.startsWith(normalizedBase)) {
          internalPath = internalPath.substring(normalizedBase.length);
        }
        if (!internalPath.startsWith('/')) internalPath = '/' + internalPath;
        
        const cleanPath = internalPath.replace(/^\/panel\//, '/').replace(/^\/panel$/, '/').replace(/\/+$/, '') || '/';
        
        if (!isAllowedPath(cleanPath)) {
          navigate('/', { replace: true });
        }
      } catch {}
    }
  }, [location.pathname, navigate]);

  return <Outlet />;
}
