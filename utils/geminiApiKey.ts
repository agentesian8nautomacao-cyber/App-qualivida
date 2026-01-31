/**
 * Retorna a chave da API Gemini a partir das variáveis de ambiente.
 * Aceita: process.env.API_KEY (injetado pelo Vite define), VITE_GEMINI_API_KEY ou VITE_API_KEY.
 */
export function getGeminiApiKey(): string | undefined {
  const fromProcess = typeof process !== 'undefined' && process.env?.API_KEY;
  const fromMeta =
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    (import.meta.env.VITE_GEMINI_API_KEY ?? import.meta.env.VITE_API_KEY);
  const value = (fromProcess ?? fromMeta) as string | undefined;
  if (value == null || typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}
