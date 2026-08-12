import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Top-level error boundary for a Pageflow surface entry.
 *
 * Without it, a throw anywhere in the page tree unmounts the whole app and
 * leaves a blank document — including the `Page "X" not found` that
 * `resolveComponent` raises when a controller names a component the surface's
 * glob does not cover.
 *
 * Deliberately dependency-free — no `react-error-boundary`, no `@ui/*`, no
 * `cn`, inline styles only. It must not import anything that could itself be the
 * thing that threw, and it has to render even if the stylesheet never loaded.
 *
 * It lives in `@pageflow/react`, not `@pageflow/admin`, precisely BECAUSE it is
 * dependency-free: a public/marketing surface wants a boundary just as much as
 * an admin one, and reaching for `@pageflow/admin` to get it would drag in
 * framer-motion and the whole shadcn shell for a component that imports nothing.
 */

interface Props {
  children: ReactNode;
  /** Report to Sentry/console/etc. Runs before the fallback renders. */
  onError?: (error: Error, info: ErrorInfo) => void;
  /** Replace the built-in fallback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Where "Back to safety" goes. Default "/". */
  homeHref?: string;
}

interface State {
  error: Error | null;
}

const BUTTON: React.CSSProperties = {
  padding: "0.5rem 1rem",
  borderRadius: "0.375rem",
  border: "1px solid currentColor",
  background: "transparent",
  cursor: "pointer",
  font: "inherit",
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
    console.error("Unhandled render error:", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    const isDev = Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);

    return (
      <div
        role="alert"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div style={{ maxWidth: "34rem", textAlign: "center" }}>
          <p style={{ fontSize: "3rem", fontWeight: 700, margin: 0, opacity: 0.25 }}>!</p>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: "0.5rem 0" }}>
            Something went wrong on this page
          </h1>
          <p style={{ opacity: 0.7, margin: "0 0 1.5rem" }}>
            The rest of the application is still working. Try again, or go back.
          </p>

          {isDev && (
            <pre
              style={{
                textAlign: "left",
                fontSize: "0.75rem",
                overflowX: "auto",
                padding: "0.75rem",
                borderRadius: "0.375rem",
                background: "rgba(127,127,127,0.12)",
                marginBottom: "1.5rem",
              }}
            >
              {error.message}
            </pre>
          )}

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            <button type="button" onClick={this.reset} style={BUTTON}>
              Try again
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.href = this.props.homeHref ?? "/";
              }}
              style={BUTTON}
            >
              Back to safety
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default AppErrorBoundary;
