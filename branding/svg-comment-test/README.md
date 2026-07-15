# SVG comment render test (temporary — delete after inspection)

Hypothesis under test: what broke the GitHub / VS Code preview of the old
`logo-tile.svg` was **not** the comment being multi-line, but the `--` inside
it — the XML spec forbids the string `--` anywhere within a comment, and the
old comment contained `--primary` / `--primary-foreground`.

Python's strict XML parser agrees:

| File | Comment | Well-formed XML? | Predicted preview |
|---|---|---|---|
| `a-no-comment-control.svg` | none | ✅ | renders |
| `b-multiline-comment-no-double-hyphen.svg` | 3 lines, no `--` | ✅ | **renders** |
| `c-single-line-comment-with-double-hyphen.svg` | 1 line, contains `--primary` | ❌ | **broken** |
| `d-multiline-comment-with-double-hyphen.svg` | 3 lines, contains `--primary` | ❌ | broken |

If b renders and c breaks, the double hyphen is the culprit and line count is
irrelevant. (The shipped logo SVGs are comment-free either way, so this is
purely diagnostic.)
