// "Meus sistemas" (D-94): atalhos para os sistemas que o servidor usa no trabalho (sistemas_externos com
// publico = 'servidor'), filtrados pelos papéis dele no banco (meus_sistemas, 0025). Sem nenhum, não aparece.
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Sistema { id: string; nome: string; fornecedor: string | null; url: string | null; descricao: string | null }

export function MeusSistemas({ municipioId }: { municipioId: string }) {
  const [lista, setLista] = useState<Sistema[] | null>(null);
  // Sistema "em breve" ainda sem endereço fica de fora (D-122).
  useEffect(() => {
    let ativo = true;
    supabase.rpc('meus_sistemas', { p_municipio: municipioId }).then(({ data }) => { if (ativo) setLista(((data ?? []) as Sistema[]).filter((s) => s.url)); });
    return () => { ativo = false; };
  }, [municipioId]);
  if (!lista?.length) return null;
  return (
    <section aria-labelledby="t-meus-sistemas">
      <h2 id="t-meus-sistemas">Meus sistemas</h2>
      <ul className="meus-sistemas">
        {lista.map((s) => (
          <li key={s.id}>
            <a href={s.url!} target="_blank" rel="noopener">
              <strong>{s.nome}</strong>
              {(s.descricao || s.fornecedor) && <span>{s.descricao || s.fornecedor}</span>}
              <span className="sr-only"> (abre em nova aba)</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
