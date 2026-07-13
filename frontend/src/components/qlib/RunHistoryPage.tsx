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
  const [loading, setLoading] = useState(true);
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
          setError(loadError instanceof Error ? loadError.message : "无法加载任务。");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
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
      setLoading(true);
      setRefreshKey((value) => value + 1);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "无法创建任务。");
    } finally {
      setPendingKind(null);
    }
  };

  const activeTaskCount = tasks.filter((task) => ACTIVE_STATUSES.has(task.status)).length;
  const latestStatus = tasks[0] ? statusLabel(tasks[0].status) : "";
  const liveMessage = error
    ? `加载失败：${error}`
    : pendingKind
      ? "正在创建任务。"
      : loading
        ? "正在加载运行历史。"
        : activeTaskCount > 0
          ? `有 ${activeTaskCount} 个任务正在排队或运行，最近任务状态：${latestStatus}。`
          : latestStatus
            ? `所有任务均已结束，最近任务状态：${latestStatus}。`
            : "";

  return (
    <main className="flex min-w-0 flex-1 overflow-auto bg-quant-bg p-3 text-quant-text sm:p-4">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs text-quant-muted">Qlib 选股研究</div>
            <h1 className="mt-1 text-xl font-semibold">运行历史</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={pendingKind !== null} onClick={() => void createTask("initialize")}>
              <Database className="h-4 w-4" />
              初始化数据
            </Button>
            <Button disabled={pendingKind !== null} onClick={() => void createTask("update")}>
              <RefreshCw className="h-4 w-4" />
              更新数据
            </Button>
          </div>
        </div>

        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {liveMessage}
        </div>
        <div className="min-h-5 text-xs text-quant-down">{error}</div>

        <Card>
          <CardHeader>
            <CardTitle>数据任务</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {tasks.length === 0 && !error ? (
              <div className="px-4 py-10 text-center text-sm text-quant-muted">
                尚未初始化数据，请先运行历史数据初始化。
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[960px]">
                  <THead>
                    <Tr>
                      <Th>任务</Th>
                      <Th>状态</Th>
                      <Th>阶段</Th>
                      <Th>进度</Th>
                      <Th>开始</Th>
                      <Th>结束</Th>
                      <Th>耗时</Th>
                      <Th>错误</Th>
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
  return <Badge className={color}>{statusLabel(status)}</Badge>;
}

function statusLabel(status: TaskRun["status"]): string {
  return {
    queued: "排队中",
    running: "运行中",
    succeeded: "成功",
    failed: "失败",
    interrupted: "已中断",
  }[status];
}

function formatTimestamp(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "-";
}
