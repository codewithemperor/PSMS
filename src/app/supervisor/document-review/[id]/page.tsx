import { DocumentReview } from "@/components/student/document-review"

export default function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return <ReviewParamsReader params={params} />
}

async function ReviewParamsReader({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <DocumentReview documentId={id} viewer="supervisor" />
}
