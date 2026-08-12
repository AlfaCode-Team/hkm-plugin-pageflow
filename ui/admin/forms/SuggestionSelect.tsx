import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/select";
import { Input } from "@ui/input";
import { cn } from "@lib/utils";

const CUSTOM = "__custom__";

export interface SuggestionSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
  customPlaceholder?: string;
  /** Label for the escape-hatch option. */
  customLabel?: string;
  disabled?: boolean;
  /** Applied to the trigger; the custom input matches it. */
  className?: string;
}

/**
 * A dropdown of suggested answers for a field stored as FREE TEXT.
 *
 * The escape hatch is the point. A closed dropdown over a free-text column
 * silently rewrites history: open an old record whose value is not on the list
 * and the control shows blank, then saves that blank over a real answer. So:
 *
 *   • a saved value that is not one of the suggestions starts in custom mode
 *     with the original text intact;
 *   • "Something else" lets anyone type a value the list does not cover.
 */
export function SuggestionSelect({
  value,
  onChange,
  options,
  placeholder = "Choose one…",
  customPlaceholder = "Type your own…",
  customLabel = "Something else…",
  disabled,
  className,
}: SuggestionSelectProps) {
  const matchesOption = options.some((option) => option.value === value);

  // A non-empty value that is not on the list starts in custom mode, so it is
  // preserved rather than blanked.
  const [isCustom, setIsCustom] = useState(() => value !== "" && !matchesOption);

  if (isCustom) {
    return (
      <Input
        autoFocus
        value={value}
        disabled={disabled}
        placeholder={customPlaceholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          // Emptying the box hands control back to the dropdown.
          if (value.trim() === "") setIsCustom(false);
        }}
        className={cn("h-11 text-base", className)}
      />
    );
  }

  return (
    <Select
      value={matchesOption ? value : ""}
      disabled={disabled}
      onValueChange={(next) => {
        if (next === CUSTOM) {
          setIsCustom(true);
          onChange("");
          return;
        }
        onChange(next);
      }}
    >
      <SelectTrigger className={cn("h-11 text-base", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="text-base">
            {option.label}
          </SelectItem>
        ))}
        <SelectItem value={CUSTOM} className="text-base italic">
          {customLabel}
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
