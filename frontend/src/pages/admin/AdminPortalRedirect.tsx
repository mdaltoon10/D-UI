import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spin } from 'antd';

export default function AdminPortalRedirect() {
  const { webPath } = useParams();
  const navigate = useNavigate();

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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16 }}>
      <Spin size="large" />
      <div style={{ fontSize: '1.2rem', fontWeight: '600' }}>Entering Reseller Portal...</div>
    </div>
  );
}
