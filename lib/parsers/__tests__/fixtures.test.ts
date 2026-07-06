import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const FIXTURES_DIR = resolve(__dirname, '..', '__fixtures__');

function readFixture(name: string): string {
  return readFileSync(resolve(FIXTURES_DIR, `${name}.txt`), 'utf-8');
}

describe('bancolombia fixture', () => {
  const text = readFixture('bancolombia');

  it('contains bank identifier', () => {
    // URL with bank name (PDF text extraction may change case)
    expect(text.toLowerCase()).toContain('bancolombia');
  });

  it('contains column headers', () => {
    expect(text).toMatch(/FECHA/);
    expect(text).toMatch(/DESCRIPCIÓN/);
    expect(text).toMatch(/SALDO/);
  });

  it('contains multiple transaction rows', () => {
    // Count date patterns (D/M format) — should be 10+
    const dateMatches = text.match(/\d{1,2}\/\d{2}/g);
    expect(dateMatches).not.toBeNull();
    expect(dateMatches!.length).toBeGreaterThanOrEqual(5);
  });

  it('contains saldo anterior and saldo actual', () => {
    expect(text).toMatch(/SALDO ANTERIOR/);
    expect(text).toMatch(/SALDO ACTUAL/);
  });
});

describe('bancoomeva fixture', () => {
  const text = readFixture('bancoomeva');

  it('contains bank identifier', () => {
    expect(text).toContain('Bancoomeva');
  });

  it('contains column headers', () => {
    expect(text).toMatch(/FECHA/);
    expect(text).toMatch(/OFICINA/);
    expect(text).toMatch(/DESCRIPCION/);
    expect(text).toMatch(/DEBITO/);
    expect(text).toMatch(/CREDITO/);
    expect(text).toMatch(/SALDO/);
  });

  it('contains multiple transaction rows', () => {
    // Count date patterns (DD-MM-YYYY)
    const dateMatches = text.match(/\d{2}-\d{2}-\d{4}/g);
    expect(dateMatches).not.toBeNull();
    expect(dateMatches!.length).toBeGreaterThanOrEqual(5);
  });

  it('contains saldo inicial and saldo final', () => {
    expect(text).toMatch(/SALDO INICIAL/);
    expect(text).toMatch(/SALDO FINAL/);
  });
});

describe('global66 fixture', () => {
  const text = readFixture('global66');

  it('contains identifying content', () => {
    expect(text).toContain('Movimientos de cuenta en COP');
    expect(text).toContain('Samán estudio');
  });

  it('contains column headers', () => {
    // PDF text extraction may split words or add spaces
    expect(text).toMatch(/Fecha/);
    expect(text).toMatch(/Descripci.*n/);
    expect(text).toMatch(/D.*bito/);
    expect(text).toMatch(/Abono/);
    expect(text).toMatch(/Saldo/);
  });

  it('contains multiple transaction rows', () => {
    // Count date patterns (YYYY-MM-DD) — should be 5+
    const dateMatches = text.match(/\d{4}-\d{2}-\d{2}/g);
    expect(dateMatches).not.toBeNull();
    expect(dateMatches!.length).toBeGreaterThanOrEqual(5);
  });

  it('contains periodo information', () => {
    expect(text).toMatch(/Período consultado/);
    expect(text).toContain('01-May-2026');
    expect(text).toContain('31-May-2026');
  });
});
