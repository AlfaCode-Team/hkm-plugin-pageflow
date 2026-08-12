import { useState, type ReactNode } from "react";
import { Check, ChevronsUpDown, Globe, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ui/dropdown-menu";
import { cn } from "@lib/utils";
import { useAdminShell } from "./useAdminShell";
import type { AdminShellTenant } from "./types";

/**
 * Tenant/organisation switcher — PRESENTATIONAL ONLY.
 *
 * It renders whatever `adminShell.tenants` contains and reports a selection. It
 * does NOT know how tenants are fetched or switched: in Sentinel that is the
 * Tenancy plugin's control plane (`GET /ajx/me/tenants`, `POST
 * /ajx/tenants/{id}/select`, which re-verifies the seat and audits the switch),
 * and putting that call here would make the Pageflow shell depend on Tenancy.
 *
 * With no `onSelect` it degrades to a read-only header showing the current
 * tenant — correct for a single-tenant app, which is most of them.
 *
 * The connected version lives in `plugins/hkm-plugin-tenancy/ui`.
 */
export interface OrgSwitcherProps {
  /** Called with the chosen tenant id. Omit for a read-only header. */
  onSelect?: (tenantId: string) => void | Promise<void>;
  /** Renders a "create" row at the bottom of the menu. */
  onCreate?: () => void;
  createLabel?: string;
  /** Extra rows appended to the menu (e.g. "Manage organisations"). */
  footer?: ReactNode;
  className?: string;
}

function TenantAvatar({
  tenant,
  size = "md",
}: {
  tenant: AdminShellTenant | null;
  size?: "sm" | "md";
}) {
  const box = size === "md" ? "h-8 w-8 text-xs" : "h-6 w-6 text-[10px]";

  if (tenant?.logoUrl) {
    return (
      <img
        src={tenant.logoUrl}
        alt=""
        aria-hidden="true"
        className={cn("shrink-0 rounded-md object-contain", box)}
      />
    );
  }
  if (!tenant) {
    return <Globe className={cn("shrink-0 text-sidebar-fg-muted", box)} aria-hidden="true" />;
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 select-none items-center justify-center rounded-md border border-border/60 bg-muted font-semibold text-muted-foreground",
        box,
      )}
    >
      {tenant.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function OrgSwitcher({
  onSelect,
  onCreate,
  createLabel = "New organisation",
  footer,
  className,
}: OrgSwitcherProps) {
  const { tenant, tenants, appName } = useAdminShell();
  const [busyId, setBusyId] = useState<string | null>(null);

  const label = tenant?.name ?? appName;
  const meta = tenant?.meta;
  const canSwitch = !!onSelect && tenants.length > 1;

  const header = (
    <>
      <TenantAvatar tenant={tenant} />
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-semibold text-sidebar-fg-active">{label}</span>
        {meta && <span className="block truncate text-xs text-sidebar-fg-muted">{meta}</span>}
      </span>
    </>
  );

  if (!canSwitch && !onCreate && !footer) {
    return (
      <div className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-2", className)}>
        {header}
      </div>
    );
  }

  const choose = async (id: string) => {
    if (!onSelect || id === tenant?.id) return;
    setBusyId(id);
    try {
      await onSelect(id);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Switch organisation"
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-sidebar-hover sidebar-transition",
            className,
          )}
        >
          {header}
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-sidebar-fg-muted" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        {tenants.map((entry) => (
          <DropdownMenuItem
            key={entry.id}
            onSelect={() => void choose(entry.id)}
            disabled={busyId !== null}
            className="gap-2.5"
          >
            <TenantAvatar tenant={entry} size="sm" />
            <span className="min-w-0 flex-1 truncate">{entry.name}</span>
            {entry.id === tenant?.id && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
          </DropdownMenuItem>
        ))}

        {onCreate && (
          <>
            {tenants.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem onSelect={onCreate} className="gap-2.5">
              <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{createLabel}</span>
            </DropdownMenuItem>
          </>
        )}

        {footer}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
