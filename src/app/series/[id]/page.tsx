import { DetailPage } from "../../components/detail-page";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <DetailPage id={(await params).id} kind="series" />;
}
