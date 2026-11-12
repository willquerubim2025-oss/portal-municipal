// Recebe o formulário do bloco "avaliacao" (D-136) e grava pela função registrar_avaliacao (o banco confere
// a organização, a nota e os tamanhos). Volta para a página inicial com o resultado em ?avaliacao=.
import type { APIRoute } from 'astro';
import { supabase } from '../lib/supabase';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const { municipio } = locals.contexto;
  let resultado = 'erro';
  try {
    const dados = await request.formData();
    const nota = Number(dados.get('nota'));
    const texto = (c: string, max: number) => String(dados.get(c) ?? '').trim().slice(0, max) || null;
    if (Number.isInteger(nota) && nota >= 1 && nota <= 5) {
      const { error } = await supabase().rpc('registrar_avaliacao', {
        p_municipio: municipio.id, p_nota: nota, p_protocolo: texto('protocolo', 40), p_comentario: texto('comentario', 1000),
      });
      if (!error) resultado = 'ok';
    }
  } catch { /* formulário inválido: volta com erro */ }
  return redirect(`/?avaliacao=${resultado}#avaliacao`, 303);
};

export const GET: APIRoute = ({ redirect }) => redirect('/#avaliacao', 302);
