# Monochrome design direction

## Redesign brief

Full visual overhaul following the supplied screenshot and feedback. Preserve the case workflow, routes, role switching, approval/consent semantics and backend APIs. Replace the original blue card grid with a charcoal navigation rail, white work surfaces, larger editorial figures and mixed-size information panels.

Design read: banking operations dashboard for laptop/desktop use with responsive customer screens. Authoritative but energetic; visual variance 7/10, motion 5/10, information density 7/10, external asset dependence 1/10. Charts explain the current case population; animation explains hierarchy and responds to interaction.

## Reference map

These Dribbble references informed individual component families. This is an original implementation; their artwork, logos and full layouts are not copied.

| Element family | Reference | Application |
| --- | --- | --- |
| Navigation and identity | [Finance sidebar](https://dribbble.com/shots/22222957-Finance-Dashboard-sidebar-navigation) | Strong rail, readable active state and restrained metadata |
| Numeric hierarchy | [Vantage dashboard](https://dribbble.com/shots/27790082-Dashboard-UI-Design) | Large values and small supporting labels |
| Analytics and card composition | [Analytics dashboard](https://dribbble.com/shots/27359377-Modern-Analytics-Dashboard-UI-Concept) | Mixed-size panels and clear chart grouping |
| Tables and filters | [Table/card collection](https://dribbble.com/jiachunli/collections/485589-dashboard-table-cards-data) | Merchant identities, compact rows and segmented filters |
| Investigation details | [Case management](https://dribbble.com/shots/27172249-Intuitive-Case-Management-Dashboard) | Case context, evidence and human decisions |
| Case history | [Dashboard timeline](https://dribbble.com/shots/26607817-Dashboard-timeline-view) | Compact chronological events |
| Forms and dialogs | [Dashboard modal](https://dribbble.com/shots/6071520-A-Dashboard-with-a-modal-sample) | Focused forms, clear actions and contained overlays |
| Form assignment patterns | [Case management modal](https://dribbble.com/shots/3796653-Case-Management-Dashboard-and-Modal) | Distinct information requests and decision surfaces |

## System

Palette: charcoal #171717 / #242424, white, neutral gray only. No blue or semantic red/green accents. Manrope typography, tabular figures, 4px spacing rhythm, 8px controls and 13px panels. Hover elevation is subtle and never changes data meaning.

The overview shows real case counts and a read-only horizontal six-stage workflow journey. Four metric cards provide the single dashboard filter area, with a light charcoal selected state. The distribution panel and duplicate dashboard filter tabs have been removed. Search and Refresh share the queue header; a compact footer provides a synchronized page-size menu, visible range and Previous/Next controls. CSV export includes only the visible queue, escapes quotes and neutralizes spreadsheet formulas. Transaction explorer adds merchant/account context, live search and posted/reversed filters. Activity is labelled Case register because it shows submissions and present status, not a fabricated event feed.

Case history is the individual dispute's audit trail: submission, reviewer decisions, customer responses and resolution. Its height is bounded for long histories; a one-event case stays compact. Internal tool outputs remain separate and role-scoped.

## Follow-up refinements

Remove the redundant sidebar workspace switch card, activity-recording tag and promotional text card. Use a quiet decorative layered-evidence animation in the sidebar footer. The illustration is not an operational progress indicator or certification claim.

Consolidate investigation context in one white case header: prominent black Back to disputes button, case reference, title, status, merchant, amount and transaction reference. Keep the sample-case disclosure in a compact footer. Move the global AI configuration notice into a small topbar indicator with an explanatory tooltip. Show Disputes as active while reading a case; inactive sidebar items remain transparent.

## Profile switcher

The topbar uses a custom monochrome profile menu instead of a native select. Its 56px trigger combines a 36px avatar, 13px name, readable role subtitle and animated chevron. The 344px menu groups bank reviewers and customer views, explains each persona and marks the active selection. Demo context is contained within the menu instead of a separate tiny header badge.

Keyboard interaction supports Enter/Space, arrow keys, Home/End, initial-letter navigation, Escape and Tab. Selection restores focus to the trigger; outside clicks close the menu without stealing focus. The panel adapts to narrow screens and reduces motion when requested. Existing identity-switching and role/ownership behavior is preserved.

## Responsive dispute form

The dispute form expands to 1120px on desktop and 1240px on large displays. Labels use 14–15px text and values use 16–17px text. Transaction and reason selectors share a desktop row; the statement and evidence fields each have a generous 220–240px writing area. A persistent footer keeps submission accessible. Smaller screens stack the fields, retain 16px values and scroll within the available viewport. Existing field names, ordering, validation and submission behavior are unchanged.

## Application-wide field menus and case readability

Transaction and reason inputs now use the shared SelectField component; there are no native select controls remaining in the app. Menus retain exact backend field names/values through hidden form inputs, show secondary option details, support keyboard navigation and choose above/below placement within the modal. Escape closes a field menu before closing its dialog. Menus do not submit the form when selecting a value.

Case stage labels use 13–14px text and 32–36px indicators. Narrow screens use three or two columns rather than shrinking six labels into unreadable text. The history sidebar grows to 360–395px on desktop, with 14–15px event headings, 12px timestamps and 13–14px descriptions; the case content stacks below 1000px.

## Motion and accessibility

Controls use 120–200ms feedback; panels enter over 350–650ms with short staggers; dialogs fade and translate. Metric figures ease to new values. Decorative orbit and evidence-layer motion is slow, local and independent of actual investigation progress. Reduced-motion preferences stop decorative motion and show current metric values immediately. Focus rings, modal focus trapping, explicit button labels and text-labelled statuses remain in place.

## Case evidence popup and status actions

Case status is a labelled, non-interactive value. Retry processing and Banking tool activity are primary buttons beside it; tool activity is no longer below Case history. The modal decodes nested MCP text results and chooses a presentation by data shape:

- Labelled facts for transaction and reversal checks, using semantic definition lists.
- Comparison tables for duplicate candidates and related transactions.
- Full-width text for policy guidance and customer statements.
- Individual supporting responses with their own labels and metadata.

The approach follows [GOV.UK summary lists](https://design-system.service.gov.uk/components/summary-list/) for key facts and [Carbon data tables](https://carbondesignsystem.com/components/data-table/usage/) for comparable records. Amounts are converted from minor units; dates and flags are human-readable. Possible duplicates remain explicitly unconfirmed. Repeated tool runs keep their timestamps and independent expansion states. Raw transport annotations are omitted.

Current operational errors use a dismissible top-right toast, while historical errors remain in the case audit log. Refresh controls replace idle polling; only active processing gets bounded status checks.

## Truthful AI runtime states

The case header, queue and history register use one shared status presentation. A failed investigation reads AI Review Failed and shows a static monochrome diamond; a queued review or missing setup uses a static indicator; only running work uses the pulsing dot. The six-stage progress display replaces the label in its AI slot with the applicable runtime state. The dashboard counts failed reviews in the AI stage and notes reviews needing attention beside the workflow heading. Retry transitions to queued before the worker changes it to running.

## Verification

ESLint, TypeScript/production build and 21 frontend tests pass. Tests cover scoped API requests, stale approvals, record-backed aggregates, empty charts, transaction rendering, case-header context and CSV safety. Browser-host access was unavailable and native Chrome access was not approved, so rendered visual acceptance remains unverified in this session.
