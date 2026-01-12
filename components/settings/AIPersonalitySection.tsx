import React, { useState } from 'react';
import { Brain, Save, Check, User, Volume2, Sparkles } from 'lucide-react';
import { useAppConfig } from '../../contexts/AppConfigContext';

const AIPersonalitySection: React.FC = () => {
  const { config, updateAIConfig } = useAppConfig();
  const [aiConfig, setAiConfig] = useState(config.aiConfig);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    updateAIConfig(aiConfig);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="premium-glass rounded-[32px] p-6 md:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-[var(--glass-bg)] flex items-center justify-center border border-[var(--border-color)]">
          <Brain className="w-6 h-6 text-[var(--text-primary)]" />
        </div>
        <div>
          <h3 className="text-xl font-black uppercase tracking-tight">Personalização da IA</h3>
          <p className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)] mt-1">
            Configure o nome, voz e comportamento do agente Sentinela
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-bold uppercase tracking-wide mb-2 text-[var(--text-primary)]">
            Nome do Agente
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-secondary)]" />
            <input
              type="text"
              value={aiConfig.name}
              onChange={(e) => setAiConfig({ ...aiConfig, name: e.target.value })}
              placeholder="Ex: Sentinela, Assistente, etc."
              className="w-full pl-12 pr-4 py-3 bg-[var(--glass-bg)] border border-[var(--border-color)] rounded-xl outline-none focus:ring-2 focus:ring-[var(--text-primary)]/20 transition-all font-medium"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold uppercase tracking-wide mb-2 text-[var(--text-primary)]">
              <Volume2 className="w-4 h-4 inline mr-2" />
              Gênero da Voz
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setAiConfig({ ...aiConfig, voiceGender: 'male' })}
                className={`flex-1 px-4 py-3 rounded-xl font-bold uppercase tracking-wide transition-all ${
                  aiConfig.voiceGender === 'male'
                    ? 'bg-[var(--text-primary)] text-[var(--bg-color)]'
                    : 'bg-[var(--glass-bg)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Masculino
              </button>
              <button
                onClick={() => setAiConfig({ ...aiConfig, voiceGender: 'female' })}
                className={`flex-1 px-4 py-3 rounded-xl font-bold uppercase tracking-wide transition-all ${
                  aiConfig.voiceGender === 'female'
                    ? 'bg-[var(--text-primary)] text-[var(--bg-color)]'
                    : 'bg-[var(--glass-bg)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Feminino
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold uppercase tracking-wide mb-2 text-[var(--text-primary)]">
              <Sparkles className="w-4 h-4 inline mr-2" />
              Estilo de Voz
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setAiConfig({ ...aiConfig, voiceStyle: 'serious' })}
                className={`flex-1 px-4 py-3 rounded-xl font-bold uppercase tracking-wide transition-all ${
                  aiConfig.voiceStyle === 'serious'
                    ? 'bg-[var(--text-primary)] text-[var(--bg-color)]'
                    : 'bg-[var(--glass-bg)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Sério
              </button>
              <button
                onClick={() => setAiConfig({ ...aiConfig, voiceStyle: 'animated' })}
                className={`flex-1 px-4 py-3 rounded-xl font-bold uppercase tracking-wide transition-all ${
                  aiConfig.voiceStyle === 'animated'
                    ? 'bg-[var(--text-primary)] text-[var(--bg-color)]'
                    : 'bg-[var(--glass-bg)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Animado
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold uppercase tracking-wide mb-2 text-[var(--text-primary)]">
            Instruções Externas (Comportamento)
          </label>
          <textarea
            value={aiConfig.externalInstructions}
            onChange={(e) => setAiConfig({ ...aiConfig, externalInstructions: e.target.value })}
            placeholder="Ex: Você é um assistente operacional profissional. Seja objetivo, prestativo e eficiente."
            rows={6}
            className="w-full px-4 py-3 bg-[var(--glass-bg)] border border-[var(--border-color)] rounded-xl outline-none focus:ring-2 focus:ring-[var(--text-primary)]/20 transition-all font-medium resize-none"
            style={{ color: 'var(--text-primary)' }}
          />
          <p className="text-xs text-[var(--text-secondary)] mt-2">
            Estas instruções personalizam o comportamento do agente. As instruções internas (lógica do sistema) são fixas e não podem ser alteradas.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-3 bg-[var(--text-primary)] text-[var(--bg-color)] rounded-xl font-black uppercase tracking-wide transition-all hover:scale-105 active:scale-95"
        >
          {saved ? (
            <>
              <Check className="w-4 h-4" />
              Configurações Salvas!
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Salvar Configurações da IA
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default AIPersonalitySection;

