import { describe, expect, it, vi } from 'vitest';
import zlib from 'zlib';

vi.mock('@/lib/supabaseServer', () => ({ supabaseAdmin: {} }));

import { generateSampleImage, isOwnMediaUrl, isValidCampaignImageUrl } from '../templateImages';
import { segmentTemplateDefs } from '../segmentTemplates';

describe('imagem de exemplo gerada', () => {
  it('é um PNG válido de 800x418', () => {
    const png = generateSampleImage();
    expect(png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    expect(png.readUInt32BE(16)).toBe(800);
    expect(png.readUInt32BE(20)).toBe(418);
    // O bloco de pixels descompacta no tamanho certo (3 bytes por pixel + 1 por linha).
    const idatLength = png.readUInt32BE(33);
    const raw = zlib.inflateSync(png.subarray(41, 41 + idatLength));
    expect(raw.length).toBe((800 * 3 + 1) * 418);
    expect(png.length).toBeLessThan(5 * 1024 * 1024);
  });
});

describe('links de imagem', () => {
  it('campanha aceita só https', () => {
    expect(isValidCampaignImageUrl('https://site.com/foto.jpg')).toBe(true);
    expect(isValidCampaignImageUrl('http://site.com/foto.jpg')).toBe(false);
    expect(isValidCampaignImageUrl('javascript:alert(1)')).toBe(false);
    expect(isValidCampaignImageUrl('')).toBe(false);
  });

  it('o servidor só baixa imagem do nosso armazenamento', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
    expect(isOwnMediaUrl('https://abc.supabase.co/storage/v1/object/public/campaign-media/t/x.png')).toBe(true);
    expect(isOwnMediaUrl('https://outro.com/storage/v1/object/public/campaign-media/t/x.png')).toBe(false);
    expect(isOwnMediaUrl('http://169.254.169.254/latest/meta-data')).toBe(false);
  });
});

describe('modelos com imagem por ramo', () => {
  it('cada ramo tem um modelo com imagem', () => {
    for (const segment of ['imobiliario', 'automotivo', 'saude', 'geral']) {
      expect(segmentTemplateDefs(segment).some((d) => d.image)).toBe(true);
    }
  });

  it('história do cliente do corretor: o nome do comprador é preenchido na campanha', () => {
    const story = segmentTemplateDefs('imobiliario').find((d) => d.name === 'conquista_cliente_imagem');
    expect(story?.image).toBe(true);
    expect(story?.body).toContain('{{nome_comprador}}');
    expect(story?.body).toContain('{{empresa}}');
  });
});
