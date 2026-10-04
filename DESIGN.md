---
version: alpha
name: Ms Robot
description: "Midnight operations shell and pale evidence cards for project-scoped reporting."
colors:
  background: "#0f1724"
  surface: "#152033"
  raised: "#1b2942"
  foreground: "#e6eef6"
  muted: "#8fa3b8"
  primary: "#0ea5ff"
  paper: "#f7fbff"
  ink: "#0f1724"
  ink-muted: "#475569"
  good: "#7dce6a"
  warn: "#e0c36a"
typography:
  display:
    fontFamily: "Poppins, Vazirmatn, Segoe UI, sans-serif"
  sans:
    fontFamily: "Inter, Vazirmatn, Segoe UI, system-ui, sans-serif"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
omitted:
  - section: spacing
    reason: "Existing Tailwind spacing utilities remain canonical; this increment changes no global spacing scale."
components:
  button:
    height: "40px"
  input:
    height: "40px"
  badge:
    rounded: "9999px"
---

# Ms Robot design context

## Overview

Ms Robot is a working operations and reporting application for project owners and authorised collaborators. The Ada event view helps an unrestricted owner identify a receipt, inspect its origin and distinguish an acknowledged receipt from an uncertain acknowledgement. Receipt state never grants action approval.

The existing identity is a midnight operations shell with pale evidence cards: the shell holds controls and context, and the cards make an individual receipt legible. Preserve this distinction rather than introducing a new dashboard aesthetic for one panel. The register is product, with familiarity and evidence taking priority over decoration.

Supported copy is British English and Iranian Persian. Mixed-script references retain their exact values in bidi isolates. Operators may work on desktop or a narrow phone; time-sensitive records use explicitly labelled Tehran time. Do not infer medical decision or action-execution authority from an event's label.

This document follows ownership model B. `src/styles.css` remains the canonical runtime token source; the frontmatter mirrors its accepted values. Tailwind v4 adapts the `@theme` variables directly. No generator or separate theme layer is introduced.

## Colors

`background`, `surface`, `raised`, `foreground`, `muted` and `primary` map respectively to `--color-bg`, `--color-surface`, `--color-raised`, `--color-fg`, `--color-muted`, and `--color-primary`. `paper`, `ink`, `ink-muted`, `good`, and `warn` map to the identically named `--color-*` variables.

Dark controls use foreground/muted text on surface or raised. Receipt cards use ink text, including badge labels, on paper. Good and warn backgrounds supplement status words; colour never supplies the only meaning. Avoid subtle text for critical timestamps or instructions because the existing subtle token has weak contrast on dark surfaces.

The document-wide scrollbar baseline uses semantic aliases in `src/styles.css`: muted thumb, background track, foreground hover and primary active. Standards properties and WebKit fallbacks share those aliases. Forced colours restore platform/system contrast. No opt-in class is needed.

## Typography

Display headings use the existing display family; body and controls use sans; technical references use mono. Vazirmatn remains in both proportional stacks. Numbers and timestamps use the active locale. References remain exact technical strings and may use Latin characters in Persian. Long references wrap rather than relying on hover to reveal truncation.

## Layout

The event section shares the provider panel's rounded surface, spacing and natural document scrolling. Controls wrap on narrow screens. Cards use one column on phones and a three-column metadata row when space permits. Secondary detail uses native disclosure, not a fixed overlay. No viewport-height constraint is added to the workspace or sibling forms.

## Elevation & Depth

The existing `--shadow-border` identifies sections. Evidence cards use surface contrast rather than extra decorative elevation. Hover and visible focus identify controls; loading does not replace the list or move the refresh control.

## Shapes

Existing runtime radius tokens remain canonical. Controls reuse Button and Input. Cards and sections retain their current geometry. Icons use Lucide at the established utility size.

## Components

Canonical Button, Input and Badge are in `src/components/ui.tsx`. Input accepts a React ref for focus restoration; search does not implement a duplicate field style. Selected filter buttons expose `aria-pressed`. Counts and refresh results have polite, atomic status messages. Native `details`/`summary` owns disclosure keyboard behaviour. Essential proposal and acknowledgement constraints stay outside disclosures.

Refresh keeps valid same-project content readable while pending, blocks repeated activation and aborts its browser request and times out after 20 seconds. An unsuccessful request clears potentially stale authorised data and shows a localised retry path. Request generations continue to prevent prior project or unmounted responses from replacing current data.

No animation is introduced except the existing refresh spinner; reduced-motion users see a static indicator plus the same text. Event receipt labels are literal descriptions, not promises of resolution, delivery or execution beyond their recorded source and receipt state.

## Do's and Don'ts

- Use readable event names with the exact source code available in details.
- Label the latest-50 search boundary and distinguish the fetched window from all project history.
- Reuse shared primitives and runtime tokens; keep the existing public product name.
- Do not add approval, dispatch or retry execution controls to informational event receipts.
- Do not store event queries or references in URLs, browser storage, analytics or clipboard automatically.
