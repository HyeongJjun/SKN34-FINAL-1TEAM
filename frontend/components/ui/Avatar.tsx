// 얼굴(design-system 3.4 Avatar · 9판 k-av): 이름 첫 글자 · 32(s) · 44(m) · 56(l). 업체 상세 큰 얼굴은 따뜻한 색(warm).
// 이름이 옆에 보이면 그림은 읽지 않아요(기본 aria-hidden). 혼자 쓰면 label을 줘요('마루와벽').
import s from "./Avatar.module.css";

export function Avatar({ name, size = "m", warm, label, className }: { name: string; size?: "s" | "m" | "l"; warm?: boolean; label?: string; className?: string }) {
  const first = Array.from(name.trim())[0] ?? "?";
  return (
    <span
      className={[s.av, s[size], warm ? s.warm : null, className].filter(Boolean).join(" ")}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {first}
    </span>
  );
}
