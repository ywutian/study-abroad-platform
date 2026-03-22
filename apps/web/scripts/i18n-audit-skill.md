# i18n Audit Skill — AI-Guided Internationalization Review

## Purpose

Structured workflow for comprehensively auditing and fixing i18n in any module of the web app. Designed for AI assistants (Claude) to follow step-by-step.

## When to Use

- Adding i18n to a new module
- Auditing an existing module for missed hardcoded strings
- After a large feature merge that may have introduced untranslated text

---

## Phase 1: Scope & Inventory

1. **Identify target directory** (e.g., `admin/high-schools/`)
2. **List all `.tsx` files** in the directory and `_components/`
3. **Check which files already use `useTranslations`** — files without it are highest priority
4. **Identify the i18n namespace** — look at neighboring modules for convention:
   - `admin/high-schools/` → `admin.highSchools`
   - `admin/data-review/` → `admin.dataReview`
   - `profile/` → `profile`
5. **Check existing keys** in `en.json` and `zh.json` under the namespace

## Phase 2: Script Triage

Run the hardcoded English detection script to get a prioritized list:

```bash
npx tsx scripts/check-hardcoded-english.ts --path <target>
```

Review the output:

- **HIGH confidence** issues are almost certainly hardcoded user-visible text
- **MEDIUM confidence** may be false positives — verify manually
- Files without `useTranslations` that have issues are top priority

## Phase 3: Deep Audit (Per File)

For each file, read it and identify ALL user-visible strings. The script catches common patterns, but manual review catches:

### Must Translate

| Pattern                                           | Example                           |
| ------------------------------------------------- | --------------------------------- |
| JSX text between tags                             | `<h4>Basic Information</h4>`      |
| `placeholder="..."`                               | `placeholder="Search by name..."` |
| `title="..."` / `alt="..."` / `description="..."` | `title="Edit school"`             |
| `toast.success/error/info('...')`                 | `toast.success('School updated')` |
| Badge/Button/Label text                           | `<Badge>Unevaluated</Badge>`      |
| Template literals with user text                  | `` `${count} items found` ``      |
| Confirm dialog text                               | `"Are you sure?"`                 |
| Empty state messages                              | `"No results found"`              |
| `aria-label="..."` with user-visible meaning      | `aria-label="Edit school"`        |
| Column headers in tables                          | `<TableHead>Name</TableHead>`     |
| Card/Section titles                               | `<CardTitle>Overview</CardTitle>` |

### Do NOT Translate

| Pattern                   | Example                                       |
| ------------------------- | --------------------------------------------- |
| CSS class names           | `className="flex items-center"`               |
| Component/variable names  | `<SchoolEditDialog>`                          |
| API endpoints, query keys | `queryKey: ['adminHighSchools']`              |
| HTML attribute values     | `variant="ghost"`, `size="sm"`, `type="text"` |
| Enum/constant keys        | `'ADMITTED'`, `'PUBLIC_US'`                   |
| Country/currency codes    | `'US'`, `'CN'`, `'USD'`                       |
| Console logs              | `console.log('debug')`                        |
| Comments                  | `// This is a comment`                        |
| Data field names from API | `school.name`, `school.country`               |
| File paths, URLs          | `'/api/admin/schools'`                        |
| Technical abbreviations   | `GPA`, `SAT`, `TOEFL`                         |
| Import statements         | `import { Button } from '...'`                |

## Phase 4: Generate i18n Keys

### Naming Conventions

```
Namespace pattern:
  page path                    → namespace
  admin/high-schools/          → admin.highSchools
  admin/data-review/           → admin.dataReview
  profile/                     → profile

Key grouping:
  Tab labels                   → tabs.*
  Filter controls              → filters.*
  Table column headers         → table.*
  User messages/toasts         → messages.*
  Dialog content               → dialog.*
  Form field labels            → form.*
  Empty/loading states         → messages.*
  Button labels (specific)     → messages.* or dialog.*
  Button labels (generic)      → reuse common.* or admin.common.*
```

### Rules

1. **Reuse existing keys** — check `common.*` and `admin.common.*` before creating new ones
2. **Follow neighbor conventions** — look at sibling modules for naming patterns
3. **Use interpolation** for dynamic values: `t('messages.found', { count: total })`
4. **Use `t.rich()`** for inline formatting:
   ```typescript
   // en.json: "description": "Enter <code>name</code> and <code>country</code>"
   t.rich('description', { code: (chunks) => <code>{chunks}</code> })
   ```
5. **Keep keys descriptive but concise** — `messages.schoolUpdated` not `messages.theSchoolHasBeenUpdatedSuccessfully`

### Output Format

Prepare two blocks for en.json and zh.json:

```json
{
  "admin": {
    "moduleName": {
      "tabs": { ... },
      "filters": { ... },
      "table": { ... },
      "messages": { ... },
      "dialog": { ... }
    }
  }
}
```

## Phase 5: Apply Changes

### Step-by-step

1. **Add keys to `en.json`** — insert alphabetically within the `admin` section
2. **Add keys to `zh.json`** — mirror structure with Chinese translations
3. **Update each component file**:
   - Add `import { useTranslations } from 'next-intl'` if missing
   - Add `const t = useTranslations('namespace')` at component top
   - Replace each hardcoded string with `t('key')` or `{t('key')}`
   - For props: `placeholder={t('filters.searchPlaceholder')}`
   - For JSX text: `{t('messages.title')}`
   - For toast: `toast.success(t('messages.saved'))`
4. **Handle sub-components** — if a file has multiple components, each needs its own `useTranslations` call (hooks can't be conditionally called)

### Verification Checklist

Run these commands after applying changes:

```bash
# 1. Check for missing keys (t() calls without matching key in JSON)
npx tsx scripts/check-missing-keys.ts

# 2. Check en/zh key consistency
npx tsx scripts/check-translation-keys.ts

# 3. Re-run hardcoded English check (should show fewer/no issues)
npx tsx scripts/check-hardcoded-english.ts --path <target>

# 4. TypeScript compilation
pnpm --filter web tsc --noEmit

# 5. Full i18n suite
pnpm --filter web lint:i18n
```

### Common Pitfalls

- **Variable shadowing**: Don't name loop variables `t` when `t` is already the translation function
  ```typescript
  // BAD: shadows t from useTranslations
  {TYPES.map((t) => <SelectItem>{t}</SelectItem>)}
  // GOOD: use different name
  {TYPES.map((type) => <SelectItem>{type}</SelectItem>)}
  ```
- **Type mismatches**: `TIER_VARIANT[school.tier]` fails if `school.tier` is string — use `Number(school.tier)`
- **Rich text syntax**: Use `<tag>content</tag>` in JSON, not `{variable}` for formatted segments
- **Hook placement**: `useTranslations` must be called at component top level, not inside callbacks or conditions

---

## Quick Reference: One-liner Audit

For a fast audit of any module:

```bash
npx tsx scripts/check-hardcoded-english.ts --path <module-path>
```

Then follow Phases 3–5 above for each flagged file.
