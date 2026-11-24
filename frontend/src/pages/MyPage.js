import { t } from '../i18n/i18n.js';
import '../styles/member.css';
import { isAuthenticated, logout, updateUser } from '../store/authStore.js';
import { getMyProfile, deleteMyAccount } from '../api/memberApi.js';
import { getMyActivity } from '../api/myActivityApi.js';
import { navigate } from '../router/router.js';
import { escapeHtml } from '../utils/html.js';
import { formatDate } from '../utils/format.js';
import { on, setText, setFormBusy, isFormBusy } from '../utils/dom.js';

const rewardStates = {
  available: { label: t('사용 가능'), className: 'available' },
  used: { label: t('사용 완료'), className: 'used' },
  expired: { label: t('기간 만료'), className: 'expired' },
};

function renderSummary(summary) {
  const cards = [
    [t('보따리'), summary.bagCount, t('저장한 여행지'), 'bag'],
    [t('완주'), summary.completionCount, t('윷판 한 바퀴 완주'), 'finish'],
    [t('보상'), summary.rewardCount, t('획득한 보상'), 'reward'],
  ];
  return `<div class="activity-summary" aria-label="${t('활동 요약')}">${cards
    .map(
      ([title, count, caption, type]) =>
        `<article class="summary-card summary-${type}"><h2>${title}</h2><p class="summary-count">${count}<span>${t(type === 'finish' ? '회' : '개')}</span></p><p>${caption}</p></article>`,
    )
    .join('')}</div>`;
}

function renderBag(items) {
  return items.length
    ? `<ul class="bag-list">${items
        .map(
          (item) =>
            `<li class="bag-card"><span class="content-type">${escapeHtml(item.contentType || t('여행지'))}</span><h3>${escapeHtml(item.name || t('이름 없는 여행지'))}</h3><p>${escapeHtml(item.region || t('지역 정보 없음'))}</p></li>`,
        )
        .join('')}</ul>`
    : `<p class="activity-empty">${t('아직 보따리에 담은 여행지가 없어요. 마음에 드는 여행지를 저장해 보세요.')}</p>`;
}

function renderCompletions(items) {
  return items.length
    ? `<ul class="activity-list">${items
        .map((item) => {
          const places = Array.isArray(item.places)
            ? item.places.map((place) => escapeHtml(place)).join(' → ')
            : '';
          return `<li class="completion-row"><div><h3>${escapeHtml(t('{n}번째 윷토피아 완주', { n: item.roundNumber || '첫' }))}</h3><p>${places || t('여행 경로 정보 없음')}</p></div><time datetime="${escapeHtml(item.completedAt || '')}">${escapeHtml(formatDate(item.completedAt))}</time></li>`;
        })
        .join('')}</ul>`
    : `<p class="activity-empty">${t('아직 완주 기록이 없어요. 첫 번째 윷토피아 여행을 기다리고 있어요.')}</p>`;
}

function renderRewards(items) {
  return items.length
    ? `<ul class="activity-list">${items
        .map((item) => {
          const state = rewardStates[item.status] || {
            label: t('상태 확인 중'),
            className: 'unknown',
          };
          return `<li class="reward-row"><div><h3>${escapeHtml(item.name || t('보상'))}</h3><p>${t('획득일')} <time datetime="${escapeHtml(item.acquiredAt || '')}">${escapeHtml(formatDate(item.acquiredAt))}</time></p></div><span class="reward-status status-${state.className}">${state.label}</span></li>`;
        })
        .join('')}</ul>`
    : `<p class="activity-empty">${t('아직 획득한 보상이 없어요. 여행 중 만날 즐거운 행운을 기대해 주세요.')}</p>`;
}

function renderAccount(user, section) {
  return `<section class="activity-panel account-panel" aria-labelledby="account-title">
    <div class="panel-heading"><div><p class="member-eyebrow">${t('나의 계정')}</p><h2 id="account-title">${t('계정 관리')}</h2></div><a class="btn member-edit-button" href="#/mypage/edit">${t('내 정보 수정')}</a></div>
    <dl class="account-profile"><div><dt>${t('닉네임')}</dt><dd>${escapeHtml(user.nickname)}</dd></div><div><dt>${t('이메일')}</dt><dd>${escapeHtml(user.email)}</dd></div></dl>
    <details class="withdrawal"${section === 'withdrawal' ? ' open' : ''}><summary>${t('회원 탈퇴')}</summary>
      <p>${t('탈퇴하면 회원정보가 삭제되며 되돌릴 수 없습니다.')}</p>
      <form id="delete-account-form">
        <label>${t('현재 비밀번호')}<input type="password" name="password" autocomplete="current-password" required /></label>
        <label class="checkbox-label"><input type="checkbox" name="confirm" required /> ${t('회원 탈퇴에 동의합니다.')}</label>
        <button class="btn member-withdraw-button" type="submit">${t('회원 탈퇴')}</button>
      </form><p id="delete-error" class="error" role="alert"></p>
    </details></section>`;
}

export async function MyPage({ section = 'profile' } = {}) {
  if (!isAuthenticated()) {
    navigate('/login');
    return '';
  }
  try {
    const user = await getMyProfile();
    updateUser(user);
    const activity = await getMyActivity(user.id);
    return `<div class="mypage member-theme">
      <header class="mypage-heading"><p class="member-eyebrow">${t('윷토피아 · 나의 여행')}</p><h1>${t('마이페이지')}</h1>
      <p class="member-description">${t('나의 윷토피아 여행 기록을 확인해보세요')}</p>
      <div class="member-identity"><strong>${escapeHtml(user.nickname)}님</strong><span>${escapeHtml(user.email)}</span></div></header>
      ${activity.isMock ? `<p class="activity-demo-note">${t('예시 활동 기록 · 아래 보따리, 완주, 보상은 화면 미리보기용 데이터입니다.')}</p>` : ''}
      ${renderSummary(activity.summary)}
      <section class="activity-panel" aria-labelledby="bag-title"><div class="panel-heading"><h2 id="bag-title">${t('나의 보따리')}</h2><span class="panel-caption">${t('최근 저장한 여행지 · 최대 3개')}</span></div>${renderBag(activity.bag)}</section>
      <section class="activity-panel" aria-labelledby="completion-title"><div class="panel-heading"><h2 id="completion-title">${t('완주 기록')}</h2><span class="panel-caption">${t('최근 완주 기록')}</span></div>${renderCompletions(activity.completions)}</section>
      <section class="activity-panel" aria-labelledby="reward-title"><div class="panel-heading"><h2 id="reward-title">${t('나의 보상함')}</h2><span class="panel-caption">${t('여행에서 만난 행운')}</span></div>${renderRewards(activity.rewards)}</section>
      ${renderAccount(user, section)}
    </div>`;
  } catch (error) {
    return `<section class="auth-page card member-theme"><p class="error" role="alert">${escapeHtml(error.message)}</p><a href="#/login" id="reauth-link">${t('다시 로그인')}</a></section>`;
  }
}

on(document, 'click', '#reauth-link', () => logout());
on(document, 'submit', '#delete-account-form', async (event, form) => {
  event.preventDefault();
  if (isFormBusy(form)) return;
  setFormBusy(form, true);
  setText('#delete-error', '');
  try {
    if (!new FormData(form).get('confirm')) throw new Error('회원 탈퇴에 동의해 주세요.');
    await deleteMyAccount({ password: new FormData(form).get('password') });
    logout();
    navigate('/');
  } catch (error) {
    setText('#delete-error', error.message);
  } finally {
    setFormBusy(form, false);
  }
});
