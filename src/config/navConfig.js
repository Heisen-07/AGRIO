import { Home, LayoutDashboard, Sprout, ScanLine, Radio, CloudSun, BarChart3 } from 'lucide-react';

/**
 * Single source of truth for navigation.
 *
 * Navigation in AGRIO is state-based (App.jsx holds `activeView` / `activeTab`),
 * so these descriptors intentionally carry only presentational data — `id`,
 * `label`, `icon`. The consuming surface (desktop sidebar, mobile drawer,
 * desktop navbar) binds each `id` to the right action (`setActiveTab`,
 * `setActiveView`, …) and decides which one is `active`.
 *
 * Keeping the list here means the desktop sidebar and the mobile drawer render
 * from the exact same data — no duplicated menus that can drift apart.
 */

/**
 * The dashboard tabs — matches App.jsx `activeTab` values.
 * Advisory is the default first screen, followed by AI Scanner,
 * Field Sensors, Climate, and supporting Analytics.
 */
export function getDashboardNav(t) {
  return [
    { id: 'advisory', label: t.sidebarAdvisory, icon: Sprout },
    { id: 'diagnostics', label: t.sidebarScanner, icon: ScanLine },
    { id: 'irrigation', label: t.sidebarFieldSensors, icon: Radio },
    { id: 'climate', label: t.sidebarClimate, icon: CloudSun },
    { id: 'analytics', label: t.sidebarAnalytics || 'Analytics', icon: BarChart3 },
  ];
}

/** Top-level public views — matches App.jsx `activeView` values. */
export function getPublicNav(t) {
  return [
    { id: 'landing', label: t.navLanding, icon: Home },
    { id: 'dashboard', label: t.navDashboard, icon: LayoutDashboard },
  ];
}
