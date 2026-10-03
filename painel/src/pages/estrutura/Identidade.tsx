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
  const cfg = (k: string) => (config[k] as string) ?? '';
  const setCfg = (k: string, v: unknown) => setConfig((c) => ({ ...c, [k]: v }));

  async function salvar(ev: FormEvent) {
    ev.preventDefault(); setErro(null); setAviso(null);
    if (!COR_VALIDA.test(primaria) || !COR_VALIDA.test(secundaria)) return setErro('As cores devem estar no formato #RRGGBB.');
    if (cPrimaria < 4.5) return setErro(`A cor principal é clara demais: o texto branco do cabeçalho ficaria ilegível (contraste ${cPrimaria.toFixed(1)}:1; o mínimo é 4,5:1).`);
    if (cSecundaria < 4.5) return setErro(`A cor de destaque é escura demais para o texto escuro dos botões (contraste ${cSecundaria.toFixed(1)}:1; o mínimo é 4,5:1).`);
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
        Contraste {c ? c.toFixed(1) : '—'}:1 {ok ? '✓ adequado' : '✗ abaixo do mínimo de 4,5:1'}
      </small>
    </div>
  );
}
