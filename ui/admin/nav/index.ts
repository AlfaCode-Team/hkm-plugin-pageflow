export {
  registerModule,
  unregisterModule,
  registerFeature,
  enableFeature,
  disableFeature,
  setEnabledFeatures,
  isFeatureEnabled,
  getAllFeatures,
  getEnabledFeatures,
  getModules,
  getNavSections,
  selectNavSections,
  getFlatRoutes,
  selectFlatRoutes,
  __resetRegistry,
} from "./registry";

export { registerIcons, getIcon, resolveIcon, registeredIconNames } from "./icons";

export {
  registerSettingsTab,
  unregisterSettingsTab,
  selectSettingsTabs,
  getSettingsTabs,
  __resetSettingsTabs,
} from "./settings";
export type { SettingsTab, SettingsTabProps } from "./settings";

export type {
  AppModule,
  Feature,
  FeatureInput,
  FlatRoute,
  ModuleChild,
  ModuleNavItem,
  ModuleSection,
  NavBadge,
} from "./types";
