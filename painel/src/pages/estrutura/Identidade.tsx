// Identidade visual e dados institucionais do município (municipios.tema / municipios.config).
// Personalização nível 1 da D-17. Contraste mínimo WCAG AA (4,5:1) é obrigatório.
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { mensagemErro, supabase, urlMidia } from '../../lib/supabase';
import type { Midia } from '../../lib/midias';
import { CampoImagem } from '../../components/CampoImagem';

const MODULOS: [string, string][] = [
  ['estrutura_organizacional', 'Estrutura organizacional'], ['perguntas_frequentes', 'Perguntas frequentes'], ['agenda', 'Agenda'],
  ['galeria', 'Galeria de fotos'], ['destaques', 'Banners e alertas'], ['legislacao', 'Legislação'], ['carta_servicos', 'Carta de Serviços'],
];
const REDES: [string, string][] = [
  ['facebook', 'Facebook'], ['instagram', 'Instagram'], ['youtube', 'YouTube'], ['x', 'X (Twitter)'], ['tiktok', 'TikTok'], ['linkedin', 'LinkedIn'], ['whatsapp', 'WhatsApp (link wa.me)'],
];
const PADRAO = { primaria: '#0b4f8a', secundaria: '#f2b705' };

/** Razão de contraste WCAG entre duas cores #rrggbb. */
export function contraste(a: string, b: string): number {
  const lum = (hex: string) => {
    const c = hex.replace('#', '').match(/../g)!.map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
const COR_VALIDA = /^#[0-9a-f]{6}$/i;
/** Razão com uma casa, arredondada para baixo: 4,49 aparece como 4,4 (e não 4,5, que passaria). */
const fmt = (c: number) => (Math.floor(c * 10) / 10).toFixed(1);
const TEXTO_ESCURO = '#1d2733';
interface Paleta { nome?: string; forte: string; claro: string }

/**
 * Cores do layout vitrine (D-17, D-39) e contra o que cada uma é lida no portal.
 * Mínimo de 4,5:1 (WCAG AA, texto comum), como as cores principais. Vazia = padrão do layout.
 */
function paresVitrine(t: Record<string, any>, primaria: string) {
  return [
    { chave: 'cor_secundaria_escura', rotulo: 'Destaque escuro (rótulos, links e botões com texto branco)', contra: '#ffffff', contraNome: 'branco' },
    { chave: 'cor_acento', rotulo: 'Cor de acento (botão do destaque, faixa de aviso)', contra: primaria, contraNome: 'a cor principal' },
    { chave: 'cor_regua', rotulo: 'Fundo dos títulos das seções', contra: TEXTO_ESCURO, contraNome: 'o texto escuro' },
    { chave: 'cor_barra_acessibilidade', rotulo: 'Barra de acessibilidade do topo (texto branco; vazia = cor do cabeçalho)', contra: '#ffffff', contraNome: 'o texto branco' },
    { chave: 'cor_fundo_pagina', rotulo: 'Fundo da página inicial (vazio = branco)', contra: primaria, contraNome: 'a cor principal (títulos das seções)' },
    { chave: 'cor_calendario', rotulo: 'Dias com evento no calendário (vazia = cor dos títulos)', contra: primaria, contraNome: 'a cor principal (número do dia)' },
    { chave: 'moldura_destaque', rotulo: 'Moldura do destaque da página inicial (vazia = sem moldura)', contra: '#ffffff', contraNome: 'o fundo branco da página' },
    { chave: 'cor_cabecalho', rotulo: 'Fundo do cabeçalho', contra: t.cor_cabecalho_texto && COR_VALIDA.test(t.cor_cabecalho_texto) ? t.cor_cabecalho_texto : '#ffffff', contraNome: 'o texto do cabeçalho' },
    { chave: 'cor_cabecalho_texto', rotulo: 'Texto do cabeçalho', contra: t.cor_cabecalho && COR_VALIDA.test(t.cor_cabecalho) ? t.cor_cabecalho : primaria, contraNome: 'o fundo do cabeçalho' },
  ];
}
/** Problemas de contraste das cores do layout e das paletas de cards (vazio = tudo certo). */
export function problemasContraste(t: Record<string, any>, primaria: string): string[] {
  const p: string[] = [];
  for (const c of paresVitrine(t, primaria)) {
    const v = t[c.chave];
    if (!v) continue;
    if (!COR_VALIDA.test(v)) { p.push(`${c.rotulo}: use o formato #RRGGBB.`); continue; }
    const r = contraste(v, c.contra);
    if (r < 4.5) p.push(`${c.rotulo}: contraste ${fmt(r)}:1 com ${c.contraNome} (mínimo 4,5:1).`);
  }
  for (const [chave, nome] of [['cores_cards', 'Cards de Serviços'], ['cores_vivas', 'Cores dos blocos']] as const) {
    ((t[chave] ?? []) as Paleta[]).forEach((c, i) => {
      const quem = `${nome}, cor ${c.nome ?? i + 1}`;
      if (!COR_VALIDA.test(c.forte) || !COR_VALIDA.test(c.claro)) { p.push(`${quem}: use o formato #RRGGBB.`); return; }
      const sobreClaro = contraste(c.forte, c.claro), comBranco = contraste(c.forte, '#ffffff');
      if (sobreClaro < 4.5) p.push(`${quem}: texto forte sobre o fundo claro com contraste ${fmt(sobreClaro)}:1 (mínimo 4,5:1).`);
      if (comBranco < 4.5) p.push(`${quem}: branco sobre a cor forte com contraste ${fmt(comBranco)}:1 (mínimo 4,5:1).`);
    });
  }
  return p;
}

export function Identidade() {
  const { atual } = useAuth();
  const mid = atual!.municipio.id;
  const [carregando, setCarregando] = useState(true);
  const [nome, setNome] = useState('');
  const [tema, setTema] = useState<Record<string, any>>({});
  const [config, setConfig] = useState<Record<string, any>>({});
  const [brasao, setBrasao] = useState<Midia | null>(null);
  const [imagemOg, setImagemOg] = useState<Midia | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    supabase.from('municipios').select('nome, tema, config').eq('id', mid).single().then(async ({ data, error }) => {
      if (error || !data) { setErro(mensagemErro(error)); setCarregando(false); return; }
      setNome(data.nome); setTema(data.tema ?? {}); setConfig(data.config ?? {});
      // Brasão e imagem de compartilhamento ficam como caminho no tema/config; busca a mídia para mostrar.
      const caminhos = [data.tema?.brasao_path, data.config?.seo?.imagem_compartilhamento_path].filter(Boolean);
      if (caminhos.length) {
        const { data: ms } = await supabase.from('midias').select('id, storage_path, nome_original, mime_type, texto_alternativo').in('storage_path', caminhos);
        setBrasao(ms?.find((m) => m.storage_path === data.tema?.brasao_path) ?? null);
        setImagemOg(ms?.find((m) => m.storage_path === data.config?.seo?.imagem_compartilhamento_path) ?? null);
      }
      setCarregando(false);
    });
  }, [mid]);

  const primaria = tema.cor_primaria ?? PADRAO.primaria;
  const secundaria = tema.cor_secundaria ?? PADRAO.secundaria;
  const cPrimaria = COR_VALIDA.test(primaria) ? contraste(primaria, '#ffffff') : 0;
  const cSecundaria = COR_VALIDA.test(secundaria) ? contraste(secundaria, '#1d2733') : 0;
  const vitrine = tema.layout === 'vitrine';
  const problemasLayout = vitrine ? problemasContraste(tema, primaria) : [];
  const cfg = (k: string) => (config[k] as string) ?? '';
  const setCfg = (k: string, v: unknown) => setConfig((c) => ({ ...c, [k]: v }));

  async function salvar(ev: FormEvent) {
    ev.preventDefault(); setErro(null); setAviso(null);
    if (!COR_VALIDA.test(primaria) || !COR_VALIDA.test(secundaria)) return setErro('As cores devem estar no formato #RRGGBB.');
    if (cPrimaria < 4.5) return setErro(`A cor principal é clara demais: o texto branco do cabeçalho ficaria ilegível (contraste ${fmt(cPrimaria)}:1; o mínimo é 4,5:1).`);
    if (cSecundaria < 4.5) return setErro(`A cor de destaque é escura demais para o texto escuro dos botões (contraste ${fmt(cSecundaria)}:1; o mínimo é 4,5:1).`);
    if (problemasLayout.length) return setErro(`Ajuste as cores do layout: ${problemasLayout.join(' ')}`);
    if (cfg('email') && !/^\S+@\S+\.\S+$/.test(cfg('email'))) return setErro('E-mail inválido.');
    const redes = Object.fromEntries(Object.entries(config.redes ?? {}).filter(([, v]) => typeof v === 'string' && v.trim()).map(([k, v]) => [k, (v as string).trim()]));
    for (const [k, v] of Object.entries(redes)) if (!/^https:\/\//.test(v as string)) return setErro(`O link do ${k} deve começar com https://.`);
    const novoTema = { ...tema, cor_primaria: primaria, cor_secundaria: secundaria, brasao_path: brasao?.storage_path ?? undefined };
    const novoConfig = {
      ...config, redes,
      seo: { ...(config.seo ?? {}), imagem_compartilhamento_path: imagemOg?.storage_path ?? undefined, google_site_verification: config.seo?.google_site_verification?.trim() || undefined },
    };
    setSalvando(true);
    const { error } = await supabase.from('municipios').update({ tema: novoTema, config: novoConfig }).eq('id', mid);
    setSalvando(false);
    if (error) setErro(mensagemErro(error)); else setAviso('Identidade salva. O portal atualiza em até 1 minuto.');
  }

  if (carregando) return <p role="status">Carregando…</p>;
  return (
    <form onSubmit={salvar} className="formulario-conteudo" noValidate>
      <div className="cabecalho-tela"><div><h1>Identidade visual e dados</h1><p className="meta">{nome}</p></div></div>
      <div aria-live="polite">{erro && <p className="erro" role="alert">{erro}</p>}{aviso && <p className="sucesso" role="status">{aviso}</p>}</div>

      <section className="secao-filha" aria-labelledby="t-cores">
        <h2 id="t-cores">Cores e brasão</h2>
        <div className="previa-cabecalho" style={{ background: primaria }} aria-label="Prévia do cabeçalho do portal">
          {brasao && <img src={urlMidia(brasao.storage_path)!} alt="" />}
          <span><small>Prefeitura de</small><strong>{cfg('nome_curto') || nome.replace(/^Prefeitura( Municipal)? d[eoa]s? /i, '')}</strong></span>
          <span className="previa-botao" style={{ background: secundaria }}>Buscar</span>
        </div>
        <div className="linha-campos">
          <CampoCor rotulo="Cor principal (cabeçalho)" valor={primaria} contraste={cPrimaria} aoMudar={(v) => setTema({ ...tema, cor_primaria: v })} />
          <CampoCor rotulo="Cor de destaque (botões, faixas)" valor={secundaria} contraste={cSecundaria} aoMudar={(v) => setTema({ ...tema, cor_secundaria: v })} />
        </div>
        <div className="linha-campos">
          <CampoImagem rotulo="Brasão (PNG com fundo transparente)" municipioId={mid} midia={brasao} aoMudar={setBrasao} />
          <CampoImagem rotulo="Imagem padrão de compartilhamento (WhatsApp, 1200 × 630)" municipioId={mid} midia={imagemOg} aoMudar={setImagemOg} />
        </div>
      </section>

      {vitrine && (
        <section className="secao-filha" aria-labelledby="t-cores-layout">
          <h2 id="t-cores-layout">Cores do layout</h2>
          <p className="meta">Cada cor é conferida contra o texto que aparece sobre ela no portal (mínimo 4,5:1, WCAG AA). Campo vazio usa o padrão do layout.</p>
          <div className="grade-cores">
            {paresVitrine(tema, primaria).map((c) => (
              <CampoCorOpcional key={c.chave} rotulo={c.rotulo} valor={tema[c.chave] ?? ''} contra={c.contra} contraNome={c.contraNome}
                aoMudar={(v) => setTema((t) => { const n = { ...t }; if (v) n[c.chave] = v; else delete n[c.chave]; return n; })} />
            ))}
          </div>
          {(['cores_cards', 'cores_vivas'] as const).map((chave) => (tema[chave] ?? []).length > 0 && (
            <fieldset key={chave} className="paleta-cores">
              <legend>{chave === 'cores_cards' ? 'Cards de Serviços' : 'Cores dos blocos (Em foco, Eventos)'}</legend>
              <table className="tabela tabela-compacta">
                <caption className="sr-only">Contraste de cada par de cores</caption>
                <thead><tr><th scope="col">Cor</th><th scope="col">Forte</th><th scope="col">Claro</th><th scope="col">Texto forte sobre o claro</th><th scope="col">Branco sobre o forte</th></tr></thead>
                <tbody>{(tema[chave] as Paleta[]).map((c, i) => {
                  const mudarPar = (campo: 'forte' | 'claro', v: string) => setTema((t) => ({ ...t, [chave]: (t[chave] as Paleta[]).map((x, j) => (j === i ? { ...x, [campo]: v } : x)) }));
                  return (
                    <tr key={i}>
                      <th scope="row">{c.nome ?? i + 1}</th>
                      {(['forte', 'claro'] as const).map((campo) => (
                        <td key={campo}><span className="campo-cor"><input type="color" value={COR_VALIDA.test(c[campo]) ? c[campo] : '#000000'} aria-label={`${c.nome ?? i + 1}: cor ${campo}`}
                          onChange={(e) => mudarPar(campo, e.target.value)} /> <code>{c[campo]}</code></span></td>
                      ))}
                      <td><Razao a={c.forte} b={c.claro} /></td>
                      <td><Razao a={c.forte} b="#ffffff" /></td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </fieldset>
          ))}
          {problemasLayout.length > 0 && (
            <div className="erro" role="status"><strong>Contraste insuficiente:</strong><ul>{problemasLayout.map((p) => <li key={p}>{p}</li>)}</ul></div>
          )}
        </section>
      )}

      <section className="secao-filha" aria-labelledby="t-dados">
        <h2 id="t-dados">Dados da prefeitura (rodapé e Google)</h2>
        <div className="linha-campos">
          <label>Nome curto<input value={cfg('nome_curto')} onChange={(e) => setCfg('nome_curto', e.target.value)} placeholder="Ex.: Jeriquara" /></label>
          <label>Slogan / descrição<input value={cfg('slogan')} onChange={(e) => setCfg('slogan', e.target.value)} /></label>
        </div>
        <label>Endereço<input value={cfg('endereco')} onChange={(e) => setCfg('endereco', e.target.value)} /></label>
        <div className="linha-campos">
          <label>Telefone<input type="tel" value={cfg('telefone')} onChange={(e) => setCfg('telefone', e.target.value)} /></label>
          <label>E-mail<input type="email" value={cfg('email')} onChange={(e) => setCfg('email', e.target.value)} /></label>
          <label>Horário de atendimento<input value={cfg('horario')} onChange={(e) => setCfg('horario', e.target.value)} /></label>
          <label>CNPJ<input value={cfg('cnpj')} onChange={(e) => setCfg('cnpj', e.target.value)} /></label>
        </div>
      </section>

      <section className="secao-filha" aria-labelledby="t-redes">
        <h2 id="t-redes">Redes sociais</h2>
        <div className="linha-campos">
          {REDES.map(([k, r]) => (
            <label key={k}>{r}<input type="url" value={config.redes?.[k] ?? ''} placeholder="https://"
              onChange={(e) => setCfg('redes', { ...(config.redes ?? {}), [k]: e.target.value })} /></label>
          ))}
        </div>
      </section>

      <section className="secao-filha" aria-labelledby="t-modulos">
        <h2 id="t-modulos">Módulos do portal</h2>
        <p className="meta">Módulo desligado some do menu, do mapa do site e responde "página não encontrada".</p>
        <div className="grade-opcoes">
          {MODULOS.map(([k, r]) => (
            <label key={k} className="opcao"><input type="checkbox" checked={config.modulos?.[k] !== false}
              onChange={(e) => setCfg('modulos', { ...(config.modulos ?? {}), [k]: e.target.checked })} /> {r}</label>
          ))}
        </div>
      </section>

      <section className="secao-filha" aria-labelledby="t-navegacao">
        <h2 id="t-navegacao">Navegação</h2>
        <label className="opcao"><input type="checkbox" checked={config.migalhas !== false} onChange={(e) => setCfg('migalhas', e.target.checked ? undefined : false)} />
          {' '}Mostrar a trilha de navegação no topo das páginas internas (Início › Serviços › …)</label>
      </section>

      <section className="secao-filha" aria-labelledby="t-google">
        <h2 id="t-google">Google</h2>
        <div className="campo">
          <label>Código de verificação do Search Console<input value={config.seo?.google_site_verification ?? ''} aria-describedby="ajuda-gsc"
            onChange={(e) => setCfg('seo', { ...(config.seo ?? {}), google_site_verification: e.target.value })} /></label>
          <small id="ajuda-gsc">No Search Console, escolha a verificação por "tag HTML" e cole só o conteúdo do atributo content.</small>
        </div>
      </section>

      <div className="barra-acoes"><button className="botao" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar identidade'}</button></div>
    </form>
  );
}

function CampoCor({ rotulo, valor, contraste: c, aoMudar }: { rotulo: string; valor: string; contraste: number; aoMudar: (v: string) => void }) {
  const ok = c >= 4.5;
  const id = rotulo.replace(/\W+/g, '-');
  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      <span className="campo-cor">
        <input type="color" value={COR_VALIDA.test(valor) ? valor : '#000000'} onChange={(e) => aoMudar(e.target.value)} aria-label={`${rotulo}: seletor`} />
        <input id={id} value={valor} onChange={(e) => aoMudar(e.target.value.trim())} maxLength={7} aria-describedby={`${id}-c`} />
      </span>
      <small id={`${id}-c`} className={ok ? 'contraste-ok' : 'contraste-ruim'}>
        Contraste {c ? fmt(c) : '—'}:1 {ok ? '✓ adequado' : '✗ abaixo do mínimo de 4,5:1'}
      </small>
    </div>
  );
}

function Razao({ a, b }: { a: string; b: string }) {
  const c = COR_VALIDA.test(a) && COR_VALIDA.test(b) ? contraste(a, b) : 0;
  const ok = c >= 4.5;
  return <span className={ok ? 'contraste-ok' : 'contraste-ruim'}>{c ? fmt(c) : '—'}:1 {ok ? '✓' : '✗'}<span className="sr-only">{ok ? ' adequado' : ' abaixo do mínimo de 4,5:1'}</span></span>;
}

/** Cor que pode ficar vazia (usa o padrão do layout); mostra o contraste com o que vai sobre ela. */
function CampoCorOpcional({ rotulo, valor, contra, contraNome, aoMudar }: { rotulo: string; valor: string; contra: string; contraNome: string; aoMudar: (v: string) => void }) {
  const id = rotulo.replace(/\W+/g, '-');
  const valida = COR_VALIDA.test(valor);
  const c = valida && COR_VALIDA.test(contra) ? contraste(valor, contra) : 0;
  const ok = c >= 4.5;
  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      <span className="campo-cor">
        <input type="color" value={valida ? valor : '#ffffff'} onChange={(e) => aoMudar(e.target.value)} aria-label={`${rotulo}: seletor`} />
        <input id={id} value={valor} placeholder="padrão" onChange={(e) => aoMudar(e.target.value.trim())} maxLength={7} aria-describedby={`${id}-c`} />
        {valor && <button type="button" className="botao-link" onClick={() => aoMudar('')}>Usar o padrão<span className="sr-only"> em {rotulo}</span></button>}
      </span>
      <small id={`${id}-c`} className={!valor ? undefined : ok ? 'contraste-ok' : 'contraste-ruim'}>
        {!valor ? 'Usando o padrão do layout.' : !valida ? 'Formato: #RRGGBB.' : `Contraste ${fmt(c)}:1 com ${contraNome} ${ok ? '✓ adequado' : '✗ abaixo do mínimo de 4,5:1'}`}
      </small>
    </div>
  );
}
