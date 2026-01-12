
import React, { useState } from 'react';
import { 
  LayoutGrid, 
  Kanban as KanbanIcon, 
  Sparkles, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Gavel, 
  MessageCircle, 
  MoreHorizontal,
  X,
  User,
  ShieldAlert,
  TrendingUp,
  Tag
} from 'lucide-react';
import { CrmUnit, CrmIssue, UnitStatus } from '../../types';

const CrmView: React.FC = () => {
  const [viewMode, setViewMode] = useState<'heatmap' | 'kanban'>('heatmap');
  const [selectedUnit, setSelectedUnit] = useState<CrmUnit | null>(null);

  // MOCK DATA - HEATMAP (Unidades)
  const mockUnits: CrmUnit[] = Array.from({ length: 20 }, (_, i) => {
    const floorNum = Math.floor(i / 4) + 1;
    const unitNum = `${floorNum}0${(i % 4) + 1}`;
    let status: UnitStatus = 'calm';
    if ([2, 7, 15].includes(i)) status = 'warning';
    if ([5, 12].includes(i)) status = 'critical';

    return {
      id: `u-${i}`,
      unit: unitNum,
      floor: `${floorNum}º Andar`,
      residentName: `Família ${['Silva', 'Souza', 'Oliveira', 'Lima'][i % 4]}`,
      status,
      tags: i % 3 === 0 ? ['#PetFriendly', '#HomeOffice'] : i % 2 === 0 ? ['#Idoso'] : ['#Festeiro'],
      npsScore: status === 'calm' ? 95 : status === 'warning' ? 60 : 30,
      lastIncident: status !== 'calm' ? 'Barulho excessivo após 22h' : undefined
    };
  });

  // MOCK DATA - KANBAN (Conflitos)
  const [issues, setIssues] = useState<CrmIssue[]>([
    { id: '1', title: 'Vazamento Apto 202 > 102', involvedUnits: ['202', '102'], severity: 'medium', status: 'mediation', description: 'Infiltração no teto do banheiro.', updatedAt: 'Há 2h' },
    { id: '2', title: 'Cachorro bravo Bloco B', involvedUnits: ['304', '303'], severity: 'high', status: 'legal', description: 'Terceira reincidência de ataque no elevador.', updatedAt: 'Ontem' },
    { id: '3', title: 'Barulho de Salto Alto', involvedUnits: ['501', '401'], severity: 'low', status: 'analysis', description: 'Reclamação recorrente de madrugada.', updatedAt: 'Hoje 08:00' },
    { id: '4', title: 'Uso indevido da Academia', involvedUnits: ['101'], severity: 'low', status: 'resolved', description: 'Personal trainer sem cadastro.', updatedAt: 'Semana passada' },
  ]);

  // INSIGHTS MOCK
  const insights = [
    { type: 'warning', text: 'Unidade 302 reservou o salão 3x este mês. Histórico de barulho.' },
    { type: 'info', text: 'Aumento de entregas "iFood" após 23h. Reforçar regras de delivery.' }
  ];

  // Render Helpers
  const getStatusColor = (status: UnitStatus) => {
    switch (status) {
      case 'calm': return 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20 shadow-[0_0_15px_-5px_rgba(59,130,246,0.3)]';
      case 'warning': return 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20 shadow-[0_0_15px_-5px_rgba(245,158,11,0.3)]';
      case 'critical': return 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20 animate-pulse shadow-[0_0_15px_-5px_rgba(239,68,68,0.5)]';
    }
  };

  const floors = [...new Set(mockUnits.map(u => u.floor))].reverse();

  return (
    <div className="relative min-h-screen pb-20 animate-in fade-in duration-700">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
             <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg text-white shadow-lg">
                <Sparkles className="w-5 h-5" />
             </div>
             <h3 className="text-3xl font-black uppercase tracking-tighter text-white">Harmony CRM</h3>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Gestão de Relacionamento & Conflitos</p>
        </div>

        <div className="flex bg-zinc-900 p-1 rounded-2xl border border-white/5">
           <button 
             onClick={() => setViewMode('heatmap')}
             className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'heatmap' ? 'bg-white text-black shadow-lg' : 'text-zinc-500 hover:text-white'}`}
           >
              <LayoutGrid className="w-4 h-4" /> Mapa Térmico
           </button>
           <button 
             onClick={() => setViewMode('kanban')}
             className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'kanban' ? 'bg-white text-black shadow-lg' : 'text-zinc-500 hover:text-white'}`}
           >
              <KanbanIcon className="w-4 h-4" /> Pipeline
           </button>
        </div>
      </div>

      {/* AI INSIGHTS WIDGET */}
      <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
         {insights.map((ins, idx) => (
            <div key={idx} className="premium-glass p-5 rounded-[24px] flex items-center gap-4 group hover:border-white/20 transition-all">
               <div className={`p-3 rounded-full ${ins.type === 'warning' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'}`}>
                  <Sparkles className="w-4 h-4" />
               </div>
               <div>
                  <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Sentinela Insight</span>
                  <p className="text-xs font-bold leading-tight mt-1">{ins.text}</p>
               </div>
            </div>
         ))}
      </div>

      {/* VIEW: HEATMAP */}
      {viewMode === 'heatmap' && (
        <div className="space-y-6">
           {floors.map(floor => (
              <div key={floor} className="flex flex-col md:flex-row gap-4">
                 <div className="w-24 py-4 flex items-center justify-center bg-zinc-900/50 rounded-2xl border border-white/5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 -rotate-90 md:rotate-0">{floor.split(' ')[0]}</span>
                 </div>
                 <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                    {mockUnits.filter(u => u.floor === floor).map(unit => (
                       <button 
                          key={unit.id}
                          onClick={() => setSelectedUnit(unit)}
                          className={`relative group p-6 rounded-[24px] border transition-all duration-300 flex flex-col justify-between h-32 ${getStatusColor(unit.status)}`}
                       >
                          <div className="flex justify-between w-full">
                             <span className="text-2xl font-black tracking-tighter opacity-80">{unit.unit}</span>
                             {unit.status !== 'calm' && <AlertTriangle className="w-5 h-5" />}
                          </div>
                          
                          <div className="text-left">
                             <div className="flex gap-1 mb-2">
                                {unit.tags.slice(0, 2).map(t => <span key={t} className="text-[7px] bg-black/20 px-1.5 py-0.5 rounded uppercase font-bold">{t}</span>)}
                             </div>
                             <div className="w-full bg-black/20 h-1 rounded-full overflow-hidden">
                                <div className="h-full bg-current transition-all duration-1000" style={{ width: `${unit.npsScore}%` }} />
                             </div>
                          </div>
                       </button>
                    ))}
                 </div>
              </div>
           ))}
        </div>
      )}

      {/* VIEW: KANBAN */}
      {viewMode === 'kanban' && (
         <div className="flex flex-col lg:flex-row gap-6 overflow-x-auto pb-4">
            {[
               { id: 'analysis', title: 'Em Análise', color: 'border-zinc-700', icon: Search },
               { id: 'mediation', title: 'Mediação', color: 'border-amber-500/50', icon: MessageCircle },
               { id: 'legal', title: 'Jurídico', color: 'border-red-500/50', icon: Gavel },
               { id: 'resolved', title: 'Resolvido', color: 'border-green-500/50', icon: CheckCircle2 },
            ].map(col => (
               <div key={col.id} className="flex-1 min-w-[280px] bg-zinc-900/30 rounded-[32px] p-4 border border-white/5 flex flex-col">
                  <header className={`flex items-center gap-3 p-4 border-b-2 ${col.color} mb-4`}>
                     <col.icon className="w-4 h-4 opacity-60" />
                     <h5 className="font-black uppercase text-xs tracking-widest">{col.title}</h5>
                     <span className="ml-auto text-[10px] bg-white/10 px-2 py-1 rounded-lg font-bold">
                        {issues.filter(i => i.status === col.id).length}
                     </span>
                  </header>
                  
                  <div className="space-y-3 flex-1">
                     {issues.filter(i => i.status === col.id).map(issue => (
                        <div key={issue.id} className="p-5 bg-zinc-800/50 hover:bg-zinc-800 rounded-[24px] border border-white/5 cursor-grab active:cursor-grabbing group transition-all hover:-translate-y-1 shadow-lg">
                           <div className="flex justify-between items-start mb-3">
                              <div className="flex gap-1">
                                 {issue.involvedUnits.map(u => (
                                    <span key={u} className="px-2 py-1 bg-white/5 rounded-md text-[9px] font-black uppercase">UN {u}</span>
                                 ))}
                              </div>
                              <button className="opacity-0 group-hover:opacity-100 transition-opacity"><MoreHorizontal className="w-4 h-4 text-zinc-500" /></button>
                           </div>
                           <h6 className="font-bold text-sm leading-tight mb-2">{issue.title}</h6>
                           <p className="text-[10px] text-zinc-400 line-clamp-2">{issue.description}</p>
                           
                           <div className="mt-4 flex items-center justify-between pt-3 border-t border-white/5">
                              <span className={`text-[9px] font-black uppercase tracking-widest ${issue.severity === 'high' ? 'text-red-500' : issue.severity === 'medium' ? 'text-amber-500' : 'text-blue-500'}`}>
                                 {issue.severity === 'high' ? 'Alta Prioridade' : issue.severity === 'medium' ? 'Atenção' : 'Baixa'}
                              </span>
                              <span className="text-[9px] text-zinc-600 font-bold">{issue.updatedAt}</span>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            ))}
         </div>
      )}

      {/* SIDE PANEL (DRAWER) - RESIDENT PROFILE 360 */}
      {selectedUnit && (
         <div className="fixed inset-0 z-[100] flex justify-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedUnit(null)} />
            <div className="relative w-full max-w-md bg-[#09090b] border-l border-white/10 h-full p-8 overflow-y-auto animate-in slide-in-from-right duration-300 shadow-2xl">
               <button onClick={() => setSelectedUnit(null)} className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-6 h-6" /></button>
               
               {/* Profile Header */}
               <div className="mt-8 text-center">
                  <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center text-3xl font-black border-4 ${selectedUnit.status === 'calm' ? 'border-blue-500/20 bg-blue-500/10 text-blue-500' : selectedUnit.status === 'warning' ? 'border-amber-500/20 bg-amber-500/10 text-amber-500' : 'border-red-500/20 bg-red-500/10 text-red-500 animate-pulse'}`}>
                     {selectedUnit.unit}
                  </div>
                  <h2 className="text-2xl font-black uppercase mt-4">{selectedUnit.residentName}</h2>
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">{selectedUnit.floor}</p>
               </div>

               {/* Tags */}
               <div className="flex flex-wrap justify-center gap-2 mt-6">
                  {selectedUnit.tags.map(tag => (
                     <span key={tag} className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-black uppercase flex items-center gap-1 border border-white/5">
                        <Tag className="w-3 h-3 opacity-50" /> {tag}
                     </span>
                  ))}
               </div>

               {/* Stats Grid */}
               <div className="grid grid-cols-2 gap-4 mt-8">
                  <div className="p-4 bg-zinc-900 rounded-2xl border border-white/5 text-center">
                     <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">NPS Score</span>
                     <div className="text-2xl font-black text-white mt-1 flex items-center justify-center gap-2">
                        {selectedUnit.npsScore} <TrendingUp className="w-4 h-4 text-green-500" />
                     </div>
                  </div>
                  <div className="p-4 bg-zinc-900 rounded-2xl border border-white/5 text-center">
                     <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Ocorrências</span>
                     <div className="text-2xl font-black text-white mt-1 flex items-center justify-center gap-2">
                        {selectedUnit.status === 'calm' ? '0' : '3'} <ShieldAlert className={`w-4 h-4 ${selectedUnit.status === 'calm' ? 'text-zinc-600' : 'text-red-500'}`} />
                     </div>
                  </div>
               </div>

               {/* Timeline */}
               <div className="mt-10">
                  <h5 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-6">Linha do Tempo Unificada</h5>
                  <div className="space-y-6 relative pl-4 border-l border-white/10 ml-2">
                     {[
                        { icon: MessageCircle, title: 'Contato via WhatsApp', time: 'Hoje, 10:00', text: 'Perguntou sobre reserva do salão.' },
                        { icon: AlertTriangle, title: 'Notificação de Barulho', time: 'Ontem, 23:40', text: 'Som alto detectado. Porteiro interfonou.' },
                        { icon: CheckCircle2, title: 'Encomenda Recebida', time: '23/05 - 14:00', text: 'Pacote Amazon entregue.' },
                     ].map((item, idx) => (
                        <div key={idx} className="relative pl-6">
                           <div className="absolute -left-[21px] top-0 w-8 h-8 bg-zinc-900 border border-white/10 rounded-full flex items-center justify-center">
                              <item.icon className="w-3 h-3 text-zinc-400" />
                           </div>
                           <h6 className="text-sm font-bold text-white">{item.title}</h6>
                           <span className="text-[10px] text-zinc-500 font-bold uppercase">{item.time}</span>
                           <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{item.text}</p>
                        </div>
                     ))}
                  </div>
               </div>

               {/* Private Notes */}
               <div className="mt-10 p-5 bg-yellow-500/5 border border-yellow-500/20 rounded-2xl">
                  <div className="flex items-center gap-2 mb-2 text-yellow-500">
                     <User className="w-4 h-4" />
                     <span className="text-[10px] font-black uppercase tracking-widest">Notas Privadas do Síndico</span>
                  </div>
                  <textarea 
                     className="w-full bg-transparent text-sm font-medium text-yellow-100/80 outline-none resize-none placeholder:text-yellow-500/30" 
                     rows={3} 
                     placeholder="Toque para adicionar observações sensíveis..."
                     defaultValue="Morador costuma viajar nos feriados. Reclama se o jornal não for entregue na porta."
                  />
               </div>

            </div>
         </div>
      )}

    </div>
  );
};

export default CrmView;
