import { jsonHandler } from './_http.js';
import { handleWeatherBody } from './_weather.js';

// Vercel 서버리스 함수: POST /api/weather  { lat, lng }
// Vercel 환경 변수에 WEATHER_KEY (OpenWeatherMap 키) 를 넣어야 동작한다.
export default jsonHandler((body) =>
  handleWeatherBody(body, process.env.WEATHER_KEY || process.env.VITE_WEATHER_KEY),
);
