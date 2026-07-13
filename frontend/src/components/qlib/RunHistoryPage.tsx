import { useEffect, useState } from "react";
import { Database, RefreshCw } from "lucide-react";
import { quantApi, type DataTaskKind, type TaskRun } from "../../api/quantApi";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TBody, Td, Th, THead, Tr } from "../ui/table";

const ACTIVE_STATUSES = new Set<TaskRun["status"]>(["queued", "running"]);

export function RunHistoryPage() {
  const [tasks, setTasks] = useState<TaskRun[]>([]);
  const [error, setError] = useState("");
  const [pendingKind, setPendingKind] = useState<DataTaskKind | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;

    const load = async () => {
      try {
        const next = await quantApi.listTasks(controller.signal);
        setTasks(next);
        setError("");
        if (next.some((task) => ACTIVE_STATUSES.has(task.status))) {
          timer = window.setTimeout(load, 2_000);
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load tasks.");
        }
      }
    };

    void load();
    return () => {
      controller.abort();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [refreshKey]);

  const createTask = async (kind: DataTaskKind) => {
    setPendingKind(kind);
    setError("");
    try {
      await quantApi.createDataTask(kind);
      setRefreshKey((value) => value + 1);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create task.");
    } finally {
      setPendingKind(null);
    }
  };

  return (
    <main className="flex min-w-0 flex-1 overflow-auto bg-quant-bg p-3 text-quant-text sm:p-4">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs text-quant-muted">Qlib 閫夎偂鐮旂┒</div>
            <h1 className="mt-1 text-xl font-semibold">杩愯鍘嗗彶</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={pendingKind !== null} onClick={() => void createTask("initialize")}>
              <Database className="h-4 w-4" />
              鍒濆鍖栨暟鎹�
            </Button>
            <Button disabled={pendingKind !== null} onClick={() => void createTask("update")}>
              <RefreshCw className="h-4 w-4" />
              鏇存柊鏁版嵁
            </Button>
          </div>
        </div>

        <div className="min-h-5 text-xs text-quant-down" aria-live="polite">
          {error}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>鏁版嵁浠诲姟</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {tasks.length === 0 && !error ? (
              <div className="px-4 py-10 text-center text-sm text-quant-muted">
                灏氭湭鍒濆鍖栨暟鎹紝璇峰厛杩愯鍘嗗彶鏁版嵁鍒濆鍖栥€俙
              </div>
            ) : (
              <div className="overflow-x-auto" aria-live="polite">
                <Table className="min-w-[960px]">
                  <THead>
                    <Tr>
                      <Th>浠诲姟</Th>
                      <Th>鐘舵€�</Th>
                      <Th>闃舵</Th>
                      <Th>杩涘害</Th>
                      <Th>寮€濮�</Th>
                      <Th>缁撴潫</Th>
                      <Th>鑰楁椂</Th>
                      <Th>閿欒</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {tasks.map((task) => (
                      <Tr key={task.id}>
                        <Td className="font-mono">{task.task_type}</Td>
                        <Td><StatusBadge status={task.status} /></Td>
                        <Td>{task.stage}</Td>
                        <Td className="font-mono">{task.progress}%</Td>
                        <Td>{formatTimestamp(task.started_at)}</Td>
                        <Td>{formatTimestamp(task.finished_at)}</Td>
                        <Td className="font-mono">{task.duration_ms === null ? "-" : `${task.duration_ms} ms`}</Td>
                        <Td className="max-w-72 whitespace-normal text-quant-down">{task.error_message ?? "-"}</Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: TaskRun["status"] }) {
  const color = status === "succeeded" ? "text-quant-up" : status === "failed" ? "text-quant-down" : "text-quant-muted";
  return <Badge className={color}>{status}</Badge>;
}

function formatTimestamp(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "-";
}
