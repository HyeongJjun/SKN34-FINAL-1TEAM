import { notFound } from "next/navigation";
import { Overview } from "@/components/project/overview/Overview";
import { getOverview } from "@/lib/api/schedule";

export const metadata = { title: "내 공사" };

// 한 공사 화면(시안 WProjectB). 없거나 남의 공사면 404.
export default async function ProjectHub({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ov = await getOverview(id);
  if (!ov) notFound();
  return <Overview ov={ov} />;
}
