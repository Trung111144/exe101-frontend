import type { ReactNode } from 'react';
import { Empty, Loading, PageHead, SignInPrompt } from './components/ui';
import { AuthProvider, useAuth } from './lib/auth';
import { when } from './lib/format';
import { Link, matchPath, RouterProvider, useLocation } from './lib/router';
import { AddressesPage } from './pages/account/AddressesPage';
import { LoginPage, RegisterPage, StaffLoginPage } from './pages/account/AuthPages';
import { CartPage } from './pages/account/CartPage';
import { OrderDetailPage, OrdersPage, PaymentReturnPage, PurchasesPage, RefundsPage } from './pages/account/OrderPages';
import { AdminPage } from './pages/admin/AdminPages';
import { CommissionDetailPage, CommissionsPage } from './pages/commission/CommissionPages';
import { ArtistPage } from './pages/shop/ArtistPage';
import { ArtworkPage } from './pages/shop/ArtworkPage';
import { Catalog } from './pages/shop/Catalog';
import { StudioArtwork, StudioHome, StudioProceeds, StudioSettings } from './pages/studio/StudioPages';

type Guard = 'public' | 'customer' | 'artist' | 'staff';
interface Route { path: string; guard: Guard; render: (p: Record<string, string>) => ReactNode }

const routes: Route[] = [
  { path: '/', guard: 'public', render: () => <Catalog /> },
  { path: '/artworks/:id', guard: 'public', render: (p) => <ArtworkPage artworkId={Number(p.id)} /> },
  { path: '/artists/:id', guard: 'public', render: (p) => <ArtistPage artistId={Number(p.id)} /> },
  { path: '/login', guard: 'public', render: () => <LoginPage /> },
  { path: '/register', guard: 'public', render: () => <RegisterPage /> },
  { path: '/staff/login', guard: 'public', render: () => <StaffLoginPage /> },
  { path: '/payment/return', guard: 'customer', render: () => <PaymentReturnPage /> },
  { path: '/cart', guard: 'customer', render: () => <CartPage /> },
  { path: '/orders', guard: 'customer', render: () => <OrdersPage /> },
  { path: '/orders/:id', guard: 'customer', render: (p) => <OrderDetailPage orderId={Number(p.id)} /> },
  { path: '/purchases', guard: 'customer', render: () => <PurchasesPage /> },
  { path: '/refunds', guard: 'customer', render: () => <RefundsPage /> },
  { path: '/account', guard: 'customer', render: () => <AccountPage /> },
  { path: '/account/addresses', guard: 'customer', render: () => <AddressesPage /> },
  { path: '/commissions', guard: 'customer', render: () => <CommissionsPage /> },
  { path: '/commissions/:id', guard: 'customer', render: (p) => <CommissionDetailPage commissionId={Number(p.id)} /> },
  { path: '/studio', guard: 'artist', render: () => <StudioHome /> },
  { path: '/studio/artworks/:id', guard: 'artist', render: (p) => <StudioArtwork artworkId={Number(p.id)} /> },
  { path: '/studio/settings', guard: 'artist', render: () => <StudioSettings /> },
  { path: '/studio/proceeds', guard: 'artist', render: () => <StudioProceeds /> },
  { path: '/admin', guard: 'staff', render: () => <AdminPage /> },
];

function Routes() {
  const { pathname } = useLocation();
  const { session, isArtist, loading } = useAuth();
  for (const route of routes) {
    const params = matchPath(route.path, pathname);
    if (!params) continue;
    if (route.guard === 'customer' || route.guard === 'artist') {
      if (session?.kind !== 'customer') return <SignInPrompt what="tiếp tục" />;
      if (loading) return <Loading />;
      if (route.guard === 'artist' && isArtist === false) {
        return <Empty title="Tài khoản này chưa là hoạ sĩ.">Gửi email tài khoản cho quản trị viên để được cấp quyền hoạ sĩ.</Empty>;
      }
    }
    if (route.guard === 'staff' && session?.kind !== 'staff') {
      return <Empty title="Trang dành cho nhân viên."><Link className="btn btn-primary" to="/staff/login">Đăng nhập quản trị</Link></Empty>;
    }
    return <>{route.render(params)}</>;
  }
  return <Empty title="Không tìm thấy trang này."><Link className="btn btn-primary" to="/">Về trang chủ</Link></Empty>;
}

function AccountPage() {
  const { me, isArtist } = useAuth();
  if (!me) return <Loading />;
  return (
    <div>
      <PageHead title="Tài khoản" />
      <dl className="kv panel">
        <dt>Tên hiển thị</dt><dd>{me.displayName}</dd>
        <dt>Email</dt><dd>{me.email}</dd>
        <dt>Mã người dùng</dt><dd>{me.userId}</dd>
        <dt>Tham gia</dt><dd>{when(me.createdAt)}</dd>
        <dt>Hoạ sĩ</dt><dd>{isArtist ? <Link to="/studio">Có, vào Xưởng</Link> : 'Chưa'}</dd>
      </dl>
      <nav className="link-grid">
        <Link to="/orders">Đơn hàng</Link>
        <Link to="/purchases">Tệp đã mua</Link>
        <Link to="/commissions">Đơn vẽ</Link>
        <Link to="/refunds">Hoàn tiền</Link>
        <Link to="/account/addresses">Sổ địa chỉ</Link>
      </nav>
    </div>
  );
}

function Header() {
  const { session, me, isArtist, logout } = useAuth();
  const { pathname } = useLocation();
  const on = (prefix: string) => (pathname === prefix || (prefix !== '/' && pathname.startsWith(prefix)) ? 'on' : '');
  return (
    <header className="site-head">
      <div className="site-head-inner">
        <Link to="/" className="brand" aria-label="Trang chủ">
          <span className="brand-mark" aria-hidden="true" />
          Phòng tranh
        </Link>
        <nav className="site-nav">
          <Link to="/" className={on('/') && pathname === '/' ? 'on' : ''}>Tranh</Link>
          {session?.kind === 'customer' && (
            <>
              <Link to="/commissions" className={on('/commissions')}>Đơn vẽ</Link>
              <Link to="/orders" className={on('/orders')}>Đơn hàng</Link>
              {isArtist && <Link to="/studio" className={on('/studio')}>Xưởng</Link>}
              <Link to="/cart" className={on('/cart')}>Giỏ hàng</Link>
              <Link to="/account" className={`nav-me ${on('/account')}`}>{me?.displayName ?? 'Tài khoản'}</Link>
              <button className="btn btn-quiet btn-sm" onClick={logout}>Đăng xuất</button>
            </>
          )}
          {session?.kind === 'staff' && (
            <>
              <Link to="/admin" className={on('/admin')}>Quản trị</Link>
              <button className="btn btn-quiet btn-sm" onClick={logout}>Đăng xuất</button>
            </>
          )}
          {!session && <Link to="/login" className="btn btn-primary btn-sm">Đăng nhập</Link>}
        </nav>
      </div>
    </header>
  );
}

export function App() {
  return (
    <RouterProvider>
      <AuthProvider>
        <Header />
        <main className="site-main"><Routes /></main>
        <footer className="site-foot">
          <div className="site-foot-inner">
            <span className="brand brand-small"><span className="brand-mark" aria-hidden="true" />Phòng tranh</span>
            <span>Tranh gốc của nhóm hoạ sĩ. Thanh toán qua VNPay, bản in giao tới các tỉnh/thành đang hỗ trợ.</span>
          </div>
        </footer>
      </AuthProvider>
    </RouterProvider>
  );
}
