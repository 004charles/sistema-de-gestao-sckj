import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api, { empresaService } from '../services/api';
import { usePeriodo, usePeriodoDaUrl } from '../context/PeriodoContext';
import useAuditoria, { invalidarAuditoria } from '../hooks/useAuditoria';
import { MESES, nomeMes } from '../utils/formato';
import Numeros from '../components/auditoria/Numeros';
import Prazos from '../components/auditoria/Prazos';
import LinhaErro from '../components/auditoria/LinhaErro';
import Carregar from '../components/auditoria/Carregar';
import AnimacaoAuditoria from '../components/auditoria/AnimacaoAuditoria';
import ParecerTecnicoIA from '../components/auditoria/ParecerTecnicoIA';
import { auditoriaService } from '../services/api';

/**
 * Auditoria — a única página onde se trabalha.
 *
 * Substitui o Dashboard, os Motores e as três primeiras abas dos Relatórios,
 * que pediam todos o mesmo endpoint e repintavam os mesmos dados. Aqui há uma
 * leitura só: carregar documentos, ver os números, corrigir o que está errado.
 */

const Vazio = ({ icone, titulo, texto }) => (
  <div className="card card-default">
    <div className="card-body text-center" style={{ padding: '48px 20px' }}>
      <i className={`la ${icone}`} style={{ fontSize: 42, color: '#c6cbd9' }}></i>
      <h5 className="fw-600 color-dark" style={{ marginTop: 12 }}>
        {titulo}
      </h5>
      <p className="text-muted mb-0" style={{ fontSize: 13 }}>
        {texto}
      </p>
    </div>
  </div>
);

const Auditoria = () => {
  usePeriodoDaUrl();
  const { empresaId, ano, mes, atualizar, escolherSeAusente } = usePeriodo();
  const { dados, carregando, erro } = useAuditoria();

  const [empresas, setEmpresas] = useState([]);
  const [filtro, setFiltro] = useState('erros');
  const [aExecutar, setAExecutar] = useState(false);
  const [aExecutarAnimacao, setAExecutarAnimacao] = useState(false);
  const [parecerData, setParecerData] = useState(null);
  const [carregandoParecer, setCarregandoParecer] = useState(false);

  useEffect(() => {
    empresaService
      .getAll()
      .then((r) => {
        const lista = Array.isArray(r.data) ? r.data : r.data?.results || [];
        setEmpresas(lista);
        if (lista.length > 0) {
          escolherSeAusente({ empresaId: String(lista[0].id) });
        }
      })
      .catch(() => setEmpresas([]));
  }, [escolherSeAusente]);

  const carregarParecer = async (empId, a, m) => {
    if (!empId) return;
    setCarregandoParecer(true);
    try {
      const res = await auditoriaService.getParecer(empId, a, m);
      setParecerData(res.data);
    } catch (e) {
      console.error('Erro ao carregar parecer:', e);
    } finally {
      setCarregandoParecer(false);
    }
  };

  useEffect(() => {
    if (empresaId && ano && mes) {
      carregarParecer(empresaId, ano, mes);
    }
  }, [empresaId, ano, mes]);

  const reexecutar = async () => {
    if (!empresaId) return;
    setAExecutar(true);
    try {
      await api.post('/ocorrencias/executar/', {
        empresa: Number(empresaId),
        empresa_id: Number(empresaId),
        ano: Number(ano),
        mes: Number(mes),
      });
      invalidarAuditoria();
      await carregarParecer(empresaId, ano, mes);
      toast.success('Auditoria executada.');
    } catch (e) {
      toast.error('Não foi possível executar a auditoria.');
    } finally {
      setAExecutar(false);
    }
  };

  const executarComIA = async () => {
    if (!empresaId) return;
    setAExecutarAnimacao(true);
    try {
      await api.post('/ocorrencias/executar/', {
        empresa: Number(empresaId),
        empresa_id: Number(empresaId),
        ano: Number(ano),
        mes: Number(mes),
      });
      invalidarAuditoria();
      const res = await auditoriaService.gerarParecer(empresaId, ano, mes);
      setParecerData(res.data);
      toast.success('Auditoria com IA concluída com sucesso.');
    } catch (e) {
      toast.error('Erro durante a auditoria com IA.');
    }
  };

  const linhas = dados?.linhas || [];
  const erros = linhas.filter((l) => l.gravidade !== 'INFORMATIVO');
  const notas = linhas.filter((l) => l.gravidade === 'INFORMATIVO');
  const emFalta = dados?.cobertura?.em_falta || [];

  const visiveis = filtro === 'faltam' ? [] : filtro === 'ok' ? notas : erros;
  const anoActual = new Date().getFullYear();
  const empresaAtualNome = empresas.find((e) => String(e.id) === String(empresaId))?.nome;

  return (
    <>
      {/* Cabeçalho: só empresa e período. O resto é número. */}
      <div className="row mb-20">
        <div className="col-12">
          <div
            className="d-flex justify-content-between align-items-center flex-wrap"
            style={{ gap: 12 }}
          >
            <div>
              <h4 className="breadcrumb-title mb-0" style={{ fontSize: 20 }}>
                Auditoria
              </h4>
              <span className="text-muted" style={{ fontSize: 13 }}>
                {nomeMes(mes)} de {ano}
              </span>
            </div>

            <div className="d-flex align-items-center flex-wrap" style={{ gap: 8 }}>
              <select
                className="form-control form-control-default"
                style={{ width: 'auto', minWidth: 180 }}
                value={empresaId}
                onChange={(e) => atualizar({ empresaId: e.target.value })}
              >
                <option value="">Escolher empresa</option>
                {empresas.map((empresa) => (
                  <option key={empresa.id} value={String(empresa.id)}>
                    {empresa.nome}
                  </option>
                ))}
              </select>

              <select
                className="form-control form-control-default"
                style={{ width: 'auto' }}
                value={mes}
                onChange={(e) => atualizar({ mes: e.target.value })}
              >
                {MESES.map((nome, i) => (
                  <option key={nome} value={String(i + 1)}>
                    {nome}
                  </option>
                ))}
              </select>

              <select
                className="form-control form-control-default"
                style={{ width: 'auto' }}
                value={ano}
                onChange={(e) => atualizar({ ano: e.target.value })}
              >
                {[anoActual, anoActual - 1, anoActual - 2].map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="btn btn-primary btn-default btn-squared d-flex align-items-center"
                onClick={executarComIA}
                disabled={aExecutar || aExecutarAnimacao || !empresaId}
                style={{ gap: 6, fontWeight: 600 }}
                title="Executar auditoria fiscal completa com varredura PGC e Parecer Técnico IA"
              >
                <i
                  className={`la ${aExecutarAnimacao ? 'la-spinner la-spin' : 'la-brain'}`}
                  style={{ fontSize: 16 }}
                ></i>
                <span>Auditar com IA</span>
              </button>

              <button
                type="button"
                className="btn btn-outline-primary btn-default btn-squared"
                onClick={reexecutar}
                disabled={aExecutar || aExecutarAnimacao || !empresaId}
                title="Voltar a correr as verificações sobre os documentos já carregados"
              >
                <i
                  className={`la ${aExecutar ? 'la-spinner la-spin' : 'la-redo-alt'}`}
                ></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Animação Técnica de Auditoria com IA */}
      {aExecutarAnimacao && (
        <div className="row mb-20">
          <div className="col-12">
            <AnimacaoAuditoria
              emExecucao={aExecutarAnimacao}
              empresaNome={empresaAtualNome}
              periodo={`${nomeMes(mes)} de ${ano}`}
              onConcluir={() => setAExecutarAnimacao(false)}
              onCancelar={() => setAExecutarAnimacao(false)}
            />
          </div>
        </div>
      )}

      {carregando && (
        <div className="row mb-20">
          <div className="col-12">
            <div
              className="progress"
              style={{ height: 4, borderRadius: 2, background: '#f1f2f6' }}
            >
              <div
                className="progress-bar progress-bar-striped progress-bar-animated"
                style={{ width: '100%', background: '#5f63f2' }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {!empresaId && (
        <Vazio
          icone="la-building"
          titulo="Escolha uma empresa"
          texto="Depois carregue os documentos do mês e a auditoria corre sozinha."
        />
      )}

      {empresaId && erro && (
        <div className="alert alert-danger" role="alert">
          {erro}
        </div>
      )}

      {empresaId && dados && (
        <>
          <div className="row mb-20">
            <div className="col-12">
              <Numeros dados={dados} filtro={filtro} onFiltrar={setFiltro} />
            </div>
          </div>

          <div className="row mb-20">
            <div className="col-12">
              <Prazos prazos={dados.prazos} />
            </div>
          </div>

          {/* Parecer Técnico do Auditor com IA & Rasto de Auditoria */}
          {(parecerData || carregandoParecer) && (
            <div className="row mb-20">
              <div className="col-12">
                <ParecerTecnicoIA
                  parecerData={parecerData}
                  rastoData={parecerData?.rasto}
                  aCarregar={carregandoParecer}
                  onReanalisar={executarComIA}
                  empresaNome={empresaAtualNome}
                  nif={empresas.find((e) => String(e.id) === String(empresaId))?.nif}
                  periodo={`${nomeMes(mes)} de ${ano}`}
                  regime={empresas.find((e) => String(e.id) === String(empresaId))?.regime_iva}
                />
              </div>
            </div>
          )}

          <div className="row mb-20">
            <div className="col-12">
              <Carregar emFalta={emFalta} />
            </div>
          </div>

          <div className="row">
            <div className="col-12">
              {filtro === 'faltam' && (
                emFalta.length === 0 ? (
                  <Vazio
                    icone="la-check-circle"
                    titulo="Não falta nada"
                    texto="Todos os documentos necessários a este mês estão carregados."
                  />
                ) : (
                  <div className="card card-default">
                    <div className="card-body" style={{ padding: '18px 20px' }}>
                      {emFalta.map((documento) => (
                        <div
                          key={documento.tipo}
                          className="d-flex justify-content-between align-items-center flex-wrap"
                          style={{
                            gap: 10,
                            padding: '10px 0',
                            borderBottom: '1px solid #f1f2f6',
                          }}
                        >
                          <span style={{ fontSize: 14, fontWeight: 600 }}>
                            {documento.tipo}
                          </span>
                          <span className="text-muted" style={{ fontSize: 12 }}>
                            {documento.desbloqueia}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}

              {filtro !== 'faltam' && visiveis.length === 0 && (
                <Vazio
                  icone={filtro === 'ok' ? 'la-clipboard-check' : 'la-check-circle'}
                  titulo={
                    filtro === 'ok'
                      ? 'Sem notas informativas'
                      : 'Nenhum erro encontrado'
                  }
                  texto={
                    filtro === 'ok'
                      ? 'Nada a assinalar para este período.'
                      : `${dados.contadores.ok} verificações correram e não acusaram problemas.`
                  }
                />
              )}

              {visiveis.map((linha) => (
                <LinhaErro key={linha.id} linha={linha} />
              ))}
            </div>
          </div>

          {dados.cobertura?.disclaimer && (
            <div className="row">
              <div className="col-12">
                <p
                  className="text-muted"
                  style={{ fontSize: 11, marginTop: 10 }}
                >
                  <i className="la la-info-circle mr-5"></i>
                  {dados.cobertura.disclaimer}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
};

export default Auditoria;
