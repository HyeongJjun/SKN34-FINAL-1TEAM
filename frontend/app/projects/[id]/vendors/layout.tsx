// 업체 고르기 묶음. panel 자리에는 목록에서 업체 이름을 눌렀을 때만 업체 자세히 오른쪽 창이 들어온다(@panel/(.)[vid]).
// 주소로 바로 오거나 새로 고치면 panel은 비고, 업체 자세히는 전체 화면([vid]/page.tsx)으로 열린다.
export default function VendorsLayout({ children, panel }: { children: React.ReactNode; panel: React.ReactNode }) {
  return (
    <>
      {children}
      {panel}
    </>
  );
}
