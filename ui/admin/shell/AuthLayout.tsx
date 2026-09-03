import type { ReactNode } from "react";
import { Toaster } from "@ui/sonner";
import { cn } from "@lib/utils";
import { usePageflowErrors } from "../hooks/usePageflowErrors";

export interface AuthLayoutProps {
  children: ReactNode;
  /** Footer copyright name. Falls back to the `adminShell.appName` default. */
  brand?: string;
  /** Footer links. Pass `[]` to render none. */
  links?: { label: string; href: string }[];
  /** Centre the slot vertically in the viewport. Default true. */
  centered?: boolean;
  className?: string;
}

const DEFAULT_LINKS = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Contact", href: "/contact" },
];

/**
 * Chrome for unauthenticated pages — login, register, verify, OAuth consent.
 *
 * Deliberately minimal and nav-free: these pages render before there is an
 * identity, so there is nothing to build a sidebar from. Attach it the same way
 * as `AdminLayout`:
 *
 * ```tsx
 * Login.layout = (page: ReactNode) => <AuthLayout>{page}</AuthLayout>;
 * ```
 */
export function AuthLayout({
  children,
  brand,
  links = DEFAULT_LINKS,
  centered = true,
  className,
}: AuthLayoutProps) {
  usePageflowErrors();

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <main
        className={cn(
          "flex-1",
          centered && "flex items-center justify-center px-4 py-12",
          className,
        )}
      >
        {children}
      </main>

      <footer className="mt-auto border-t border-border py-6">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 md:flex-row">
          <p className="text-sm text-muted-foreground">
            {/* No brand → year alone. Falling back to a generic phrase produced
                "© 2026 All rights reserved", and falling back to the shell's
                appName default produced "© 2026 Admin" — a login page usually
                renders before there is any shell prop at all. */}
            © {new Date().getFullYear()}
            {brand ? ` ${brand}` : ""}
          </p>
          {links.length > 0 && (
            <nav className="flex gap-6 text-sm text-muted-foreground">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="transition-colors hover:text-foreground"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          )}
        </div>
      </footer>

      <Toaster position="top-center" />
    </div>
  );
}

export default AuthLayout;
