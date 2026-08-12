import { useAdmin } from '@/pg-ui/hooks/use-admin';
import { canAccessRoute, firstAllowedRoute } from '@/pg-ui/utils/rbac';
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';

export default function RouteGuard({ children }: { children: React.ReactNode }) {
  const { admin } = useAdmin()
  const location = useLocation()
  const navigate = useNavigate()
  const hasNavigatedRef = useRef(false)
  const allowed = admin ? canAccessRoute(admin, location.pathname) : false

  useEffect(() => {
    if (!admin) {
      hasNavigatedRef.current = false
      return // Wait for admin data to load
    }

    if (allowed) {
      hasNavigatedRef.current = false
      return
    }

    if (hasNavigatedRef.current) {
      return
    }

    hasNavigatedRef.current = true
    navigate(firstAllowedRoute(admin), { replace: true })
  }, [admin, allowed, location.pathname, navigate])

  // Reset navigation flag when pathname changes (after navigation completes)
  useEffect(() => {
    hasNavigatedRef.current = false
  }, [location.pathname])

  if (!admin || !allowed) return null

  return <>{children}</>
}
