/** Cidades sugeridas no campo Cidade / Estado (dá para digitar qualquer outra no formato "Cidade, UF"). */
export type CityStateOption = {
  city: string;
  uf: string;
  label: string; // "São Paulo, SP"
};

export const POPULAR_CITIES: CityStateOption[] = [
  // SP
  { city: 'São Paulo', uf: 'SP', label: 'São Paulo, SP' },
  { city: 'Campinas', uf: 'SP', label: 'Campinas, SP' },
  { city: 'Guarulhos', uf: 'SP', label: 'Guarulhos, SP' },
  { city: 'São Bernardo do Campo', uf: 'SP', label: 'São Bernardo do Campo, SP' },
  { city: 'Santo André', uf: 'SP', label: 'Santo André, SP' },
  { city: 'Osasco', uf: 'SP', label: 'Osasco, SP' },
  { city: 'Ribeirão Preto', uf: 'SP', label: 'Ribeirão Preto, SP' },
  { city: 'Sorocaba', uf: 'SP', label: 'Sorocaba, SP' },
  { city: 'Santos', uf: 'SP', label: 'Santos, SP' },
  { city: 'São José dos Campos', uf: 'SP', label: 'São José dos Campos, SP' },
  { city: 'Barueri', uf: 'SP', label: 'Barueri, SP' },
  { city: 'Jundiaí', uf: 'SP', label: 'Jundiaí, SP' },
  { city: 'Piracicaba', uf: 'SP', label: 'Piracicaba, SP' },
  { city: 'Bauru', uf: 'SP', label: 'Bauru, SP' },
  { city: 'Franca', uf: 'SP', label: 'Franca, SP' },
  { city: 'Presidente Prudente', uf: 'SP', label: 'Presidente Prudente, SP' },
  { city: 'Araraquara', uf: 'SP', label: 'Araraquara, SP' },
  { city: 'Taubaté', uf: 'SP', label: 'Taubaté, SP' },
  { city: 'Marília', uf: 'SP', label: 'Marília, SP' },
  { city: 'Americana', uf: 'SP', label: 'Americana, SP' },

  // RJ
  { city: 'Rio de Janeiro', uf: 'RJ', label: 'Rio de Janeiro, RJ' },
  { city: 'Niterói', uf: 'RJ', label: 'Niterói, RJ' },
  { city: 'Duque de Caxias', uf: 'RJ', label: 'Duque de Caxias, RJ' },
  { city: 'Nova Iguaçu', uf: 'RJ', label: 'Nova Iguaçu, RJ' },
  { city: 'São Gonçalo', uf: 'RJ', label: 'São Gonçalo, RJ' },
  { city: 'Petrópolis', uf: 'RJ', label: 'Petrópolis, RJ' },
  { city: 'Volta Redonda', uf: 'RJ', label: 'Volta Redonda, RJ' },
  { city: 'Campos dos Goytacazes', uf: 'RJ', label: 'Campos dos Goytacazes, RJ' },
  { city: 'Cabo Frio', uf: 'RJ', label: 'Cabo Frio, RJ' },
  { city: 'Macaé', uf: 'RJ', label: 'Macaé, RJ' },

  // MG
  { city: 'Belo Horizonte', uf: 'MG', label: 'Belo Horizonte, MG' },
  { city: 'Uberlândia', uf: 'MG', label: 'Uberlândia, MG' },
  { city: 'Juiz de Fora', uf: 'MG', label: 'Juiz de Fora, MG' },
  { city: 'Contagem', uf: 'MG', label: 'Contagem, MG' },
  { city: 'Betim', uf: 'MG', label: 'Betim, MG' },
  { city: 'Montes Claros', uf: 'MG', label: 'Montes Claros, MG' },
  { city: 'Uberaba', uf: 'MG', label: 'Uberaba, MG' },
  { city: 'Governador Valadares', uf: 'MG', label: 'Governador Valadares, MG' },
  { city: 'Ipatinga', uf: 'MG', label: 'Ipatinga, MG' },
  { city: 'Poços de Caldas', uf: 'MG', label: 'Poços de Caldas, MG' },

  // PR
  { city: 'Curitiba', uf: 'PR', label: 'Curitiba, PR' },
  { city: 'Londrina', uf: 'PR', label: 'Londrina, PR' },
  { city: 'Maringá', uf: 'PR', label: 'Maringá, PR' },
  { city: 'Ponta Grossa', uf: 'PR', label: 'Ponta Grossa, PR' },
  { city: 'Cascavel', uf: 'PR', label: 'Cascavel, PR' },
  { city: 'Foz do Iguaçu', uf: 'PR', label: 'Foz do Iguaçu, PR' },
  { city: 'São José dos Pinhais', uf: 'PR', label: 'São José dos Pinhais, PR' },

  // SC
  { city: 'Florianópolis', uf: 'SC', label: 'Florianópolis, SC' },
  { city: 'Joinville', uf: 'SC', label: 'Joinville, SC' },
  { city: 'Blumenau', uf: 'SC', label: 'Blumenau, SC' },
  { city: 'Chapecó', uf: 'SC', label: 'Chapecó, SC' },
  { city: 'Criciúma', uf: 'SC', label: 'Criciúma, SC' },
  { city: 'Itajaí', uf: 'SC', label: 'Itajaí, SC' },
  { city: 'Balneário Camboriú', uf: 'SC', label: 'Balneário Camboriú, SC' },

  // RS
  { city: 'Porto Alegre', uf: 'RS', label: 'Porto Alegre, RS' },
  { city: 'Caxias do Sul', uf: 'RS', label: 'Caxias do Sul, RS' },
  { city: 'Canoas', uf: 'RS', label: 'Canoas, RS' },
  { city: 'Pelotas', uf: 'RS', label: 'Pelotas, RS' },
  { city: 'Santa Maria', uf: 'RS', label: 'Santa Maria, RS' },
  { city: 'Gravataí', uf: 'RS', label: 'Gravataí, RS' },
  { city: 'Novo Hamburgo', uf: 'RS', label: 'Novo Hamburgo, RS' },

  // BA
  { city: 'Salvador', uf: 'BA', label: 'Salvador, BA' },
  { city: 'Feira de Santana', uf: 'BA', label: 'Feira de Santana, BA' },
  { city: 'Vitória da Conquista', uf: 'BA', label: 'Vitória da Conquista, BA' },
  { city: 'Camaçari', uf: 'BA', label: 'Camaçari, BA' },
  { city: 'Lauro de Freitas', uf: 'BA', label: 'Lauro de Freitas, BA' },
  { city: 'Itabuna', uf: 'BA', label: 'Itabuna, BA' },
  { city: 'Ilhéus', uf: 'BA', label: 'Ilhéus, BA' },

  // PE
  { city: 'Recife', uf: 'PE', label: 'Recife, PE' },
  { city: 'Jaboatão dos Guararapes', uf: 'PE', label: 'Jaboatão dos Guararapes, PE' },
  { city: 'Olinda', uf: 'PE', label: 'Olinda, PE' },
  { city: 'Caruaru', uf: 'PE', label: 'Caruaru, PE' },
  { city: 'Petrolina', uf: 'PE', label: 'Petrolina, PE' },

  // CE
  { city: 'Fortaleza', uf: 'CE', label: 'Fortaleza, CE' },
  { city: 'Caucaia', uf: 'CE', label: 'Caucaia, CE' },
  { city: 'Juazeiro do Norte', uf: 'CE', label: 'Juazeiro do Norte, CE' },
  { city: 'Maracanaú', uf: 'CE', label: 'Maracanaú, CE' },
  { city: 'Sobral', uf: 'CE', label: 'Sobral, CE' },

  // GO & DF
  { city: 'Goiânia', uf: 'GO', label: 'Goiânia, GO' },
  { city: 'Aparecida de Goiânia', uf: 'GO', label: 'Aparecida de Goiânia, GO' },
  { city: 'Anápolis', uf: 'GO', label: 'Anápolis, GO' },
  { city: 'Rio Verde', uf: 'GO', label: 'Rio Verde, GO' },
  { city: 'Brasília', uf: 'DF', label: 'Brasília, DF' },

  // ES
  { city: 'Vitória', uf: 'ES', label: 'Vitória, ES' },
  { city: 'Vila Velha', uf: 'ES', label: 'Vila Velha, ES' },
  { city: 'Serra', uf: 'ES', label: 'Serra, ES' },
  { city: 'Cariacica', uf: 'ES', label: 'Cariacica, ES' },
  { city: 'Cachoeiro de Itapemirim', uf: 'ES', label: 'Cachoeiro de Itapemirim, ES' },

  // Outros capitais e polos regionais
  { city: 'Manaus', uf: 'AM', label: 'Manaus, AM' },
  { city: 'Belém', uf: 'PA', label: 'Belém, PA' },
  { city: 'Ananindeua', uf: 'PA', label: 'Ananindeua, PA' },
  { city: 'Santarém', uf: 'PA', label: 'Santarém, PA' },
  { city: 'Cuiabá', uf: 'MT', label: 'Cuiabá, MT' },
  { city: 'Várzea Grande', uf: 'MT', label: 'Várzea Grande, MT' },
  { city: 'Rondonópolis', uf: 'MT', label: 'Rondonópolis, MT' },
  { city: 'Campo Grande', uf: 'MS', label: 'Campo Grande, MS' },
  { city: 'Dourados', uf: 'MS', label: 'Dourados, MS' },
  { city: 'São Luís', uf: 'MA', label: 'São Luís, MA' },
  { city: 'Imperatriz', uf: 'MA', label: 'Imperatriz, MA' },
  { city: 'João Pessoa', uf: 'PB', label: 'João Pessoa, PB' },
  { city: 'Campina Grande', uf: 'PB', label: 'Campina Grande, PB' },
  { city: 'Natal', uf: 'RN', label: 'Natal, RN' },
  { city: 'Mossoró', uf: 'RN', label: 'Mossoró, RN' },
  { city: 'Maceió', uf: 'AL', label: 'Maceió, AL' },
  { city: 'Aracaju', uf: 'SE', label: 'Aracaju, SE' },
  { city: 'Teresina', uf: 'PI', label: 'Teresina, PI' },
  { city: 'Palmas', uf: 'TO', label: 'Palmas, TO' },
  { city: 'Porto Velho', uf: 'RO', label: 'Porto Velho, RO' },
  { city: 'Rio Branco', uf: 'AC', label: 'Rio Branco, AC' },
  { city: 'Macapá', uf: 'AP', label: 'Macapá, AP' },
  { city: 'Boa Vista', uf: 'RR', label: 'Boa Vista, RR' },
  // SP (mais cidades)
  { city: 'São Roque', uf: 'SP', label: 'São Roque, SP' },
  { city: 'Mairinque', uf: 'SP', label: 'Mairinque, SP' },
  { city: 'Alumínio', uf: 'SP', label: 'Alumínio, SP' },
  { city: 'Araçariguama', uf: 'SP', label: 'Araçariguama, SP' },
  { city: 'Ibiúna', uf: 'SP', label: 'Ibiúna, SP' },
  { city: 'Vargem Grande Paulista', uf: 'SP', label: 'Vargem Grande Paulista, SP' },
  { city: 'Votorantim', uf: 'SP', label: 'Votorantim, SP' },
  { city: 'Itu', uf: 'SP', label: 'Itu, SP' },
  { city: 'Salto', uf: 'SP', label: 'Salto, SP' },
  { city: 'Cabreúva', uf: 'SP', label: 'Cabreúva, SP' },
  { city: 'Pirapora do Bom Jesus', uf: 'SP', label: 'Pirapora do Bom Jesus, SP' },
  { city: 'Itapevi', uf: 'SP', label: 'Itapevi, SP' },
  { city: 'Cotia', uf: 'SP', label: 'Cotia, SP' },
  { city: 'Jandira', uf: 'SP', label: 'Jandira, SP' },
  { city: 'Carapicuíba', uf: 'SP', label: 'Carapicuíba, SP' },
  { city: 'Santana de Parnaíba', uf: 'SP', label: 'Santana de Parnaíba, SP' },
  { city: 'Embu das Artes', uf: 'SP', label: 'Embu das Artes, SP' },
  { city: 'Itapecerica da Serra', uf: 'SP', label: 'Itapecerica da Serra, SP' },
  { city: 'Embu-Guaçu', uf: 'SP', label: 'Embu-Guaçu, SP' },
  { city: 'Taboão da Serra', uf: 'SP', label: 'Taboão da Serra, SP' },
  { city: 'Piedade', uf: 'SP', label: 'Piedade, SP' },
  { city: 'Salto de Pirapora', uf: 'SP', label: 'Salto de Pirapora, SP' },
  { city: 'Araçoiaba da Serra', uf: 'SP', label: 'Araçoiaba da Serra, SP' },
  { city: 'Iperó', uf: 'SP', label: 'Iperó, SP' },
  { city: 'Boituva', uf: 'SP', label: 'Boituva, SP' },
  { city: 'Porto Feliz', uf: 'SP', label: 'Porto Feliz, SP' },
  { city: 'Tatuí', uf: 'SP', label: 'Tatuí, SP' },
  { city: 'Itapetininga', uf: 'SP', label: 'Itapetininga, SP' },
  { city: 'Cerquilho', uf: 'SP', label: 'Cerquilho, SP' },
  { city: 'Tietê', uf: 'SP', label: 'Tietê, SP' },
  { city: 'Capela do Alto', uf: 'SP', label: 'Capela do Alto, SP' },
  { city: 'Sarapuí', uf: 'SP', label: 'Sarapuí, SP' },
  { city: 'Pilar do Sul', uf: 'SP', label: 'Pilar do Sul, SP' },
  { city: 'São Miguel Arcanjo', uf: 'SP', label: 'São Miguel Arcanjo, SP' },
  { city: 'Itupeva', uf: 'SP', label: 'Itupeva, SP' },
  { city: 'Indaiatuba', uf: 'SP', label: 'Indaiatuba, SP' },
  { city: 'Diadema', uf: 'SP', label: 'Diadema, SP' },
  { city: 'Mauá', uf: 'SP', label: 'Mauá, SP' },
  { city: 'São Caetano do Sul', uf: 'SP', label: 'São Caetano do Sul, SP' },
  { city: 'Ribeirão Pires', uf: 'SP', label: 'Ribeirão Pires, SP' },
  { city: 'Mogi das Cruzes', uf: 'SP', label: 'Mogi das Cruzes, SP' },
  { city: 'Suzano', uf: 'SP', label: 'Suzano, SP' },
  { city: 'Itaquaquecetuba', uf: 'SP', label: 'Itaquaquecetuba, SP' },
  { city: 'Ferraz de Vasconcelos', uf: 'SP', label: 'Ferraz de Vasconcelos, SP' },
  { city: 'Poá', uf: 'SP', label: 'Poá, SP' },
  { city: 'Arujá', uf: 'SP', label: 'Arujá, SP' },
  { city: 'Santa Isabel', uf: 'SP', label: 'Santa Isabel, SP' },
  { city: 'Caieiras', uf: 'SP', label: 'Caieiras, SP' },
  { city: 'Franco da Rocha', uf: 'SP', label: 'Franco da Rocha, SP' },
  { city: 'Francisco Morato', uf: 'SP', label: 'Francisco Morato, SP' },
  { city: 'Mairiporã', uf: 'SP', label: 'Mairiporã, SP' },
  { city: 'Cajamar', uf: 'SP', label: 'Cajamar, SP' },
  { city: 'Louveira', uf: 'SP', label: 'Louveira, SP' },
  { city: 'Vinhedo', uf: 'SP', label: 'Vinhedo, SP' },
  { city: 'Valinhos', uf: 'SP', label: 'Valinhos, SP' },
  { city: 'Hortolândia', uf: 'SP', label: 'Hortolândia, SP' },
  { city: 'Sumaré', uf: 'SP', label: 'Sumaré, SP' },
  { city: 'Paulínia', uf: 'SP', label: 'Paulínia, SP' },
  { city: 'Nova Odessa', uf: 'SP', label: 'Nova Odessa, SP' },
  { city: 'Santa Bárbara d\'Oeste', uf: 'SP', label: 'Santa Bárbara d\'Oeste, SP' },
  { city: 'Limeira', uf: 'SP', label: 'Limeira, SP' },
  { city: 'Rio Claro', uf: 'SP', label: 'Rio Claro, SP' },
  { city: 'São Carlos', uf: 'SP', label: 'São Carlos, SP' },
  { city: 'Atibaia', uf: 'SP', label: 'Atibaia, SP' },
  { city: 'Bragança Paulista', uf: 'SP', label: 'Bragança Paulista, SP' },
  { city: 'Itatiba', uf: 'SP', label: 'Itatiba, SP' },
  { city: 'Amparo', uf: 'SP', label: 'Amparo, SP' },
  { city: 'Jaguariúna', uf: 'SP', label: 'Jaguariúna, SP' },
  { city: 'Mogi Guaçu', uf: 'SP', label: 'Mogi Guaçu, SP' },
  { city: 'Mogi Mirim', uf: 'SP', label: 'Mogi Mirim, SP' },
  { city: 'Leme', uf: 'SP', label: 'Leme, SP' },
  { city: 'Pirassununga', uf: 'SP', label: 'Pirassununga, SP' },
  { city: 'Araras', uf: 'SP', label: 'Araras, SP' },
  { city: 'Botucatu', uf: 'SP', label: 'Botucatu, SP' },
  { city: 'Avaré', uf: 'SP', label: 'Avaré, SP' },
  { city: 'Ourinhos', uf: 'SP', label: 'Ourinhos, SP' },
  { city: 'Assis', uf: 'SP', label: 'Assis, SP' },
  { city: 'Lins', uf: 'SP', label: 'Lins, SP' },
  { city: 'Jaú', uf: 'SP', label: 'Jaú, SP' },
  { city: 'Araçatuba', uf: 'SP', label: 'Araçatuba, SP' },
  { city: 'Birigui', uf: 'SP', label: 'Birigui, SP' },
  { city: 'São José do Rio Preto', uf: 'SP', label: 'São José do Rio Preto, SP' },
  { city: 'Catanduva', uf: 'SP', label: 'Catanduva, SP' },
  { city: 'Votuporanga', uf: 'SP', label: 'Votuporanga, SP' },
  { city: 'Fernandópolis', uf: 'SP', label: 'Fernandópolis, SP' },
  { city: 'Barretos', uf: 'SP', label: 'Barretos, SP' },
  { city: 'Bebedouro', uf: 'SP', label: 'Bebedouro, SP' },
  { city: 'Sertãozinho', uf: 'SP', label: 'Sertãozinho, SP' },
  { city: 'Jaboticabal', uf: 'SP', label: 'Jaboticabal, SP' },
  { city: 'São João da Boa Vista', uf: 'SP', label: 'São João da Boa Vista, SP' },
  { city: 'Jacareí', uf: 'SP', label: 'Jacareí, SP' },
  { city: 'Pindamonhangaba', uf: 'SP', label: 'Pindamonhangaba, SP' },
  { city: 'Guaratinguetá', uf: 'SP', label: 'Guaratinguetá, SP' },
  { city: 'Lorena', uf: 'SP', label: 'Lorena, SP' },
  { city: 'Caraguatatuba', uf: 'SP', label: 'Caraguatatuba, SP' },
  { city: 'Ubatuba', uf: 'SP', label: 'Ubatuba, SP' },
  { city: 'São Sebastião', uf: 'SP', label: 'São Sebastião, SP' },
  { city: 'Ilhabela', uf: 'SP', label: 'Ilhabela, SP' },
  { city: 'Bertioga', uf: 'SP', label: 'Bertioga, SP' },
  { city: 'Guarujá', uf: 'SP', label: 'Guarujá, SP' },
  { city: 'Cubatão', uf: 'SP', label: 'Cubatão, SP' },
  { city: 'São Vicente', uf: 'SP', label: 'São Vicente, SP' },
  { city: 'Praia Grande', uf: 'SP', label: 'Praia Grande, SP' },
  { city: 'Mongaguá', uf: 'SP', label: 'Mongaguá, SP' },
  { city: 'Itanhaém', uf: 'SP', label: 'Itanhaém, SP' },
  { city: 'Peruíbe', uf: 'SP', label: 'Peruíbe, SP' },
  { city: 'Registro', uf: 'SP', label: 'Registro, SP' },
  // RJ (mais cidades)
  { city: 'Angra dos Reis', uf: 'RJ', label: 'Angra dos Reis, RJ' },
  { city: 'Resende', uf: 'RJ', label: 'Resende, RJ' },
  { city: 'Nova Friburgo', uf: 'RJ', label: 'Nova Friburgo, RJ' },
  { city: 'Teresópolis', uf: 'RJ', label: 'Teresópolis, RJ' },
  { city: 'Belford Roxo', uf: 'RJ', label: 'Belford Roxo, RJ' },
  { city: 'São João de Meriti', uf: 'RJ', label: 'São João de Meriti, RJ' },
  { city: 'Maricá', uf: 'RJ', label: 'Maricá, RJ' },
  { city: 'Itaboraí', uf: 'RJ', label: 'Itaboraí, RJ' },
  { city: 'Rio das Ostras', uf: 'RJ', label: 'Rio das Ostras, RJ' },
  // MG (mais cidades)
  { city: 'Pouso Alegre', uf: 'MG', label: 'Pouso Alegre, MG' },
  { city: 'Varginha', uf: 'MG', label: 'Varginha, MG' },
  { city: 'Divinópolis', uf: 'MG', label: 'Divinópolis, MG' },
  { city: 'Sete Lagoas', uf: 'MG', label: 'Sete Lagoas, MG' },
  { city: 'Extrema', uf: 'MG', label: 'Extrema, MG' },
  { city: 'Ribeirão das Neves', uf: 'MG', label: 'Ribeirão das Neves, MG' },
  { city: 'Santa Luzia', uf: 'MG', label: 'Santa Luzia, MG' },
  { city: 'Patos de Minas', uf: 'MG', label: 'Patos de Minas, MG' },
  { city: 'Passos', uf: 'MG', label: 'Passos, MG' },
  { city: 'Lavras', uf: 'MG', label: 'Lavras, MG' },
  { city: 'Itabira', uf: 'MG', label: 'Itabira, MG' },
  // PR (mais cidades)
  { city: 'Colombo', uf: 'PR', label: 'Colombo, PR' },
  { city: 'Guarapuava', uf: 'PR', label: 'Guarapuava, PR' },
  { city: 'Toledo', uf: 'PR', label: 'Toledo, PR' },
  { city: 'Paranaguá', uf: 'PR', label: 'Paranaguá, PR' },
  { city: 'Araucária', uf: 'PR', label: 'Araucária, PR' },
  { city: 'Apucarana', uf: 'PR', label: 'Apucarana, PR' },
  // SC (mais cidades)
  { city: 'São José', uf: 'SC', label: 'São José, SC' },
  { city: 'Palhoça', uf: 'SC', label: 'Palhoça, SC' },
  { city: 'Jaraguá do Sul', uf: 'SC', label: 'Jaraguá do Sul, SC' },
  { city: 'Brusque', uf: 'SC', label: 'Brusque, SC' },
  { city: 'Lages', uf: 'SC', label: 'Lages, SC' },
  { city: 'Tubarão', uf: 'SC', label: 'Tubarão, SC' },
  // RS (mais cidades)
  { city: 'São Leopoldo', uf: 'RS', label: 'São Leopoldo, RS' },
  { city: 'Passo Fundo', uf: 'RS', label: 'Passo Fundo, RS' },
  { city: 'Rio Grande', uf: 'RS', label: 'Rio Grande, RS' },
  { city: 'Alvorada', uf: 'RS', label: 'Alvorada, RS' },
  { city: 'Viamão', uf: 'RS', label: 'Viamão, RS' },
  { city: 'Bento Gonçalves', uf: 'RS', label: 'Bento Gonçalves, RS' },
  { city: 'Santa Cruz do Sul', uf: 'RS', label: 'Santa Cruz do Sul, RS' },
  // ES (mais cidades)
  { city: 'Linhares', uf: 'ES', label: 'Linhares, ES' },
  { city: 'Colatina', uf: 'ES', label: 'Colatina, ES' },
  { city: 'Guarapari', uf: 'ES', label: 'Guarapari, ES' },
  { city: 'São Mateus', uf: 'ES', label: 'São Mateus, ES' },
  // BA (mais cidades)
  { city: 'Porto Seguro', uf: 'BA', label: 'Porto Seguro, BA' },
  { city: 'Juazeiro', uf: 'BA', label: 'Juazeiro, BA' },
  { city: 'Jequié', uf: 'BA', label: 'Jequié, BA' },
  { city: 'Alagoinhas', uf: 'BA', label: 'Alagoinhas, BA' },
  { city: 'Barreiras', uf: 'BA', label: 'Barreiras, BA' },
  // GO (mais cidades)
  { city: 'Águas Lindas de Goiás', uf: 'GO', label: 'Águas Lindas de Goiás, GO' },
  { city: 'Luziânia', uf: 'GO', label: 'Luziânia, GO' },
  { city: 'Valparaíso de Goiás', uf: 'GO', label: 'Valparaíso de Goiás, GO' },
  { city: 'Itumbiara', uf: 'GO', label: 'Itumbiara, GO' },
  // PE (mais cidades)
  { city: 'Paulista', uf: 'PE', label: 'Paulista, PE' },
  { city: 'Cabo de Santo Agostinho', uf: 'PE', label: 'Cabo de Santo Agostinho, PE' },
  { city: 'Garanhuns', uf: 'PE', label: 'Garanhuns, PE' },
  // CE (mais cidades)
  { city: 'Crato', uf: 'CE', label: 'Crato, CE' },
  { city: 'Itapipoca', uf: 'CE', label: 'Itapipoca, CE' },
  // PA (mais cidades)
  { city: 'Marabá', uf: 'PA', label: 'Marabá, PA' },
  { city: 'Castanhal', uf: 'PA', label: 'Castanhal, PA' },
  { city: 'Parauapebas', uf: 'PA', label: 'Parauapebas, PA' },
  // MT (mais cidades)
  { city: 'Sinop', uf: 'MT', label: 'Sinop, MT' },
  { city: 'Tangará da Serra', uf: 'MT', label: 'Tangará da Serra, MT' },
  { city: 'Sorriso', uf: 'MT', label: 'Sorriso, MT' },
  // MS (mais cidades)
  { city: 'Três Lagoas', uf: 'MS', label: 'Três Lagoas, MS' },
  { city: 'Corumbá', uf: 'MS', label: 'Corumbá, MS' },
  // PB / RN / AL / SE / PI / MA / RO / TO / AP
  { city: 'Santa Rita', uf: 'PB', label: 'Santa Rita, PB' },
  { city: 'Parnamirim', uf: 'RN', label: 'Parnamirim, RN' },
  { city: 'Arapiraca', uf: 'AL', label: 'Arapiraca, AL' },
  { city: 'Nossa Senhora do Socorro', uf: 'SE', label: 'Nossa Senhora do Socorro, SE' },
  { city: 'Parnaíba', uf: 'PI', label: 'Parnaíba, PI' },
  { city: 'São José de Ribamar', uf: 'MA', label: 'São José de Ribamar, MA' },
  { city: 'Caxias', uf: 'MA', label: 'Caxias, MA' },
  { city: 'Ji-Paraná', uf: 'RO', label: 'Ji-Paraná, RO' },
  { city: 'Araguaína', uf: 'TO', label: 'Araguaína, TO' },
  { city: 'Santana', uf: 'AP', label: 'Santana, AP' },
];

/** Normaliza texto para busca insensível a acentuação e caixa alta/baixa. */
export function normalizeCitySearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Filtra cidades sugeridas pelo termo digitado (cidade, estado ou sigla da UF).
 */
export function searchCities(query: string, limit = 12): CityStateOption[] {
  const cleanQuery = normalizeCitySearch(query);
  if (!cleanQuery) {
    return POPULAR_CITIES.slice(0, limit);
  }

  return POPULAR_CITIES.filter((item) => {
    const cleanLabel = normalizeCitySearch(item.label);
    const cleanCity = normalizeCitySearch(item.city);
    const cleanUf = item.uf.toLowerCase();
    return (
      cleanLabel.includes(cleanQuery) ||
      cleanCity.includes(cleanQuery) ||
      cleanUf === cleanQuery
    );
  }).slice(0, limit);
}
