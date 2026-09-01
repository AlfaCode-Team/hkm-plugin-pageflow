import { createContext, useContext, type ReactNode } from "react";

/**
 * How wide the page content column is allowed to get.
 *
 * `full` is the pre-centring behaviour and exists for the pages that genuinely
 * need the whole viewport — a wide data table, a board, a map. Everything else
 * reads better in a measured column: on a 27" monitor an uncentred form stretched
 * its inputs to 2000px and left the eye travelling the full width of the screen
 * between a label and its field.
 */
export type ContentWidth = "default" | "wide" | "full";

/**
 * `[&>*]:mx-auto` is the second half of "centred", and the half that is easy to
 * miss.
 *
 * `mx-auto` on the CONTAINER centres the column in the viewport. It does
 * nothing for what is inside it: a card that declares `w-full max-w-md` is
 * 448px in a 1280px column and sits hard against its left edge, which is what
 * "the content is not centred" actually looks like on a wide screen.
 *
 * Applying `mx-auto` to each direct child fixes exactly that case and is inert
 * everywhere else — on a child with no max width, `w-full` or `block`, auto
 * margins resolve to zero and nothing moves. So a table still fills the column
 * and a narrow card sits in the middle of it, without either page saying
 * anything.
 */
const CENTRE_CHILDREN = "[&>*]:mx-auto";

const WIDTH: Record<ContentWidth, string> = {
  default: `mx-auto w-full max-w-7xl ${CENTRE_CHILDREN}`,
  wide: `mx-auto w-full max-w-[110rem] ${CENTRE_CHILDREN}`,
  // `full` is edge-to-edge by request, but its children are still centred —
  // "no max width" is about the column, not about hugging the left.
  full: `w-full ${CENTRE_CHILDREN}`,
};

/**
 * The horizontal padding every band shares.
 *
 * Load-bearing, and the reason this is one constant rather than a value each
 * component picks: `main`, `PageHeaderBar` and `PageFooterBar` are three
 * SEPARATE full-width bands stacked vertically, so their inner columns only
 * appear to be one column while their padding agrees. They did not — main was
 * `px-2 pl-6`, the header `px-3 md:px-6`, the footer `px-5` — which was
 * invisible while everything was full-bleed and left-aligned, and would show up
 * as a page title sitting a few pixels off the content it labels the moment
 * anything was centred.
 */
const PADDING = "px-4 md:px-6";

const ContentWidthContext = createContext<ContentWidth>("default");

/**
 * Publish the layout's content width so the header and footer bars can match it.
 *
 * They are rendered by the layout but live in their own module, and threading a
 * prop through would mean every custom shell that reuses the pair had to
 * remember to pass it — and a bar that forgot would silently misalign rather
 * than fail.
 */
export function ContentWidthProvider({
  width,
  children,
}: {
  width: ContentWidth;
  children: ReactNode;
}) {
  return <ContentWidthContext.Provider value={width}>{children}</ContentWidthContext.Provider>;
}

/** The container classes for the active width — `mx-auto`, a max width, padding. */
export function useContentClass(): string {
  return `${WIDTH[useContext(ContentWidthContext)]} ${PADDING}`;
}

/**
 * One band's centred column.
 *
 * Used by the layout for `main` and by both chrome bars, so a band's border and
 * background still span the viewport while its CONTENT lines up with every
 * other band's.
 */
export function ContentContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const container = useContentClass();

  return <div className={className ? `${container} ${className}` : container}>{children}</div>;
}
