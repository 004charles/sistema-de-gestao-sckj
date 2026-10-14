import { parseAnaliseIA, isLinhaDecorativaOuRuido, isTituloDiferencaValido, sanitizarValorTexto } from '../utils/analiseIaParser';

describe('analiseIaParser - Sanitização e Robustez de Markdown', () => {
  test('isLinhaDecorativaOuRuido deve identificar linhas de ruído e separadores Markdown', () => {
    expect(isLinhaDecorativaOuRuido('*====================================*')).toBe(true);
    expect(isLinhaDecorativaOuRuido('*====================================')).toBe(true);
    expect(isLinhaDecorativaOuRuido('====================================')).toBe(true);
    expect(isLinhaDecorativaOuRuido('---')).toBe(true);
    expect(isLinhaDecorativaOuRuido('--')).toBe(true);
    expect(isLinhaDecorativaOuRuido('*')).toBe(true);
    expect(isLinhaDecorativaOuRuido('-')).toBe(true);
    expect(isLinhaDecorativaOuRuido('***')).toBe(true);
    expect(isLinhaDecorativaOuRuido('| Campo | O que está no Balancete | O que foi declarado no Modelo 7 | Causa provável | Risco fiscal |')).toBe(true);
    expect(isLinhaDecorativaOuRuido('| Nome do Campo | Contabilidade | AGT | Status | Diferença |')).toBe(true);
    expect(isLinhaDecorativaOuRuido('Para cada diferenca:')).toBe(true);
    expect(isLinhaDecorativaOuRuido('[Nome do Campo]')).toBe(true);

    // Texto real não é ruído
    expect(isLinhaDecorativaOuRuido('Base Tributável / Volume de Negócios: 100.000,00 Kz')).toBe(false);
    expect(isLinhaDecorativaOuRuido('IVA Liquidado (Conta 3453): 14.000,00 Kz')).toBe(false);
  });

  test('isTituloDiferencaValido deve rejeitar separadores e aceitar rubricas reais', () => {
    expect(isTituloDiferencaValido('*====================================')).toBe(false);
    expect(isTituloDiferencaValido('====================================')).toBe(false);
    expect(isTituloDiferencaValido('--')).toBe(false);
    expect(isTituloDiferencaValido('ANÁLISE DAS DIFERENÇAS DETETADAS')).toBe(false);
    expect(isTituloDiferencaValido('Nenhuma divergência detetada')).toBe(false);

    expect(isTituloDiferencaValido('Base Tributável / Volume de Negócios')).toBe(true);
    expect(isTituloDiferencaValido('IVA Liquidado – Divergência de 5.000,00 Kz')).toBe(true);
  });

  test('sanitizarValorTexto deve remover formatação residual e manter conteúdo substantivo', () => {
    expect(sanitizarValorTexto('- **O que está no Balancete:** 500.000,00 Kz (Conta 71)')).toBe('500.000,00 Kz (Conta 71)');
    expect(sanitizarValorTexto('* **Risco fiscal:** Elevado perante o CIVA')).toBe('Elevado perante o CIVA');
    expect(sanitizarValorTexto('*====================================')).toBe('');
    expect(sanitizarValorTexto('--')).toBe('');
  });

  test('Cenário Real do Bug da Foto: Não deve criar falsa divergência quando os valores são conformes', () => {
    const textoIaComGlitch = `
====================================
1. RESUMO DO CONFRONTO (BALANCETE vs MODELO 7)
====================================
- Documentos confrontados: Balancete de Verificação e Declaração Modelo 7
- Total de pontos analisados: 3
- Dados IGUAIS (Conformes): 3
- Dados com DIFERENCAS: 0

====================================
2. DETALHE DOS DADOS: IGUAIS vs DIFERENCAS
====================================
| Nome do Campo | Contabilidade (Balancete) | AGT (Modelo 7) | Status | Diferença Apurada |
| Base Tributável / Volume de Negócios | 10.000.000,00 Kz | 10.000.000,00 Kz | IGUAIS | 0,00 Kz |
| IVA Liquidado (Conta 3453) | 1.400.000,00 Kz | 1.400.000,00 Kz | IGUAIS | 0,00 Kz |
| IVA Dedutível (Conta 3451) | 500.000,00 Kz | 500.000,00 Kz | IGUAIS | 0,00 Kz |

====================================
3. ANALISE DAS DIFERENCAS DETETADAS
====================================
*====================================
| Campo | O que está no Balancete | O que foi declarado no Modelo 7 | Causa provável | Risco fiscal |

**Pontos IGUAIS**:
--
*====================================
*
- Base Tributável / Volume de Negócios: 10.000.000,00 Kz (em perfeita conformidade)
- IVA Liquidado (Conta 3453): 1.400.000,00 Kz (em perfeita conformidade)
- IVA Dedutível (Conta 3451): 500.000,00 Kz (em perfeita conformidade)

====================================
4. O QUE FAZER PARA RESOLVER (RECOMENDACOES)
====================================
1. **Manter o Arquivo Digital Atualizado**
   - Manter as faturas e guias de liquidação arquivadas.
2. **Reconciliação Mensal Contínua**
   - Efetuar o fecho mensal antes do dia 25.

**Resultado esperado**:
- Plena conformidade fiscal perante a AGT.
`;

    const resultado = parseAnaliseIA(textoIaComGlitch);

    expect(resultado).not.toBeNull();
    expect(resultado.totalPontos).toBe(3);
    expect(resultado.iguaisCount).toBe(3);
    expect(resultado.diferencasCount).toBe(0);

    // CRÍTICO: Não deve existir NENHUMA falsa divergência com o título '*===================================='
    expect(resultado.diferencasDetalhadas.length).toBe(0);

    // CRÍTICO: Pontos iguais não devem conter '--', '*====================================' ou '*'
    expect(resultado.pontosIguais).toHaveLength(3);
    expect(resultado.pontosIguais[0]).toContain('Base Tributável');
    expect(resultado.pontosIguais[1]).toContain('IVA Liquidado');
    expect(resultado.pontosIguais[2]).toContain('IVA Dedutível');
    expect(resultado.pontosIguais).not.toContain('--');
    expect(resultado.pontosIguais).not.toContain('*====================================');
    expect(resultado.pontosIguais).not.toContain('*');

    // Recomendações devem estar limpas
    expect(resultado.recomendacoes).toHaveLength(2);
    expect(resultado.recomendacoes[0].titulo).toBe('Manter o Arquivo Digital Atualizado');
    expect(resultado.recomendacoes[1].titulo).toBe('Reconciliação Mensal Contínua');
  });

  test('Cenário com Divergências Reais: Deve capturar os detalhes legítimos', () => {
    const textoComDifs = `
====================================
1. RESUMO DO CONFRONTO (BALANCETE vs MODELO 7)
====================================
- Total de pontos analisados: 2
- Dados IGUAIS: 1
- Dados com DIFERENÇAS: 1

====================================
2. DETALHE DOS DADOS: IGUAIS vs DIFERENCAS
====================================
| Nome do Campo | Contabilidade | AGT | Status | Diferença Apurada |
| Base Tributável | 10.000.000,00 Kz | 10.000.000,00 Kz | IGUAIS | 0,00 Kz |
| IVA Liquidado (Conta 3453) | 1.400.000,00 Kz | 1.000.000,00 Kz | DIFERENÇA | 400.000,00 Kz |

====================================
3. ANALISE DAS DIFERENCAS DETETADAS
====================================
- **IVA Liquidado (Conta 3453)**
  - **O que está no Balancete:** 1.400.000,00 Kz creditados na Conta 3453
  - **O que foi declarado no Modelo 7:** 1.000.000,00 Kz no Campo 10
  - **Causa provável:** Omissão de faturas emitidas na segunda quinzena
  - **Risco fiscal:** Risco elevado de liquidação adicional e coima perante a AGT

**Pontos IGUAIS**:
- Base Tributável: 10.000.000,00 Kz (em perfeita conformidade)

====================================
4. O QUE FAZER PARA RESOLVER
====================================
1. **Submeter Declaração de Substituição**
   - Regularizar o Modelo 7 retificando o IVA Liquidado.
`;

    const resultado = parseAnaliseIA(textoComDifs);

    expect(resultado.diferencasCount).toBe(1);
    expect(resultado.diferencasDetalhadas).toHaveLength(1);
    expect(resultado.diferencasDetalhadas[0].titulo).toBe('IVA Liquidado (Conta 3453)');
    expect(resultado.diferencasDetalhadas[0].balancete).toContain('1.400.000,00 Kz');
    expect(resultado.diferencasDetalhadas[0].agt).toContain('1.000.000,00 Kz');
    expect(resultado.diferencasDetalhadas[0].causas[0]).toContain('Omissão de faturas');
    expect(resultado.diferencasDetalhadas[0].riscos[0]).toContain('Risco elevado');
    expect(resultado.pontosIguais).toHaveLength(1);
  });
});
