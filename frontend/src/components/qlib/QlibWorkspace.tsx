import { RunHistoryPage } from "./RunHistoryPage";

export function QlibWorkspace({ submenu }: { submenu: string }) {
  if (submenu === "运行历史") return <RunHistoryPage />;

  return (
    <main className="flex min-w-0 flex-1 items-center justify-center overflow-auto bg-quant-bg p-4 text-quant-muted">
      后续阶段
    </main>
  );
}
