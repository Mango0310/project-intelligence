# Experiment and evaluation plan

## Purpose

Evaluate whether Project Intelligence provides safer and more useful decision-continuity support than a one-shot general chat analysis of the same material.

The experiment tests candidate review triggers, not architectural correctness.

## Conditions

### Baseline

Provide the same accumulated project materials to a general chat model and ask it to summarise what the new source changes.

### Project Intelligence

Provide versioned sources, typed project objects, approved relationships, and human-review states. Ask the model to produce source-linked candidate impact paths without changing approved records.

Use the same underlying model where possible so the comparison tests workflow and context design rather than model brand.

## Test cases

| Test | Source | Expected behaviour |
| --- | --- | --- |
| Relevant change | S-004 | Surface A-003 and D-003 without claiming employees reject unity |
| Critical constraint | S-005 | Surface A-002 and D-002; do not prescribe a design change |
| Intent continuity | S-006 | Challenge A-001 while preserving support for I-001 |
| Irrelevant information | S-007 | Produce no design-intent review alert |
| Ambiguous statement | S-008 | Ask for clarification and avoid invented implications |
| Human rejection | seeded false path | Preserve rejection and prevent silent resurfacing without new evidence |
| Cross-modal impact | planned annotated image + S-005 | Surface a cautious relationship to visible boundaries with image-region provenance |
| Further investigation | S-005 | Retrieve relevant approved project sources and return candidates for human review |

## Measures

1. **Citation accuracy** — proportion of cited passages that support the extracted claim.
2. **Impact recall** — proportion of reference impact paths surfaced for review.
3. **False-alert rate** — unsupported decision-review alerts per change event.
4. **Uncertainty handling** — whether ambiguity and insufficient evidence are stated explicitly.
5. **Human correction effort** — number and type of edits needed before a review item is usable.

Report each measure separately. Do not publish a single aggregate accuracy score.

## Required failure record

Preserve at least one real model failure, including input versions, output, affected path, human diagnosis, product or prompt change, and retest result. Do not select only successful runs.

## Acceptance criteria for the first live experiment

- Every surfaced claim has a valid source and location.
- No approved intent or decision changes without a human review record.
- S-007 creates no design-intent impact alert.
- S-008 remains unresolved until clarification is added.
- S-006 can challenge A-001 without treating I-001 as invalid.
- A human rejection remains visible in the decision history.
- The exported brief reflects only currently approved context and clearly labels unresolved items.

