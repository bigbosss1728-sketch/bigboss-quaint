import { ChevronLeft, ChevronRight } from "lucide-react";
import { menuItems } from "../data/mockQuant";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Tooltip } from "./ui/tooltip";

export type MainView = "chart" | "portfolio" | "qlib" | "page";

type SidebarProps = {
  collapsed: boolean;
  activeMenuId: string;
  activeSubmenu: string;
  onToggle: () => void;
  onMenuChange: (menuId: string, view: MainView, submenu: string) => void;
};

export function Sidebar({ collapsed, activeMenuId, activeSubmenu, onToggle, onMenuChange }: SidebarProps) {
  const selectMenu = (menuId: string, child: string) => {
    onMenuChange(menuId, viewForMenu(menuId), child);
  };

  return (
    <aside
      className={cn(
        "hidden h-screen shrink-0 flex-col border-r border-quant-line bg-quant-bg px-2 py-3 quant-transition md:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className="mb-4 flex h-8 items-center justify-between">
        <div className={cn("overflow-hidden whitespace-nowrap text-sm font-semibold tracking-wide text-quant-text", collapsed && "w-0")}>
          QUANT OS
        </div>
        <Button variant="ghost" className="h-8 w-8 px-0" onClick={onToggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 rounded-quant border border-quant-line bg-quant-glass p-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = activeMenuId === item.id;
          const firstChild = item.children[0] ?? item.label;

          return (
            <div key={item.id} className="group">
              <Tooltip label={collapsed ? item.label : ""}>
                <button
                  className={cn(
                    "flex h-8 w-full items-center gap-2 rounded-quant px-2 text-left text-xs text-quant-muted quant-transition hover:bg-quant-glassHover hover:text-quant-text",
                    active && "bg-quant-glassHover text-quant-text",
                  )}
                  onClick={() => selectMenu(item.id, firstChild)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className={cn("truncate", collapsed && "hidden")}>{item.label}</span>
                </button>
              </Tooltip>
              {!collapsed && item.children.length > 0 ? (
                <div className="max-h-0 overflow-hidden pl-6 opacity-0 quant-transition group-hover:max-h-28 group-hover:opacity-100">
                  {item.children.map((child) => (
                    <button
                      key={child}
                      className={cn(
                        "block h-7 w-full truncate rounded-quant px-2 text-left text-[11px] text-quant-disabled quant-transition hover:bg-quant-glass hover:text-quant-muted",
                        active && activeSubmenu === child && "bg-quant-glassHover text-quant-text",
                      )}
                      onClick={() => selectMenu(item.id, child)}
                    >
                      {child}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

export function MobileNavigation({ activeMenuId, activeSubmenu, onMenuChange }: Pick<SidebarProps, "activeMenuId" | "activeSubmenu" | "onMenuChange">) {
  const activeMenu = menuItems.find((item) => item.id === activeMenuId) ?? menuItems[0];

  return (
    <nav aria-label="移动导航" className="grid shrink-0 grid-cols-2 gap-2 border-b border-quant-line bg-quant-bg p-2 md:hidden">
      <label>
        <span className="sr-only">一级导航</span>
        <select
          className="h-11 w-full rounded-quant border border-quant-line bg-quant-glass px-2 text-sm text-quant-text"
          value={activeMenuId}
          onChange={(event) => {
            const menu = menuItems.find((item) => item.id === event.target.value) ?? menuItems[0];
            onMenuChange(menu.id, viewForMenu(menu.id), menu.children[0] ?? menu.label);
          }}
        >
          {menuItems.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      <label>
        <span className="sr-only">子导航</span>
        <select
          className="h-11 w-full rounded-quant border border-quant-line bg-quant-glass px-2 text-sm text-quant-text disabled:opacity-50"
          value={activeMenu.children.length > 0 ? activeSubmenu : ""}
          disabled={activeMenu.children.length === 0}
          onChange={(event) => onMenuChange(activeMenu.id, viewForMenu(activeMenu.id), event.target.value)}
        >
          {activeMenu.children.length === 0 ? <option value="">无子项</option> : null}
          {activeMenu.children.map((child) => <option key={child} value={child}>{child}</option>)}
        </select>
      </label>
    </nav>
  );
}

function viewForMenu(menuId: string): MainView {
  return menuId === "position" ? "portfolio" : menuId === "kline" ? "chart" : menuId === "qlib" ? "qlib" : "page";
}
