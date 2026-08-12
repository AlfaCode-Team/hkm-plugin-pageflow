import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@ui/sheet";
import { cn } from "@lib/utils";

export interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
  /** Tailwind max-width class. Default "sm:max-w-lg". */
  width?: string;
}

/**
 * Side panel for one row's detail — cheaper than a route when the look is
 * read-only and the user wants to keep their place in the list.
 */
export function DetailDrawer({
  open,
  onClose,
  title,
  children,
  className,
  width = "sm:max-w-lg",
}: DetailDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className={cn("overflow-y-auto", width, className)}>
        <SheetHeader>
          <SheetTitle className="truncate pr-6 text-lg font-semibold">{title}</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-6">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

/** A titled group of fields. Renders a `<dl>`, so `DrawerField` can use dt/dd. */
export function DrawerSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      {title && (
        <h3 className="border-b border-border pb-1 text-sm font-semibold text-foreground">
          {title}
        </h3>
      )}
      <dl className="grid grid-cols-2 gap-4">{children}</dl>
    </div>
  );
}

/** One label/value pair. Must live inside a {@link DrawerSection}. */
export function DrawerField({
  label,
  children,
  span2,
}: {
  label: string;
  children: ReactNode;
  span2?: boolean;
}) {
  return (
    <div className={span2 ? "col-span-2" : undefined}>
      <dt className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}
