import { describe, it, expect } from 'vitest';
import { detectarBanco, getParser } from '@/lib/parsers/index';
import { Banco } from '@/lib/types';

describe('detectarBanco', () => {
  it('detects Bancolombia from bancolombia.com', () => {
    const text = 'www.bancolombia.com/personas RESUMEN SALDO 1,000.00';
    expect(detectarBanco(text)).toBe('Bancolombia' as Banco);
  });

  it('detects Bancolombia from uppercase URL', () => {
    const text = 'DCF:defensor@BANCOLOMBIA.COM.CO';
    expect(detectarBanco(text)).toBe('Bancolombia' as Banco);
  });

  it('detects Bancoomeva from bank name', () => {
    const text = 'www.bancoomeva.com.co – Opción Contáctanos.';
    expect(detectarBanco(text)).toBe('Bancoomeva' as Banco);
  });

  it('detects Bancoomeva inline', () => {
    const text = 'Bancoomeva ha sido designado por...';
    expect(detectarBanco(text)).toBe('Bancoomeva' as Banco);
  });

  it('detects Global66 from header and column signature', () => {
    const text = `Movimientos de cuenta en COP  Período consultado:  Desde:   01-May-2026
Fecha   Descripción   Movimiento   Tarjeta   Débito   Abono   Saldo
2026-05-01   Envío   100.00`;
    expect(detectarBanco(text)).toBe('Global66' as Banco);
  });

  it('detects Global66 with just the identifiers', () => {
    const text = 'Movimientos de cuenta en COP  Fecha  Descripción  Movimiento  Tarjeta  Débito  Abono  Saldo';
    expect(detectarBanco(text)).toBe('Global66' as Banco);
  });

  it('returns No detectado for unknown text', () => {
    const text = 'Some random bank statement';
    expect(detectarBanco(text)).toBe('No detectado' as Banco);
  });

  it('returns No detectado for empty text', () => {
    expect(detectarBanco('')).toBe('No detectado' as Banco);
  });

  it('handles noise and whitespace gracefully', () => {
    const text = `
      some random text
      with multiple lines
      and no bank identifiers
    `;
    expect(detectarBanco(text)).toBe('No detectado' as Banco);
  });

  it('prefers Bancolombia over Global66 when both signatures appear', () => {
    // Bancolombia URL takes priority
    const text = `Movimientos de cuenta en COP
Fecha   Descripción   Movimiento   Tarjeta   Débito   Abono   Saldo
www.bancolombia.com`;
    expect(detectarBanco(text)).toBe('Bancolombia' as Banco);
  });
});

describe('getParser', () => {
  it('returns BancolombiaParser for Bancolombia', () => {
    const parser = getParser('Bancolombia');
    expect(parser.banco).toBe('Bancolombia');
  });

  it('returns BancoomevaParser for Bancoomeva', () => {
    const parser = getParser('Bancoomeva');
    expect(parser.banco).toBe('Bancoomeva');
  });

  it('returns Global66Parser for Global66', () => {
    const parser = getParser('Global66');
    expect(parser.banco).toBe('Global66');
  });

  it('throws for No detectado', () => {
    expect(() => getParser('No detectado')).toThrow('No hay un parser disponible');
  });
});
