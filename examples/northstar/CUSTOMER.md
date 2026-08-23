---
companymd: "0.1"
kind: customer
id: northstar-cloud.customer.regulated-ops
company: northstar-cloud
name: Regulated operations teams
status: active
classification: internal
owners:
  - team: Customer Research
    contact: research@northstar.example
review:
  last_reviewed: "2026-08-19"
  next_review: "2027-02-19"
scope:
  business_units: [all]
  regions: [eu, north-america]
  products: [platform]
claims:
  - id: customer.approval-delay
    status: verified
    source: internal://research/q2-2026/regulated-ops-study
    owner: Customer Research
    verified_at: "2026-08-10"
  - id: customer.audit-trigger
    status: verified
    source: internal://research/win-loss-fy26-h1
    owner: Revenue Operations
    verified_at: "2026-08-11"
---

# Northstar Cloud customer context

## Ideal Customer Profile

The primary customer has 500–5,000 employees, a regulated or contractually controlled operating environment, and at least one recurring workflow that crosses three teams. A named process owner can define the current steps, a control owner can approve boundaries, and IT can support identity and data integration.

## Pains

Operators chase evidence across email, shared drives, tickets, and spreadsheets. Managers cannot see why work is waiting. Control teams reconstruct the history after the fact. Interviewed teams consistently identified approval waiting time as a larger constraint than task execution time {claim:customer.approval-delay}.

## Objections

“We cannot let AI make that decision” is often correct; Northstar should respond by separating assistance, recommendation, execution, and approval. “This will become another system of record” signals that the integration and retention boundary is still unclear. “Our process is unique” requires a concrete process walk-through, not a generic rebuttal.

## Buying Triggers

A failed or expensive audit, a new regulatory obligation, an operating-model consolidation, a mandate to reduce cycle time, or an enterprise AI program that has reached the governance stage can create urgency. Audit remediation has produced the shortest observed path to an approved project {claim:customer.audit-trigger}.

## Questions

Customers ask where data is processed, which model sees it, what the agent can change, when a human approves, how actions are logged, how exceptions work, how long implementation takes, and how value will be measured.

## Language

Prefer the customer's terms: “case,” “control,” “evidence,” “exception,” “owner,” “approval,” and “activity history.” Use “agent” only after defining its job and boundary. Customers say work is “waiting on approval,” not that they need “hyperautomation.”

## Fears

The champion fears sponsoring an unsafe experiment. The operator fears losing control while remaining accountable. IT fears an ungoverned integration surface. Compliance fears incomplete evidence and plausible-looking unsupported output. Executives fear funding a demo that never becomes an operating capability.

## Decision Criteria

In order: security and data boundary, ability to encode human approvals, auditability, fit with the named workflow, integration effort, operator adoption, measurable cycle-time impact, and total commercial commitment. A credible negative test carries more weight than a broad feature list.

## Exclusions

Do not target teams seeking unsupervised high-impact decisions, companies without a named process owner, buyers unwilling to expose the current workflow, or use cases whose only success measure is “use more AI.”

## Evidence and Open Questions

Language and buying-trigger evidence currently overrepresents compliance-led projects. Customer Research will test whether operations-led expansions use different decision criteria in the next quarterly study.
