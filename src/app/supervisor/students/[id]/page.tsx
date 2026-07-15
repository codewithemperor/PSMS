import { StudentProjectView } from "@/components/supervisor/student-project-view"

export default function StudentProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return <StudentProjectView params={params} />
}
