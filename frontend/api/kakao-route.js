import { jsonHandler } from './_http.js';
import { handleRouteBody } from './_kakaoRoute.js';

// Vercel 서버리스 함수: POST /api/kakao-route  { action: 'matrix' | 'path', points: [{lat,lng}] }
// Vercel 환경 변수에 KAKAO_REST_API_KEY (카카오 REST API 키) 를 넣어야 동작한다.
export default jsonHandler((body) =>
  handleRouteBody(body, process.env.KAKAO_REST_API_KEY || process.env.VITE_KAKAO_REST_API_KEY),
);
