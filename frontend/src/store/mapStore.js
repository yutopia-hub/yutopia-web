import { createStore } from './store.js';

// 상세 페이지에서 "지도로 돌아가기" 시 마지막 검색 결과를 복원하기 위해 사용.
// Only the selected course is kept across the login screen; chat history/tokens are not kept here.
export const mapStore = createStore({ lastKeyword: '', yutoReturnCourse: null });
