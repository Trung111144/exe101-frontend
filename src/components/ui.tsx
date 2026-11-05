import { useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ApiError, downloadFile, fetchBlob } from '../api/client';
import { label, tone } from '../lib/format';
import { Link } from '../lib/router';

// ---------- data loading ----------
export function useAsync<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const counter = useRef(0);

  const reload = useCallback(async () => {
    const run = ++counter.current;
    setLoading(true);
    try {
      const value = await load();
      if (run === counter.current) {
        setData(value);
        setError(null);
      }
    } catch (err) {
      if (run === counter.current) setError(err);
    } finally {
      if (run === counter.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}

// Framework-level errorCodes from the backend (everything else shows the backend's own detail).
const codeText: Record<string, string> = {
  ACCESS_DENIED: 'Tài khoản này không có quyền làm việc này.',
  PAYLOAD_TOO_LARGE: 'Tệp quá lớn. Mỗi tệp tối đa 200 MB.',
  UNSUPPORTED_MEDIA_TYPE: 'Máy chủ không nhận định dạng dữ liệu này.',
  NOT_FOUND: 'Không tìm thấy địa chỉ API này. Kiểm tra backend đã cập nhật chưa.',
  METHOD_NOT_ALLOWED: 'Backend không hỗ trợ thao tác này ở địa chỉ này.',
  INTERNAL_ERROR: 'Máy chủ gặp lỗi. Thử lại sau ít phút.',
};

export function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    // INVALID_CREDENTIALS is a wrong email/password at login; only AUTHENTICATION_REQUIRED means the session ended.
    if (error.code === 'INVALID_CREDENTIALS') return 'Email hoặc mật khẩu không đúng, hoặc tài khoản đang bị khoá.';
    if (error.status === 401) return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.';
    if (codeText[error.code]) return codeText[error.code];
    const details = error.problem?.details;
    const extra = Array.isArray(details) && details.length ? ` (${details.join(', ')})` : '';
    return `${error.message}${extra}`;
  }
  return error instanceof Error ? error.message : String(error);
}

// ---------- primitives ----------
export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (!error) return null;
  const code = error instanceof ApiError ? error.code : null;
  return (
    <div className="alert alert-bad" role="alert">
      <div>
        <strong>{errorText(error)}</strong>
        {code && <div className="alert-code">Mã lỗi: {code}</div>}
      </div>
      {onRetry && <button className="btn btn-ghost btn-sm" onClick={onRetry}>Thử lại</button>}
    </div>
  );
}

export function Notice({ children, kind = 'info' }: { children: ReactNode; kind?: 'info' | 'ok' | 'warn' }) {
  // One wrapper so text and links inside flow as a sentence instead of becoming separate flex items.
  return <div className={`alert alert-${kind}`}><div>{children}</div></div>;
}

export function Loading({ text = 'Đang tải…' }: { text?: string }) {
  return <div className="loading" aria-live="polite"><span className="spinner" />{text}</div>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children && <div className="empty-body">{children}</div>}
    </div>
  );
}

export function Badge({ status, text }: { status: string | null | undefined; text?: string }) {
  return <span className={`badge badge-${tone(status)}`}>{text ?? label(status)}</span>;
}

type Variant = 'primary' | 'ghost' | 'danger' | 'quiet';
interface ActionProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  onClick: () => Promise<unknown> | unknown;
  variant?: Variant;
  size?: 'sm' | 'md';
  onError?: (error: unknown) => void;
  confirm?: string;
}

// A button that shows its own busy state and reports failures through onError (or an inline message).
export function Action({ onClick, variant = 'primary', size = 'md', onError, confirm, children, className, ...rest }: ActionProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  return (
    <span className="action">
      <button
        {...rest}
        className={`btn btn-${variant} ${size === 'sm' ? 'btn-sm' : ''} ${className ?? ''}`}
        disabled={busy || rest.disabled}
        onClick={async () => {
          if (confirm && !window.confirm(confirm)) return;
          setBusy(true);
          setError(null);
          try {
            await onClick();
          } catch (err) {
            if (onError) onError(err);
            else setError(err);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <span className="spinner spinner-sm" /> : null}
        {children}
      </button>
      {error ? <span className="action-error" role="alert">{errorText(error)}</span> : null}
    </span>
  );
}

export function Field({ label: text, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{text}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn btn-quiet btn-sm" onClick={onClose} aria-label="Đóng">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function PageHead({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Tabs<K extends string>({ tabs, value, onChange }: { tabs: [K, string][]; value: K; onChange: (k: K) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(([key, text]) => (
        <button key={key} role="tab" aria-selected={value === key} className={`tab ${value === key ? 'tab-on' : ''}`} onClick={() => onChange(key)}>
          {text}
        </button>
      ))}
    </div>
  );
}

// ---------- images & files ----------
// Public images can use the URL directly; protected ones need the bearer token, so they are fetched as blobs.
export function ProtectedImage({ path, alt, className }: { path: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let objectUrl: string | null = null;
    let alive = true;
    fetchBlob(path)
      .then(({ blob }) => {
        objectUrl = URL.createObjectURL(blob);
        if (alive) setUrl(objectUrl);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);
  if (failed) return <div className={`img-missing ${className ?? ''}`}>Không tải được ảnh</div>;
  if (!url) return <div className={`img-loading ${className ?? ''}`} />;
  return <img src={url} alt={alt} className={className} />;
}

export function DownloadButton({ path, name, children }: { path: string; name: string; children?: ReactNode }) {
  return (
    <Action variant="ghost" size="sm" onClick={() => downloadFile(path, name)}>
      {children ?? 'Tải xuống'}
    </Action>
  );
}

export const MB = 1024 * 1024;

// Files over the limit are refused here: far above the backend's 200 MB limit Tomcat may drop the connection, and
// the browser then sees a network error instead of 413 PAYLOAD_TOO_LARGE.
export function FilePicker({ multiple, accept, onPick, text = 'Chọn tệp', maxBytes = 200 * MB }: {
  multiple?: boolean; accept?: string; onPick: (files: File[]) => void; text?: string; maxBytes?: number;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [tooLarge, setTooLarge] = useState<string[]>([]);
  return (
    <>
      <input ref={ref} type="file" hidden multiple={multiple} accept={accept} onChange={(event) => {
        const files: File[] = Array.from(event.target.files ?? []);
        event.target.value = '';
        const rejected = files.filter((file) => file.size > maxBytes);
        setTooLarge(rejected.map((file) => file.name));
        const accepted = files.filter((file) => file.size <= maxBytes);
        if (accepted.length) onPick(accepted);
      }} />
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => ref.current?.click()}>{text}</button>
      {tooLarge.length > 0 && (
        <span className="action-error" role="alert">Bỏ qua {tooLarge.join(', ')}: vượt {Math.round(maxBytes / MB)} MB.</span>
      )}
    </>
  );
}

export function SignInPrompt({ what }: { what: string }) {
  return (
    <Empty title={`Đăng nhập để ${what}`}>
      <Link className="btn btn-primary" to={`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`}>Đăng nhập</Link>
    </Empty>
  );
}
