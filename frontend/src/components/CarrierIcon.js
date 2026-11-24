// 직접 그린 복주머니 아이콘 (실제 색 사용, currentColor 아님 — 버튼 상태와 무관하게 항상 같은 색).
// 빨간 산 모양 윗단 + 금색 매듭/조임끈 + 무지개 줄무늬 몸통 + 福 배지.
export function CarrierIcon({ size = 44 } = {}) {
  return `
    <svg class="carrier-icon" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="carrier-body-clip">
          <path d="M9 24C9 15.5 15.5 11 24 11C32.5 11 39 15.5 39 24C39 35 31.5 44 24 44C16.5 44 9 35 9 24Z" />
        </clipPath>
      </defs>

      <g clip-path="url(#carrier-body-clip)">
        <rect x="9" y="11" width="6.5" height="33" fill="#e0356b" />
        <rect x="15.5" y="11" width="6" height="33" fill="#f08a24" />
        <rect x="21.5" y="11" width="5.5" height="33" fill="#f4c430" />
        <rect x="27" y="11" width="6" height="33" fill="#6fb544" />
        <rect x="33" y="11" width="6" height="33" fill="#7a5ec9" />
      </g>

      <path
        fill="#d93838"
        d="M16 14.5C16 9.5 17.7 5 20 6.7C21 3.5 23.2 3 24 6.2C24.8 3 27 3.5 28 6.7C30.3 5 32 9.5 32 14.5C28.3 11.3 19.7 11.3 16 14.5Z"
      />
      <path
        fill="#d93838"
        d="M11 23C10 18 12.5 13.5 17 12C15.5 16.5 15.3 20 16.5 24C14.5 24 12.3 23.8 11 23Z"
      />
      <path
        fill="#d93838"
        d="M37 23C38 18 35.5 13.5 31 12C32.5 16.5 32.7 20 31.5 24C33.5 24 35.7 23.8 37 23Z"
      />

      <path
        fill="none"
        stroke="#f4c430"
        stroke-width="1.6"
        stroke-linecap="round"
        d="M24 17.5C21 14.5 17 14.8 16.3 17C15.6 19.2 18.5 20.3 24 17.5Z
           M24 17.5C27 14.5 31 14.8 31.7 17C32.4 19.2 29.5 20.3 24 17.5Z
           M22 18.3C20 21 19 23.5 20 26.5
           M26 18.3C28 21 29 23.5 28 26.5"
      />
      <circle cx="24" cy="17.3" r="1.7" fill="#f4c430" />
      <circle cx="20" cy="27.3" r="1.5" fill="#f4c430" />
      <circle cx="28" cy="27.3" r="1.5" fill="#f4c430" />

      <path d="M9.5 20.5Q24 17 38.5 20.5L38.5 24Q24 20.5 9.5 24Z" fill="#f4c430" />

      <g transform="translate(24 30) rotate(45)">
        <rect x="-6.5" y="-6.5" width="13" height="13" rx="2.5" fill="#ffffff" stroke="#3f9b8f" stroke-width="1.4" />
      </g>
      <text x="24" y="33.5" text-anchor="middle" font-size="9" font-weight="700" fill="#222" font-family="'Malgun Gothic', sans-serif">福</text>
    </svg>
  `;
}
