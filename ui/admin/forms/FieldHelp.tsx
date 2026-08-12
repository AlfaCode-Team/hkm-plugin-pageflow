import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@ui/popover";
import { cn } from "@lib/utils";

export interface FieldHelpProps {
  /** Bold heading at the top of the popover. */
  title: string;
  /** Plain description shown above the rules. */
  children?: ReactNode;
  /** Same as `children` — use whichever reads better at the call site. */
  description?: ReactNode;
  /** Bullet-point rules. Keep each short, in everyday words. */
  rules?: string[];
  /** Example, shown in a tinted box at the bottom. */
  example?: ReactNode;
  className?: string;
  /** Override the generated aria-label. */
  ariaLabel?: string;
}

/**
 * The "?" help button that sits next to a form label.
 *
 * Sized for a wide age range: a 28×28 px target with an 18 px glyph, which
 * clears the WCAG visual-target rule inside a dense label row, opens on click
 * and on Enter/Space, and uses larger body text inside the popover than the
 * labels around it.
 */
export function FieldHelp({
  title,
  children,
  description,
  rules,
  example,
  className,
  ariaLabel,
}: FieldHelpProps) {
  const body = children ?? description;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel ?? `Help — ${title}`}
          className={cn(
            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
            className,
          )}
        >
          <CircleHelp className="h-4 w-4" aria-hidden="true" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        side="top"
        sideOffset={6}
        className="w-80 max-w-[calc(100vw-2rem)] p-0 text-sm"
      >
        <div className="border-b bg-muted/40 px-4 py-2.5">
          <p className="text-sm font-semibold leading-tight">{title}</p>
        </div>
        <div className="space-y-2.5 px-4 py-3">
          {body && <div className="text-sm leading-relaxed text-foreground/90">{body}</div>}
          {rules && rules.length > 0 && (
            <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-foreground/80">
              {rules.map((rule, i) => (
                <li key={i}>{rule}</li>
              ))}
            </ul>
          )}
          {example && (
            <div className="mt-2 rounded-md bg-muted/50 px-3 py-2 text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground/70">Example:</span> {example}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
