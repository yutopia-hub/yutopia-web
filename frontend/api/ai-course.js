import { jsonHandler } from './_http.js';
import { recommendCourse } from './_course.js';

// Vercel 서버리스 함수: POST /api/ai-course
// Vercel 프로젝트 Settings → Environment Variables 에 OPENAI_API_KEY 를 넣어야 동작한다.
export default jsonHandler((body) =>
  recommendCourse(body, {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || undefined,
  }),
);
