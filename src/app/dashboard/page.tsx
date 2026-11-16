import { ClaimsQueue } from "@/components/claims-queue";

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Claims Queue</h1>
        <p className="mt-1 text-sm text-gray-500">
          Youth care property damage claims requiring review
        </p>
      </div>
      <ClaimsQueue />
    </div>
  );
}
