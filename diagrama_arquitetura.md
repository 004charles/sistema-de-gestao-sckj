# Diagrama de Arquitetura do Sistema de Auditoria Contábil

```mermaid
flowchart TD
    %% Estilo
    classDef process fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px
    classDef data fill:#BBDEFB,stroke:#1565C0,stroke-width:2px
    classDef engine fill:#FFF3E0,stroke:#EF6C00,stroke-width:2px
    classDef output fill:#E8EAF6,stroke:#8E24AA,stroke-width:2px

    %% Nós
    Empresa([EMPRESA])
    Balanco[BALANÇETE<br/>Contabilidade<br/>Razão/Diários]
    Documentos[DOCUMENTOS<br/>Faturas/PDF<br/>Recibos]
    DadosAGT([DADOS AGT<br/>Declarações<br/>Pagamentos])

    Normalizacao[NORMALIZAÇÃO DE DADOS]
    MotorRegras[MOTOR DE REGRAS<br/>FISCAIS E CONTABILÍSTICAS]
    Reconciliacao[RECONCILIAÇÃO]
    TestesFiscais[TESTES FISCAIS]
    TestesContabeis[TESTES CONTÁBEIS]
    MotorAuditoria[MOTOR DE AUDITORIA<br/>Achados/Exceções]
    RelatorioFinal[RELATÓRIO DE AUDITORIA]

    %% Fluxo
    Empresa --> Balanco
    Empresa --> Documentos
    Empresa --> DadosAGT

    Balanco --> Normalizacao
    Documentos --> Normalizacao
    DadosAGT --> Normalizacao

    Normalizacao --> MotorRegras

    MotorRegras --> Reconciliacao
    MotorRegras --> TestesFiscais
    MotorRegras --> TestesContabeis

    Reconciliacao --> MotorAuditoria
    TestesFiscais --> MotorAuditoria
    TestesContabeis --> MotorAuditoria

    MotorAuditoria --> RelatorioFinal

    %% Classe dos nós
    class Empresa,Balanco,Documentos,DadosAGT data
    class Normalizacao,MotorRegras,Reconciliacao,TestesFiscais,TestesContabeis,MotorAuditoria process
    class RelatorioFinal output