import { JobPageClient } from "../../../../components/job-page-client";

export default function JobPage({ params }: { params: { id: string } }) {
  return <JobPageClient jobId={params.id} />;
}
