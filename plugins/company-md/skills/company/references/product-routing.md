# Company, product, and template selection

Use `companymd.yaml` to register several companies, products, or brands in one authorized workspace. Organizational membership (`parent`) does not inherit business facts or design; document `extends` and artifact bindings are explicit.

```yaml
schema: companymd/registry/v1
subjects:
  - id: studio
    name: Studio
    kind: company
    pack: ./context/studio
  - id: product-a
    name: Product A
    kind: product
    parent: studio
    aliases: [Product Alpha]
    pack: ./context/product-a
    artifacts:
      presentation:
        design: ./context/product-a/DESIGN.md
        templateSkill: ./templates/product-a-slides/SKILL.md
```

Paths are relative to the registry directory and must remain within the authorized workspace. `template` can bind a native template file; `templateSkill` binds the actual `SKILL.md` path. Do not select a skill by name similarity or reuse another product's presentation merely because it is available. A website design can supply tokens, but a slide template may add layout, density, or export requirements.

The normal path is one validated context call on the supplied workspace. The resolver discovers the registry or pack; no recursive inventory is needed first. Pass the identity named by the user even before checking whether a registry exists:

```bash
node <absolute-skill-directory>/scripts/run-companymd.mjs context <workspace> --subject product-a --artifact presentation --compact --workspace-root <workspace> --output <context.md> --receipt <context.json>
```

Use `resolve` only when diagnosing routing or inspecting the selected bindings without generating context:

```bash
node <absolute-skill-directory>/scripts/run-companymd.mjs resolve <workspace> --subject product-a --artifact presentation --workspace-root <workspace> --format json
```

Read the bound `templateSkill` and compose it with the host's available presentation capability. The template controls product-specific presentation rules; Company controls business meaning, audience, claims, and voice. If a required binding is missing or conflicts with an explicit user reference, explain the concrete conflict before dependent generation. Continue work that does not depend on that choice.

When the user switches from Product A to Product B, generate a fresh context and receipt using Product B's subject. Rebuild brand-specific content, assets, claims, and templates from that selection. Earlier conversation context is not an approved source for the new product.

For two separate decks, resolve each product separately and retain separate receipts. For a joint deck, use an explicit co-branding context or the user's clear joint-design direction; if neither exists, ask which identity leads before combining visual systems. A parent's registry membership alone does not authorize mixing product claims or styles.
