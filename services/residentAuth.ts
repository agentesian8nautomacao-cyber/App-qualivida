import { supabase } from './supabase';
import { Resident } from '../types';

// Função simples para hash de senha (usando bcrypt via Supabase Edge Function seria ideal)
// Por enquanto, vamos usar uma função simples baseada em crypto
const hashPassword = async (password: string): Promise<string> => {
  // Usar Web Crypto API para hash simples
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
};

// Registrar novo morador
export const registerResident = async (
  resident: Omit<Resident, 'id'>,
  password: string
): Promise<{ resident: Resident; success: boolean; error?: string }> => {
  try {
    // Verificar se já existe morador com essa unidade
    const { data: existing, error: checkError } = await supabase
      .from('residents')
      .select('id, unit')
      .eq('unit', resident.unit.toUpperCase())
      .single();

    if (existing) {
      return {
        resident: existing as Resident,
        success: false,
        error: `Já existe um cadastro para a unidade ${resident.unit.toUpperCase()}`
      };
    }

    // Hash da senha
    const passwordHash = await hashPassword(password);

    // Inserir morador
    const { data, error } = await supabase
      .from('residents')
      .insert({
        name: resident.name.trim(),
        unit: resident.unit.toUpperCase(),
        email: resident.email || null,
        phone: resident.phone || null,
        whatsapp: resident.whatsapp || null,
        password_hash: passwordHash,
        extra_data: resident.extraData || null
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao cadastrar morador:', error);
      return {
        resident: resident as Resident,
        success: false,
        error: error.message || 'Erro ao cadastrar morador'
      };
    }

    return {
      resident: {
        id: data.id,
        name: data.name,
        unit: data.unit,
        email: data.email || '',
        phone: data.phone || '',
        whatsapp: data.whatsapp || '',
        extraData: data.extra_data
      },
      success: true
    };
  } catch (err: any) {
    console.error('Erro ao registrar morador:', err);
    return {
      resident: resident as Resident,
      success: false,
      error: err.message || 'Erro ao cadastrar morador'
    };
  }
};

// Login de morador
export const loginResident = async (
  unit: string,
  password: string
): Promise<{ resident: Resident | null; success: boolean; error?: string }> => {
  try {
    // Buscar morador pela unidade
    const { data, error } = await supabase
      .from('residents')
      .select('*')
      .eq('unit', unit.toUpperCase())
      .single();

    if (error || !data) {
      return {
        resident: null,
        success: false,
        error: 'Unidade ou senha incorretos'
      };
    }

    // Verificar senha
    if (!data.password_hash) {
      return {
        resident: null,
        success: false,
        error: 'Morador não possui senha cadastrada. Faça o cadastro primeiro.'
      };
    }

    const isValid = await verifyPassword(password, data.password_hash);
    
    if (!isValid) {
      return {
        resident: null,
        success: false,
        error: 'Unidade ou senha incorretos'
      };
    }

    return {
      resident: {
        id: data.id,
        name: data.name,
        unit: data.unit,
        email: data.email || '',
        phone: data.phone || '',
        whatsapp: data.whatsapp || '',
        extraData: data.extra_data
      },
      success: true
    };
  } catch (err: any) {
    console.error('Erro ao fazer login:', err);
    return {
      resident: null,
      success: false,
      error: err.message || 'Erro ao fazer login'
    };
  }
};

// Buscar morador por unidade (sem autenticação)
export const getResidentByUnit = async (unit: string): Promise<Resident | null> => {
  try {
    const { data, error } = await supabase
      .from('residents')
      .select('*')
      .eq('unit', unit.toUpperCase())
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      unit: data.unit,
      email: data.email || '',
      phone: data.phone || '',
      whatsapp: data.whatsapp || '',
      extraData: data.extra_data
    };
  } catch (err) {
    console.error('Erro ao buscar morador:', err);
    return null;
  }
};

// Atualizar senha do morador
export const updateResidentPassword = async (
  residentId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const passwordHash = await hashPassword(newPassword);

    const { error } = await supabase
      .from('residents')
      .update({ password_hash: passwordHash })
      .eq('id', residentId);

    if (error) {
      return {
        success: false,
        error: error.message || 'Erro ao atualizar senha'
      };
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Erro ao atualizar senha'
    };
  }
};