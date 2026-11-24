import { request, HAS_BACKEND } from './http.js';
import { mockGetMember, mockUpdateMember, mockDeleteMember } from './mock/mockMembers.js';
import { isRequired } from '../utils/validators.js';
// VITE_API_BASE_URL 이 있으면 Spring 백엔드(/api/members/me), 없으면 브라우저 저장소 목업.
const USE_MOCK = !HAS_BACKEND;
export async function getMyProfile() {
  return USE_MOCK ? mockGetMember() : request('/api/members/me', { auth: true });
}
export async function updateMyProfile({ nickname }) {
  if (!isRequired(nickname)) throw new Error('닉네임을 입력해 주세요.');
  return USE_MOCK
    ? mockUpdateMember({ nickname })
    : request('/api/members/me', { method: 'PATCH', body: { nickname }, auth: true });
}
export async function deleteMyAccount({ password }) {
  if (!isRequired(password)) throw new Error('비밀번호를 입력해 주세요.');
  return USE_MOCK
    ? mockDeleteMember({ password })
    : request('/api/members/me', { method: 'DELETE', body: { password }, auth: true });
}
