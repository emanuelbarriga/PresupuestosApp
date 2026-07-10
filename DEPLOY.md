# Deploy a Firebase Hosting + Cloud Functions

Este documento describe cómo está configurado el deploy de la app Next.js a Firebase.

## Arquitectura

```
Usuario → Dominio (o .web.app) → Firebase Hosting (CDN)
                                    ↓ (rewrite **)
                            Cloud Function nextjs
                                    ↓
                            Next.js server (SSR + API routes)
                                    ↓
                            Firebase Firestore (Admin SDK)
```

Todas las rutas (`**`) se reescriben a la Cloud Function. No hay contenido estático servido directamente por Hosting — el server de Next.js maneja tanto SSR como archivos estáticos.

## Script de deploy

```bash
npm run deploy
```

Esto ejecuta:
1. `npm run build` — build de Next.js con `output: 'standalone'`
2. `deploy:prepare` — copia `.next/standalone/` + `.next/static/` + `public/` a `functions/standalone/`
3. `npm install` en `functions/` — instala `firebase-functions`, `next`, `react`, `react-dom`, `firebase-admin`
4. `firebase deploy --only hosting,functions` — despliega a Firebase

## Estructura de archivos para deploy

```
functions/
├── .env                    # SA_* env vars (no sensibles)
├── package.json            # Dependencias del server
├── index.js                # Cloud Function wrapper
├── standalone/             # Build de Next.js (generado por deploy:prepare)
│   ├── server.js           # Entry point del server
│   ├── .next/              # App compilada (server + static)
│   ├── public/             # Assets estáticos
│   └── node_modules/       # Dependencias del server
```

## Variables de entorno

```env
# Client SDK (se inyectan en build time — NEXT_PUBLIC_)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...

# Admin SDK (runtime en Cloud Function — prefijo SA_)
SA_PROJECT_ID=...
SA_PRIVATE_KEY=...          # Seteado como secreto de Firebase
```

Las vars con prefijo `FIREBASE_` están **reservadas** por Firebase Runtime. Se renombraron a `SA_`.

La `SA_PRIVATE_KEY` se setea como secreto:
```bash
firebase functions:secrets:set SA_PRIVATE_KEY --data-file <(echo "...")
```

Y se referencia en `functions/index.js`:
```js
secrets: ['SA_PRIVATE_KEY'],
```

## Cloud Function (functions/index.js)

- **Runtime**: Node.js 22 (2nd Gen)
- **Memory**: 512 MB
- **CPU**: 1 vCPU
- **Concurrency**: 80 req/instancia
- **Min/Max instances**: 0-10
- **Invocación**: Pública (`invoker: 'public'`)
- **Región**: `us-central1`

Lee la config de Next.js desde `server.js`, crea el handler y lo exporta como `onRequest`.

## Comandos útiles

```bash
# Deploy completo
npm run deploy

# Solo functions (más rápido si no cambió el build)
npx firebase deploy --only functions

# Solo hosting
npx firebase deploy --only hosting

# Ver logs de la function
npx firebase functions:log

# Ver channels de hosting
npx firebase hosting:channel:list

# Configurar dominio personalizado
# → Firebase Console → Hosting → Configurar dominio personalizado
```

## URLs

| Entorno | URL |
|---------|-----|
| Producción | https://planningsaman-3cf7e.web.app |
| Cloud Function directa | https://nextjs-tzc3iu4nla-uc.a.run.app |
| Consola Firebase | https://console.firebase.google.com/project/planningsaman-3cf7e/overview |
