/**
 * Parser inteligente e resiliente para estruturar a resposta da Inteligência Artificial (Groq / Llama / Qwen)
 * e alimentar diretamente os componentes visuais do dashboard StrikingDash.
 *
 * Suporta formatos em tabela Markdown, blocos em lista/marcadores e saídas com formatações variadas.
 */

/**
 * Detecta se uma linha de texto é apenas ruído, decoração ou separador Markdown
 * (ex: '===', '---', '*====================================*', '--', '*', etc.)
 */
export function isLinhaDecorativaOuRuido(str) {
  if (!str) return true;
  const limpa = String(str).trim();
  if (limpa.length === 0) return true;

  // Linhas formadas unicamente por caracteres de separação e pontuação (ex: '===', '---', '*===', '--', '*', '***')
  if (/^[*=\-_~#: \t|/\\`]+$/.test(limpa)) return true;

  // Linhas de modelo/cabeçalho de tabela Markdown ou instruções do prompt
  if (limpa.includes('|') && /O que est[áa] no Balancete/i.test(limpa)) return true;
  if (/^\|?\s*Campo\s*\|\s*O que/i.test(limpa)) return true;
  if (/^\|?\s*Nome do Campo\s*\|/i.test(limpa)) return true;
  if (/^Para cada diferen[çc]a:?/i.test(limpa)) return true;
  if (/^\[Nome do Campo\]/i.test(limpa)) return true;
  if (/^\[valor/i.test(limpa)) return true;

  return false;
}

/**
 * Valida se um título de divergência corresponde a uma rubrica ou conta real
 */
export function isTituloDiferencaValido(str) {
  if (!str || isLinhaDecorativaOuRuido(str)) return false;
  const limpo = String(str).replace(/[*=\-_~#: \t|]/g, '').trim();
  // Deve conter pelo menos 3 caracteres alfabéticos reais
  if (!/[a-zA-ZÀ-ÿ]{3,}/.test(limpo)) return false;
  // Não pode ser cabeçalho de seção
  if (/^AN[ÁA]LISE/i.test(limpo) || /^PONTOS IGUAIS/i.test(limpo) || /^RESUMO/i.test(limpo) || /^DETALHE/i.test(limpo)) return false;
  // Se expressar ausência de divergência
  if (/sem diferen[çc]a|nenhuma diferen[çc]a|sem diverg[êe]ncia|nenhuma diverg[êe]ncia|em perfeita conformidade/i.test(str)) {
    return false;
  }
  return true;
}

/**
 * Limpa marcadores de tópicos (- ou * ou •) e asteriscos, preservando o texto substantivo
 */
export function sanitizarLinhaTopico(str) {
  if (!str) return '';
  let limpo = String(str).trim();
  if (isLinhaDecorativaOuRuido(limpo)) return '';
  limpo = limpo.replace(/^[-*•\s]+/, '').replace(/\*\*/g, '').trim();
  if (isLinhaDecorativaOuRuido(limpo)) return '';
  return limpo;
}

/**
 * Extrai o valor limpo de um campo rotulado (ex: '- **O que está no Balancete:** 500.000 Kz')
 */
export function extrairValorRotulado(str) {
  if (!str) return '';
  let limpo = String(str).trim();
  if (isLinhaDecorativaOuRuido(limpo)) return '';
  limpo = limpo.replace(/^[-*•\s]+/, '').trim();
  // Remove rótulo até o ':' (incluindo negritos e variações)
  limpo = limpo.replace(/^(?:\*\*)?[^*:\n]+(?::\*\*|\*\*:\s*|\*\*\s*:\s*|:\s*)\s*/i, '').trim();
  limpo = limpo.replace(/\*\*/g, '').trim();
  if (isLinhaDecorativaOuRuido(limpo)) return '';
  return limpo;
}

/**
 * Alias compatível com versões anteriores
 */
export function sanitizarValorTexto(str) {
  return extrairValorRotulado(str);
}

export function parseAnaliseIA(texto) {
  if (!texto || typeof texto !== 'string') return null;

  // 1. Extrair Seções Principais (suporta hífens normais, travessões, e formatos variados)
  const resumoMatch = texto.match(/1\s*[-–.]\s*RESUMO[\s\S]*?(?=2\s*[-–.]\s*DETALHE|$)/i);
  const detalheMatch = texto.match(/2\s*[-–.]\s*DETALHE[\s\S]*?(?=3\s*[-–.]\s*AN[ÁA]LISE|$)/i);
  const analiseMatch = texto.match(/3\s*[-–.]\s*AN[ÁA]LISE[\s\S]*?(?=4\s*[-–.]\s*O QUE FAZER|4\s*[-–.]\s*RECOMENDA[ÇC]|$)/i);
  const recomendacoesMatch = texto.match(/4\s*[-–.]\s*(?:O QUE FAZER|RECOMENDA[ÇC][ÕO]ES)[\s\S]*$/i);

  const resumoTexto = resumoMatch ? resumoMatch[0] : '';
  const detalheTexto = detalheMatch ? detalheMatch[0] : '';
  const analiseTexto = analiseMatch ? analiseMatch[0] : '';
  const recomendacoesTexto = recomendacoesMatch ? recomendacoesMatch[0] : '';

  // 2. Metadados do Resumo (suporta markdown ** em números e rótulos)
  const docsMatch = resumoTexto.match(/Documentos confrontados\*?\*?:\s*([^\n\r]+)/i);
  const totalMatch = resumoTexto.match(/Total de pontos analisados[^:]*:\s*(?:\*\*)?(\d+)(?:\*\*)?/i);
  const iguaisMatch = resumoTexto.match(/Dados IGUAIS[^:]*:\s*(?:\*\*)?(\d+)(?:\*\*)?/i);
  const difsMatch = resumoTexto.match(/Dados com DIFER[EÊeê]NCIAS[^:]*:\s*(?:\*\*)?(\d+)(?:\*\*)?/i);

  const documentosConfrontados = docsMatch
    ? docsMatch[1].replace(/\*\*/g, '').trim()
    : 'Balancete de Verificação da Contabilidade e Declaração Modelo 7 de IVA';

  // 3. Extrair Itens de Confronto (Tabela Markdown OU Blocos em Lista)
  const itensConfronto = [];
  if (detalheTexto) {
    // Caso A: Tabela Markdown com barras verticais "|"
    const linhas = detalheTexto.split('\n');
    for (const linha of linhas) {
      if (
        linha.includes('|') &&
        !linha.includes('---') &&
        !linha.toLowerCase().includes('nome do campo') &&
        !linha.toLowerCase().includes('ponto confrontado')
      ) {
        const partes = linha.split('|').map((p) => p.trim()).filter(Boolean);
        if (partes.length >= 3) {
          const statusRaw = partes[3] || partes[2] || '';
          const status = statusRaw.toUpperCase().includes('DIFEREN')
            ? 'DIFERENÇA'
            : statusRaw.toUpperCase().includes('IGUAIS') ||
              statusRaw.toUpperCase().includes('OK') ||
              statusRaw.toUpperCase().includes('CONFORME')
            ? 'IGUAIS'
            : 'INFO';

          const campoNome = partes[0].replace(/\*\*/g, '').trim();
          const contab = partes[1] ? partes[1].replace(/\*\*/g, '').trim() : '—';
          const agt = partes[2] ? partes[2].replace(/\*\*/g, '').trim() : '—';
          const dif = partes[4]
            ? partes[4].replace(/\*\*/g, '').trim()
            : status === 'IGUAIS'
            ? '0,00 Kz'
            : 'Diferença apurada';

          itensConfronto.push({
            campo: campoNome,
            contabilidade: contab,
            agt: agt,
            status: status,
            diferenca: dif,
          });
        }
      }
    }

    // Caso B: Blocos em formato lista/tópicos (ex: **Campo** \n - Contabilidade: ... \n - AGT: ... \n - Status: ... \n - Diferença: ...)
    if (itensConfronto.length === 0) {
      const blocos = detalheTexto
        .replace(/^[=\s\w\d-–.:]*DETALHE[^\n]*\n+/i, '')
        .split(/\n(?=(?:[-*]\s*)?\*\*[^*]+\*\*|\[.+?\])/);

      for (const bloco of blocos) {
        const linhasBloco = bloco.split('\n').map((l) => l.trim()).filter(Boolean);
        if (linhasBloco.length === 0) continue;

        const primeiraLinha = linhasBloco[0];
        if (primeiraLinha.startsWith('===') || primeiraLinha.toLowerCase().includes('detalhe dos dados')) continue;

        const campoNome = primeiraLinha
          .replace(/^[-*]\s*/, '')
          .replace(/\*\*/g, '')
          .replace(/^\[|\]$/g, '')
          .trim();

        let contab = '—';
        let agt = '—';
        let status = 'INFO';
        let dif = '0,00 Kz';

        for (const l of linhasBloco) {
          const matchContab = l.match(/(?:Contabilidade|Balancete)[^:]*:\s*([^\n\r]+)/i);
          if (matchContab) contab = matchContab[1].replace(/\*\*/g, '').trim();

          const matchAgt = l.match(/(?:AGT|Modelo\s*7)[^:]*:\s*([^\n\r]+)/i);
          if (matchAgt) agt = matchAgt[1].replace(/\*\*/g, '').trim();

          const matchStatus = l.match(/Status[^:]*:\s*([^\n\r]+)/i);
          if (matchStatus) {
            const raw = matchStatus[1].toUpperCase();
            if (raw.includes('DIFEREN')) status = 'DIFERENÇA';
            else if (raw.includes('IGUAIS') || raw.includes('OK') || raw.includes('CONFORME')) status = 'IGUAIS';
          }

          const matchDif = l.match(/Diferen[çc]a[^:]*:\s*([^\n\r]+)/i);
          if (matchDif) dif = matchDif[1].replace(/\*\*/g, '').trim();
        }

        if (campoNome && (contab !== '—' || agt !== '—')) {
          if (status === 'INFO') {
            if (dif !== '0,00 Kz' && !dif.includes('0,00')) status = 'DIFERENÇA';
            else status = 'IGUAIS';
          }
          itensConfronto.push({
            campo: campoNome,
            contabilidade: contab,
            agt: agt,
            status: status,
            diferenca: dif,
          });
        }
      }
    }
  }

  // 4. Observações no detalhe
  const obsMatch = detalheTexto.match(/\*Observa[çc][ãa]o\*:\s*([^\n\r]+(?:\n[^\n\r=]+)*)/i);
  const observacao = obsMatch ? obsMatch[1].replace(/\*\*/g, '').trim() : null;

  // 5. Contagens
  const total = totalMatch ? parseInt(totalMatch[1], 10) : itensConfronto.length;
  const iguaisCount = iguaisMatch ? parseInt(iguaisMatch[1], 10) : itensConfronto.filter((i) => i.status === 'IGUAIS').length;
  const diferencasCount = difsMatch
    ? parseInt(difsMatch[1], 10)
    : (total - iguaisCount >= 0 ? total - iguaisCount : itensConfronto.filter((i) => i.status === 'DIFERENÇA').length);

  // 6. Parse da Seção 3: Análise Técnica das Diferenças
  const diferencasDetalhadas = [];
  const pontosIguais = [];

  if (analiseTexto) {
    const partesAnalise = analiseTexto.split(/\*\*Pontos IGUAIS\*\*:?/i);
    const parteDifs = partesAnalise[0] || '';
    const parteIguais = partesAnalise[1] || '';

    if (parteIguais) {
      const pIguaisEncontrados = parteIguais
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => !isLinhaDecorativaOuRuido(l))
        .map((l) => sanitizarLinhaTopico(l))
        .filter((l) => l.length > 2 && /[a-zA-ZÀ-ÿ0-9]/.test(l) && !isLinhaDecorativaOuRuido(l));
      pontosIguais.push(...pIguaisEncontrados);
    }

    // Identificar blocos de diferenças por:
    // a) **Ponto de diferença**: ...
    // b) - **Nome – 0,01 Kz**
    // c) Linhas em negrito seguidas de "O que está no Balancete"
    const blocosDifs = parteDifs
      .replace(/^[=\s\w\d-–.:]*AN[ÁA]LISE[^\n]*\n+/i, '')
      .split(/\n(?=(?:[-*]\s*)?(?:\*\*Ponto(?:s)? de diferen[çc]a\*\*:?|\*\*[^*]+(?:\s*[–-]\s*[^*]+)?\*\*))/i);

    for (const b of blocosDifs) {
      const lines = b
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !isLinhaDecorativaOuRuido(l));
      if (lines.length === 0) continue;

      const firstLine = lines[0];
      if (isLinhaDecorativaOuRuido(firstLine)) continue;

      const titulo = firstLine
        .replace(/^[-*•\s]+/, '')
        .replace(/\*\*Ponto(?:s)? de diferen[çc]a\*\*:?/i, '')
        .replace(/\*\*/g, '')
        .trim();

      if (!isTituloDiferencaValido(titulo)) continue;

      let balancete = '';
      let agt = '';
      const causas = [];
      const riscos = [];
      let currentMode = '';

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (isLinhaDecorativaOuRuido(line)) continue;

        if (/O que est[áa] no Balancete/i.test(line)) {
          if (line.includes('|')) continue;
          balancete = extrairValorRotulado(line);
          currentMode = 'balancete';
        } else if (/O que foi declarado no Modelo/i.test(line)) {
          if (line.includes('|')) continue;
          agt = extrairValorRotulado(line);
          currentMode = 'agt';
        } else if (/Causa prov[áa]vel/i.test(line)) {
          if (line.includes('|')) continue;
          const direct = extrairValorRotulado(line);
          if (direct && !isLinhaDecorativaOuRuido(direct)) causas.push(direct);
          currentMode = 'causa';
        } else if (/Risco fiscal/i.test(line)) {
          if (line.includes('|')) continue;
          const direct = extrairValorRotulado(line);
          if (direct && !isLinhaDecorativaOuRuido(direct)) riscos.push(direct);
          currentMode = 'risco';
        } else if (line.startsWith('-') || line.startsWith('*') || line.startsWith('•')) {
          const sub = sanitizarLinhaTopico(line);
          if (sub && !isLinhaDecorativaOuRuido(sub)) {
            if (currentMode === 'causa') causas.push(sub);
            else if (currentMode === 'risco') riscos.push(sub);
          }
        }
      }

      if (titulo && (balancete || agt || causas.length > 0 || riscos.length > 0)) {
        diferencasDetalhadas.push({ titulo, balancete, agt, causas, riscos });
      }
    }
  }

  // Validação de consistência:
  // Se o resumo declarou explicitamente 0 diferenças e a tabela de confronto tem 0 diferenças,
  // descartar qualquer falso positivo capturado por ruído de formatação.
  const totalDifsTabela = itensConfronto.filter((i) => i.status === 'DIFERENÇA').length;
  if (diferencasCount === 0 && totalDifsTabela === 0) {
    diferencasDetalhadas.length = 0;
  }

  // Fallbacks inteligentes para garantir que a interface NUNCA fique vazia
  if (pontosIguais.length === 0 && itensConfronto.length > 0) {
    const conformes = itensConfronto.filter((i) => i.status === 'IGUAIS');
    for (const c of conformes) {
      pontosIguais.push(`${c.campo}: Contabilidade (${c.contabilidade}) e AGT (${c.agt}) em perfeita conformidade.`);
    }
  }

  if (diferencasDetalhadas.length === 0 && totalDifsTabela > 0) {
    const divergentes = itensConfronto.filter((i) => i.status === 'DIFERENÇA');
    for (const d of divergentes) {
      diferencasDetalhadas.push({
        titulo: `${d.campo} – Divergência de ${d.diferenca}`,
        balancete: d.contabilidade,
        agt: d.agt,
        causas: [`Divergência apurada entre o Balancete (${d.contabilidade}) e a Declaração AGT (${d.agt}).`],
        riscos: [`Verificar o suporte documental para regularizar a diferença de ${d.diferenca}.`],
      });
    }
  }

  // 7. Parse da Seção 4: Recomendações e Resultado Esperado
  const recomendacoesLista = [];
  let resultadoEsperado = [];

  if (recomendacoesTexto) {
    // Remover o cabeçalho "4. O QUE FAZER PARA RESOLVER"
    const textoSemTitulo = recomendacoesTexto
      .replace(/^[=\s\w\d-–.:]*(?:O QUE FAZER|RECOMENDA[ÇC][ÕO]ES)[^\n]*\n+/i, '');

    // Isolar o bloco "Resultado esperado" para não se misturar com as ações recomendadas
    const partesRec = textoSemTitulo.split(/(?:\*\*Resultado esperado\*\*|Resultado esperado:?)/i);
    const parteAcoes = partesRec[0] || '';
    const parteResultado = partesRec[1] || '';

    const recLines = parteAcoes.split('\n');
    let currentRec = null;

    for (const line of recLines) {
      const trimmed = line.trim();
      if (isLinhaDecorativaOuRuido(trimmed)) continue;

      const numMatch = trimmed.match(/^(\d+)[.)]\s*(.*)/);
      if (numMatch) {
        const titleRaw = sanitizarLinhaTopico(numMatch[2]);
        if (titleRaw && !isLinhaDecorativaOuRuido(titleRaw)) {
          if (currentRec) recomendacoesLista.push(currentRec);
          currentRec = {
            numero: parseInt(numMatch[1], 10),
            titulo: titleRaw,
            detalhes: [],
          };
        }
      } else if (currentRec && (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('•'))) {
        const detail = sanitizarLinhaTopico(trimmed);
        if (detail && !isLinhaDecorativaOuRuido(detail)) currentRec.detalhes.push(detail);
      } else if (
        currentRec &&
        trimmed &&
        !isLinhaDecorativaOuRuido(trimmed) &&
        !trimmed.startsWith('4 -') &&
        !trimmed.startsWith('4.')
      ) {
        const detail = sanitizarLinhaTopico(trimmed);
        if (detail && !isLinhaDecorativaOuRuido(detail) && currentRec.detalhes.length === 0 && !trimmed.toLowerCase().includes('assim, a empresa')) {
          currentRec.detalhes.push(detail);
        }
      }
    }
    if (currentRec) recomendacoesLista.push(currentRec);

    // 8. Resultado Esperado
    if (parteResultado) {
      resultadoEsperado = parteResultado
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => !isLinhaDecorativaOuRuido(l))
        .map((l) => sanitizarLinhaTopico(l))
        .filter((l) => l.length > 2 && !isLinhaDecorativaOuRuido(l));
    } else {
      const conclusaoMatch = textoSemTitulo.match(/(?:Assim,\s*a empresa[\s\S]*?)(?=$)/i);
      if (conclusaoMatch) {
        resultadoEsperado = [conclusaoMatch[0].replace(/\n+/g, ' ').trim()];
      }
    }
  }

  // 9. Quadro Oficial de Apuramento do IVA (Lei n.º 7/19 - Código do IVA)
  // Regra Legal Obrigatória: IVA a Pagar = IVA Liquidado (Conta 3453) - IVA Dedutível (Conta 3451)
  const itemLiquidado = itensConfronto.find((i) =>
    i.campo.toLowerCase().includes('liquidado') ||
    i.campo.toLowerCase().includes('favor do estado')
  );
  const itemDedutivel = itensConfronto.find((i) =>
    i.campo.toLowerCase().includes('dedut') ||
    i.campo.toLowerCase().includes('suportado') ||
    i.campo.toLowerCase().includes('favor do sujeito passivo')
  );
  const itemPagar = itensConfronto.find((i) =>
    (i.campo.toLowerCase().includes('pagar') || i.campo.toLowerCase().includes('apurado')) &&
    !i.campo.toLowerCase().includes('crédito') &&
    !i.campo.toLowerCase().includes('recuperar')
  );
  const itemRecuperar = itensConfronto.find((i) =>
    i.campo.toLowerCase().includes('recuperar') ||
    i.campo.toLowerCase().includes('crédito de iva') ||
    i.campo.toLowerCase().includes('crédito fiscal')
  );

  const apuramentoIva = (itemLiquidado || itemDedutivel || itemPagar)
    ? {
        liquidado: {
          contabilidade: itemLiquidado?.contabilidade || '0,00 Kz',
          agt: itemLiquidado?.agt || '0,00 Kz',
          status: itemLiquidado?.status || 'IGUAIS',
          diferenca: itemLiquidado?.diferenca || '0,00 Kz',
        },
        dedutivel: {
          contabilidade: itemDedutivel?.contabilidade || '0,00 Kz',
          agt: itemDedutivel?.agt || '0,00 Kz',
          status: itemDedutivel?.status || 'IGUAIS',
          diferenca: itemDedutivel?.diferenca || '0,00 Kz',
        },
        pagar: {
          contabilidade: itemPagar?.contabilidade || '0,00 Kz',
          agt: itemPagar?.agt || '0,00 Kz',
          status: itemPagar?.status || 'IGUAIS',
          diferenca: itemPagar?.diferenca || '0,00 Kz',
        },
        recuperar: itemRecuperar
          ? {
              contabilidade: itemRecuperar.contabilidade,
              agt: itemRecuperar.agt,
              status: itemRecuperar.status,
              diferenca: itemRecuperar.diferenca,
            }
          : null,
        formula: 'IVA a Pagar = IVA Liquidado (Vendas) - IVA Dedutível (Compras)',
      }
    : null;

  return {
    totalPontos: total,
    iguaisCount: iguaisCount,
    diferencasCount: diferencasCount,
    documentosConfrontados: documentosConfrontados,
    itensConfronto: itensConfronto,
    apuramentoIva: apuramentoIva,
    observacao: observacao,
    diferencasDetalhadas: diferencasDetalhadas,
    pontosIguais: pontosIguais,
    recomendacoes: recomendacoesLista,
    resultadoEsperado: resultadoEsperado,
    analiseTecnicaRaw: analiseTexto,
    recomendacoesRaw: recomendacoesTexto,
    textoOriginal: texto,
  };
}
