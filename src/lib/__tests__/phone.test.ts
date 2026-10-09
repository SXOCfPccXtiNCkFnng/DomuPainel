import { describe, expect, it } from 'vitest';
import { phoneLookupVariants, toStoredPhone } from '../phone';

describe('toStoredPhone', () => {
  it('adiciona 55 a número com DDD', () => {
    expect(toStoredPhone('(11) 98765-4321')).toBe('5511987654321');
    expect(toStoredPhone('11 3333-4444')).toBe('551133334444');
  });

  it('mantém número que já tem DDI', () => {
    expect(toStoredPhone('+55 11 98765-4321')).toBe('5511987654321');
  });
});

describe('phoneLookupVariants', () => {
  it('celular vindo da Meta sem o 9 encontra o contato gravado com o 9', () => {
    const v = phoneLookupVariants('551187654321');
    expect(v).toContain('5511987654321');
    expect(v).toContain('551187654321');
  });

  it('celular com o 9 encontra o contato gravado sem o 9', () => {
    const v = phoneLookupVariants('5511987654321');
    expect(v).toContain('551187654321');
  });

  it('cobre contatos antigos gravados sem 55', () => {
    const v = phoneLookupVariants('5511987654321');
    expect(v).toContain('11987654321');
    expect(v).toContain('1187654321');
  });

  it('número digitado sem DDI também gera a forma com 55', () => {
    expect(phoneLookupVariants('11987654321')).toContain('5511987654321');
  });

  it('fixo não ganha 9', () => {
    const v = phoneLookupVariants('551133334444');
    expect(v).not.toContain('5511933334444');
  });

  it('vazio não gera variantes', () => {
    expect(phoneLookupVariants('')).toEqual([]);
  });
});
