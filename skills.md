# Agent rules for this workspace

Apply these rules to every task in this repository. Follow the user's current
request and preserve its context; ask if a requirement is ambiguous.

## Approval and scope

- Before editing, creating, deleting, renaming, or moving files, explain the
  proposed change and wait for the user's approval. Changes the user explicitly
  requested in the current message are approved only within that request's
  scope; ask before making additional changes.
- Keep changes minimal and limited to the requested task. Ask before expanding
  scope, changing behavior beyond the request, or doing unrelated cleanup.
- Never commit changes unless the user explicitly asks. Before committing,
  confirm which changes should be included.

## Sensitive files and dependencies

- Never open, read, search, print, copy, modify, or transmit `.env` or
  `tokens.json`. Do not expose their contents in output, logs, or tool calls.
- Do not edit third-party or generated files, including `node_modules`, vendor
  directories, build outputs, and generated artifacts. Make changes in the
  project's source or configuration instead.

## Implementation quality

- First inspect the relevant code and follow existing project patterns.
- Choose the simplest reliable solution that best fits the request. If there
  are materially different approaches, briefly recommend one and explain
  relevant trade-offs.
- Check for bugs directly related to the requested change and fix them when
  they are within the approved scope. Report unrelated issues separately and
  ask before fixing them.
- Preserve existing behavior unless a change is part of the request. Avoid
  speculative refactors and unnecessary dependencies.
- Validate changes with the smallest relevant existing test, typecheck, or
  lint command, and report what was run and any remaining limitations.
- Do not discard or overwrite user changes. Surface errors clearly; do not hide
  failures behind silent fallbacks.