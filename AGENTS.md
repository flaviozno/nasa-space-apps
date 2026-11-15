# Codex Project Instructions

<!-- BEGIN GRAPHIFY CODEX -->

## Graphify Architecture Context

This repository contains architectural documentation
generated locally with Graphify and Ollama.

### Context Loading

- Use `.codex/instructions.md` when architectural context
  is relevant to the current task.
- Consult `graphify-out/GRAPH_REPORT.md` for complex
  dependencies, integrations and architectural changes.
- Do not read the entire graph report for trivial changes.
- Treat generated documentation as guidance, not authority.
- Validate important relationships against source code.

### Development Rules

1. Inspect relevant source files before making changes.
2. Follow established repository conventions.
3. Prefer existing abstractions and utilities.
4. Avoid introducing unnecessary dependencies.
5. Respect existing module boundaries.
6. Consider downstream dependencies when changing shared code.
7. Keep modifications focused on the requested task.
8. Run available tests and validation commands.

### Graphify Tools

When needed, use:

- `graphify query "<question>"` to explore relationships.
- `graphify explain "<node>"` to understand a component.
- `graphify path "<source>" "<target>"` to trace dependencies.

Use these selectively to avoid unnecessary context consumption.

<!-- END GRAPHIFY CODEX -->

