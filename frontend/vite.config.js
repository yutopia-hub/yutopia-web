import { defineConfig, loadEnv } from 'vite';
import { jsonHandler } from './api/_http.js';
import { recommendCourse } from './api/_course.js';
import { handleRouteBody } from './api/_kakaoRoute.js';
import { handleWeatherBody } from './api/_weather.js';

// 개발 서버에서도 Vercel 함수(/api/*)와 똑같이 동작하게 하는 미들웨어.
// OPENAI_API_KEY / 카카오 REST 키는 서버에서만 읽고, 브라우저 번들에는 넣지 않는다.
function devApi(env) {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use(
        '/api/ai-course',
        jsonHandler((body) =>
          recommendCourse(body, {
            apiKey: env.OPENAI_API_KEY,
            model: env.OPENAI_MODEL || undefined,
          }),
        ),
      );
      server.middlewares.use(
        '/api/weather',
        jsonHandler((body) => handleWeatherBody(body, env.WEATHER_KEY || env.VITE_WEATHER_KEY)),
      );
      server.middlewares.use(
        '/api/kakao-route',
        jsonHandler((body) =>
          handleRouteBody(body, env.KAKAO_REST_API_KEY || env.VITE_KAKAO_REST_API_KEY),
        ),
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    root: '.',
    plugins: [devApi(env)],
    server: {
      port: 5173,
      open: true,
    },
    build: {
      outDir: 'dist',
    },
  };
});
