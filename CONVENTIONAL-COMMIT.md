# Conventional Commits 1.0.0

```
<type>[optional scope][!]: <description>

[optional body]

[optional footer(s)]
```

## Types

| Type     | Usage                                           |
|----------|-------------------------------------------------|
| `feat`   | New feature                                     |
| `fix`    | Bug fix                                         |
| `docs`   | Documentation only                              |
| `style`  | Formatting, missing semicolons, etc. No code change |
| `refactor` | Code refactor without feature or fix          |
| `perf`   | Performance improvement                         |
| `test`   | Adding/updating tests                           |
| `build`  | Build system or dependencies                    |
| `ci`     | CI configuration                                |
| `chore`  | Maintenance, tooling, minor tasks               |

## Rules

- Description MUST follow `<type>: ` (colon + space)
- Scope is OPTIONAL: `feat(parser): add array parsing`
- Breaking change: `feat!:` or `BREAKING CHANGE:` in footer
- Description is imperative, present tense: "add" not "added"/"adds"
- Description is lowercase unless proper noun
- No period at end of description
- Body MAY follow after blank line, free-form paragraphs
- Footer tokens use `-` for spaces: `Acked-by`, `Refs`
- `BREAKING CHANGE` MUST be uppercase

## Examples

```
feat: add glass fill hover to social links
fix(css): resolve social icon color override
refactor: extract spring constants into shared config
docs: add animation architecture overview
perf: reduce particle count on mobile
BREAKING CHANGE: social-link ::before removed
```
