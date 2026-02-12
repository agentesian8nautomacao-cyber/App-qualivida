import { useState, useEffect } from 'react';
import Dexie from 'dexie';
import { FinancialEntry } from '../types';

// Database setup
class FinancialDatabase extends Dexie {
  financialEntries: Dexie.Table<FinancialEntry, string>;

  constructor() {
    super('FinancialDatabase');
    this.version(1).stores({
      financialEntries: 'id, type, category, date, createdAt, referenceMonth'
    });
    this.financialEntries = this.table('financialEntries');
  }
}

const db = new FinancialDatabase();

export const useFinancialEntries = () => {
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Load entries from database
  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      setLoading(true);
      const allEntries = await db.financialEntries.orderBy('date').reverse().toArray();
      setEntries(allEntries);
    } catch (error) {
      console.error('Error loading financial entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const addEntry = async (entryData: Omit<FinancialEntry, 'id' | 'createdAt'>) => {
    try {
      const newEntry: FinancialEntry = {
        ...entryData,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        createdAt: new Date().toISOString()
      };

      await db.financialEntries.add(newEntry);
      await loadEntries(); // Reload to get updated data
      return newEntry;
    } catch (error) {
      console.error('Error adding financial entry:', error);
      throw error;
    }
  };

  const updateEntry = async (id: string, updates: Partial<Omit<FinancialEntry, 'id' | 'createdAt'>>) => {
    try {
      await db.financialEntries.update(id, updates);
      await loadEntries();
    } catch (error) {
      console.error('Error updating financial entry:', error);
      throw error;
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      await db.financialEntries.delete(id);
      await loadEntries();
    } catch (error) {
      console.error('Error deleting financial entry:', error);
      throw error;
    }
  };

  const getEntriesByPeriod = (month: number, year: number) => {
    const referenceMonth = `${month.toString().padStart(2, '0')}/${year}`;
    return entries.filter(entry => entry.referenceMonth === referenceMonth);
  };

  const getTotalsByPeriod = (month: number, year: number) => {
    const periodEntries = getEntriesByPeriod(month, year);

    return periodEntries.reduce(
      (totals, entry) => {
        if (entry.type === 'receita') {
          totals.receitas += entry.amount;
        } else {
          totals.despesas += entry.amount;
        }
        totals.saldo = totals.receitas - totals.despesas;
        return totals;
      },
      { receitas: 0, despesas: 0, saldo: 0 }
    );
  };

  return {
    entries,
    loading,
    addEntry,
    updateEntry,
    deleteEntry,
    getEntriesByPeriod,
    getTotalsByPeriod,
    loadEntries
  };
};