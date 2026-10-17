import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, LoaderCircle, Check } from "lucide-react";
import { useDashboardStore } from "../store/dashboard";

export function Button({
  children,
  className = "",
  variant = "ghost",
  busy = false,
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "ghost" | "primary" | "outline";
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...props}
      className={`button ${variant} ${className}`}
      aria-busy={busy || undefined}
    >
      {busy ? <LoaderCircle className="spin" size={17} /> : null}
      {children}
    </button>
  );
}
export function Modal({
  title,
  description,
  children,
  onClose,
  wide = false,
  className = "",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  className?: string;
}) {
  const returnFocus = useRef(document.activeElement as HTMLElement | null);
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className={`modal ${wide ? "wide" : ""} ${className}`}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            returnFocus.current?.focus();
          }}
          aria-describedby={description ? undefined : undefined}
        >
          <header className="modal-header">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              {description ? (
                <Dialog.Description>{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">
                  {title}
                </Dialog.Description>
              )}
            </div>
            <Button
              className="icon-button"
              aria-label="Закрыть"
              onClick={onClose}
            >
              <X size={20} />
            </Button>
          </header>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className={`field ${error ? "invalid" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      <p
        id={`${id}-help`}
        className={`field-help ${error ? "error-text" : ""}`}
      >
        {error || hint || " "}
      </p>
    </div>
  );
}
/** Native OS-owned popup is an intentional settings-only UX variant. */
export function NativeSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} />;
}
export function Toast() {
  const message = useDashboardStore((s) => s.notice);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(
      () => useDashboardStore.setState({ notice: null }),
      4200,
    );
    return () => clearTimeout(t);
  }, [message]);
  return (
    <div
      className={`toast ${message ? "visible" : ""}`}
      role="status"
      aria-live="polite"
    >
      {message ? (
        <>
          <Check size={17} />
          <span>{message}</span>
        </>
      ) : null}
    </div>
  );
}
export function notify(message: string) {
  useDashboardStore.setState({ notice: message });
}
export function Empty({
  text = "Нет данных за этот период",
}: {
  text?: string;
}) {
  return (
    <div className="empty-chart">
      <span>—</span>
      <p>{text}</p>
    </div>
  );
}
