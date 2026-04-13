import { useHealth } from "../queries/use-health";

export default function Dashboard() {
  const { data, isLoading, error } = useHealth();

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <div className="rounded-lg border p-4 max-w-sm">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">API Health</h2>
        {isLoading && <p className="text-gray-400">Checking...</p>}
        {error && <p className="text-red-500">Failed to connect</p>}
        {data && (
          <div className="space-y-1 text-sm">
            <p>Status: <span className={data.status === "ok" ? "text-green-600" : "text-yellow-600"}>{data.status}</span></p>
            <p>Version: {data.version}</p>
            <p>Database: <span className={data.checks.database === "ok" ? "text-green-600" : "text-red-600"}>{data.checks.database}</span></p>
          </div>
        )}
      </div>
    </div>
  );
}
