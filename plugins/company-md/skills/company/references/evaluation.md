# Before/after evaluation

Use this reference when validating whether Company.md improves an agent output.

Run the same task twice with the same model, tools, attachments, and output constraints:

1. baseline without a Company.md context bundle;
2. candidate with the narrowest applicable Company.md profile.

Save both outputs as plain text or Markdown companions even when the final artifact is binary. Evaluate them with:

```bash
companymd eval <pack> --baseline <baseline.md> --candidate <candidate.md> --rubric <rubric.yaml>
```

Report criterion-level passes, fixed failures, and regressions. Never summarize the result as a truth score. Static checks demonstrate conformance to explicit constraints; they do not prove factual truth, persuasion, design quality, or business performance. Add human or model graders for those dimensions and keep their results separate.

When the final deliverable is native to a cloud editor, keep the revision id in the artifact receipt and rerender after every write. A live URL proves location, not completion: `artifact/access`, `artifact/revision`, and every artifact-specific gate must still pass.
