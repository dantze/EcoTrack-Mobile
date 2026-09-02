/**
 * Layout barrel — screens import their frame from here.
 *
 *   Frame      AppShell (owned by the router, not by screens)
 *   Screen     Workbench · WorkbenchBody · CommandBar · ToolbarGroup ·
 *              ToolbarSeparator · PaneHeader
 *   Panes      ListDetail
 *   State      usePersistentState (a remembered pane width, a collapsed rail)
 */

export { AppShell } from './AppShell';
export {
  CommandBar,
  PaneHeader,
  ToolbarGroup,
  ToolbarSeparator,
  Workbench,
  WorkbenchBody,
  usePersistentState,
} from './Workbench';
export type { CommandBarProps } from './Workbench';
export { ListDetail } from './ListDetail';
export type { ListDetailProps } from './ListDetail';
export { NAV_SECTIONS, NavPane } from './nav';
export type { NavItem, NavSectionDef } from './nav';
export { ThemeToggle } from './ThemeToggle';
export { TopBar } from './TopBar';
