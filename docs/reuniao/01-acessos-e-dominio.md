# 1. Acessos e domínio

**Por que importa:** sem o acesso ao domínio não é possível colocar o portal novo no ar, e o prazo de 60 dias só corre depois da entrega dos acessos (TR 6.9.2).

---

## 1.1 Quem administra o domínio jeriquara.sp.gov.br
- **O que precisamos:** nome e contato de quem tem acesso ao **Registro.br** (onde o domínio está registrado) e ao **DNS** (onde ficam os apontamentos do domínio). Às vezes é a própria prefeitura; às vezes, a empresa que mantém o site atual ou o provedor de internet.
- **Quem costuma saber:** TI da prefeitura, Departamento de Administração ou a empresa do site atual.
- **Onde será usado:** para apontar o domínio para o portal novo no dia da troca. É uma alteração de poucos minutos, feita pela pessoa com acesso ou com a SECKE acompanhando.
- **O que muda conforme a resposta:**
  | Situação | O que fazemos |
  |---|---|
  | A prefeitura tem o acesso | No dia da troca, a pessoa cria um apontamento (CNAME) que passamos. O domínio continua no nome da prefeitura |
  | Está com outra empresa | Pedir à prefeitura que solicite à empresa, por escrito, a liberação ou a alteração no dia combinado |
  | Ninguém sabe | Recuperar o acesso pelo Registro.br, com o CNPJ da prefeitura. **Pode levar dias: começar logo** |
- **Bloqueia?** **Sim**, a publicação. O desenvolvimento e os testes continuam na homologação.
- **Resposta:** ____________________________________________

## 1.2 Endereço oficial: com ou sem "www"
- **O que precisamos:** qual endereço é o oficial: `jeriquara.sp.gov.br` ou `www.jeriquara.sp.gov.br`. O outro passa a redirecionar automaticamente para ele.
- **Onde será usado:** no cadastro de domínios do sistema (domínio "principal"), no Google (endereço que aparece na busca) e nos links compartilhados.
- **O que muda conforme a resposta:** só um ajuste de cadastro. O sistema já redireciona o endereço secundário. **Recomendação:** manter o que o site atual usa hoje (`www.jeriquara.sp.gov.br`), para não alterar o que já está no Google.
- **Bloqueia?** Não; tem padrão recomendado.
- **Resposta:** ( ) com www  ( ) sem www

## 1.3 Google Search Console
- **O que precisamos:** saber se a prefeitura já usa o Google Search Console no site atual. Se usa, precisamos ser adicionados como usuários. Se não usa, criamos um no dia da troca (exige o acesso ao DNS do item 1.1).
- **Onde será usado:** acompanhar se o Google entendeu a troca de site (redirecionamentos, páginas indexadas, erros) nas semanas seguintes. Evita que a prefeitura "suma" da busca.
- **O que muda conforme a resposta:** nada no sistema; o código de verificação é cadastrado no painel (Identidade visual e dados → Google).
- **Bloqueia?** Não, mas é importante para a troca.
- **Resposta:** ____________________________________________

## 1.4 Acesso de administrador ao WordPress atual
- **O que precisamos:** um usuário de administrador no WordPress do site atual (pode ser temporário) **ou** uma cópia do banco de dados e da pasta de arquivos.
- **Por quê:** a parte pública do site mostra 6.547 arquivos, mas o próprio WordPress informa 7.247. Uns **700 arquivos** só aparecem com acesso de administrador (provavelmente ligados a conteúdo não publicado ou privado).
- **Onde será usado:** na ferramenta de migração, para trazer esses arquivos e conferir o que é privado.
- **O que muda conforme a resposta:**
  | Situação | Efeito |
  |---|---|
  | Acesso concedido | Migramos tudo e a prefeitura decide o que é privado |
  | Sem acesso | Migramos só o que é público; os ~700 arquivos ficam de fora (podem ser enviados depois pelo painel) |
- **Bloqueia?** Não; a migração do conteúdo público segue.
- **Resposta:** ____________________________________________

## 1.5 Contatos técnicos
- **O que precisamos:** nome, e-mail e telefone de quem responde pela **TI da prefeitura** e de quem mantém o **site atual** (empresa ou servidor).
- **Onde será usado:** para combinar a troca do domínio e eventuais bloqueios de rede (alguns órgãos bloqueiam sites novos no firewall).
- **Bloqueia?** Não.
- **Resposta:** ____________________________________________
