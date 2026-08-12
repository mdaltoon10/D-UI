import type { ReactNode } from 'react';

interface ProfileTransportBlockProps {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ProfileTransportBlock({
  title,
  description,
  action,
  children,
  className = '',
}: ProfileTransportBlockProps) {
  const hasHeader = title != null || description != null || action != null;

  return (
    <section className={`ext-proxy-transport-block ${className}`.trim()}>
      {hasHeader && (
        <div className="ext-proxy-transport-block__head">
          <div className="ext-proxy-transport-block__identity">
            {title != null && (
              <h4 className="ext-proxy-transport-block__title">{title}</h4>
            )}
            {description != null && (
              <div className="ext-proxy-transport-block__description">
                {description}
              </div>
            )}
          </div>
          {action != null && (
            <div className="ext-proxy-transport-block__action">{action}</div>
          )}
        </div>
      )}
      <div className="ext-proxy-transport-block__body">{children}</div>
    </section>
  );
}

interface ProfileTransportGridProps {
  children: ReactNode;
  columns?: 1 | 2 | 3;
  className?: string;
}

export function ProfileTransportGrid({
  children,
  columns = 2,
  className = '',
}: ProfileTransportGridProps) {
  return (
    <div
      className={[
        'ext-proxy-transport-grid',
        `ext-proxy-transport-grid--${columns}`,
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}

interface ProfileTransportFieldProps {
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
  wide?: boolean;
  className?: string;
}

export function ProfileTransportField({
  label,
  children,
  hint,
  wide = false,
  className = '',
}: ProfileTransportFieldProps) {
  return (
    <div
      className={[
        'ext-proxy-field',
        'ext-proxy-transport-field',
        wide ? 'ext-proxy-transport-field--wide' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      <span className="ext-proxy-flabel ext-proxy-transport-field__label">
        {label}
      </span>
      <div className="ext-proxy-transport-field__control">{children}</div>
      {hint != null && (
        <span className="ext-proxy-fhint ext-proxy-transport-field__hint">
          {hint}
        </span>
      )}
    </div>
  );
}

interface ProfileTransportToggleRowProps {
  label: ReactNode;
  control: ReactNode;
  hint?: ReactNode;
  className?: string;
}

export function ProfileTransportToggleRow({
  label,
  control,
  hint,
  className = '',
}: ProfileTransportToggleRowProps) {
  return (
    <div
      className={[
        'ext-proxy-field',
        'ext-proxy-transport-toggle',
        className,
      ].filter(Boolean).join(' ')}
    >
      <div className="ext-proxy-transport-toggle__copy">
        <span className="ext-proxy-flabel ext-proxy-transport-toggle__label">
          {label}
        </span>
        {hint != null && (
          <span className="ext-proxy-fhint ext-proxy-transport-toggle__hint">
            {hint}
          </span>
        )}
      </div>
      <div className="ext-proxy-transport-toggle__control">{control}</div>
    </div>
  );
}

interface ProfileTransportSubsectionProps {
  title: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ProfileTransportSubsection({
  title,
  children,
  className = '',
}: ProfileTransportSubsectionProps) {
  return (
    <section
      className={`ext-proxy-transport-subsection ${className}`.trim()}
    >
      <h5 className="ext-proxy-transport-subsection__title">{title}</h5>
      <div className="ext-proxy-transport-subsection__body">{children}</div>
    </section>
  );
}
