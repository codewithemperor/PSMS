import { DocumentReview } from "@/components/student/document-review"

export default function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // We read the id via a synchronous wrapper because DocumentReview is a
  // client component that needs the id as a prop.
  return <ReviewParamsReader params={params} />
}

async function ReviewParamsReader({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <DocumentReview documentId={id} viewer="student" />
}
