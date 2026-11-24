// 재재: 안전모를 쓴 줄자 모양 비서 캐릭터(시연 영상과 같은 그림). 장식 그림이라 화면 읽기에는 숨겨요.
export function Jaejae({ size = 44, mouth = "smile" }: { size?: number; mouth?: "smile" | "open" | "flat" }) {
  const K = "#3B2F25";
  const m = mouth === "open" ? <path d="M41 64 Q46 72 51 64 Z" fill={K} stroke={K} strokeWidth="2" strokeLinejoin="round" />
    : mouth === "flat" ? <path d="M41 66 L51 66" fill="none" stroke={K} strokeWidth="2.5" strokeLinecap="round" />
    : <path d="M40 64 Q46 70 52 64" fill="none" stroke={K} strokeWidth="2.5" strokeLinecap="round" />;
  return (
    <svg viewBox="-10 0 110 100" width={size} height={Math.round((size * 100) / 110)} aria-hidden="true" focusable="false">
      <rect x="29" y="82" width="10" height="10" fill="#5F5A57" stroke={K} strokeWidth="2.5" />
      <rect x="58" y="82" width="10" height="10" fill="#5F5A57" stroke={K} strokeWidth="2.5" />
      <rect x="22" y="89" width="21" height="9" rx="4.5" fill="#4A4543" stroke={K} strokeWidth="2.5" />
      <rect x="54" y="89" width="21" height="9" rx="4.5" fill="#4A4543" stroke={K} strokeWidth="2.5" />
      <rect x="18" y="27" width="68" height="59" rx="19" fill="#5F5A57" stroke={K} strokeWidth="3" />
      <rect x="62" y="19" width="17" height="9" rx="3" fill="#4A4543" stroke={K} strokeWidth="2.5" transform="rotate(14 70 23)" />
      <rect x="14" y="26" width="61" height="53" rx="19" fill="#F6B830" stroke={K} strokeWidth="3" />
      <path d="M30 31 Q56 27 66 42 Q71 55 67 70" fill="none" stroke="#C98A12" strokeWidth="1.6" strokeLinecap="round" />
      <g transform="rotate(-12 34 22)">
        <path d="M13 27 A22 20 0 0 1 57 27 Z" fill="#FBF1DD" stroke={K} strokeWidth="3" strokeLinejoin="round" />
        <rect x="7" y="25" width="56" height="7" rx="3.5" fill="#FBF1DD" stroke={K} strokeWidth="3" />
      </g>
      <ellipse cx="36" cy="54" rx="2.7" ry="3.8" fill={K} />
      <ellipse cx="56" cy="54" rx="2.7" ry="3.8" fill={K} />
      {m}
      <circle cx="15" cy="68" r="6" fill="#F6B830" stroke={K} strokeWidth="2.5" />
      <circle cx="74" cy="68" r="6" fill="#F6B830" stroke={K} strokeWidth="2.5" />
    </svg>
  );
}
