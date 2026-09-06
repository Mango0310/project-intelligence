# Product definition

## Research question

When evidence, constraints, stakeholder understanding, and project intent change during a complex design project, can AI help a multidisciplinary team identify which earlier assumptions, intents, and decisions deserve another look, while leaving final professional judgment with people?

## Product value

Project Intelligence helps a team recover two forms of context:

- **Decision rationale:** why an earlier judgment was made.
- **Change impact:** what new information may require the team to reconsider.

## Core information types

| Type | Definition | Example form |
| --- | --- | --- |
| Source | A versioned original artefact | brief, transcript, review note, image |
| Observed evidence | A traceable observation or recorded result | research finding with method and scope |
| Stakeholder view | A person's stated belief, priority, or concern | sponsor's view of project value |
| Constraint | A condition that limits possible responses | confidentiality or retained-material requirement |
| Assumption | A proposition temporarily used in reasoning | a proposed cause of a workplace problem |
| Interpretation | A team reading of what the material may mean | a possible implication requiring review |
| Design intent | An approved outcome the design should support | support purposeful exchange across disciplines |
| Design decision | A recorded choice informed by current intent | develop a central shared review setting |
| Review | A human judgment about an extraction or impact | keep, revise, reject, investigate |

Stakeholder statements are not promoted to verified evidence automatically. A source can support multiple, even conflicting, views.

## Human–AI boundary

AI may:

- extract candidate information with exact source locations;
- propose relationships and possible impact paths;
- distinguish conflict, tension, ambiguity, and missing information;
- search an approved project repository for additional candidate evidence;
- state why an item was surfaced and what remains uncertain.

AI may not:

- approve or modify a design intent;
- decide that a professional decision is wrong;
- resolve stakeholder disagreement;
- convert an unverified statement into a fact;
- assign professional responsibility;
- silently overwrite human decisions or rationale.

## Primary interaction

The main work surface is the **Change Impact Inbox**. Each candidate review contains:

- the new source and exact supporting passage;
- the proposed impact path;
- the AI's reason for surfacing it;
- extraction confidence, evidence sufficiency, and human-review status as separate fields;
- affected disciplines and an assigned human owner;
- one of four human outcomes: `confirm_unchanged`, `revise`, `reject_ai_interpretation`, or `need_more_evidence`;
- a required human rationale.

The relationship map is a traceability view, not the primary workflow.

## MVP pages

1. **Project Context** — sources, provenance, versions, and scope.
2. **Project Intelligence Map** — evidence-to-decision relationships.
3. **Human Review** — extraction and relationship review.
4. **Change Impact Review** — candidate impact queue and human decisions.
5. **Current Design Intent** — approved current context and export.

## Review levels

- `monitor`: related information with no current action.
- `review_recommended`: a plausible impact that deserves professional attention.
- `review_required`: a defined critical constraint or approved project premise has changed.

AI can recommend a level. Only transparent project rules or a person can make a review mandatory.

## Export

The system will produce a human-readable brief and structured JSON containing current approved intents, constraints, assumptions, decisions, unresolved questions, recent changes, provenance, and explicit items that downstream AI systems must not infer.

