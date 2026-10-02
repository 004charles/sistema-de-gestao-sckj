/**
 * Parser inteligente e resiliente para estruturar a resposta da Inteligência Artificial (Groq / Llama / Qwen)
 * e alimentar diretamente os componentes visuais do dashboard StrikingDash.
 *
 * Suporta formatos em tabela Markdown, blocos em lista/marcadores e saídas com formatações variadas.
 */
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
        .filter((l) => l.startsWith('-') || l.startsWith('*'))
        .map((l) => l.replace(/^[-*]\s*/, '').replace(/\*\*/g, '').trim())
        .filter(Boolean);
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
      const lines = b.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) continue;

      const firstLine = lines[0];
      if (!firstLine.includes('**') || firstLine.startsWith('===')) continue;

      const titulo = firstLine
        .replace(/^[-*]\s*/, '')
        .replace(/\*\*Ponto(?:s)? de diferen[çc]a\*\*:?/i, '')
        .replace(/\*\*/g, '')
        .trim();

      let balancete = '';
      let agt = '';
      const causas = [];
      const riscos = [];
      let currentMode = '';

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (/O que est[áa] no Balancete/i.test(line)) {
          balancete = line.replace(/^[-*]\s*/, '').replace(/\*\*[^*]+\*\*:\s*/i, '').trim();
          currentMode = 'balancete';
        } else if (/O que foi declarado no Modelo/i.test(line)) {
          agt = line.replace(/^[-*]\s*/, '').replace(/\*\*[^*]+\*\*:\s*/i, '').trim();
          currentMode = 'agt';
        } else if (/Causa prov[áa]vel/i.test(line)) {
          const direct = line.replace(/^[-*]\s*/, '').replace(/\*\*[^*]+\*\*:\s*/i, '').trim();
          if (direct) causas.push(direct);
          currentMode = 'causa';
        } else if (/Risco fiscal/i.test(line)) {
          const direct = line.replace(/^[-*]\s*/, '').replace(/\*\*[^*]+\*\*:\s*/i, '').trim();
          if (direct) riscos.push(direct);
          currentMode = 'risco';
        } else if (line.startsWith('-') || line.startsWith('*')) {
          const sub = line.replace(/^[-*]\s*/, '').replace(/\*\*/g, '').trim();
          if (currentMode === 'causa') causas.push(sub);
          else if (currentMode === 'risco') riscos.push(sub);
        }
      }

      if (titulo && (balancete || agt || causas.length > 0 || riscos.length > 0)) {
        diferencasDetalhadas.push({ titulo, balancete, agt, causas, riscos });
      }
    }
  }

  // Fallbacks inteligentes para garantir que a interface NUNCA fique vazia
  if (pontosIguais.length === 0 && itensConfronto.length > 0) {
    const conformes = itensConfronto.filter((i) => i.status === 'IGUAIS');
    for (const c of conformes) {
      pontosIguais.push(`${c.campo}: Contabilidade (${c.contabilidade}) e AGT (${c.agt}) em perfeita conformidade.`);
    }
  }

  if (diferencasDetalhadas.length === 0 && itensConfronto.length > 0) {
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

  // 7. Parse da Seção 4: Recomendações
  const recomendacoesLista = [];
  const recLines = recomendacoesTexto.split('\n');
  let currentRec = null;

  for (const line of recLines) {
    const trimmed = line.trim();
    const numMatch = trimmed.match(/^(\d+)[.)]\s*(.*)/);
    if (numMatch) {
      if (currentRec) recomendacoesLista.push(currentRec);
      const titleRaw = numMatch[2].replace(/\*\*/g, '').trim();
      currentRec = {
        numero: parseInt(numMatch[1], 10),
        titulo: titleRaw,
        detalhes: [],
      };
    } else if (currentRec && (trimmed.startsWith('-') || trimmed.startsWith('*'))) {
      const detail = trimmed.replace(/^[-*]\s*/, '').replace(/\*\*/g, '').trim();
      if (detail) currentRec.detalhes.push(detail);
    } else if (
      currentRec &&
      trimmed &&
      !trimmed.startsWith('**Resultado esperado**') &&
      !trimmed.startsWith('---') &&
      !trimmed.startsWith('4 -') &&
      !trimmed.startsWith('====')
    ) {
      if (currentRec.detalhes.length === 0 && !trimmed.toLowerCase().includes('assim, a empresa')) {
        currentRec.detalhes.push(trimmed.replace(/\*\*/g, ''));
      }
    }
  }
  if (currentRec) recomendacoesLista.push(currentRec);

  // 8. Resultado Esperado
  const resEspMatch = recomendacoesTexto.match(/\*\*Resultado esperado\*\*:\s*([\s\S]*?)(?:---|$)/i);
  let resultadoEsperado = [];
  if (resEspMatch) {
    resultadoEsperado = resEspMatch[1]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('-') || l.startsWith('*'))
      .map((l) => l.replace(/^[-*]\s*/, '').replace(/\*\*/g, '').trim())
      .filter(Boolean);
  } else {
    const conclusaoMatch = recomendacoesTexto.match(/(?:Assim,\s*a empresa[\s\S]*?)(?=$)/i);
    if (conclusaoMatch) {
      resultadoEsperado = [conclusaoMatch[0].replace(/\n+/g, ' ').trim()];
    }
  }

  return {
    totalPontos: total,
    iguaisCount: iguaisCount,
    diferencasCount: diferencasCount,
    documentosConfrontados: documentosConfrontados,
    itensConfronto: itensConfronto,
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
