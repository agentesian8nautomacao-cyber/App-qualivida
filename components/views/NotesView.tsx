
import React from 'react';
import { Plus, Check, Minus } from 'lucide-react';
import { Note } from '../../types';

interface NotesViewProps {
  allNotes: Note[];
  setEditingNoteId: (id: string | null) => void;
  setNewNoteContent: (val: string) => void;
  setIsNewNoteModalOpen: (val: boolean) => void;
  setAllNotes: (notes: Note[]) => void;
}

const NotesView: React.FC<NotesViewProps> = ({
  allNotes,
  setEditingNoteId,
  setNewNoteContent,
  setIsNewNoteModalOpen,
  setAllNotes
}) => {
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex justify-between items-center">
        <h3 className="text-3xl font-black uppercase tracking-tighter">Bloco de Notas</h3>
        <button onClick={() => { setEditingNoteId(null); setNewNoteContent(''); setIsNewNoteModalOpen(true); }} className="px-6 py-3 bg-white text-black rounded-full text-[10px] font-black uppercase shadow-lg hover:scale-105 transition-transform"><Plus className="w-4 h-4 inline mr-2" /> Criar Nota</button>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {allNotes.map(note => (
          <div 
            key={note.id} 
            onClick={() => { setEditingNoteId(note.id); setNewNoteContent(note.content); setIsNewNoteModalOpen(true); }}
            className={`premium-glass p-6 rounded-[32px] cursor-pointer hover:border-white/40 transition-all ${note.completed ? 'opacity-50' : ''}`}
          >
            <div className="flex justify-between items-start mb-4">
              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 bg-white/5 rounded-lg">{note.category}</span>
              <span className="text-[9px] font-black opacity-40 uppercase">{note.date.includes('T') ? new Date(note.date).toLocaleDateString() : note.date}</span>
            </div>
            <p className={`text-sm font-medium ${note.completed ? 'line-through' : ''}`}>{note.content}</p>
            <div className="mt-6 flex justify-end">
               <button 
                 onClick={(e) => {
                   e.stopPropagation();
                   setAllNotes(allNotes.map(n => n.id === note.id ? {...n, completed: !n.completed} : n));
                 }} 
                 className="p-2 hover:bg-white/10 rounded-xl transition-all"
               >
                 {note.completed ? <Check className="w-5 h-5 text-green-500" /> : <Minus className="w-5 h-5 opacity-40" />}
               </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotesView;
