import { describe, expect, it } from 'vitest';
import { pickOnboardedPhone, sameWhatsappNumber, type ListedWhatsappPhone } from '../metaSignupPhone';

const phones: ListedWhatsappPhone[] = [
  { id: '111', wabaId: 'waba-1', displayPhoneNumber: '+55 11 98765-4321' },
  { id: '222', wabaId: 'waba-1', displayPhoneNumber: '+55 21 3333-4444' },
];

describe('sameWhatsappNumber', () => {
  it('ignora máscara e o código 55', () => {
    expect(sameWhatsappNumber('+55 11 98765-4321', '(11) 98765-4321')).toBe(true);
  });
});

describe('pickOnboardedPhone', () => {
  it('usa o único número quando a Meta não manda o id', () => {
    expect(pickOnboardedPhone([phones[0]], null)).toEqual(phones[0]);
  });

  it('escolhe o número que o cliente digitou no cadastro', () => {
    const picked = pickOnboardedPhone(phones, '(21) 3333-4444');
    expect(picked).toMatchObject({ id: '222' });
  });

  it('não chuta quando há vários números e nenhum bate', () => {
    expect(pickOnboardedPhone(phones, '11911112222')).toBe('ambiguous');
    expect(pickOnboardedPhone([], '11987654321')).toBe('none');
  });
});
