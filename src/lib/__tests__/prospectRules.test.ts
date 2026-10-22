import { describe, expect, it } from 'vitest';
import {
  PROSPECT_KINDS,
  buildSearchQuery,
  extractInstagramFromHtml,
  fillTemplate,
  instagramFromUrl,
  isBrazilMobile,
  isPrivateAddress,
  phoneKey,
  placeToProspect,
  prospectKind,
  whatsappNumber,
} from '@/lib/prospectRules';

describe('telefone', () => {
  it('reconhece celular e fixo em vários formatos', () => {
    expect(isBrazilMobile('(11) 99876-5432')).toBe(true);
    expect(isBrazilMobile('+55 11 99876-5432')).toBe(true);
    expect(isBrazilMobile('(11) 4712-3456')).toBe(false);
    expect(isBrazilMobile('')).toBe(false);
  });

  it('monta o número do wa.me só quando é válido', () => {
    expect(whatsappNumber('(15) 99123-4567')).toBe('5515991234567');
    expect(whatsappNumber('+55 11 4712-3456')).toBe('551147123456');
    expect(whatsappNumber('123')).toBeNull();
  });

  it('phoneKey bate o mesmo número com e sem 55 e com e sem o 9', () => {
    expect(phoneKey('+55 (11) 99876-5432')).toBe(phoneKey('11 9876-5432'));
    expect(phoneKey('5511998765432')).toBe('1198765432');
    expect(phoneKey(null)).toBeNull();
  });
});

describe('instagram', () => {
  it('extrai o perfil de um link do Instagram', () => {
    expect(instagramFromUrl('https://www.instagram.com/Lava.Jato_SR/?hl=pt-br')).toBe('lava.jato_sr');
    expect(instagramFromUrl('https://instagram.com/p/abc123/')).toBeNull();
    expect(instagramFromUrl('https://lavajato.com.br')).toBeNull();
    expect(instagramFromUrl('https://notinstagram.com/perfil')).toBeNull();
    expect(instagramFromUrl('lixo')).toBeNull();
  });

  it('acha o primeiro perfil válido no HTML, ignorando posts e links genéricos', () => {
    const html =
      '<a href="https://www.instagram.com/p/XYZ/">post</a><a href="https://instagram.com/explore">x</a>' +
      '<a href="https://www.instagram.com/esteticacarros.sr/">Siga</a>';
    expect(extractInstagramFromHtml(html)).toBe('esteticacarros.sr');
    expect(extractInstagramFromHtml('<p>sem redes</p>')).toBeNull();
  });
});

describe('isPrivateAddress', () => {
  it('bloqueia redes internas e libera IPs públicos', () => {
    for (const ip of ['127.0.0.1', '10.0.0.5', '172.20.1.1', '192.168.0.1', '169.254.169.254', '::1', 'fd00::1', '::ffff:10.0.0.1', '0.0.0.0', '100.64.0.1']) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ['8.8.8.8', '172.32.0.1', '200.147.67.142', '2804:14c::1']) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });
});

describe('placeToProspect', () => {
  const kind = prospectKind('lava_rapido')!;

  it('converte o retorno do Google e acha cidade, celular e Instagram do site', () => {
    const row = placeToProspect(
      {
        id: 'ChIJ123',
        displayName: { text: ' Lava Jato do Zé ' },
        formattedAddress: 'R. A, 10 - Centro, São Roque - SP',
        addressComponents: [
          { longText: 'Centro', types: ['sublocality'] },
          { longText: 'São Roque', types: ['administrative_area_level_2', 'political'] },
        ],
        nationalPhoneNumber: '(11) 99876-5432',
        internationalPhoneNumber: '+55 11 99876-5432',
        websiteUri: 'https://instagram.com/lavajatodoze',
        googleMapsUri: 'https://maps.google.com/?cid=1',
        rating: 4.7,
        userRatingCount: 88,
        businessStatus: 'OPERATIONAL',
      },
      kind,
      'São Roque'
    );
    expect(row).toMatchObject({
      place_id: 'ChIJ123',
      name: 'Lava Jato do Zé',
      kind: 'lava_rapido',
      module: 'automotivo',
      city: 'São Roque',
      is_mobile: true,
      instagram: 'lavajatodoze',
      rating: 4.7,
      search_city: 'São Roque',
    });
  });

  it('descarta lugar sem id ou sem nome', () => {
    expect(placeToProspect({ displayName: { text: 'X' } }, kind, 'Itu')).toBeNull();
    expect(placeToProspect({ id: 'a' }, kind, 'Itu')).toBeNull();
  });
});

describe('busca e mensagens', () => {
  it('todo tipo tem id único e monta a busca com a cidade', () => {
    expect(new Set(PROSPECT_KINDS.map((k) => k.id)).size).toBe(PROSPECT_KINDS.length);
    expect(buildSearchQuery(prospectKind('barbearia')!, 'Itu')).toBe('barbearia em Itu - SP');
  });

  it('preenche nome e cidade na mensagem', () => {
    expect(fillTemplate('Oi {nome}, aqui em {cidade}! {nome}', { nome: 'Lava X', cidade: 'Itu' })).toBe('Oi Lava X, aqui em Itu! Lava X');
    expect(fillTemplate('em {cidade}', { nome: 'A', cidade: null })).toBe('em sua cidade');
  });
});
