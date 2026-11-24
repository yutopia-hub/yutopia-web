import './styles/account.css';
import { MemberEditPage } from './pages/MemberEditPage.js';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage.js';
import { initRouter, registerRoute, registerNotFound } from './router/router.js';
import { renderHeader } from './components/Header.js';
import { renderFooter } from './components/Footer.js';
import { LoginPage } from './pages/LoginPage.js';
import { SignupPage } from './pages/SignupPage.js';
import { BoardPage } from './pages/BoardPage.js';
import { MapPage } from './pages/MapPage.js';
import { PlaceDetailPage } from './pages/PlaceDetailPage.js';
import { MyPage } from './pages/MyPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { startCarrierSync } from './api/carrierSyncApi.js';

// 루트(/)는 윷판으로 보낸다. replace 라서 뒤로 가기 때 루트로 되돌아오지 않는다.
registerRoute('/', async () => {
  window.location.replace('#/board');
  return '';
});
registerRoute('/login', LoginPage);
registerRoute('/signup', SignupPage);
registerRoute('/board', BoardPage);
registerRoute('/board/:id', BoardPage);
registerRoute('/map', MapPage);
registerRoute('/map/details/:id', PlaceDetailPage);
registerRoute('/mypage', MyPage);
registerRoute('/mypage/edit', MemberEditPage);
registerRoute('/forgot-password', ForgotPasswordPage);
registerNotFound(NotFoundPage);

renderHeader();
renderFooter();
startCarrierSync();
initRouter();
