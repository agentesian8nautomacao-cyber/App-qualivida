import React, { useState, useRef } from 'react';
import { Upload, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { Boleto, BoletoType, Resident } from '../../types';

interface ImportBoletosModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (boletos: Boleto[]) => void;
  existingBoletos: Boleto[];
  allResidents: Resident[];
}

const ImportBoletosModal: React.FC<ImportBoletosModalProps> = ({
  isOpen,
  onClose,
  onImport,
  existingBoletos,
  allResidents
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<Boleto[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    if (selectedFiles.length > 1) {
      setErrors(['Por enquanto, selecione apenas um arquivo por vez.']);
      return;
    }

    const selectedFile = selectedFiles[0];
    setFile(selectedFile);
    processFile(selectedFile);
  };

  const processFile = async (fileToProcess: File) => {
    setIsProcessing(true);
    setErrors([]);

    try {
      const text = await fileToProcess.text();

      // Tentar interpretar como CSV simples
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        setErrors(['Arquivo deve ter pelo menos cabeçalho e uma linha de dados.']);
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const boletos: Boleto[] = [];
      const csvErrors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());

        const unit = values[0] || '';
        const referenceMonth = values[1] || '';
        const dueDate = values[2] || '';
        const amountStr = values[3] || '';
        const amount = parseFloat(amountStr.replace(/[^\d,.-]/g, '').replace(',', '.'));

        if (!unit || !referenceMonth || !dueDate || isNaN(amount) || amount <= 0) {
          csvErrors.push(`Linha ${i + 1}: Dados inválidos`);
          continue;
        }

        // Procurar morador
        const resident = allResidents.find(r => r.unit.toLowerCase() === unit.toLowerCase());
        if (!resident) {
          csvErrors.push(`Linha ${i + 1}: Morador não encontrado para unidade "${unit}"`);
          continue;
        }

        // Verificar duplicata
        const exists = existingBoletos.some(b =>
          b.unit === resident.unit && b.referenceMonth === referenceMonth
        );
        if (exists) {
          csvErrors.push(`Linha ${i + 1}: Boleto já existe para ${resident.unit} - ${referenceMonth}`);
          continue;
        }

        let parsedDate: Date;
        try {
          if (dueDate.includes('/')) {
            const [day, month, year] = dueDate.split('/');
            parsedDate = new Date(`${year}-${month}-${day}`);
          } else {
            parsedDate = new Date(dueDate);
          }
          if (isNaN(parsedDate.getTime())) {
            throw new Error('Data inválida');
          }
        } catch {
          csvErrors.push(`Linha ${i + 1}: Data inválida: ${dueDate}`);
          continue;
        }

        boletos.push({
          id: Date.now().toString() + i,
          residentName: resident.name,
          unit: resident.unit,
          referenceMonth: referenceMonth,
          dueDate: parsedDate.toISOString().split('T')[0],
          amount: amount,
          status: 'Pendente',
          boletoType: 'condominio',
          resident_id: resident.id,
          unidade_id: resident.unit,
          nosso_numero: Date.now().toString() + i
        });
      }

      if (csvErrors.length > 0) {
        setErrors(csvErrors);
      }
      setPreviewData(boletos);

    } catch (error) {
      setErrors([`Erro ao processar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (previewData.length === 0) {
      setErrors(['Nenhum boleto válido para importar.']);
      return;
    }
    setIsImporting(true);
    setErrors([]);
    try {
      await onImport(previewData);
      handleClose();
    } catch (e) {
      const message = (e instanceof Error ? e.message : String(e ?? '')).trim() || 'Erro ao importar.';
      setErrors([message]);
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreviewData([]);
    setErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const downloadTemplate = () => {
    const template = `unidade,mes,vencimento,valor
102A,01/2025,10/01/2025,450.00
405B,01/2025,10/01/2025,120.50
301,02/2025,15/02/2025,85.00`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_boletos.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[var(--sidebar-bg)] border border-[var(--border-color)] rounded-3xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-black uppercase tracking-tighter">Importar Boletos</h3>
            <p className="text-xs opacity-40 mt-1">Importe boletos via arquivo CSV.</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/10 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6 p-4 bg-[var(--glass-bg)] border border-[var(--border-color)] rounded-xl">
          <h4 className="text-sm font-bold mb-2">📋 Formato CSV</h4>
          <p className="text-xs opacity-80">
            O arquivo deve ter as colunas: unidade, mes, vencimento, valor
          </p>
        </div>

        <div className="mb-6">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[var(--border-color)] rounded-2xl p-8 text-center cursor-pointer hover:border-[var(--text-primary)]/30 transition-all"
          >
            <Upload className="w-12 h-12 mx-auto mb-4 opacity-40" />
            <p className="text-sm font-bold mb-2">
              {file ? file.name : 'Clique para selecionar arquivo CSV'}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          <button
            onClick={downloadTemplate}
            className="mt-4 text-xs opacity-60 hover:opacity-100 flex items-center gap-2 transition-opacity"
          >
            Baixar template CSV
          </button>
        </div>

        {errors.length > 0 && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <p className="text-xs font-black text-red-400">Erros encontrados:</p>
            </div>
            <ul className="text-xs opacity-80 space-y-1 max-h-32 overflow-y-auto">
              {errors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          </div>
        )}

        {isProcessing && (
          <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-bold text-blue-400">Processando arquivo...</p>
            </div>
          </div>
        )}

        {previewData.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <p className="text-sm font-black">
                  {previewData.length} boleto(s) pronto(s) para importar
                </p>
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto border border-[var(--border-color)] rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-white/5 sticky top-0">
                  <tr>
                    <th className="p-3 text-left font-black uppercase">Unidade</th>
                    <th className="p-3 text-left font-black uppercase">Morador</th>
                    <th className="p-3 text-left font-black uppercase">Mês</th>
                    <th className="p-3 text-left font-black uppercase">Valor</th>
                    <th className="p-3 text-left font-black uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((boleto, index) => (
                    <tr key={boleto.id} className="border-t border-[var(--border-color)]">
                      <td className="p-3">{boleto.unit}</td>
                      <td className="p-3">{boleto.residentName}</td>
                      <td className="p-3">{boleto.referenceMonth}</td>
                      <td className="p-3">{formatCurrency(boleto.amount)}</td>
                      <td className="p-3">
                        <span className="px-2 py-1 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-400">
                          {boleto.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={handleClose}
            className="px-6 py-3 bg-white/5 border border-[var(--border-color)] rounded-xl text-xs font-black uppercase hover:bg-white/10 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleImport}
            disabled={previewData.length === 0 || isProcessing || isImporting}
            className="px-6 py-3 bg-[var(--text-primary)] text-[var(--bg-color)] rounded-xl text-xs font-black uppercase hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isImporting ? 'Importando...' : `Importar ${previewData.length > 0 ? `(${previewData.length})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportBoletosModal;