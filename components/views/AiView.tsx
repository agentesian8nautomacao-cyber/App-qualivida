
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BrainCircuit, Mic, SendHorizontal, X, Activity, Radio, Cpu, Sparkles, MessageSquare, History, Volume2, ShieldAlert, Settings, User } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { encode, decode, decodeAudioData } from '../../services/audioHelper';
import { getInternalInstructions } from '../../services/ai/internalInstructions';
import { useAppConfig } from '../../contexts/AppConfigContext';

interface AiViewProps {
  allPackages: any[];
  visitorLogs: any[];
  allOccurrences: any[];
  allNotes: any[];
  allResidents: any[];
  dayReservations: any[];
  allNotices: any[];
  chatMessages: any[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

interface VoiceSettings {
  gender: 'male' | 'female';
  style: 'serious' | 'animated';
}

const AiView: React.FC<AiViewProps> = ({ 
  allPackages, 
  visitorLogs, 
  allOccurrences, 
  allNotes,
  allResidents,
  dayReservations,
  allNotices,
  chatMessages
}) => {
  const { config, updateAIConfig } = useAppConfig();
  // Chat State
  const [input, setInput] = useState('');
  const aiName = config.aiConfig.name;
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('sentinela_history');
    return saved ? JSON.parse(saved).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })) : [
      { id: '0', role: 'model', text: `Olá. Sou o ${aiName}, seu copiloto operacional. Estou conectado a todas as camadas do sistema. Configure minha voz e comportamento nas Configurações.`, timestamp: new Date() }
    ];
  });

  // Voice & Persona State - usar do config
  const [isVoiceSettingsOpen, setIsVoiceSettingsOpen] = useState(false);
  const voiceSettings: VoiceSettings = { 
    gender: config.aiConfig.voiceGender, 
    style: config.aiConfig.voiceStyle 
  };

  // Live State
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLiveConnecting, setIsLiveConnecting] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const liveSessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const liveAudioSources = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Salvar histórico
  useEffect(() => {
    localStorage.setItem('sentinela_history', JSON.stringify(messages));
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mapa de Vozes do Gemini Live API
  const getVoiceConfig = () => {
    // Fenrir: Deep/Authoritative (Male Serious)
    // Puck: Playful/Mid (Male Animated)
    // Kore: Calm/Professional (Female Serious)
    // Aoede: Expressive (Female Animated)
    if (voiceSettings.gender === 'male') {
      return voiceSettings.style === 'serious' ? 'Fenrir' : 'Puck';
    } else {
      return voiceSettings.style === 'serious' ? 'Kore' : 'Aoede';
    }
  };

  const getSystemPersona = () => {
    const internalInstructions = getInternalInstructions();
    const externalInstructions = config.aiConfig.externalInstructions;
    
    return `${internalInstructions}

PERSONALIZAÇÃO DO AGENTE:
Nome: ${aiName}
${externalInstructions}

INSTRUÇÕES DE PERSONALIDADE:
${voiceSettings.style === 'serious' 
  ? `Você é o ${aiName}, uma IA militar e objetiva. Responda de forma curta, precisa e profissional. Foque em segurança e eficiência.`
  : `Você é o ${aiName}, um parceiro de trabalho amigável e prestativo. Use uma linguagem mais natural e colaborativa. Seja proativo.`
}`;
  };

  // Montar contexto DO SISTEMA INTEIRO para a IA
  const getSystemContext = useCallback(() => {
    const activeVisitors = visitorLogs.filter(v => v.status === 'active');
    const pendingPackages = allPackages.filter(p => p.status === 'Pendente');
    const openOccurrences = allOccurrences.filter(o => o.status === 'Aberto');
    const urgentNotices = allNotices.filter(n => n.category === 'Urgente' || n.priority === 'high');
    
    // Processamento de Notas e Chat para Contexto Rico
    const operationalNotes = allNotes.filter(n => !n.completed).map(n => `[NOTA] ${n.content} (${n.category})`).join('\n');
    const recentChat = chatMessages.slice(-10).map(m => `[CHAT ${m.senderRole}]: ${m.text}`).join('\n');

    return `
      DADOS EM TEMPO REAL DO CONDOMÍNIO:
      
      1. COMUNICAÇÃO INTERNA (CRÍTICO):
      ${recentChat ? recentChat : 'Nenhuma mensagem recente.'}
      
      2. NOTAS OPERACIONAIS:
      ${operationalNotes ? operationalNotes : 'Nenhuma nota pendente.'}

      3. STATUS ATUAL:
      - Visitantes: ${activeVisitors.length} ativos.
      - Encomendas: ${pendingPackages.length} pendentes.
      - Alertas de Segurança: ${openOccurrences.map(o => o.description).join(', ')}.
      - Avisos do Síndico: ${urgentNotices.map(n => n.title).join(', ')}.

      INSTRUÇÃO:
      Use o histórico de CHAT e NOTAS para entender ordens e contextos não estruturados. 
      Se o Síndico pediu algo no chat, isso é uma regra ativa.
    `;
  }, [allPackages, visitorLogs, allOccurrences, allNotes, chatMessages, allNotices]);

  // --- FUNÇÕES DE CHAT (GEMINI 3 PRO) ---
  const handleSendMessage = async () => {
    if (!input.trim() || isProcessing) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsProcessing(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const context = getSystemContext();
      const persona = getSystemPersona();
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [
          { role: 'user', parts: [{ text: `${persona}\n\nCONTEXTO EM TEMPO REAL:\n${context}\n\nSOLICITAÇÃO DO USUÁRIO:\n${userMsg.text}` }] }
        ],
        config: { temperature: 0.7 }
      });

      const modelMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.text || "Sem resposta.",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, modelMsg]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- FUNÇÕES DE VOZ (GEMINI LIVE API) ---
  const startLiveMode = async () => {
    setIsLiveConnecting(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const context = getSystemContext();
      const voiceName = getVoiceConfig();
      const persona = getSystemPersona();

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let nextStartTime = 0;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsLiveConnecting(false);
            setIsLiveActive(true);
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              sessionPromise.then(session => session.sendRealtimeInput({ media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } }));
            };
            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              nextStartTime = Math.max(nextStartTime, outputCtx.currentTime);
              const buffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtx.destination);
              source.start(nextStartTime);
              nextStartTime += buffer.duration;
              liveAudioSources.current.add(source);
              source.onended = () => liveAudioSources.current.delete(source);
            }
            if (message.serverContent?.interrupted) {
              liveAudioSources.current.forEach(s => s.stop());
              liveAudioSources.current.clear();
              nextStartTime = 0;
            }
          },
          onerror: () => stopLiveMode(),
          onclose: () => stopLiveMode()
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `${persona}. Use estes dados: ${context}.`,
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } } }
        }
      });
      liveSessionRef.current = await sessionPromise;
    } catch (error) {
      console.error(error);
      setIsLiveConnecting(false);
    }
  };

  const stopLiveMode = () => {
    if (liveSessionRef.current) liveSessionRef.current.close();
    liveAudioSources.current.forEach(s => s.stop());
    setIsLiveActive(false);
    setIsLiveConnecting(false);
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col lg:flex-row gap-6 animate-in fade-in duration-500 overflow-hidden relative">
      
      {/* SELETOR DE VOZ (MODAL INTERNO) */}
      {isVoiceSettingsOpen && (
        <div className="absolute top-20 right-8 z-50 bg-black/90 backdrop-blur-xl p-6 rounded-[32px] border border-white/10 w-72 shadow-2xl animate-in fade-in slide-in-from-top-4">
           <div className="flex justify-between items-center mb-6">
              <h5 className="text-white font-black uppercase text-sm">Configuração Neural</h5>
              <button onClick={() => setIsVoiceSettingsOpen(false)}><X className="w-5 h-5 text-zinc-500 hover:text-white" /></button>
           </div>
           
           <div className="space-y-6">
              <div>
                 <label className="text-[10px] font-black uppercase text-zinc-500 mb-3 block">Gênero da Voz</label>
                 <div className="flex gap-2">
                    <button onClick={() => updateAIConfig({ voiceGender: 'male' })} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${voiceSettings.gender === 'male' ? 'bg-cyan-500 text-black' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}>Masculino</button>
                    <button onClick={() => updateAIConfig({ voiceGender: 'female' })} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${voiceSettings.gender === 'female' ? 'bg-purple-500 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}>Feminino</button>
                 </div>
              </div>
              
              <div>
                 <label className="text-[10px] font-black uppercase text-zinc-500 mb-3 block">Estilo Operacional</label>
                 <div className="flex gap-2">
                    <button onClick={() => updateAIConfig({ voiceStyle: 'serious' })} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${voiceSettings.style === 'serious' ? 'border-white text-white bg-white/10' : 'border-transparent text-zinc-500 hover:text-white'}`}>Sério</button>
                    <button onClick={() => updateAIConfig({ voiceStyle: 'animated' })} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${voiceSettings.style === 'animated' ? 'border-green-400 text-green-400 bg-green-400/10' : 'border-transparent text-zinc-500 hover:text-white'}`}>Animado</button>
                 </div>
              </div>
           </div>
           
           <div className="mt-6 pt-4 border-t border-white/10 text-[10px] text-zinc-500 text-center">
              Voz Ativa: <span className="text-white font-bold">{getVoiceConfig()}</span>
           </div>
        </div>
      )}

      {/* MODAL LIVE (OVERLAY IMERSIVO) */}
      {(isLiveActive || isLiveConnecting) && (
        <div className="fixed inset-0 z-[999] bg-black/98 backdrop-blur-3xl flex flex-col items-center justify-center animate-in fade-in duration-700 p-8">
           <button 
             onClick={stopLiveMode}
             className="absolute top-10 right-10 p-5 rounded-full bg-white/5 hover:bg-red-500 transition-all text-white border border-white/10"
           >
             <X className="w-8 h-8" />
           </button>

           <div className="relative w-80 h-80 flex items-center justify-center">
              <div className={`absolute inset-0 rounded-full blur-[80px] animate-pulse ${voiceSettings.gender === 'male' ? 'bg-cyan-500/20' : 'bg-purple-500/20'}`} />
              
              <div className={`w-56 h-56 rounded-full border-2 flex items-center justify-center relative transition-transform duration-300 ${isLiveConnecting ? 'scale-75 opacity-50' : 'scale-100'} ${voiceSettings.gender === 'male' ? 'border-cyan-500/40' : 'border-purple-500/40'}`}>
                 <div className={`absolute inset-0 bg-gradient-to-t rounded-full ${voiceSettings.gender === 'male' ? 'from-cyan-900/60' : 'from-purple-900/60'} to-transparent`} />
                 <Activity className={`w-24 h-24 ${voiceSettings.gender === 'male' ? 'text-cyan-400' : 'text-purple-400'} ${isLiveActive ? 'animate-[bounce_0.6s_infinite]' : 'animate-pulse'}`} />
                 <div className={`absolute inset-[-20px] border rounded-full animate-[spin_8s_linear_infinite] ${voiceSettings.gender === 'male' ? 'border-cyan-500/10' : 'border-purple-500/10'}`} />
              </div>
           </div>

           <div className="mt-16 text-center space-y-6">
              <div className="flex items-center justify-center gap-3">
                 <div className={`w-3 h-3 rounded-full ${isLiveConnecting ? 'bg-amber-500' : 'bg-green-500'} animate-pulse`} />
                 <span className={`text-[11px] font-black uppercase tracking-[0.5em] ${voiceSettings.gender === 'male' ? 'text-cyan-500' : 'text-purple-500'}`}>
                    {isLiveConnecting ? 'Sincronizando Voz...' : `Voz: ${getVoiceConfig()} (${voiceSettings.style})`}
                 </span>
              </div>
              <h2 className="text-4xl font-black text-white uppercase tracking-tighter max-w-xl">
                 {isLiveConnecting ? 'Conectando...' : 'Canal Aberto'}
              </h2>
           </div>

           <button onClick={stopLiveMode} className="mt-12 px-10 py-5 bg-white/5 border border-white/10 rounded-full text-zinc-400 font-black uppercase text-[10px] tracking-widest hover:text-white transition-all">Encerrar</button>
        </div>
      )}

      {/* PAINEL LATERAL: STATUS & INSIGHTS */}
      <div className="hidden lg:flex w-80 flex-col gap-6 p-6 bg-white/5 border border-white/5 rounded-[40px]">
         <div className="flex items-center gap-4 mb-2">
            <div className="p-4 bg-cyan-500/10 text-cyan-400 rounded-3xl border border-cyan-500/20">
               <Cpu className="w-6 h-6" />
            </div>
            <div>
               <h3 className="text-sm font-black uppercase text-white tracking-tight">Sentinela v3</h3>
               <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Núcleo de Comando</p>
            </div>
         </div>

         <div className="space-y-4">
             {/* Card de Memória de Chat */}
            <div className="p-5 bg-emerald-900/10 rounded-3xl border border-emerald-500/10 group hover:border-emerald-500/30 transition-all">
               <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold uppercase text-emerald-500/60">Comunicação</span>
                  <MessageSquare className="w-3 h-3 text-emerald-500 opacity-40" />
               </div>
               <span className="text-xs font-bold text-emerald-100 leading-tight">
                  {chatMessages.length > 0 ? "Última ordem do Síndico indexada." : "Nenhuma ordem recente no chat."}
               </span>
            </div>

            <div className="p-5 bg-black/40 rounded-3xl border border-white/5 group hover:border-cyan-500/30 transition-all">
               <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-bold uppercase text-zinc-500">Fluxo</span>
                  <Activity className="w-3 h-3 text-cyan-500 opacity-40" />
               </div>
               <span className="text-2xl font-black text-white">{visitorLogs.filter(v => v.status === 'active').length} Pessoas</span>
            </div>
         </div>
      </div>

      {/* ÁREA DE CHAT CENTRAL */}
      <div className="flex-1 flex flex-col bg-zinc-950/60 border border-white/5 rounded-[40px] relative overflow-hidden">
         
         {/* Chat Header */}
         <div className="p-8 border-b border-white/5 flex justify-between items-center bg-black/30 backdrop-blur-xl z-10">
            <div className="flex items-center gap-5">
               <div className="relative">
                  <div className={`w-14 h-14 rounded-3xl bg-gradient-to-br flex items-center justify-center shadow-2xl ${voiceSettings.gender === 'male' ? 'from-cyan-600 to-blue-800 shadow-cyan-900/40' : 'from-purple-600 to-pink-800 shadow-purple-900/40'}`}>
                     <BrainCircuit className="w-7 h-7 text-white" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-4 border-black animate-pulse" />
               </div>
               <div>
                  <h2 className="text-xl font-black uppercase text-white tracking-tight leading-none mb-1">Interface Neural</h2>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                     <Radio className="w-3 h-3" /> Conectado: Notas & Chat
                  </p>
               </div>
            </div>
            
            <div className="flex gap-3">
               <button 
                  onClick={() => setIsVoiceSettingsOpen(!isVoiceSettingsOpen)}
                  className={`p-4 rounded-2xl hover:bg-white/10 transition-all ${isVoiceSettingsOpen ? 'bg-white text-black' : 'bg-white/5 text-zinc-500'}`}
                  title="Configurar Voz"
               >
                  <Settings className="w-5 h-5" />
               </button>
               <button 
                  onClick={() => setMessages([{ id: '0', role: 'model', text: 'Memória limpa. Reindexando dados do condomínio...', timestamp: new Date() }])}
                  className="p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all text-zinc-500"
                  title="Limpar Histórico"
               >
                  <History className="w-5 h-5" />
               </button>
               <button 
                  onClick={startLiveMode}
                  className={`group flex items-center gap-4 px-8 py-4 text-white rounded-3xl transition-all shadow-2xl active:scale-95 ${voiceSettings.gender === 'male' ? 'bg-cyan-600 hover:bg-cyan-500' : 'bg-purple-600 hover:bg-purple-500'}`}
               >
                  <Mic className="w-5 h-5 group-hover:animate-bounce" />
                  <span className="text-[11px] font-black uppercase tracking-widest">Live Voice</span>
               </button>
            </div>
         </div>

         {/* Messages Area */}
         <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-10 relative">
            {messages.map((msg) => {
               const isModel = msg.role === 'model';
               return (
                  <div key={msg.id} className={`flex ${isModel ? 'justify-start' : 'justify-end'} animate-in slide-in-from-bottom-4 duration-500`}>
                     <div className={`max-w-[85%] md:max-w-[75%] p-7 rounded-[32px] relative group ${
                        isModel 
                           ? 'bg-zinc-900/80 border border-white/5 text-zinc-300 rounded-tl-sm shadow-xl' 
                           : 'bg-white text-black rounded-tr-sm shadow-2xl'
                     }`}>
                        {isModel && (
                           <div className="flex items-center gap-2 mb-3 opacity-40">
                              <Sparkles className="w-3 h-3" />
                              <span className="text-[9px] font-black uppercase tracking-widest">Sentinela ({voiceSettings.gender === 'male' ? 'M' : 'F'})</span>
                           </div>
                        )}
                        <p className="text-sm font-bold leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        <div className={`flex items-center gap-2 mt-4 ${isModel ? 'justify-end' : 'justify-start'} opacity-20`}>
                           <span className="text-[8px] font-black uppercase">
                              {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                           </span>
                        </div>
                     </div>
                  </div>
               );
            })}
            
            {isProcessing && (
               <div className="flex justify-start animate-pulse">
                  <div className="bg-zinc-900 border border-white/5 p-6 rounded-[24px] flex gap-3">
                     <div className={`w-2 h-2 rounded-full animate-bounce ${voiceSettings.gender === 'male' ? 'bg-cyan-500' : 'bg-purple-500'}`} />
                     <div className={`w-2 h-2 rounded-full animate-bounce delay-150 ${voiceSettings.gender === 'male' ? 'bg-cyan-500' : 'bg-purple-500'}`} />
                     <div className={`w-2 h-2 rounded-full animate-bounce delay-300 ${voiceSettings.gender === 'male' ? 'bg-cyan-500' : 'bg-purple-500'}`} />
                  </div>
               </div>
            )}
            <div ref={chatEndRef} />
         </div>

         {/* Input Area */}
         <div className="p-8 bg-black/40 border-t border-white/5 backdrop-blur-md">
            <div className="relative group">
               <div className={`absolute inset-0 bg-gradient-to-r rounded-[32px] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity ${voiceSettings.gender === 'male' ? 'from-cyan-600/10 via-blue-600/10 to-transparent' : 'from-purple-600/10 via-pink-600/10 to-transparent'}`} />
               <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Pergunte sobre notas, chat ou operações..."
                  className="w-full relative bg-zinc-900/50 border border-white/10 rounded-[32px] pl-8 pr-20 py-7 text-sm font-bold text-white outline-none focus:border-white/20 transition-all placeholder:text-zinc-600 shadow-inner"
               />
               <button 
                  onClick={handleSendMessage}
                  disabled={!input.trim() || isProcessing}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-5 rounded-2xl transition-all ${
                     input.trim() && !isProcessing
                        ? 'bg-white text-black shadow-2xl hover:scale-105 active:scale-95' 
                        : 'bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-50'
                  }`}
               >
                  <SendHorizontal className="w-6 h-6" />
               </button>
            </div>
         </div>
      </div>
    </div>
  );
};

export default AiView;
