# Design: Company Selector in Sidebar

## Technical Approach

React Context wrapping the app at `page.tsx`, providing company state consumed by the sidebar and available to any descendant. Active company persists to `localStorage` via a `useEffect` inside the provider. The static "B" logo in the sidebar header is replaced by a dropdown showing the selected company — initial-only when collapsed, name + initial when expanded. Future Firestore migration swaps the context value source without changing consumers.

The two companies are **Pácora** (`id: "pacora"`) and **Samán** (`id: "saman"`), sourced from a static `COMPANIES` constant in `mockData.ts`.

## Architecture Decisions

### Provider placement

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `layout.tsx` wrapping every page | Layout is a server component — would need conversion | ❌ |
| `page.tsx` wrapping the App JSX | Already `'use client'`, minimal diff, all consumers inside it | ✅ |

### Company selector UI

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Native `<select>` | Accessible but unstylable dropdown | ❌ |
| Custom button + absolute dropdown | Full design control, matches existing aesthetic | ✅ |

### `CompanyProvider` + `useCompany` in one file vs. split

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Two files: one provider, one hook | More files, same logic | ❌ |
| Single `context/CompanyContext.tsx` | Provider, context, and hook co-located; hook is 3 lines | ✅ |

## Data Flow

```
page.tsx
  └── CompanyProvider (wraps Sidebar + main content)
        ├── Sidebar
        │     └── useCompany() → renders selectedCompany in dropdown
        │         onChange → setCompany(id) → localStorage + context
        └── Dashboard / Datos
              └── useCompany() (future: filters transactions by companyId)
```

The provider initializes by reading `localStorage`. If the stored ID is missing or invalid, it defaults to `COMPANIES[0]` (Pácora). No SSR concern — the app is `'use client'` everywhere, so `localStorage` is always available after hydration.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `lib/types.ts` | Modify | Add `Company` interface; add optional `companyId?: string` to `Transaction` |
| `lib/mockData.ts` | Modify | Export `COMPANIES` constant: `[{ id: "pacora", name: "Pácora" }, { id: "saman", name: "Samán" }]` |
| `context/CompanyContext.tsx` | Create | `CompanyProvider` + `useCompany` hook with localStorage sync |
| `components/Sidebar.tsx` | Modify | Replace static "B" logo with company selector dropdown using `useCompany()` |
| `app/page.tsx` | Modify | Import `CompanyProvider`, wrap JSX children |

## Interfaces / Contracts

```ts
// lib/types.ts (additions)
export interface Company {
  id: string
  name: string
}

export interface Transaction {
  // ...existing fields
  companyId?: string  // optional — existing transactions stay valid
}

// context/CompanyContext.tsx — exported
interface CompanyContextValue {
  selectedCompany: Company
  companies: Company[]
  setCompany: (id: string) => void
}
```

`localStorage` key: `selected-company-id` — stores the raw company ID string.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `useCompany` defaults to first company when localStorage is empty | Mock `localStorage`, mount provider, assert `selectedCompany.id === "pacora"` |
| Unit | `setCompany` persists to localStorage and updates context | Call `setCompany("saman")`, assert localStorage write + context update |
| Unit | Invalid stored ID falls back to default | Set localStorage to `"borondo"`, mount, assert fallback to Pácora |
| Visual | Sidebar renders company initial when collapsed, dropdown when expanded | Render `Sidebar` inside `CompanyProvider` with both `collapsed=true/false` |
| Integration | New transactions created via Sidepanel don't require companyId | No regression — optional field |

## Migration / Rollout

No migration required. This is a pure additive change — new types are optional, existing data is untouched, localStorage is populated on first visit. Revert by removing `CompanyProvider`, reverting `Sidebar.tsx`, and deleting `context/CompanyContext.tsx`.

## Open Questions

- [x] (Resolved by spec) Companies are Pácora and Samán — no "Borondo" in this scope.
- [ ] Sidebar dropdown design: should the dropdown appear on hover or click? Click is simpler and more predictable on mobile.
