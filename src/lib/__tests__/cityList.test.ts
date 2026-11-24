import { describe, expect, it } from 'vitest';
import { POPULAR_CITIES, searchCities, normalizeCitySearch } from '../cities';
import { validateCityState, BR_UFS } from '../onboardingValidation';

const BRAZILIAN_CAPITALS = [
  'Rio Branco, AC',
  'Maceió, AL',
  'Macapá, AP',
  'Manaus, AM',
  'Salvador, BA',
  'Fortaleza, CE',
  'Brasília, DF',
  'Vitória, ES',
  'Goiânia, GO',
  'São Luís, MA',
  'Cuiabá, MT',
  'Campo Grande, MS',
  'Belo Horizonte, MG',
  'Belém, PA',
  'João Pessoa, PB',
  'Curitiba, PR',
  'Recife, PE',
  'Teresina, PI',
  'Rio de Janeiro, RJ',
  'Natal, RN',
  'Porto Alegre, RS',
  'Porto Velho, RO',
  'Boa Vista, RR',
  'Florianópolis, SC',
  'São Paulo, SP',
  'Aracaju, SE',
  'Palmas, TO',
];

describe('lista de cidades do onboarding (POPULAR_CITIES)', () => {
  it('tem São Roque e a região metropolitana/Sorocaba', () => {
    for (const c of ['São Roque, SP', 'Mairinque, SP', 'Ibiúna, SP', 'Itu, SP', 'Sorocaba, SP', 'Votorantim, SP']) {
      expect(POPULAR_CITIES.some((x) => x.label === c)).toBe(true);
    }
  });

  it('contém todas as 27 capitais do Brasil (26 estados + DF)', () => {
    const missing = BRAZILIAN_CAPITALS.filter(
      (cap) => !POPULAR_CITIES.some((c) => c.label === cap)
    );
    expect(missing).toEqual([]);
  });

  it('toda cidade da lista passa na validação (sem nome que o cadastro recusaria)', () => {
    const bad = POPULAR_CITIES.filter((c) => !validateCityState(c.label).ok).map((c) => c.label);
    expect(bad).toEqual([]);
  });

  it('não tem cidade repetida', () => {
    const labels = POPULAR_CITIES.map((c) => c.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('cada entrada tem formato consistente label = "Cidade, UF" e UF oficial válida', () => {
    for (const item of POPULAR_CITIES) {
      expect(item.label).toBe(`${item.city}, ${item.uf}`);
      expect(BR_UFS).toContain(item.uf);
      expect(item.city.trim()).toBe(item.city);
      expect(item.uf.trim()).toBe(item.uf);
    }
  });
});

describe('busca e filtro de cidades (searchCities)', () => {
  it('normaliza acentos e maiúsculas na busca', () => {
    expect(normalizeCitySearch('São Roque')).toBe('sao roque');
    expect(normalizeCitySearch('CURITIBA')).toBe('curitiba');
  });

  it('encontra cidade digitada sem acento (ex: "sao roque" -> "São Roque, SP")', () => {
    const results = searchCities('sao roque');
    expect(results.some((c) => c.label === 'São Roque, SP')).toBe(true);
  });

  it('encontra cidade com acento (ex: "Brasília" -> "Brasília, DF")', () => {
    const results = searchCities('Brasília');
    expect(results.some((c) => c.label === 'Brasília, DF')).toBe(true);
  });

  it('filtra por sigla de UF (ex: "RJ" retorna cidades do Rio de Janeiro)', () => {
    const results = searchCities('RJ', 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((c) => c.uf === 'RJ')).toBe(true);
  });

  it('com busca vazia devolve as primeiras cidades respeitando o limite', () => {
    const results = searchCities('', 8);
    expect(results.length).toBe(8);
    expect(results[0]).toEqual(POPULAR_CITIES[0]);
  });

  it('respeita limite customizado', () => {
    const results = searchCities('São', 3);
    expect(results.length).toBe(3);
  });
});
