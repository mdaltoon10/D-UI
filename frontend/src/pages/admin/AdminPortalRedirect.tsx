import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useTheme } from '@/hooks/useTheme';

export default function AdminPortalRedirect() {
  const { webPath } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();

  useEffect(() => {
    if (!webPath) {
      navigate('/');
      return;
    }
    // Redirect to the backend portal route to trigger the login flow
    const basePath = window.X_UI_BASE_PATH || '/';
    // Remove trailing slash if present to avoid //portal
    const cleanBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
    window.location.href = `${cleanBase}/portal/${webPath}`;
  }, [webPath, navigate]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: 16,
        background: isDark ? '#020c1b' : '#f0f9ff',
        color: isDark ? '#00b4d8' : '#0077b6',
        transition: 'all 0.2s ease',
      }}
    >
      <Spin size="large" />
      <div style={{ fontSize: '1.2rem', fontWeight: '600', letterSpacing: '0.5px' }}>
        Entering Reseller Portal...
      </div>
    </div>
  );
}
