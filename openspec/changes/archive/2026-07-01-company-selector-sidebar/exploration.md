# Exploration: company-selector-sidebar

## Current State

The app is a **single-page Next.js 15 budget manager** with all state living in `app/page.tsx` (`App` component). Key facts:

- **Data**: A flat `Transaction[]` array initialized from `lib/mockData.ts` (8 hardcoded transactions). No concept of "company" exists in the data model.
- **Sidebar** (`components/Sidebar.tsx`): Navigation-only — 5 menu items (Dashboard, Proyectos, Proveedores, Clientes, Datos) + collapse toggle. Header shows a static "B" logo + "Gestor Presupuestos" text.
- **Data flow**: `page.tsx` owns `transactions` state and passes it down to `Dashboard` and `Datos` as props. No context providers, no data layer abstraction.
- **Types** (`lib/types.ts`): `Transaction` has `proyectoAsignado`, `clienteOProveedor`, etc. — but no `companyId` or company association.
- **Firebase**: `firebase-tools` is in devDependencies but no Firebase config or SDK code exists yet.

## Affected Areas

- `lib/types.ts` — Must add `companyId` to `Transaction`; must define `Company` type
- `lib/mockData.ts` — Must tag each mock transaction with a `companyId`
- `components/Sidebar.tsx` — Must add company selector UI (dropdown/switcher) in the header area
- `app/page.tsx` — Must manage `selectedCompanyId` state, filter transactions by company, persist to localStorage
- `hooks/` — New `useCompany` hook (or context) for company selection + localStorage sync
- `components/Dashboard.tsx` — Receives already-filtered transactions; no structural change needed
- `components/Datos.tsx` — Same as Dashboard; receives filtered data
- `components/Sidepanel.tsx` — New transactions created here must inherit the active `companyId`

## Approaches

### 1. React Context + localStorage hook

Create a `CompanyContext` with a `useCompany` hook. The provider wraps the app in `page.tsx`. Sidebar consumes the context to render the selector. `page.tsx` filters transactions by `companyId` before passing to children.

- **Pros**: Clean separation, any component can access company without prop drilling, natural migration path to Firestore (swap context value source)
- **Cons**: Slightly more files (context + hook), but both are small
- **Effort**: Low

### 2. Lift state to page.tsx + prop drilling

Add `selectedCompanyId` state directly in `page.tsx`, pass it as a prop to `Sidebar` and use it to filter `transactions` before passing to `Dashboard`/`Datos`.

- **Pros**: Minimal new files, follows the existing pattern (everything in page.tsx)
- **Cons**: Prop drilling for company, harder to add company-aware components later (e.g., company-specific settings), doesn't scale toward Firestore migration
- **Effort**: Low

### 3. Data repository abstraction (pre-Firestore)

Create a `lib/data/company.ts` repository layer that wraps mock data behind an interface (`getTransactions(companyId)`, `getCompanies()`). Context consumes the repository. When Firestore arrives, only the repository implementation changes.

- **Pros**: Cleanest Firestore migration path, single place to swap data source
- **Cons**: Over-engineering for 2 companies and mock data — adds abstraction before it's needed. The repository will be thin and may feel pointless until Firestore arrives
- **Effort**: Medium

## Recommendation

**Approach 1 — React Context + localStorage hook.**

Rationale:
- The existing codebase already uses a flat prop-drilling pattern from `page.tsx`. A context provider is the minimal escalation that doesn't break the pattern but gives room to grow.
- localStorage persistence is trivial inside the hook (`useEffect` + `JSON.parse/stringify`).
- When Firestore arrives, the context provider's value source changes from localStorage+mock to a Firestore listener — the consuming components don't change.
- Avoids over-engineering (Approach 3) while being more scalable than prop drilling (Approach 2).

**Data model addition**:
```ts
// lib/types.ts
export interface Company {
  id: string;
  name: string;
  logo?: string; // first letter or icon
}

// Add to Transaction:
export interface Transaction {
  // ... existing fields
  companyId: string;
}
```

**Sidebar placement**: Company selector goes in the sidebar header area (above the nav menu), replacing or sitting below the current "B / Gestor Presupuestos" block. When collapsed, show only the company logo/initial.

## Risks

- **Mock data split**: Need to decide which of the 8 existing transactions belong to Samán vs. Borondo. The user should confirm this mapping.
- **Hydration mismatch**: localStorage is not available during SSR. Since the app already uses `'use client'` everywhere and `suppressHydrationWarning` in layout, this is manageable — default to first company on server, hydrate with stored value on client.
- **No git repo**: The project has a `.git` directory but `git status` reports it's not a repo (possibly uninitialized). Should verify before any commits.

## Ready for Proposal

**Yes** — the scope is well-defined and the approach is clear. The orchestrator can proceed to `sdd-propose`. One open question for the user: which mock transactions belong to which company (Saman vs. Borondo)?
