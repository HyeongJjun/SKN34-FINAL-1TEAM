// iOS 홈 화면 아이콘(180, 바탕이 꽉 찬 PNG). Next가 <link rel="apple-touch-icon">을 넣어요. 그림은 app/icons/mark.tsx
import { markImage } from "./icons/mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return markImage(180, "apple");
}
