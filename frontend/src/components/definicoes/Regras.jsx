import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../services/api';
import { invalidarAuditoria } from '../../hooks/useAuditoria';

/**
 * Validação das regras de auditoria.
 *
 * O sistema não inventa lei: cada regra nasce "por validar" e só passa a gerar
 * alertas oficiais depois de alguém com responsabilidade a confirmar. Esta
 * página é onde isso acontece — e vive em Definições, não na Auditoria, porque
 * é uma decisão que se toma uma vez, não um gesto do dia-a-dia.
 */

const ESTADOS = {
  VALIDADA: { cor: '#20c997', texto: 'Activa' },
  POR_VALIDAR: { cor: '#fa8b0c', texto: 'Por validar' },
  REJEITADA: { cor: '#a0a4b8', texto: 'Rejeitada' },
};

const Regras = () => {
  const [regras, setRegras] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState('POR_VALIDAR');
  const [aGuardar, setAGuardar] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const resposta = await api.get('/regras/');
      const lista = Array.isArray(resposta.data)
        ? resposta.data
        : resposta.data?.results || [];
      setRegras(lista);
    } catch (e) {
      toast.error('Não foi possível carregar as regras.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const decidir = async (regra, estado) => {
    setAGuardar(regra.id);
    try {
      await api.patch(`/regras/${regra.id}/`, { estado_validacao: estado });
      toast.success(
        estado === 'VALIDADA'
          ? `${regra.codigo} passou a gerar alertas.`
          : `${regra.codigo} deixou de gerar alertas.`
      );
      await carregar();
      // Validar uma regra muda os números de toda a gente.
      invalidarAuditoria();
    } catch (e) {
      toast.error('Não foi possível guardar.');
    } finally {
      setAGuardar(null);
    }
  };

  const visiveis = regras.filter(
    (r) => filtro === 'TODAS' || r.estado_validacao === filtro
  );
  const contar = (estado) =>
    regras.filter((r) => r.estado_validacao === estado).length;

  return (
    <div className="card card-default">
      <div className="card-body" style={{ padding: '20px' }}>
        <div
          className="d-flex justify-content-between align-items-center flex-wrap mb-15"
          style={{ gap: 10 }}
        >
          <div>
            <h6 className="fw-600 color-dark mb-0" style={{ fontSize: 15 }}>
              Regras de auditoria
            </h6>
            <span className="text-muted" style={{ fontSize: 12 }}>
              Só as regras activas geram alertas.
            </span>
          </div>

          <div className="d-flex" style={{ gap: 6 }}>
            {[
              ['POR_VALIDAR', `Por validar (${contar('POR_VALIDAR')})`],
              ['VALIDADA', `Activas (${contar('VALIDADA')})`],
              ['TODAS', 'Todas'],
            ].map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                className={`btn btn-sm btn-squared ${
                  filtro === valor ? 'btn-primary' : 'btn-outline-light'
                }`}
                style={{ fontSize: 12 }}
                onClick={() => setFiltro(valor)}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </div>

        {carregando && (
          <p className="text-muted mb-0" style={{ fontSize: 13 }}>
            A carregar...
          </p>
        )}

        {!carregando && visiveis.length === 0 && (
          <p className="text-muted mb-0" style={{ fontSize: 13 }}>
            Nenhuma regra neste estado.
          </p>
        )}

        {visiveis.map((regra) => {
          const estado = ESTADOS[regra.estado_validacao] || ESTADOS.POR_VALIDAR;
          return (
            <div
              key={regra.id}
              className="d-flex justify-content-between align-items-start flex-wrap"
              style={{
                gap: 12,
                padding: '14px 0',
                borderBottom: '1px solid #f1f2f6',
              }}
            >
              <div style={{ flex: '1 1 320px' }}>
                <div className="d-flex align-items-center" style={{ gap: 8 }}>
                  <code style={{ fontSize: 12 }}>{regra.codigo}</code>
                  <span
                    style={{
                      fontSize: 11,
                      color: estado.cor,
                      background: `${estado.cor}14`,
                      padding: '2px 8px',
                      borderRadius: 10,
                    }}
                  >
                    {estado.texto}
                  </span>
                </div>
                <div
                  style={{ fontSize: 13, fontWeight: 600, color: '#272b41', marginTop: 4 }}
                >
                  {regra.nome}
                </div>
                {regra.base_legal && (
                  <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
                    {typeof regra.base_legal === 'string'
                      ? regra.base_legal
                      : `${regra.base_legal.legislacao} — ${regra.base_legal.artigo}`}
                  </div>
                )}
              </div>

              <div className="d-flex" style={{ gap: 6 }}>
                {regra.estado_validacao !== 'VALIDADA' && (
                  <button
                    type="button"
                    className="btn btn-sm btn-success btn-squared"
                    style={{ fontSize: 12 }}
                    disabled={aGuardar === regra.id}
                    onClick={() => decidir(regra, 'VALIDADA')}
                  >
                    Activar
                  </button>
                )}
                {regra.estado_validacao !== 'REJEITADA' && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-light btn-squared"
                    style={{ fontSize: 12 }}
                    disabled={aGuardar === regra.id}
                    onClick={() => decidir(regra, 'REJEITADA')}
                  >
                    Desactivar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Regras;
