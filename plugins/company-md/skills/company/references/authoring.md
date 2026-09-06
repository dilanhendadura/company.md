# Company.md authoring interview

Create useful drafts from the user's request and authorized sources. The passes below are evidence categories, not mandatory interview rounds. Inspect supplied websites, repositories, and documents first; ask only for facts still needed to complete the requested work. Preserve unknown facts explicitly instead of blocking draft creation on optional details.

## Pass 1 — Company

Ask what the company sells, who it serves, how it makes money, what it believes, what makes it different, and what it will not do. Separate current facts from aspirations.

## Pass 2 — Customer

Ask for the primary ideal-customer profile, painful situations, objections, buying triggers, decision criteria, feared outcomes, exact language, and explicit exclusions. Do not treat a persona stereotype as research.

## Pass 3 — Offer

Ask for active packages, included deliverables, pricing logic, proof, bounded promises, prohibited claims, qualification rules, and approval gates. Record a missing price or proof source as an open question, never as a plausible guess.

## Pass 4 — Voice and design

Ask how the business should sound, how it must never sound, preferred and avoided phrases, and two representative examples. If visual work is in scope, link or draft `DESIGN.md`; do not infer brand tokens from taste words alone.

## Pass 5 — Governance

Name an accountable owner and contact for every file, classification, scope, review date, escalation route, and evidence source for material claims. Mark unconfirmed ownership explicitly. Keep documents in `draft` until the authorized owner approves activation. A request to create and test a draft authorizes `--allow-draft` for that test; disclose this status without asking for the same permission again.

## Finish

Run `companymd lint <pack> --format pretty`. Return:

1. what is usable now;
2. open questions and assumptions;
3. evidence or approvals still required;
4. the exact next command or `$company` request the user can make.
