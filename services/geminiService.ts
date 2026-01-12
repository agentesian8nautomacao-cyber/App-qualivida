
import { GoogleGenAI } from "@google/genai";

export class AIService {
  // Always create a new instance before making an API call to ensure it uses the latest API key from the environment/dialog.

  static async analyzeCondoData(data: string): Promise<string> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analise os seguintes dados do condomínio Qualivida e forneça um resumo executivo com recomendações rápidas: ${data}`,
        config: {
          systemInstruction: "Você é um assistente inteligente especializado em gestão condominial de alto luxo. Use um tom profissional, direto e elegante em português brasileiro.",
        }
      });
      return response.text || "Não foi possível gerar uma análise no momento.";
    } catch (error) {
      console.error("AI Error:", error);
      return "Erro ao processar análise inteligente.";
    }
  }

  static async getPackageAdvice(): Promise<string> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: "Quais as melhores práticas atuais para entrega de encomendas em condomínios de luxo para evitar acúmulo na portaria?",
      });
      return response.text || "";
    } catch (error) {
      return "";
    }
  }
}
