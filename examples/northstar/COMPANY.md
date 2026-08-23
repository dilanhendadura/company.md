---
companymd: "0.1"
schema: companymd/context/v1
maturity: enterprise
kind: company
id: northstar-cloud
name: Northstar Cloud
status: active
classification: internal
owners:
  - team: Corporate Strategy
    contact: strategy@northstar.example
review:
  last_reviewed: "2026-08-20"
  next_review: "2027-02-20"
scope:
  business_units: [all]
  regions: [eu, north-america]
  products: [all]
links:
  customer: ./CUSTOMER.md
  offer: ./OFFER.md
  voice: ./VOICE.md
  design: ./DESIGN.md
claims:
  - id: company.subscription-model
    status: verified
    source: internal://finance/fy26-commercial-model
    owner: Finance
    verified_at: "2026-08-18"
  - id: company.eu-data-boundary
    status: verified
    source: internal://security/architecture/data-residency-4
    owner: Security Architecture
    verified_at: "2026-08-12"
  - id: company.operator-first
    status: decision
    source: internal://decisions/brand-positioning-12
    owner: Corporate Strategy
---

# Northstar Cloud company context

## Overview

Northstar Cloud is the fictional example company for Company.md. It gives regulated mid-market operations teams a controlled workspace for turning fragmented procedures into reviewable, agent-assisted workflows.

## What We Sell

We sell a hosted workflow platform, implementation services, and optional governed connectors. The product brings procedures, evidence, approvals, and agent activity into one auditable operating surface.

## Who We Serve

We serve operations and compliance teams in regulated companies with 500–5,000 employees. The economic buyer is usually an operations, risk, or technology executive; the daily user owns a high-volume process that still crosses email, documents, and spreadsheets.

## How We Make Money

Northstar uses an annual software subscription with implementation scoped separately {claim:company.subscription-model}. Connector volume and workflow complexity influence the subscription band; headcount alone does not.

## What We Believe

Useful automation begins with a process people can inspect. Agents should make bounded work faster, show their evidence, and stop at named approval points. We optimize for the operator who is accountable after the demo, not for the person impressed during it {claim:company.operator-first}.

## What Makes Us Different

Northstar combines workflow execution, evidence lineage, human approvals, and activity history in one product. EU customer data can remain within the approved EU processing boundary {claim:company.eu-data-boundary}.

## Operating Boundaries

We do not sell autonomous decision-making for employment, credit, medical, or law-enforcement outcomes. We do not describe a prototype as production-ready, promise that an agent cannot fail, or bypass a customer's control owners.

## Evidence and Open Questions

The current claims are approved for sales engineering and product work, not automatically for public marketing. Corporate Strategy owns the open question of whether the primary category should remain “governed workflow platform” after the next customer research cycle.
