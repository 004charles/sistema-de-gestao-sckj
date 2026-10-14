import React, { useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { API_BASE, authHeaders } from '../../services/api';
import { usePeriodo } from '../../context/PeriodoContext';
import { invalidarAuditoria } from '../../hooks/useAuditoria';

/**
 * Carregar documentos — e a auditoria corre de imediato.
 *
 * O upload é o gesto que põe o sistema a trabalhar, por isso termina sempre
 * com `invalidarAuditoria()`: os números, os prazos e a lista de erros de
 * todas as páginas abertas actualizam-se sozinhos, sem o utilizador ter de
 * navegar para outro lado para "ver o resultado".
 */

const TIPOS = [
  { valor: 'AUTO', nome: 'Detectar automaticamente' },
  { valor: 'BALANCETE', nome: 'Balancete' },
  { valor: 'MODELO7', nome: 'Modelo 7 (IVA)' },
  { valor: 'FOLHA_SALARIAL', nome: 'Folha salarial' },
  { valor: 'FOLHA_SS', nome: 'Segurança Social' },
  { valor: 'RETENCOES', nome: 'Retenções' },
  { valor: 'COMPROVATIVOS', nome: 'Comprovativo de pagamento' },
  { valor: 'DECLARACAO_IRT', nome: 'Declaração de IRT' },
  { valor: 'EXTRACTO_BANCARIO', nome: 'Extracto bancário' },
  { valor: 'DOSSIE_MENSAL', nome: 'Dossiê mensal completo' },
];

const Carregar = ({ emFalta = [] }) => {
  const { empresaId, ano, mes } = usePeriodo();
  const [ficheiro, setFicheiro] = useState(null);
  const [tipo, setTipo] = useState('AUTO');
  const [aEnviar, setAEnviar] = useState(false);
  const inputRef = useRef(null);

  const escolher = (lista) => {
    if (lista && lista[0]) setFicheiro(lista[0]);
  };

  const enviar = async () => {
    if (!ficheiro || !empresaId) return;
    setAEnviar(true);

    const dados = new FormData();
    dados.append('arquivo', ficheiro);
    dados.append('empresa_id', empresaId);
    dados.append('ano', ano);
    dados.append('mes', mes);
    dados.append('nome_arquivo', ficheiro.name);
    if (tipo !== 'AUTO') dados.append('tipo', tipo);

    try {
      const resposta = await fetch(`${API_BASE}/documentos/upload/`, {
        method: 'POST',
        headers: authHeaders(),
        body: dados,
      });
      const corpo = await resposta.json().catch(() => ({}));

      if (resposta.ok) {
        const criados = corpo.documentos_criados?.length;
        toast.success(
          criados
            ? `${criados} documentos lidos. Auditoria actualizada.`
            : 'Documento lido. Auditoria actualizada.'
        );
        setFicheiro(null);
        if (inputRef.current) inputRef.current.value = '';
        // Põe o sistema inteiro em dia, não só esta página.
        invalidarAuditoria();
      } else {
        toast.error(corpo.error || 'Não foi possível ler este documento.');
      }
    } catch (e) {
      toast.error('Sem ligação ao servidor.');
    } finally {
      setAEnviar(false);
    }
  };

  return (
    <div className="card card-default">
      <div className="card-body" style={{ padding: '18px 20px' }}>
        <div
          className="d-flex align-items-center flex-wrap"
          style={{ gap: 10 }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.xlsx,.xls,.csv,.xml"
            onChange={(e) => escolher(e.target.files)}
            style={{ display: 'none' }}
            id="ficheiro-auditoria"
          />

          <label
            htmlFor="ficheiro-auditoria"
            className="btn btn-outline-primary btn-default btn-squared mb-0"
            style={{ cursor: 'pointer' }}
          >
            <i className="la la-paperclip mr-5"></i>
            {ficheiro ? ficheiro.name : 'Escolher ficheiro'}
          </label>

          <select
            className="form-control form-control-default"
            style={{ width: 'auto', minWidth: 190 }}
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
          >
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.nome}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn btn-primary btn-default btn-squared"
            onClick={enviar}
            disabled={!ficheiro || aEnviar || !empresaId}
          >
            <i
              className={`la ${aEnviar ? 'la-spinner la-spin' : 'la-upload'} mr-5`}
            ></i>
            {aEnviar ? 'A ler...' : 'Carregar e auditar'}
          </button>
        </div>

        {emFalta.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <span
              className="text-muted d-block mb-5"
              style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}
            >
              Em falta para auditar este mês
            </span>
            <div className="d-flex flex-wrap" style={{ gap: 6 }}>
              {emFalta.map((documento) => (
                <span
                  key={documento.tipo}
                  style={{
                    fontSize: 12,
                    background: '#fff7e6',
                    color: '#fa8b0c',
                    padding: '4px 10px',
                    borderRadius: 12,
                  }}
                >
                  {TIPOS.find((t) => t.valor === documento.tipo)?.nome
                    || documento.tipo}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Carregar;
