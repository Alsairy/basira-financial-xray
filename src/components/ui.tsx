import * as Dialog from '@radix-ui/react-dialog';
import {
  AlertCircle,
  ArrowUpLeft,
  CheckCircle2,
  ChevronLeft,
  FileSearch,
  LoaderCircle,
  X,
} from 'lucide-react';
import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { statusLabels, useApp } from '../context';
export function Button({
  children,
  variant = 'primary',
  busy = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={`btn btn-${variant} ${props.className || ''}`}
      aria-busy={busy}
    >
      {busy && <LoaderCircle size={17} className="spin" />}
      {children}
    </button>
  );
}
export function Badge({ status, children }: { status?: string; children?: ReactNode }) {
  const { locale } = useApp();
  return (
    <span className={`badge badge-${status || 'neutral'}`}>
      {children || statusLabels[status || '']?.[locale === 'ar' ? 0 : 1] || status}
    </span>
  );
}
export function Panel({
  children,
  title,
  subtitle,
  action,
  className = '',
}: {
  children: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && (
        <div className="panel-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function Empty({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">{icon || <FileSearch size={30} />}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" />
      <span>جارٍ تحميل مساحة العمل… / Loading</span>
    </div>
  );
}
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className={`modal ${wide ? 'modal-wide' : ''}`}
          aria-describedby={description ? 'dialog-description' : undefined}
        >
          <div className="modal-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              {description && (
                <Dialog.Description id="dialog-description">{description}</Dialog.Description>
              )}
            </div>
            <Dialog.Close className="icon-button" aria-label="إغلاق / Close">
              <X size={20} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Field({
  label,
  hint,
  children,
  className = '',
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Notice({
  children,
  type = 'info',
}: {
  children: ReactNode;
  type?: 'info' | 'warning' | 'success' | 'error';
}) {
  return (
    <div className={`notice notice-${type}`} role={type === 'error' ? 'alert' : undefined}>
      {type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
      <div>{children}</div>
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}
export function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowUpLeft size={15} />
    </button>
  );
}
export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { locale, tr } = useApp();
  const e = error as { message?: string; messageAr?: string };
  return (
    <Notice type="error">
      <span>{locale === 'ar' ? e.messageAr || e.message : e.message}</span>
      {onRetry && (
        <Button variant="ghost" onClick={onRetry}>
          {tr('إعادة المحاولة', 'Retry')}
        </Button>
      )}
    </Notice>
  );
}
export function Confirm({
  title,
  description,
  children,
  onConfirm,
}: {
  title: string;
  description: string;
  children: (open: () => void) => ReactNode;
  onConfirm: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <>
      {children(() => setOpen(true))}
      <Modal open={open} onClose={() => setOpen(false)} title={title} description={description}>
        <div className="modal-footer">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            إلغاء / Cancel
          </Button>
          <Button
            busy={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                setOpen(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            تأكيد / Confirm
          </Button>
        </div>
      </Modal>
    </>
  );
}
export function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button className="text-link" onClick={onClick}>
      <ChevronLeft size={16} />
      {label}
    </button>
  );
}
