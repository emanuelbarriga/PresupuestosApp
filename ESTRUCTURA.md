# 📊 Estructura de Firestore — PlanningSaman

Generado el 2026-07-13 a las 16:58

## Resumen

| Colección | Documentos | Campos totales | Tamaño estimado |
|-----------|-----------:|---------------:|----------------:|
| `companies` | 2 | — | 175 B |
| `invitations` | 1 | — | 212 B |
| `settings` | 1 | — | 1.3 KB |
| `terceros` | 52 | — | 8.6 KB |
| `users` | 3 | — | 487 B |

---
## 📁 `companies`
- **Documentos**: 2
- **IDs**: `pcora`, `saman`

### Campos

| Campo | Tipo(s) | Requerido | Valores de ejemplo |
|-------|---------|-----------|-------------------|
| `createdAt` | string | ✅ Siempre | 2026-07-05T03:20:06.241Z<br>2026-07-01T21:42:47.728Z |
| `name` | string | ✅ Siempre | Pácora<br>Samán |
| `createdBy` | string | ⚠️ 1/2 | 0yJ45MfxOoNblIuR1NrcFfU1OWL2 |

---
## 📁 `invitations`
- **Documentos**: 1
- **IDs**: `pUuymWPY5d9uZpksFpoH`

### Campos

| Campo | Tipo(s) | Requerido | Valores de ejemplo |
|-------|---------|-----------|-------------------|
| `createdAt` | string | ✅ Siempre | 2026-07-10T19:35:16.331Z |
| `email` | string | ✅ Siempre | henry.soto@pacoraproducciones.com |
| `expiresAt` | string | ✅ Siempre | 2026-07-11T19:35:16.331Z |
| `invitedBy` | string | ✅ Siempre | 0yJ45MfxOoNblIuR1NrcFfU1OWL2 |
| `status` | string | ✅ Siempre | pendiente |

---
## 📁 `settings`
- **Documentos**: 1
- **IDs**: `categorias`

### Campos

| Campo | Tipo(s) | Requerido | Valores de ejemplo |
|-------|---------|-----------|-------------------|
| `stateProject` | array<object> | ✅ Siempre | [{name, color, order}, {name, color, order} … (+3 más)] |
| `tipoComprobante` | array<object> | ✅ Siempre | [{order, color, name}, {name, color, order} … (+4 más)] |
| `tipoProyectos` | array<object> | ✅ Siempre | [{color, name, order}, {name, color, order} … (+6 más)] |
| `unidades` | array<object> | ✅ Siempre | [{color, order, name}, {color, name, order} … (+2 más)] |
| `updatedAt` | Timestamp | ✅ Siempre | 2026-07-10T04:10:10.000Z |

### Arrays detectados

| Campo | Items | Estructura interna |
|-------|------:|--------------------|
| `stateProject` | 5 | `name`, `color`, `order` |
| `tipoComprobante` | 6 | `order`, `color`, `name` |
| `tipoProyectos` | 8 | `color`, `name`, `order` |
| `unidades` | 4 | `color`, `order`, `name` |

---
## 📁 `terceros`
- **Documentos**: 52
- **IDs**: `06akExU7StJ0fbEz0Tu6`, `2gmchVaKIHnTG5XepX2G`, `2xHAYHxvMYlhJBbeuESn`, `31jJlePpzF6wrUfeHnok`, `3lZAzYUq6VToBnydtSfm`, `4WgUK3jmntEnJUcWbwxh`, `6099YwvqiKJ6vpLp8Mzw`, `6Yybt8TaVV2evDv6unwe`, `ApBBukN5wXL3ANJ5lVWB`, `Da2lF71H8ZAIhgN5rW3w`, `DiySKeU64lfVY5fhG3tj`, `Eklu7Gi37O4T6ZPFA0O3`, `F1U2ScJhX7RZ5uUf0rJd`, `GGV5olKBfUzkXQKiKSzC`, `H8eLunPge4zB5v02LsUC`, `HtrQPYxPj07w9alf54eg`, `LF5ComS34ftKib8s09D8`, `LoL0x0gKA4uBxQMODW4r`, `NnVlQXoqwP0IMMGXvOas`, `O6xa1FtK7R1Y7cp3bBHH`, `PT3qRSSJJOd6cnapPCxP`, `RSi0iQ80PZrUA9U2pnpY`, `UFVdhG6Sidiq3a1py7zS`, `VhzXlCTpffVq0B3rxOqV`, `W8kB67dpS0GbU3aWFSFj`, `YEeS2UwfKGsgYqhZ61FI`, `a2KomgylbrqQphPd90Gg`, `bGq41uhW8ao8C4p6Bajn`, `bLKRdXBlRDp8N2nmq4kz`, `c50A4tQ6j0FLNqtspSvL`, `cYbMd6a5O4F57wJQC8aR`, `cqcwmp26FGRUD1g2e59X`, `eOjw4IZWmyqfi1PAQ8gr`, `faBRedP5jzUybDP07nXf`, `gKdK6ZoXfuGq98KhzbHj`, `jKS8ErT2pulExAkFAOJp`, `l0GwdZ2lir6TXQYIv4kF`, `lJUaNdWb6R3xbfOFuI7L`, `mLkzX2K18F0n6GUZaj2M`, `nDFP2SHXLQi6joZ4bzou`, `pRdZ9vJRhlaGVHbTh31U`, `rUTuNRxAFFzigJlEtJrf`, `rsM1YfeXwq2wNlzXQFft`, `uDN2oFqOvhE8045xpYr6`, `uIRFTKLbIbYEYwBrB57G`, `vgkfeN99OuOY3p4AolB7`, `xAub16dZ5nZEmS0IUHZL`, `yD3PjHyV9sy4UrBuBz1V`, `yPSOhcWajDmEobOSsOuQ`, `zHaxyxKPCgYdwocJXXLN`, `zlnjj7O2uOfXmggD3LVu`, `zpg8zk7Wgp0raXbmjamK`

### Campos

| Campo | Tipo(s) | Requerido | Valores de ejemplo |
|-------|---------|-----------|-------------------|
| `createdAt` | Timestamp, string | ✅ Siempre | 2026-07-02T18:54:33.000Z<br>2026-07-02T16:59:40.781Z |
| `name` | string | ✅ Siempre | Google Samán<br>Pácora Producciones SAS |
| `tipo` | string | ✅ Siempre | cliente<br>ambos |
| `apodo` | string | ⚠️ 20/52 | Pácora<br>Juan Francisco |
| `documento` | string | ⚠️ 19/52 | NIT<br>CI |
| `lugar` | string | ⚠️ 20/52 | Colombia<br>Ecuador |
| `naturaleza` | string | ⚠️ 20/52 | Persona Jurídica<br>Persona Natural |
| `numeroDocumento` | string | ⚠️ 19/52 | 901170033<br>1718217548 |
| `updatedAt` | Timestamp | ⚠️ 4/52 | 2026-07-02T17:42:29.000Z<br>2026-07-02T17:40:42.000Z |

---
## 📁 `users`
- **Documentos**: 3
- **IDs**: `0yJ45MfxOoNblIuR1NrcFfU1OWL2`, `GVfk76SIivWLJHeEjXxFBRArmsu2`, `ozpvJjskOqY7MtKfYJaMbGCj1q53`

### Campos

| Campo | Tipo(s) | Requerido | Valores de ejemplo |
|-------|---------|-----------|-------------------|
| `createdAt` | string | ✅ Siempre | 2026-07-05T03:20:06.241Z<br>2026-07-10T19:25:48.895Z |
| `email` | string | ✅ Siempre | emanuel.barriga@pacoraproducciones.com<br>emanuel.barriga@samanestudio.com |
| `id` | string | ✅ Siempre | 0yJ45MfxOoNblIuR1NrcFfU1OWL2<br>GVfk76SIivWLJHeEjXxFBRArmsu2 |
| `pendingAssignment` | boolean | ⚠️ 1/3 | false |

---

## ⚠️ Observaciones

- ⚠️ `companies.createdAt` guarda fechas como **string ISO** en lugar de Timestamp de Firestore. Ej: `2026-07-05T03:20:06`
- 📊 **5 colecciones**, **59 documentos** en total.
- 💾 Respaldado en `mi_estructura.json`