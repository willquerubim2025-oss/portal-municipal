# Requisitos e viabilidade

*Análise feita em 02/10/2026 a partir de "Especificação de Requisitos – Site Institucional de Jeriquara/SP v1.0".*

## Contrato
| Item | Valor |
|---|---|
| Contratante | Prefeitura Municipal de Jeriquara/SP, Departamento de Administração |
| Procedimento | Dispensa Eletrônica 028/2026 · Processo 227/2026 · DFD 042/2026 |
| Vigência | 12 meses (implantação + operação) |
| Implantação | Até 60 dias **após** a entrega de acessos e materiais pelo Município. Atrasos do Município deslocam o prazo (TR 6.9.2). |
| Valor | R$ 4.000 de implantação + 12 × R$ 750 = R$ 13.000 |
| Domínio | jeriquara.sp.gov.br, que continua do Município |

## Requisitos, agrupados (detalhe no PDF)
- **Portal público (RF01–07):** responsivo, menus por tema e público, busca interna, notícias e avisos, documentos com filtro e download, Carta de Serviços, política de privacidade e cookies.
- **Transparência (RF08–11):** Central de Transparência (PNTP/ATRICON), links para os sistemas Fiorilli (sem replicar dados), Diário Oficial, e-SIC, Ouvidoria, mapeamento PNTP sem garantia de nota.
- **Painel (RF12–19):** CRUD de conteúdo, perfis, login individual com recuperação de senha, biblioteca de mídias, auditoria, redirecionamentos 301, verificação de links, exportação completa em formato aberto.
- **Suporte (RF20–22):** chamados com protocolo e histórico; **limite de 120 solicitações editoriais no contrato inteiro, sem franquia mensal**; relatório mensal para o fiscal.
- **Não funcionais:** HTTPS, WCAG 2.1 AA / eMAG, OWASP Top 10, backup diário com 30 dias de retenção, monitoramento, LGPD, homologação separada, suporte em horário comercial.
- **Migração (RM01–05):** inventário, classificação, migrar só o que for validado, preservar URLs ou redirecionar, planilha validada pelo Município.
- **Treinamento (RT01–02):** treinamento remoto e manual ou vídeos.

## Avaliação da stack atual (GeoEscolas: React + Vite SPA + Supabase)
- **Supabase atende:** Auth e RLS (perfis), Storage (mídias), triggers (auditoria), busca textual do Postgres em português, `pg_cron` com Edge Functions (links, exportação).
- **Precisa ajustar:**
  1. O portal público não pode ser SPA (SEO, 301, acessibilidade, desempenho). Usar Astro SSR. Ver D-01.
  2. O projeto Supabase precisa ser novo, em sa-east-1 (LGPD e latência), no plano Pro (o grátis não tem backup e pausa por inatividade). Ver D-02.
  3. O backup do Pro retém 7 dias. Para chegar aos 30 dias, um `pg_dump` diário no R2. Ver D-05.
  4. Homologação em projeto ou branch separado; monitoramento com UptimeRobot ou Better Stack; HTTPS pelo Cloudflare.

## Viabilidade
- **Técnica:** viável.
- **Financeira só para Jeriquara:** apertada. R$ 4.000 não pagam um CMS feito do zero.
- **Como produto multi-prefeitura:** viável. Do segundo município em diante, o custo é praticamente a migração. Ver D-03.
- **Mensalidade:** R$ 750/mês cobre a infraestrutura (~R$ 150–200) e o suporte (~10 solicitações por mês).

## Riscos, do maior para o menor
1. **Prazo de 60 dias para o CMS completo.** Mitigar com modelagem genérica e reaproveitável.
2. **Migração:** 1.639 posts, ~6.500 arquivos, ~8 GB. Licitações estão cadastradas como posts. Ver doc 05.
3. **Dependência do Município:** acessos, DNS, identidade visual, validações. Registrar formalmente cada data de entrega.
4. **PNTP/ATRICON:** muitos critérios; é trabalho de mapeamento. A prefeitura vai cobrar nota, mesmo sem garantia no TR.
5. **Acessibilidade AA:** testar com axe, Lighthouse e teclado desde o início.
6. **Domínio .gov.br:** descobrir quem tem acesso ao Registro.br e ao DNS. Pedir no primeiro dia.

## Ordem de execução planejada
0. Antes do contrato: inventário do site atual (**feito em 02/10/2026**) e lista de pendências para o Município.
1. Base: schema multi-prefeitura, Auth, papéis, auditoria, mídia (**schema aplicado no Supabase em 02/10/2026**, migrations 0001–0009).
2. Portal público (Astro): layout acessível, notícias, documentos, serviços, busca, Central de Transparência.
3. Painel admin (React): edição de conteúdo, redirecionamentos, chamados com saldo.
4. Operação: homologação, backup no R2, monitoramento, verificador de links, exportação.
5. Migração, testes, treinamento, virada de DNS (fases 5–9 do cronograma do PDF).
