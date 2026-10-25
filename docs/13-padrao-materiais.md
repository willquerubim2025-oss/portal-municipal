# Padrão dos materiais: apresentações e guias (D-135, D-136, D-137)

Dois materiais aprovados pelo William em 25/10/2026 são o **molde** para todo sistema novo (portal, painel e satélites como Pesquisas da Educação):

| Tipo | Modelo aprovado | Para quem |
|---|---|---|
| **Apresentação impressa** (vender a ideia) | `Portais-Publicos/docs/portfolio/apresentacao/` (Portal da Educação, 31 págs.) | Secretária, gestores, quem decide |
| **Guia do Usuário** (ensinar a usar) | `ci-eletronica/docs/guia/` (CI Eletrônica, 57 págs.) | Quem vai operar o sistema |

Ao começar o material de um sistema novo, **copie a pasta `fonte/` do modelo** e troque o conteúdo; não comece do zero.

## Regras que valem para os dois
- **A experiência do usuário é o centro**, como nos sistemas. Linguagem simples, sem jargão nas partes para o público.
- **Gerado por código** (Playwright tira as fotos, Python monta o HTML, Chromium gera o PDF A4), para ser refeito quando as telas mudarem. Passo a passo num `LEIA-ME.md` na pasta.
- **Fotos reais** do sistema (publicado ou com dados fictícios), com **números marcados** sobre a imagem e a explicação numerada ao lado. Imagens em JPEG leve; a pasta de imagens fica fora do git, o PDF entra.
- **Visual do próprio sistema:** cores e fontes do produto (no portal: verde #004348, turquesa #24a9b3, salmão #f2c2a9, areia #f7efe6; Raleway + Nunito Sans; ícones em linha).
- **Índice no início**, com o número real das páginas.
- Fotos e nomes fictícios são avisados ("ilustrativos"); dado que falta fica como marcador visível (`[telefone]`) e é avisado ao William.
- Antes de entregar: conferir **todas** as páginas renderizadas (folha de contato em PNG), sem sobra de espaço, sem texto vazando no rodapé.

## Apresentação impressa (vender)
- **Impresso é imediato:** A4, pensado para entregar na mão.
- **Primeiro conquistar, depois a técnica.** Ordem: capa forte (foto de abertura + sistema no computador e no celular) → o problema de hoje (a jornada da pessoa, com tom cuidadoso, sem criticar quem fez o atual) → a virada (o que muda) → índice → o sistema por partes → benefícios para o público → integração com os outros sistemas → o painel/administração ("sem programador") → perguntas (segurança, LGPD, backup, treinamento) → problemas e como resolver → tecnologia (Supabase, RLS, backups) → próximos passos → contracapa com chamada e contato.
- **Telas grandes divididas em partes** (ex.: a página inicial em 4), **alternando** página só de imagem (fundo escuro, moldura de navegador, números) e página de explicação (miniatura + itens numerados + caixa "Por que importa").
- Páginas duplas com colagem de duas telas sobrepostas, cartões de três benefícios e uma frase de efeito em faixa.
- Toda afirmação precisa existir no sistema (conferir antes).

## Guia do Usuário (ensinar)
- **Uma unidade por papel** (ex.: operador, gestor, administrador), com índice no início de cada unidade.
- Passo a passo com fotos numeradas, **fluxogramas** dos processos, **cartões** de atenção, dica e "importante", glossário.
- **"Problemas e o que fazer"** no fim: o erro como a pessoa vê, a causa e a solução, sem culpar a pessoa.
- Funções de administração novas são anotadas durante o desenvolvimento num material de apoio (na CI: `docs/06-material-para-o-guia.md`) para o guia não depender de memória.
