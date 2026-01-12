
import React from 'react';
import { Pin, Crown, BadgeInfo, Check, CheckCheck, MessageSquareText, ChevronUp, X, Paperclip, SendHorizontal } from 'lucide-react';
import { Notice, ChatMessage, UserRole } from '../../types';

interface NoticesViewProps {
  filteredNotices: Notice[];
  setNoticeFilter: (filter: 'all' | 'urgent' | 'unread') => void;
  noticeFilter: 'all' | 'urgent' | 'unread';
  activeNoticeTab: 'wall' | 'chat';
  setActiveNoticeTab: (tab: 'wall' | 'chat') => void;
  isChatOpen: boolean;
  setIsChatOpen: (val: boolean) => void;
  chatMessages: ChatMessage[];
  role: UserRole;
  chatInput: string;
  setChatInput: (val: string) => void;
  handleSendChatMessage: () => void;
  chatEndRef: React.RefObject<HTMLDivElement>;
  handleAcknowledgeNotice: (id: string) => void;
}

const NoticesView: React.FC<NoticesViewProps> = ({
  filteredNotices,
  setNoticeFilter,
  noticeFilter,
  activeNoticeTab,
  setActiveNoticeTab,
  isChatOpen,
  setIsChatOpen,
  chatMessages,
  role,
  chatInput,
  setChatInput,
  handleSendChatMessage,
  chatEndRef,
  handleAcknowledgeNotice
}) => {
  const lastMessage = chatMessages[chatMessages.length - 1];

  return (
    <div className="relative h-[calc(100vh-140px)] flex flex-col md:flex-row gap-6 animate-in fade-in duration-500 overflow-hidden">
      
      {/* Header Mobile Switcher (Hidden in Desktop due to Glass Bottom Sheet design, but kept for fallback) */}
      <div className="md:hidden flex justify-center mb-4 hidden">
         <div className="bg-white/5 p-1 rounded-full flex">
            <button 
              onClick={() => setActiveNoticeTab('wall')}
              className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeNoticeTab === 'wall' ? 'bg-white text-black' : 'text-zinc-500'}`}
            >
               Mural
            </button>
            <button 
              onClick={() => setActiveNoticeTab('chat')}
              className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeNoticeTab === 'chat' ? 'bg-white text-black' : 'text-zinc-500'}`}
            >
               Chat
            </button>
         </div>
      </div>

      {/* COLUNA ESQUERDA: MURAL DE VIDRO (MASONRY) */}
      <div className="flex-1 flex flex-col min-h-0 relative">
         {/* Overlay Escuro para Mobile quando Chat está Aberto */}
         <div 
            className={`absolute inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-500 md:hidden ${isChatOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
            onClick={() => setIsChatOpen(false)}
         />

         <div className="flex justify-between items-end mb-6 pb-6 border-b border-white/5 flex-shrink-0">
            <div>
               <h3 className="text-3xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-500">Mural Digital</h3>
               <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500 mt-1">Avisos & Comunicados</p>
            </div>
            <div className="flex gap-2">
               {['all', 'urgent', 'unread'].map(f => (
                  <button
                     key={f}
                     onClick={() => setNoticeFilter(f as any)}
                     className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${noticeFilter === f ? 'bg-white text-black border-white' : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600'}`}
                  >
                     {f === 'all' ? 'Todos' : f === 'urgent' ? 'Urgentes' : 'Não Lidos'}
                  </button>
               ))}
            </div>
         </div>

         <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-32 md:pb-20">
            <div className="columns-1 lg:columns-2 gap-6 space-y-6">
               {filteredNotices.map((notice) => {
                  const isSindico = notice.authorRole === 'SINDICO';
                  
                  return (
                     <div 
                        key={notice.id}
                        className={`break-inside-avoid relative overflow-hidden rounded-[32px] border backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 shadow-2xl group ${
                           isSindico 
                              ? 'bg-amber-950/10 border-amber-500/20 shadow-amber-500/5' 
                              : 'bg-cyan-950/10 border-cyan-500/20 shadow-cyan-500/5'
                        } ${notice.read ? 'opacity-60 grayscale-[0.3]' : 'opacity-100'}`}
                     >
                        {/* Role Indicator Stripe */}
                        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${isSindico ? 'from-amber-400 via-yellow-200 to-amber-600' : 'from-cyan-400 via-blue-200 to-cyan-600'} opacity-80`} />

                        {/* Pinned Icon */}
                        {notice.pinned && (
                           <div className="absolute top-4 right-4 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] rotate-45 z-10">
                              <Pin className="w-5 h-5 fill-white" />
                           </div>
                        )}

                        <div className="p-8">
                           <div className="flex items-center gap-3 mb-6">
                              <div className={`p-2 rounded-xl ${isSindico ? 'bg-amber-500/10 text-amber-400' : 'bg-cyan-500/10 text-cyan-400'}`}>
                                 {isSindico ? <Crown className="w-4 h-4" /> : <BadgeInfo className="w-4 h-4" />}
                              </div>
                              <div>
                                 <span className={`text-[9px] font-black uppercase tracking-widest block ${isSindico ? 'text-amber-500' : 'text-cyan-500'}`}>
                                    {isSindico ? 'Administração' : 'Operacional'}
                                 </span>
                                 <span className="text-[10px] font-bold text-zinc-500 uppercase">{notice.author} • {new Date(notice.date).toLocaleDateString()}</span>
                              </div>
                           </div>

                           <h4 className="text-2xl font-black uppercase leading-tight mb-4 text-white">{notice.title}</h4>
                           <p className="text-sm font-medium text-zinc-400 leading-relaxed mb-8">{notice.content}</p>

                           <button 
                              onClick={() => handleAcknowledgeNotice(notice.id)}
                              disabled={notice.read}
                              className={`w-full py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${
                                 notice.read 
                                 ? 'bg-zinc-900/50 text-zinc-600 cursor-default border border-white/5' 
                                 : `hover:scale-[1.02] active:scale-95 shadow-lg ${isSindico ? 'bg-amber-500 text-black hover:bg-amber-400' : 'bg-cyan-500 text-black hover:bg-cyan-400'}`
                              }`}
                           >
                              {notice.read ? (
                                 <>Lido <CheckCheck className="w-4 h-4" /></>
                              ) : (
                                 <>Confirmar Leitura <Check className="w-4 h-4" /></>
                              )}
                           </button>
                        </div>
                     </div>
                  );
               })}
            </div>
         </div>
      </div>

      {/* COLUNA DIREITA (DESKTOP) / BOTTOM SHEET (MOBILE): CHAT "LINHA DIRETA" */}
      <div 
         className={`
            flex flex-col flex-shrink-0 bg-zinc-950/60 backdrop-blur-2xl border-white/5 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
            md:relative md:h-auto md:w-[380px] lg:w-[420px] md:rounded-l-[40px] md:border-l md:bg-zinc-950/50
            absolute left-0 right-0 z-50 md:z-0
            ${isChatOpen 
               ? 'bottom-0 h-[85%] rounded-t-[32px] border-t shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.5)]' 
               : 'bottom-0 h-[80px] md:h-auto rounded-t-[32px] md:rounded-none border-t md:border-t-0 hover:bg-zinc-900/80 cursor-pointer md:cursor-default'
            }
         `}
         onClick={() => !isChatOpen && window.innerWidth < 768 && setIsChatOpen(true)}
      >
         {/* Mobile Handle */}
         <div className="md:hidden w-full flex justify-center pt-3 pb-1" onClick={(e) => { e.stopPropagation(); setIsChatOpen(!isChatOpen); }}>
            <div className="w-12 h-1.5 bg-white/20 rounded-full" />
         </div>

         {/* Mobile Minimized Header (Peeking Bar Content) */}
         <div className={`md:hidden px-6 pb-4 flex items-center justify-between transition-opacity duration-300 ${isChatOpen ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
            <div className="flex items-center gap-3 w-full">
               <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center text-white shadow-lg">
                     <MessageSquareText className="w-5 h-5" />
                  </div>
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-black animate-pulse" />
               </div>
               <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-black uppercase text-white">Linha Direta</h4>
                  <p className="text-[10px] font-medium text-zinc-400 truncate">{lastMessage ? lastMessage.text : 'Nenhuma mensagem'}</p>
               </div>
               <div className="animate-pulse">
                  <ChevronUp className="w-5 h-5 text-zinc-500" />
               </div>
            </div>
         </div>

         {/* Desktop Header / Expanded Mobile Header */}
         <div className={`p-6 border-b border-white/5 flex items-center justify-between bg-zinc-900/50 md:rounded-tl-[40px] transition-all duration-300 ${!isChatOpen ? 'hidden md:flex' : 'flex'}`}>
            <div className="flex items-center gap-4">
               <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center text-white shadow-lg">
                     <MessageSquareText className="w-6 h-6" />
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-black animate-pulse" />
               </div>
               <div>
                  <h4 className="text-sm font-black uppercase text-white">Linha Direta</h4>
                  <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Online Agora</p>
               </div>
            </div>
            {/* Mobile Close Button */}
            <button 
               className="md:hidden p-2 bg-white/10 rounded-full text-white/50"
               onClick={(e) => { e.stopPropagation(); setIsChatOpen(false); }}
            >
               <X className="w-5 h-5" />
            </button>
         </div>

         {/* Messages Stream */}
         <div className={`flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6 ${!isChatOpen ? 'hidden md:block' : 'block'}`}>
            {chatMessages.map((msg) => {
               const isMe = msg.senderRole === role;
               return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                     <div className={`max-w-[85%] p-4 relative group transition-all hover:scale-[1.01] ${
                        isMe 
                           ? 'bg-gradient-to-br from-emerald-600 to-emerald-800 text-white rounded-2xl rounded-tr-sm shadow-lg shadow-emerald-900/20' 
                           : 'bg-white/10 backdrop-blur-md text-zinc-200 rounded-2xl rounded-tl-sm border border-white/5'
                     }`}>
                        <p className="text-xs font-bold leading-relaxed">{msg.text}</p>
                        <div className="flex items-center justify-end gap-1 mt-2 opacity-50">
                           <span className="text-[9px] font-black uppercase">{new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                           {isMe && <CheckCheck className="w-3 h-3 text-blue-300" />}
                        </div>
                     </div>
                  </div>
               );
            })}
            <div ref={chatEndRef} />
         </div>

         {/* Input Area */}
         <div className={`p-4 bg-zinc-900/80 border-t border-white/5 md:rounded-bl-[40px] ${!isChatOpen ? 'hidden md:block' : 'block'}`}>
            <div className="relative flex items-center gap-2">
               <button className="p-3 text-zinc-500 hover:text-white transition-colors rounded-full hover:bg-white/5">
                  <Paperclip className="w-5 h-5" />
               </button>
               <div className="flex-1 relative">
                  <input 
                     type="text" 
                     value={chatInput}
                     onChange={(e) => setChatInput(e.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                     onFocus={() => { if(window.innerWidth < 768) setIsChatOpen(true); }}
                     placeholder="Digite sua mensagem..."
                     className="w-full bg-black/40 border border-white/10 rounded-full pl-5 pr-12 py-3 text-sm font-medium text-white outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all placeholder:text-zinc-600"
                  />
                  <button 
                     onClick={handleSendChatMessage}
                     disabled={!chatInput.trim()}
                     className={`absolute right-1 top-1 p-2 rounded-full transition-all ${
                        chatInput.trim() 
                           ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:scale-105 active:scale-95' 
                           : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                     }`}
                  >
                     <SendHorizontal className="w-4 h-4" />
                  </button>
               </div>
            </div>
         </div>
      </div>

   </div>
  );
};

export default NoticesView;
