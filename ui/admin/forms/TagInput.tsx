import { useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@ui/input";
import { Label } from "@ui/label";
import { Button } from "@ui/button";
import { cn } from "@lib/utils";
import { FieldHelp } from "./FieldHelp";

export type TagTone = "default" | "primary" | "success" | "destructive";

export interface TagInputProps {
  items: string[];
  onChange: (next: string[]) => void;

  label?: ReactNode;
  /** Hint under the input. */
  helperText?: string;
  placeholder?: string;
  /** Leading icon for the label row. */
  icon?: ReactNode;
  tone?: TagTone;
  /** Reject case-insensitive duplicates. Default true. */
  unique?: boolean;
  /** Max characters per tag. Default 64. */
  maxLength?: number;
  disabled?: boolean;
  /** Hide the explicit Add button — Enter still works. Default false. */
  hideAddButton?: boolean;
  help?: {
    title: string;
    description?: ReactNode;
    rules?: string[];
    example?: ReactNode;
  };
  className?: string;
}

const TONE_CLASSES: Record<TagTone, string> = {
  default: "bg-muted text-foreground border-border",
  primary: "bg-primary/10 text-primary border-primary/20",
  success:
    "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
  destructive: "bg-destructive/10 text-destructive border-destructive/20",
};

/**
 * Accessible tag entry.
 *
 *   • Enter adds the trimmed value.
 *   • Backspace on an empty input removes the last chip.
 *   • Optional Add button, for touch.
 *   • Skips empties and (by default) duplicates.
 */
export function TagInput({
  items,
  onChange,
  label,
  helperText,
  placeholder = "Type and press Enter…",
  icon,
  tone = "default",
  unique = true,
  maxLength = 64,
  disabled = false,
  hideAddButton = false,
  help,
  className,
}: TagInputProps) {
  const [value, setValue] = useState("");

  const tryAdd = () => {
    const next = value.trim().slice(0, maxLength);
    if (!next) return;
    if (unique && items.some((item) => item.toLowerCase() === next.toLowerCase())) {
      setValue("");
      return;
    }
    onChange([...items, next]);
    setValue("");
  };

  const removeAt = (index: number) => onChange(items.filter((_, i) => i !== index));

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <div className="flex items-center justify-between gap-2">
          <Label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {icon}
            {label}
          </Label>
          {help && (
            <FieldHelp title={help.title} rules={help.rules} example={help.example}>
              {help.description}
            </FieldHelp>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          className="h-9 flex-1"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={maxLength}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              tryAdd();
            } else if (e.key === "Backspace" && value === "" && items.length > 0) {
              e.preventDefault();
              removeAt(items.length - 1);
            }
          }}
        />
        {!hideAddButton && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-9 px-3"
            disabled={disabled || !value.trim()}
            onClick={tryAdd}
            aria-label="Add tag"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>

      {helperText && <p className="text-[11px] text-muted-foreground/80">{helperText}</p>}

      {items.length > 0 && (
        <ul className="flex list-none flex-wrap gap-1.5 pt-1">
          {items.map((item, i) => {
            // Long items take a full row so wrapped text reads cleanly.
            const isLong = item.length > 32;
            return (
              <li key={`${item}-${i}`} className={cn("max-w-full", isLong && "basis-full")}>
                <span
                  className={cn(
                    "inline-flex w-full items-start gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium leading-snug",
                    TONE_CLASSES[tone],
                  )}
                >
                  <span className="min-w-0 flex-1 whitespace-normal break-words text-left">
                    {item}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    disabled={disabled}
                    aria-label={`Remove ${item}`}
                    className="-mr-1 mt-0.5 shrink-0 rounded p-0.5 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
