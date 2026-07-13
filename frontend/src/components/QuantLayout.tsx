import { useEffect, useMemo, useState } from "react";
import { menuItems } from "../data/mockQuant";
import { ChartWorkspace } from "./ChartWorkspace";
import { MenuPage } from "./MenuPage";
import { PortfolioAssets } from "./PortfolioAssets";
import { QuantTransition } from "./QuantTransition";
import { QlibWorkspace } from "./qlib/QlibWorkspace";
import { RightInfoDrawer } from "./RightInfoDrawer";
import { MobileNavigation, Sidebar, type MainView } from "./Sidebar";

export function QuantLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeView, setActiveView] = useState<MainView>("chart");
  const [activeMenuId, setActiveMenuId] = useState("kline");
  const [activeSubmenu, setActiveSubmenu] = useState("主图分析");

  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const apply = () => {
      if (media.matches) {
        setSidebarCollapsed(true);
        setDrawerOpen(false);
      }
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  const activeMenu = useMemo(
    () => menuItems.find((item) => item.id === activeMenuId) ?? menuItems[0],
    [activeMenuId],
  );

  const handleMenuChange = (menuId: string, view: MainView, submenu: string) => {
    setActiveMenuId(menuId);
    setActiveView(view);
    setActiveSubmenu(submenu);
    if (menuId !== "kline") setDrawerOpen(false);
  };

  const page =
    activeView === "portfolio" ? (
      <PortfolioAssets />
    ) : activeView === "qlib" ? (
      <QlibWorkspace submenu={activeSubmenu} />
    ) : activeView === "chart" ? (
      <ChartWorkspace />
    ) : (
      <MenuPage menuLabel={activeMenu.label} submenuLabel={activeSubmenu} />
    );

  return (
    <QuantTransition className="relative flex h-screen flex-col overflow-hidden bg-quant-bg text-quant-text md:flex-row">
      <MobileNavigation
        activeMenuId={activeMenuId}
        activeSubmenu={activeSubmenu}
        onMenuChange={handleMenuChange}
      />
      <Sidebar
        collapsed={sidebarCollapsed}
        activeMenuId={activeMenuId}
        activeSubmenu={activeSubmenu}
        onToggle={() => setSidebarCollapsed((value) => !value)}
        onMenuChange={handleMenuChange}
      />
      <div key={`${activeMenuId}-${activeSubmenu}`} className="flex min-h-0 min-w-0 flex-1 view-enter">
        {page}
      </div>
      {activeMenuId === "kline" ? <RightInfoDrawer open={drawerOpen} onOpenChange={setDrawerOpen} /> : null}
    </QuantTransition>
  );
}
