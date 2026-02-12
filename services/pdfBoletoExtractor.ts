import * as pdfjsLib from 'pdfjs-dist';
// Vite vai transformar isso em URL do worker
// @ts-ignore
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export interface ExtractedBoletoFields {
  cpf?: string; // apenas dígitos
  unidade?: string; // ex: "03/005" ou "101A"
  nome?: string;
  nossoNumero?: string;
  vencimento?: string; // dd/mm/yyyy
  valor?: number; // número em reais
  referencia?: string; // mm/yyyy
  codigoBarras?: string; // apenas dígitos (44-48)
}

function onlyDigits(v: string) {
  return (v || '').replace(/\D+/g, '');
}

function parseMoneyBR(value: string): number | undefined {
  const raw = (value || '').trim();
  if (!raw) return undefined;
  // remove R$, espaços e normaliza separadores
  const cleaned = raw
    .replace(/R\$\s?/gi, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.]/g, '');
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

function normalizeRefMonth(v: string): string | undefined {
  const s = (v || '').trim();
  if (!s) return undefined;
  // aceita 1/2026, 01-2026, 01/2026
  const m = s.match(/(\d{1,2})\s*[\/\-]\s*(\d{4})/);
  if (!m) return undefined;
  const mm = m[1].padStart(2, '0');
  const yy = m[2];
  return `${mm}/${yy}`;
}

function normalizeDateBR(v: string): string | undefined {
  const s = (v || '').trim();
  if (!s) return undefined;
  const m = s.match(/(\d{1,2})\s*[\/\-]\s*(\d{1,2})\s*[\/\-]\s*(\d{4})/);
  if (!m) return undefined;
  const dd = m[1].padStart(2, '0');
  const mm = m[2].padStart(2, '0');
  const yy = m[3];
  return `${dd}/${mm}/${yy}`;
}

export async function extractTextFromPdf(file: File): Promise<string> {
  // configurar worker
  // @ts-ignore
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;

  const parts: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((it: any) => (typeof it.str === 'string' ? it.str : ''))
      .filter(Boolean)
      .join(' ');
    parts.push(pageText);
  }
  return parts.join('\n');
}

export function extractFieldsFromBoletoText(text: string): ExtractedBoletoFields {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  const out: ExtractedBoletoFields = {};

  // CPF (pode vir como CPF/CNPJ)
  const cpfMatch =
    t.match(/CPF\s*\/\s*CNPJ\s*[:\-]?\s*([\d.\-]{11,18})/i) ||
    t.match(/CPF\s*[:\-]?\s*([\d.\-]{11,18})/i);
  if (cpfMatch?.[1]) out.cpf = onlyDigits(cpfMatch[1]);

  // Unidade (tenta vários formatos)
  const unidadeMatch =
    t.match(/Unidade\s*[:\-]?\s*([0-9]{1,3}\s*\/\s*[0-9]{1,3})/i) ||
    t.match(/Unidade\s*[:\-]?\s*([0-9]{1,3}[A-Z]{0,2})/i) ||
    t.match(/\b([0-9]{2}\s*\/\s*[0-9]{3})\b/); // fallback direto
  if (unidadeMatch?.[1]) out.unidade = unidadeMatch[1].replace(/\s+/g, '');

  // Nosso número
  const nnMatch =
    t.match(/Nosso\s*N[úu]mero\s*[:\-]?\s*([\d.\-\/]+)/i) ||
    t.match(/Nosso\s*Numero\s*[:\-]?\s*([\d.\-\/]+)/i);
  if (nnMatch?.[1]) out.nossoNumero = nnMatch[1].trim();

  // Vencimento
  const vencMatch =
    t.match(/Vencimento\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i) ||
    t.match(/Venc\.?\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i);
  if (vencMatch?.[1]) out.vencimento = normalizeDateBR(vencMatch[1]);

  // Referência / Competência
  const refMatch =
    t.match(/Compet[êe]ncia\s*[:\-]?\s*(\d{1,2}[\/\-]\d{4})/i) ||
    t.match(/Refer[êe]ncia\s*[:\-]?\s*(\d{1,2}[\/\-]\d{4})/i) ||
    t.match(/\b(\d{1,2}[\/\-]\d{4})\b/);
  if (refMatch?.[1]) out.referencia = normalizeRefMonth(refMatch[1]);

  // Valor (tentativas comuns)
  const valorMatch =
    t.match(/Valor\s*(?:do\s*Documento)?\s*[:\-]?\s*R?\$?\s*([\d.]+,\d{2})/i) ||
    t.match(/\bR\$\s*([\d.]+,\d{2})\b/i);
  if (valorMatch?.[1]) out.valor = parseMoneyBR(valorMatch[1]);

  // Nome (quando existe "Nome:")
  const nomeMatch = t.match(/Nome\s*[:\-]?\s*([A-ZÀ-Ü\s]{8,})/i);
  if (nomeMatch?.[1]) out.nome = nomeMatch[1].trim();

  // Código de barras / linha digitável (pega maior sequência de dígitos 44-48)
  const digitRuns = (text || '')
    .split(/[\s]+/)
    .map(s => onlyDigits(s))
    .filter(s => s.length >= 20); // reduz ruído

  const candidates: string[] = [];
  for (const chunk of digitRuns) {
    if (chunk.length >= 44 && chunk.length <= 48) candidates.push(chunk);
    if (chunk.length > 48) {
      // às vezes vem colado com mais coisa; tenta recortar 44/47/48
      candidates.push(chunk.slice(0, 44));
      candidates.push(chunk.slice(0, 47));
      candidates.push(chunk.slice(0, 48));
    }
  }
  const best = candidates.find(c => c.length >= 44 && c.length <= 48);
  if (best) out.codigoBarras = best;

  return out;
}

