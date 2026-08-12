import { Button } from '@/pg-ui/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/pg-ui/components/ui/popover';
import { useClipboard } from '@/pg-ui/hooks/use-clipboard';
import { Info } from 'lucide-react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

interface VariablesPopoverProps {
  includeProtocolTransport?: boolean
  includeProfileTitle?: boolean
  includeFormat?: boolean
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
}

type VariableItemProps = {
  variable: string
  translationKey: string
  t: TFunction
  onCopy: (text: string) => Promise<void>
}

function VariableItem({ variable, translationKey, t, onCopy }: VariableItemProps) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <button
        type="button"
        className="bg-muted/50 hover:bg-muted shrink-0 cursor-pointer rounded-sm px-1.5 py-0.5 font-mono text-[11px] transition-colors"
        onClick={() => void onCopy(variable)}
        title={t('copy')}
        aria-label={t('copyVariable', { variable, defaultValue: `Copy ${variable}` })}
      >
        {variable}
      </button>
      <span className="text-muted-foreground min-w-0 truncate text-[11px]" title={t(translationKey)}>
        {t(translationKey)}
      </span>
    </div>
  )
}

function VariableItems({
  includeProtocolTransport,
  includeProfileTitle,
  includeFormat,
  t,
  onCopy,
  includeUsagePercentage = true,
}: {
  includeProtocolTransport: boolean
  includeProfileTitle: boolean
  includeFormat: boolean
  t: TFunction
  onCopy: (text: string) => Promise<void>
  includeUsagePercentage?: boolean
}) {
  return (
    <div className="space-y-1">
      {includeProfileTitle && (
        <>
          <VariableItem variable="{PROFILE_TITLE}" translationKey="hostsDialog.variables.profile_title" t={t} onCopy={onCopy} />
          <VariableItem variable="{url}" translationKey="hostsDialog.variables.url" t={t} onCopy={onCopy} />
        </>
      )}
      {includeFormat && <VariableItem variable="{format}" translationKey="hostsDialog.variables.format" t={t} onCopy={onCopy} />}
      <VariableItem variable="{USERNAME}" translationKey="hostsDialog.variables.username" t={t} onCopy={onCopy} />
      <VariableItem variable="{DATA_USAGE}" translationKey="hostsDialog.variables.data_usage" t={t} onCopy={onCopy} />
      {includeUsagePercentage && <VariableItem variable="{USAGE_PERCENTAGE}" translationKey="hostsDialog.variables.usage_percentage" t={t} onCopy={onCopy} />}
      <VariableItem variable="{DATA_LEFT}" translationKey="hostsDialog.variables.data_left" t={t} onCopy={onCopy} />
      <VariableItem variable="{DATA_LIMIT}" translationKey="hostsDialog.variables.data_limit" t={t} onCopy={onCopy} />
      <VariableItem variable="{DAYS_LEFT}" translationKey="hostsDialog.variables.days_left" t={t} onCopy={onCopy} />
      <VariableItem variable="{EXPIRE_DATE}" translationKey="hostsDialog.variables.expire_date" t={t} onCopy={onCopy} />
      <VariableItem variable="{JALALI_EXPIRE_DATE}" translationKey="hostsDialog.variables.jalali_expire_date" t={t} onCopy={onCopy} />
      <VariableItem variable="{TIME_LEFT}" translationKey="hostsDialog.variables.time_left" t={t} onCopy={onCopy} />
      <VariableItem variable="{STATUS_EMOJI}" translationKey="hostsDialog.variables.status_emoji" t={t} onCopy={onCopy} />
      {includeProtocolTransport && (
        <>
          <VariableItem variable="{PROTOCOL}" translationKey="hostsDialog.variables.protocol" t={t} onCopy={onCopy} />
          <VariableItem variable="{TRANSPORT}" translationKey="hostsDialog.variables.transport" t={t} onCopy={onCopy} />
        </>
      )}
      <VariableItem variable="{ADMIN_USERNAME}" translationKey="hostsDialog.variables.admin_username" t={t} onCopy={onCopy} />
    </div>
  )
}

export function VariablesPopover({ includeProtocolTransport = false, includeProfileTitle = false, includeFormat = false, side = 'bottom', align = 'start', sideOffset = 0 }: VariablesPopoverProps) {
  const { t } = useTranslation()
  const { copy } = useClipboard()

  const handleCopy = async (text: string) => {
    await copy(text)
    toast.success(t('usersTable.copied'))
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="h-auto w-auto p-0 hover:bg-transparent">
          <Info className="text-muted-foreground h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-3 sm:w-[320px]" side={side} align={align} sideOffset={sideOffset}>
        <div className="space-y-1.5">
          <h4 className="mb-2 text-[11px] font-medium">{t('hostsDialog.variables.title')}</h4>
          <div className="max-h-[60vh] space-y-1 overflow-y-auto pr-1">
            <VariableItems
              includeProtocolTransport={includeProtocolTransport}
              includeProfileTitle={includeProfileTitle}
              includeFormat={includeFormat}
              t={t}
              onCopy={handleCopy}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function VariablesList({
  includeProtocolTransport = false,
  includeProfileTitle = false,
  includeFormat = false,
}: {
  includeProtocolTransport?: boolean
  includeProfileTitle?: boolean
  includeFormat?: boolean
}) {
  const { t } = useTranslation()
  const { copy } = useClipboard()

  const handleCopy = async (text: string) => {
    await copy(text)
    toast.success(t('usersTable.copied'))
  }

  return (
    <VariableItems
      includeProtocolTransport={includeProtocolTransport}
      includeProfileTitle={includeProfileTitle}
      includeFormat={includeFormat}
      t={t}
      onCopy={handleCopy}
    />
  )
}
