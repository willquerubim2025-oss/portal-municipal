import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

function Cartao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main className="tela-acesso">
      <div className="cartao-acesso">
        <p className="acesso-produto">Portal Municipal · Painel</p>
        <h1>{titulo}</h1>
        {children}
      </div>
    </main>
  );
}

export function Entrar() {
  const { sessao, carregando, entrar } = useAuth();
  const local = useLocation();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (!carregando && sessao) return <Navigate to={(local.state as { de?: string })?.de ?? '/'} replace />;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(await entrar(email.trim(), senha));
    setEnviando(false);
  }

  return (
    <Cartao titulo="Entrar">
      <form onSubmit={enviar} className="formulario">
        <label>E-mail<input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Senha<input type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} /></label>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button className="botao" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
      </form>
      <p><Link to="/esqueci-senha">Esqueci minha senha</Link></p>
    </Cartao>
  );
}

export function EsqueciSenha() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${location.origin}/redefinir-senha`,
    });
    // Mensagem igual com ou sem conta: não revela quais e-mails estão cadastrados.
    if (error && error.status !== 400) setErro('Não foi possível enviar agora. Tente novamente em alguns minutos.');
    else setEnviado(true);
  }

  return (
    <Cartao titulo="Recuperar senha">
      {enviado ? (
        <p role="status">Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.</p>
      ) : (
        <form onSubmit={enviar} className="formulario">
          <label>E-mail<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          {erro && <p className="erro" role="alert">{erro}</p>}
          <button className="botao">Enviar link</button>
        </form>
      )}
      <p><Link to="/entrar">Voltar para o login</Link></p>
    </Cartao>
  );
}

export function RedefinirSenha() {
  const navegar = useNavigate();
  const { sessao } = useAuth();
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (senha.length < 10) return setErro('Use pelo menos 10 caracteres.');
    if (senha !== confirmacao) return setErro('As senhas não conferem.');
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) return setErro('O link expirou ou já foi usado. Peça um novo em "Esqueci minha senha".');
    setPronto(true);
  }

  useEffect(() => { if (pronto) { const t = setTimeout(() => navegar('/'), 1500); return () => clearTimeout(t); } }, [pronto, navegar]);

  // O supabase-js troca o código do link de recuperação por uma sessão ao carregar a página.
  if (!sessao) {
    return <Cartao titulo="Nova senha"><p>Validando o link…</p><p><Link to="/esqueci-senha">Pedir um novo link</Link></p></Cartao>;
  }
  return (
    <Cartao titulo="Nova senha">
      {pronto ? <p role="status">Senha alterada. Entrando…</p> : (
        <form onSubmit={enviar} className="formulario">
          <label>Nova senha<input type="password" autoComplete="new-password" required value={senha} onChange={(e) => setSenha(e.target.value)} /></label>
          <label>Repita a senha<input type="password" autoComplete="new-password" required value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} /></label>
          {erro && <p className="erro" role="alert">{erro}</p>}
          <button className="botao">Salvar senha</button>
        </form>
      )}
    </Cartao>
  );
}

export function EscolherPrefeitura() {
  const { acessos, escolherMunicipio, sessao, carregando } = useAuth();
  const navegar = useNavigate();
  const local = useLocation();
  if (!carregando && !sessao) return <Navigate to="/entrar" replace />;
  return (
    <Cartao titulo="Qual prefeitura você vai editar?">
      <ul className="lista-escolha">
        {acessos.map((a) => (
          <li key={a.municipio.id}>
            <button type="button" className="botao-secundario" onClick={() => {
              escolherMunicipio(a.municipio.id);
              navegar((local.state as { de?: string })?.de ?? '/', { replace: true });
            }}>
              {a.municipio.nome} <small>({a.municipio.uf})</small>
            </button>
          </li>
        ))}
      </ul>
    </Cartao>
  );
}
