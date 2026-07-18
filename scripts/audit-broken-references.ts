#!/usr/bin/env tsx
/**
 * audit-broken-references.ts
 *
 * Detect broken soft references between collections (read-only / dry-run).
 * Checks 4 reference types:
 *   1. Budget → Tercero (entityId)
 *   2. Ejecucion → Tercero (entityId)
 *   3. DocumentoMedio → Tercero (terceroId)
 *   4. Proyecto → Tercero (clientId)
 *
 * Usage:
 *   npx tsx scripts/audit-broken-references.ts                    # dry-run (default)
 *   npx tsx scripts/audit-broken-references.ts --json report.json # output JSON to file
 */

import { Firestore } from 'firebase-admin/firestore';

// ─── Result Types ────────────────────────────────────────────────────────

export interface BrokenRef {
  sourceCollection: string;
  sourceId: string;
  sourceName: string;
  terceroId: string;
  terceroName: string;
  terceroArchivado: boolean;
  terceroExists: boolean;
}

export interface AuditResult {
  budgets: BrokenRef[];
  ejecuciones: BrokenRef[];
  documentos: BrokenRef[];
  proyectos: BrokenRef[];
  total: number;
}

// ─── Audit Check ─────────────────────────────────────────────────────────

export async function runAudit(db: Firestore): Promise<AuditResult> {
  // 1. Read all terceros (global collection)
  const tercerosSnap = await db.collection('terceros').get();
  const terceroMap = new Map<string, { name: string; archivado: boolean }>();
  tercerosSnap.forEach((d) => {
    const data = d.data();
    terceroMap.set(d.id, {
      name: (data.name as string) ?? '',
      archivado: (data.archivado as boolean) ?? false,
    });
  });

  console.log(`📋 Loaded ${terceroMap.size} terceros`);

  const budgets: BrokenRef[] = [];
  const ejecuciones: BrokenRef[] = [];
  const documentos: BrokenRef[] = [];
  const proyectos: BrokenRef[] = [];

  // 2. Iterate all companies
  const companiesSnap = await db.collection('companies').get();
  console.log(`🏢 Processing ${companiesSnap.size} companies...`);

  for (const companyDoc of companiesSnap.docs) {
    const cId = companyDoc.id;

    // ── Budgets → Tercero ──
    const budgetsSnap = await db
      .collection('companies')
      .doc(cId)
      .collection('budgets')
      .get();

    budgetsSnap.forEach((d) => {
      const data = d.data();
      const entityId = data.entityId as string | undefined;
      if (!entityId) return;

      const tercero = terceroMap.get(entityId);
      if (!tercero || tercero.archivado) {
        budgets.push({
          sourceCollection: 'budgets',
          sourceId: d.id,
          sourceName: (data.descripcion as string) ?? '',
          terceroId: entityId,
          terceroName: tercero?.name ?? '(inexistente)',
          terceroArchivado: tercero ? tercero.archivado : false,
          terceroExists: !!tercero,
        });
      }
    });

    // ── Ejecuciones → Tercero ──
    const ejecucionesSnap = await db
      .collection('companies')
      .doc(cId)
      .collection('ejecuciones')
      .get();

    ejecucionesSnap.forEach((d) => {
      const data = d.data();
      const entityId = data.entityId as string | undefined;
      if (!entityId) return;

      const tercero = terceroMap.get(entityId);
      if (!tercero || tercero.archivado) {
        ejecuciones.push({
          sourceCollection: 'ejecuciones',
          sourceId: d.id,
          sourceName: (data.descripcion as string) ?? '',
          terceroId: entityId,
          terceroName: tercero?.name ?? '(inexistente)',
          terceroArchivado: tercero ? tercero.archivado : false,
          terceroExists: !!tercero,
        });
      }
    });

    // ── Documentos → Tercero ──
    const docsSnap = await db
      .collection('companies')
      .doc(cId)
      .collection('documentos')
      .get();

    docsSnap.forEach((d) => {
      const data = d.data();
      const terceroId = data.terceroId as string | undefined;
      if (!terceroId) return;

      const tercero = terceroMap.get(terceroId);
      if (!tercero || tercero.archivado) {
        documentos.push({
          sourceCollection: 'documentos',
          sourceId: d.id,
          sourceName: (data.fileName as string) ?? '',
          terceroId,
          terceroName: tercero?.name ?? '(inexistente)',
          terceroArchivado: tercero ? tercero.archivado : false,
          terceroExists: !!tercero,
        });
      }
    });

    // ── Proyectos → Tercero ──
    const projectsSnap = await db
      .collection('companies')
      .doc(cId)
      .collection('projects')
      .get();

    projectsSnap.forEach((d) => {
      const data = d.data();
      const clientId = data.clientId as string | undefined;
      if (!clientId) return;

      const tercero = terceroMap.get(clientId);
      if (!tercero || tercero.archivado) {
        proyectos.push({
          sourceCollection: 'proyectos',
          sourceId: d.id,
          sourceName: (data.name as string) ?? '',
          terceroId: clientId,
          terceroName: tercero?.name ?? '(inexistente)',
          terceroArchivado: tercero ? tercero.archivado : false,
          terceroExists: !!tercero,
        });
      }
    });
  }

  return {
    budgets,
    ejecuciones,
    documentos,
    proyectos,
    total: budgets.length + ejecuciones.length + documentos.length + proyectos.length,
  };
}

// ─── Report ──────────────────────────────────────────────────────────────

function printReport(result: AuditResult): void {
  console.log('\n═══════════════════════════════════════════════');
  console.log('   Broken References Audit Report');
  console.log('═══════════════════════════════════════════════\n');

  const sections: Array<{ label: string; items: BrokenRef[] }> = [
    { label: '📊 Budgets → Tercero', items: result.budgets },
    { label: '📊 Ejecuciones → Tercero', items: result.ejecuciones },
    { label: '📊 Documentos → Tercero', items: result.documentos },
    { label: '📊 Proyectos → Tercero', items: result.proyectos },
  ];

  for (const section of sections) {
    console.log(`${section.label}: ${section.items.length}`);
    if (section.items.length > 0) {
      console.table(section.items.map((r) => ({
        ID: r.sourceId,
        Nombre: r.sourceName.slice(0, 50),
        TerceroID: r.terceroId,
        Tercero: r.terceroName.slice(0, 40),
        Problema: r.terceroExists ? 'archivado' : 'inexistente',
      })));
    }
    console.log('');
  }

  console.log('───────────────────────────────────────────────');
  console.log(`🔍 TOTAL broken references found: ${result.total}`);
  console.log('⚠️  This was a DRY-RUN — no data was modified.');
  if (result.total === 0) {
    console.log('✅ All references are intact.');
  }
}

// ─── Auto-run when executed directly ─────────────────────────────────────

const isDirectRun = process.argv.length >= 2 &&
  process.argv[1]?.includes('audit-broken-references');

if (isDirectRun) {
  (async () => {
    const { getApps, initializeApp } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');

    if (!getApps().length) {
      initializeApp();
    }

    const db = getFirestore();
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      db.settings({ host: process.env.FIRESTORE_EMULATOR_HOST, ssl: false });
    }

    const jsonPathIndex = process.argv.indexOf('--json');
    const jsonPath = jsonPathIndex !== -1 ? process.argv[jsonPathIndex + 1] : null;

    console.log('🔍 Starting broken references audit (DRY-RUN)...');
    const result = await runAudit(db);
    printReport(result);

    if (jsonPath) {
      const fs = await import('fs/promises');
      await fs.writeFile(jsonPath, JSON.stringify(result, null, 2));
      console.log(`📝 JSON report written to ${jsonPath}`);
    }

    process.exit(0);
  })().catch((err) => {
    console.error('❌ Audit failed:', err);
    process.exit(1);
  });
}
