
import React, { useState, useEffect } from 'react';
import { ShieldCheck, ArrowRight, User, Lock, Eye, EyeOff } from 'lucide-react';
import { UserRole } from '../types';

interface LoginProps {
  onLogin: (role: UserRole) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('PORTEIRO');
  const [username, setUsername] = useState('portaria');
  const [password, setPassword] = useState('123456');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [showForm, setShowForm] = useState(true);

  // Intro removida - o vídeo já foi exibido antes
  // useEffect(() => {
  //   const introTimer = setTimeout(() => {
  //     setShowIntro(false);
  //     setShowForm(true);
  //   }, 2800); 
  //   return () => clearTimeout(introTimer);
  // }, []);

  // Adiciona listener global para tecla Enter (atalho para computadores)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && showForm && !loading) {
        handleLogin();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showForm, loading, selectedRole, username, password]);

  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role);
    if (role === 'PORTEIRO') {
      setUsername('portaria');
      setPassword('123456');
    } else if (role === 'SINDICO') {
      setUsername('admin');
      setPassword('admin123');
    } else if (role === 'MORADOR') {
      setUsername('morador');
      setPassword('morador123');
    }
  };

  const handleLogin = (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    if (loading) return;
    
    setLoading(true);
    setTimeout(() => {
      onLogin(selectedRole);
    }, 1500);
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#050505] overflow-hidden">
      {/* Intro removida - vídeo já foi exibido */}
      
      <div className="relative z-10 w-full max-w-md p-4 opacity-100">
        <div className="bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[48px] p-8 md:p-12 shadow-2xl relative overflow-hidden group">
          
          <div className="relative z-10">
            <header className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-20 h-20 mb-8 relative">
                 <div className="absolute inset-0 bg-white/10 rounded-3xl blur-xl" />
                 <div className="relative z-10 w-full h-full rounded-3xl bg-white flex items-center justify-center shadow-2xl">
                    <ShieldCheck className="w-10 h-10 text-black" />
                 </div>
              </div>
              <h2 className="text-2xl font-black tracking-tighter mb-1 shimmer-text">QUALIVIDA</h2>
              <p className="text-[10px] text-zinc-500 uppercase tracking-[0.3em] font-black">Acesso Restrito</p>
            </header>

            <div className="bg-white/5 p-1 rounded-2xl mb-8 flex relative border border-white/5">
              <div 
                className={`absolute top-1 bottom-1 w-[calc(33.333%-4px)] bg-white rounded-xl transition-all duration-500 shadow-xl ${
                  selectedRole === 'SINDICO' ? 'translate-x-[calc(200%+0px)]' : 
                  selectedRole === 'MORADOR' ? 'translate-x-[calc(100%+0px)]' : 
                  'translate-x-0'
                }`}
              />
              <button 
                type="button"
                onClick={() => handleRoleChange('MORADOR')}
                className={`relative z-10 flex-1 py-3 text-[10px] font-black uppercase transition-colors ${
                  selectedRole === 'MORADOR' ? 'text-black' : 'text-zinc-500'
                }`}
              >
                Morador
              </button>
              <button 
                type="button"
                onClick={() => handleRoleChange('PORTEIRO')}
                className={`relative z-10 flex-1 py-3 text-[10px] font-black uppercase transition-colors ${
                  selectedRole === 'PORTEIRO' ? 'text-black' : 'text-zinc-500'
                }`}
              >
                Portaria
              </button>
              <button 
                type="button"
                onClick={() => handleRoleChange('SINDICO')}
                className={`relative z-10 flex-1 py-3 text-[10px] font-black uppercase transition-colors ${
                  selectedRole === 'SINDICO' ? 'text-black' : 'text-zinc-500'
                }`}
              >
                Síndico
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-4">
                <div className="relative">
                  <User className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                  <input 
                    type="text" 
                    placeholder="Usuário" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    className="w-full pl-8 pr-4 py-3 bg-transparent border-b border-white/10 text-white text-sm outline-none focus:border-white transition-all placeholder:text-zinc-700 font-medium"
                    required
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Senha" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="w-full pl-8 pr-12 py-3 bg-transparent border-b border-white/10 text-white text-sm outline-none focus:border-white transition-all placeholder:text-zinc-700 font-medium"
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="group w-full py-5 bg-white text-black font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl flex items-center justify-center gap-3 hover:bg-zinc-200 active:scale-95 transition-all shadow-[0_20px_40px_-10px_rgba(255,255,255,0.2)]"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                ) : (
                  <>
                    Entrar no Sistema
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
