import { SidebarTrigger } from '@/pg-ui/components/ui/sidebar';
import { useVersionCheck } from '@/pg-ui/hooks/use-version-check';
import { useSystemVersion } from '@/pg-ui/hooks/use-system-version';
import { cn } from '@/pg-ui/lib/utils';

interface SidebarTriggerWithBadgeProps {
  showUpdateBadge?: boolean
}

export function SidebarTriggerWithBadge({ showUpdateBadge = true }: SidebarTriggerWithBadgeProps) {
  const { currentVersion } = useSystemVersion({ enabled: showUpdateBadge })
  const normalizedVersion = currentVersion ? String(currentVersion).replace(/[^0-9.]/g, '') : null
  const { hasUpdate, isLoading } = useVersionCheck(normalizedVersion, { enabled: showUpdateBadge })

  // Show badge when there's an update available
  // The badge is especially important when sidebar is closed/collapsed, but we show it always for visibility
  const showBadge = showUpdateBadge && !isLoading && hasUpdate

  return (
    <div className="relative inline-block">
      <SidebarTrigger />
      {showBadge && <span className={cn('absolute -top-1 -right-1 h-3 w-3 rounded-full', 'bg-amber-500 dark:bg-amber-400', 'border-background border-2')} aria-label="Update available" />}
    </div>
  )
}
