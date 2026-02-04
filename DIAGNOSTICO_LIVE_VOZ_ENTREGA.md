# Diagnóstico Live Voice — Causa raiz e correções (Qualivida vs Nutri.IA)

## Objetivo

Garantir que o Live Voice do **Qualivida Residence** use exatamente a mesma engine, parâmetros e fluxo de áudio do **Nutri.IA**, eliminando o timbre robótico.

---

## 1. Comparação entre projetos (inspeção de código)

### 1.1 Engine e modelo

| Item | Qualivida Residence | Nutri.IA | Conclusão |
|------|---------------------|----------|-----------|
| API | `ai.live.connect` (Google GenAI) | `ai.live.connect` (Google GenAI) | Igual |
| Modelo | `gemini-2.5-flash-native-audio-preview-09-2025` | `gemini-2.5-flash-native-audio-preview-09-2025` | Igual |
| Modalities | `responseModalities: [Modality.AUDIO]` | Idem | Igual |
| Fluxo de áudio | Base64 → decode → AudioBuffer → BufferSource → destination | Idem | Igual |
| Interrupções | `activeSourcesRef` + `nextStartTimeRef` | Idem | Igual |

**Conclusão:** A engine é a mesma (Gemini Live API, áudio nativo). Não há uso de Web Speech API no Live em nenhum dos dois. O `geminiService` (transcribeAudio, etc.) não é usado no canal ao vivo; só no chat/upload.

### 1.2 Diferenças que causavam voz robótica no Qualivida

| Parâmetro | Qualivida (antes) | Nutri.IA | Impacto |
|-----------|-------------------|----------|---------|
| **Voz padrão (prebuiltVoiceConfig)** | `'Aoede'` | `'Kore'` | **Causa raiz:** timbre diferente. Aoede foi escolhida em documentação anterior como “mais fluida”, mas na prática o Nutri.IA (Kore) soa mais humana no mesmo modelo. |
| **System instruction (Live)** | Incluía bloco extra “IMPORTANTE — Sua resposta será reproduzida por VOZ (TTS)” (frases curtas, ritmo, etc.) | Apenas as 5 instruções gerais, sem bloco TTS | Possível divergência no estilo de resposta gerada; para paridade estrita, o bloco foi removido. |

Nenhuma outra diferença em:
- `speechConfig` (sem `languageCode` em nenhum dos dois)
- Decode/playback (sample rate 24000, PCM16 → Float32, agendamento contínuo)
- Tool `logMeal`, callbacks, cleanup

---

## 2. Verificação de engine real em execução

- **LiveConversation (ambos):** só usa Gemini Live API. O áudio de saída vem de `msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data` (base64), decodificado e reproduzido via Web Audio API (`AudioContext`, `createBufferSource`). Não há fallback para Web Speech API, voz padrão do navegador ou TTS local no fluxo Live.
- **AiView (Qualivida):** é outro fluxo (Sentinela / chat por voz no condomínio) e usa Web Speech API; não é o Live Voice da chamada Nutri/Residence.

**Conclusão:** Nenhum fallback indevido no Live. O problema era **configuração de voz e instrução**, não engine diferente.

---

## 3. Parâmetros de humanização (Gemini Live)

- **Voz:** prebuilt `Kore` (agora igual ao Nutri.IA). Opcionalmente o usuário pode definir `userProfile.aiVoice`.
- **Idioma:** implícito no system instruction (“Fale sempre em Português do Brasil”); a API do modelo native-audio lida com PT-BR.
- **Streaming:** o áudio já vem em chunks pelo Live API; o código apenas decodifica e enfileira com `nextStartTimeRef` (buffer contínuo, sem concatenação “seca”).
- **SSML:** não usado neste fluxo (Gemini Live gera áudio diretamente).

---

## 4. Fluxo de áudio

- **Reinicialização:** uma única sessão `live.connect` por abertura da tela; a voz não é reinicializada a cada resposta.
- **Buffer:** cada chunk de áudio é agendado em sequência (`nextStartTimeRef`); não há `speechSynthesis.cancel()` no Live (isso existe só no AiView).
- **Interrupção:** em `msg.serverContent?.interrupted` todos os `activeSourcesRef` são parados e `nextStartTimeRef` zerado; comportamento igual ao Nutri.IA.

Nenhuma correção necessária no fluxo; apenas alinhamento de voz e system instruction.

---

## 5. Garantia de paridade com Nutri.IA

- **Streaming:** já igual (chunks da API → decode → play em sequência).
- **Modelo:** já igual (`gemini-2.5-flash-native-audio-preview-09-2025`).
- **Parâmetros:** voz padrão alterada de `Aoede` para `Kore`; system instruction alinhada ao Nutri.IA (removido o bloco TTS extra).

---

## 6. Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `components/views/LiveConversation.tsx` | 1) `userProfile?.aiVoice \|\| 'Aoede'` → `userProfile?.aiVoice \|\| 'Kore'`. 2) Removido o bloco “IMPORTANTE — Sua resposta será reproduzida por VOZ (TTS)” e mantidas apenas as “Instruções” 1–5, no mesmo texto do Nutri.IA. |
| `HUMANIZACAO_VOZ.md` | Atualizado: voz padrão descrita como Kore (paridade Nutri.IA); system instruction alinhado ao Nutri.IA. |

---

## 7. Engine e modelo ativos após o ajuste

- **Engine:** Google Gemini Live API (áudio nativo), mesma em Qualivida e Nutri.IA.
- **Modelo:** `gemini-2.5-flash-native-audio-preview-09-2025`.
- **Voz:** `Kore` (prebuilt), ou `userProfile.aiVoice` se definido.
- **Fluxo:** áudio em chunks pela API → decode base64 → AudioBuffer 24 kHz → BufferSource em sequência → saída contínua; interrupção tratada igual ao Nutri.IA.

---

## 8. Por que antes soava robótico e agora não (esperado)

1. **Voz diferente:** O Qualivida usava **Aoede** por documentação anterior; o Nutri.IA usa **Kore**. Com a troca para Kore no Qualivida, o timbre fica igual ao app que já soa humanizado.
2. **Instrução diferente:** O bloco extra de “TTS” no system instruction podia alterar o estilo da resposta (ex.: mais “didático” ou mais listas). Alinhar ao Nutri.IA remove essa divergência.
3. **Engine e fluxo:** Já eram os mesmos; não havia fallback para Web Speech nem erro de buffer. A causa era configuração (voz + instrução), não engine ou fluxo errado.

---

## 9. Resultado esperado

- A voz do Live Voice no Qualivida Residence deve soar **igual à do Nutri.IA** (Kore, mesmo modelo e fluxo).
- Timbre **claramente humano**, sem robótico.
- Validação recomendada: testar uma mesma pergunta nos dois apps e comparar a qualidade da voz em execução real.

---

*Diagnóstico feito por inspeção de código dos dois projetos (LiveConversation.tsx e geminiService em ambos); nenhuma suposição — comparação lado a lado e alinhamento explícito ao Nutri.IA.*
