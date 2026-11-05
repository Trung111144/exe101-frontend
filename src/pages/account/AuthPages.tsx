import { useState, type FormEvent } from 'react';
import { auth } from '../../api/endpoints';
import { ErrorBox, Field, Notice } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { Link, navigate, useQuery } from '../../lib/router';

function useSubmit(action: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, submit };
}

function safeNext(next: string | null, fallback: string) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}

export function LoginPage() {
  const { loginCustomer } = useAuth();
  const query = useQuery();
  const [email, setEmail] = useState(query.get('email') ?? '');
  const [password, setPassword] = useState('');
  const { busy, error, submit } = useSubmit(async () => {
    await loginCustomer(email.trim(), password);
    navigate(safeNext(query.get('next'), '/'), { replace: true });
  });

  return (
    <div className="auth-card">
      <h1>Đăng nhập</h1>
      {query.get('registered') && <Notice kind="ok">Đã tạo tài khoản. Đăng nhập để tiếp tục.</Notice>}
      <form className="form" onSubmit={submit}>
        <Field label="Email"><input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Mật khẩu"><input className="input" type="password" autoComplete="current-password" required minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <ErrorBox error={error} />
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
      </form>
      <p className="auth-alt">Chưa có tài khoản? <Link to="/register">Tạo tài khoản</Link></p>
      <p className="auth-alt">Nhân viên? <Link to="/staff/login">Đăng nhập trang quản trị</Link></p>
    </div>
  );
}

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const { busy, error, submit } = useSubmit(async () => {
    if (password !== confirm) throw new Error('Hai lần nhập mật khẩu không khớp.');
    await auth.register(email.trim(), password, displayName.trim());
    navigate(`/login?registered=1&email=${encodeURIComponent(email.trim())}`, { replace: true });
  });

  return (
    <div className="auth-card">
      <h1>Tạo tài khoản</h1>
      <form className="form" onSubmit={submit}>
        <Field label="Tên hiển thị"><input className="input" required maxLength={160} value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></Field>
        <Field label="Email"><input className="input" type="email" autoComplete="email" required maxLength={320} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Mật khẩu" hint="Từ 12 đến 128 ký tự.">
          <input className="input" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Nhập lại mật khẩu"><input className="input" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
        <ErrorBox error={error} />
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Đang tạo…' : 'Tạo tài khoản'}</button>
      </form>
      <p className="auth-alt">Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p>
    </div>
  );
}

export function StaffLoginPage() {
  const { loginStaff } = useAuth();
  const [loginName, setLoginName] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, submit } = useSubmit(async () => {
    await loginStaff(loginName.trim(), password);
    navigate('/admin', { replace: true });
  });
  return (
    <div className="auth-card">
      <h1>Đăng nhập quản trị</h1>
      <form className="form" onSubmit={submit}>
        <Field label="Tên đăng nhập"><input className="input" required autoComplete="username" value={loginName} onChange={(e) => setLoginName(e.target.value)} /></Field>
        <Field label="Mật khẩu"><input className="input" type="password" required minLength={12} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <ErrorBox error={error} />
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
      </form>
    </div>
  );
}
