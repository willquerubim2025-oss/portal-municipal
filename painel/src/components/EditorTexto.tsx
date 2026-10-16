// Editor de texto formatado (TipTap). Restrições propositais, por acessibilidade (eMAG/WCAG):
// - títulos só H2/H3 (o H1 da página é o título do conteúdo);
// - toda imagem exige texto alternativo;
// - sem cores/fontes livres (a identidade vem do tema do portal).
// O portal ainda sanitiza o HTML na saída (htmlSeguro), então isto não é a barreira de segurança.
import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { enviarMidia, type Midia } from '../lib/midias';
import { BibliotecaMidias } from './BibliotecaMidias';
import { mensagemErro, urlMidia } from '../lib/supabase';

interface Props {
  rotulo: string;
  valor: string;
  aoMudar: (html: string) => void;
  municipioId: string;
  desabilitado?: boolean;
}

export function EditorTexto({ rotulo, valor, aoMudar, municipioId, desabilitado = false }: Props) {
  const arquivo = useRef<HTMLInputElement>(null);
  const [biblioteca, setBiblioteca] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
      Image.configure({ inline: false }),
    ],
    content: valor,
    editable: !desabilitado,
    editorProps: { attributes: { class: 'editor-area', 'aria-label': rotulo, role: 'textbox', 'aria-multiline': 'true' } },
    onUpdate: ({ editor: e }) => aoMudar(e.isEmpty ? '' : e.getHTML()),
  });

  useEffect(() => { editor?.setEditable(!desabilitado); }, [editor, desabilitado]);

  const estado = useEditorState({
    editor,
    selector: ({ editor: e }) => e ? {
      negrito: e.isActive('bold'), italico: e.isActive('italic'), sublinhado: e.isActive('underline'),
      h2: e.isActive('heading', { level: 2 }), h3: e.isActive('heading', { level: 3 }),
      lista: e.isActive('bulletList'), numerada: e.isActive('orderedList'), citacao: e.isActive('blockquote'),
      link: e.isActive('link'),
    } : null,
  });

  if (!editor) return null;
  const cmd = () => editor.chain().focus();

  function link() {
    const atual = editor!.getAttributes('link').href as string | undefined;
    const url = window.prompt('Endereço do link (deixe vazio para remover):', atual ?? 'https://');
    if (url === null) return;
    if (!url.trim() || url === 'https://') cmd().extendMarkRange('link').unsetLink().run();
    else cmd().extendMarkRange('link').setLink({ href: url.trim() }).run();
  }

  async function imagem(f: File | undefined) {
    if (!f) return;
    const alt = window.prompt('Descreva a imagem para quem não pode vê-la (texto alternativo, obrigatório):');
    if (!alt?.trim()) { alert('A imagem não foi inserida: o texto alternativo é obrigatório.'); return; }
    try {
      const m = await enviarMidia(municipioId, f, alt.trim());
      cmd().setImage({ src: urlMidia(m.storage_path)!, alt: alt.trim() }).run();
    } catch (e) { alert(`Não foi possível enviar a imagem: ${mensagemErro(e)}`); }
  }

  /** Imagem já enviada, da biblioteca (D-92). Sem descrição cadastrada, pede uma (obrigatória). */
  function daBiblioteca(m: Midia) {
    const alt = m.texto_alternativo?.trim()
      || window.prompt('Descreva a imagem para quem não pode vê-la (texto alternativo, obrigatório):')?.trim();
    if (!alt) { alert('A imagem não foi inserida: o texto alternativo é obrigatório.'); return; }
    cmd().setImage({ src: urlMidia(m.storage_path)!, alt }).run();
  }

  const Botao = ({ ativo, onClick, children, titulo }: { ativo?: boolean; onClick: () => void; children: React.ReactNode; titulo: string }) => (
    <button type="button" title={titulo} aria-label={titulo} aria-pressed={ativo} disabled={desabilitado}
      className={ativo ? 'ativo' : undefined} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>{children}</button>
  );

  return (
    <div className="editor">
      <div className="editor-barra" role="toolbar" aria-label={`Formatação: ${rotulo}`}>
        <Botao titulo="Negrito" ativo={estado?.negrito} onClick={() => cmd().toggleBold().run()}><b>N</b></Botao>
        <Botao titulo="Itálico" ativo={estado?.italico} onClick={() => cmd().toggleItalic().run()}><i>I</i></Botao>
        <Botao titulo="Sublinhado" ativo={estado?.sublinhado} onClick={() => cmd().toggleUnderline().run()}><u>S</u></Botao>
        <span className="separador" />
        <Botao titulo="Título de seção" ativo={estado?.h2} onClick={() => cmd().toggleHeading({ level: 2 }).run()}>T2</Botao>
        <Botao titulo="Subtítulo" ativo={estado?.h3} onClick={() => cmd().toggleHeading({ level: 3 }).run()}>T3</Botao>
        <Botao titulo="Lista" ativo={estado?.lista} onClick={() => cmd().toggleBulletList().run()}>• Lista</Botao>
        <Botao titulo="Lista numerada" ativo={estado?.numerada} onClick={() => cmd().toggleOrderedList().run()}>1. Lista</Botao>
        <Botao titulo="Citação" ativo={estado?.citacao} onClick={() => cmd().toggleBlockquote().run()}>“ ”</Botao>
        <span className="separador" />
        <Botao titulo="Link" ativo={estado?.link} onClick={link}>Link</Botao>
        <Botao titulo="Inserir imagem (enviar arquivo)" onClick={() => arquivo.current?.click()}>Imagem</Botao>
        <Botao titulo="Inserir imagem da biblioteca" onClick={() => setBiblioteca(true)}>Da biblioteca</Botao>
        <span className="separador" />
        <Botao titulo="Desfazer" onClick={() => cmd().undo().run()}>↶</Botao>
        <Botao titulo="Refazer" onClick={() => cmd().redo().run()}>↷</Botao>
        <input ref={arquivo} type="file" accept="image/*" hidden onChange={(e) => { imagem(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      <EditorContent editor={editor} />
      <BibliotecaMidias municipioId={municipioId} aberta={biblioteca} aoFechar={() => setBiblioteca(false)} aoEscolher={daBiblioteca} />
    </div>
  );
}
