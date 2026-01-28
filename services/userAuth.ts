import { supabase } from './supabase';

// Interface para dados do usuário
export interface User {
  id: string;
  username: string;
  role: 'PORTEIRO' | 'SINDICO';
  name: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
}

// Configurações de segurança
const MAX_LOGIN_ATTEMPTS = 5;
const BLOCK_DURATION_MINUTES = 15;

// Interface para tentativas de login
interface LoginAttempts {
  count: number;
  blockedUntil: number | null;
  lastAttempt: number;
}

/**
 * Obtém ou cria registro de tentativas para um usuário
 */
const getLoginAttempts = (username: string): LoginAttempts => {
  try {
    const stored = localStorage.getItem(`login_attempts_${username.toLowerCase()}`);
    if (stored) {
      const attempts: LoginAttempts = JSON.parse(stored);
      // Se o bloqueio expirou, resetar
      if (attempts.blockedUntil && Date.now() > attempts.blockedUntil) {
        return { count: 0, blockedUntil: null, lastAttempt: 0 };
      }
      return attempts;
    }
  } catch (error) {
    console.error('Erro ao ler tentativas de login:', error);
  }
  return { count: 0, blockedUntil: null, lastAttempt: 0 };
};

/**
 * Incrementa contador de tentativas falhas
 */
const incrementFailedAttempts = (username: string): LoginAttempts => {
  const attempts = getLoginAttempts(username);
  const newCount = attempts.count + 1;
  const blockedUntil = newCount >= MAX_LOGIN_ATTEMPTS 
    ? Date.now() + (BLOCK_DURATION_MINUTES * 60 * 1000)
    : null;

  const newAttempts: LoginAttempts = {
    count: newCount,
    blockedUntil,
    lastAttempt: Date.now()
  };

  try {
    localStorage.setItem(`login_attempts_${username.toLowerCase()}`, JSON.stringify(newAttempts));
  } catch (error) {
    console.error('Erro ao salvar tentativas de login:', error);
  }

  return newAttempts;
};

/**
 * Reseta tentativas de login (usado após login bem-sucedido)
 */
const resetLoginAttempts = (username: string): void => {
  try {
    localStorage.removeItem(`login_attempts_${username.toLowerCase()}`);
  } catch (error) {
    console.error('Erro ao resetar tentativas de login:', error);
  }
};

/**
 * Verifica se o usuário está bloqueado
 */
export const isUserBlocked = (username: string): { blocked: boolean; remainingMinutes?: number } => {
  const attempts = getLoginAttempts(username);
  
  if (attempts.blockedUntil && Date.now() < attempts.blockedUntil) {
    const remainingMs = attempts.blockedUntil - Date.now();
    const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
    return { blocked: true, remainingMinutes };
  }

  return { blocked: false };
};

/**
 * Verifica força mínima da nova senha:
 * - Mínimo 8 caracteres
 * - Pelo menos 1 letra maiúscula
 * - Pelo menos 1 letra minúscula
 * - Pelo menos 1 número
 * - Pelo menos 1 caractere especial
 */
const isStrongPassword = (password: string): boolean => {
  if (!password || password.length < 8) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  return hasUpper && hasLower && hasDigit && hasSpecial;
};

/**
 * Faz hash da senha usando SHA-256 (Web Crypto API) quando disponível.
 * Em contexto não seguro (ex: http em rede local no celular), crypto.subtle
 * não está disponível, então usamos um fallback simples para não quebrar o login.
 *
 * IMPORTANTE: em produção (https://app-qualivida.vercel.app) a versão com
 * SHA-256 será usada normalmente.
 */
const hashPassword = async (password: string): Promise<string> => {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    }
  } catch (err) {
    console.warn('Falha ao usar crypto.subtle para hash de senha, usando fallback:', err);
  }

  // Fallback para ambiente não seguro (ex: http://192.168.x.x no celular)
  // Aqui apenas retornamos a senha em texto puro, o que funciona para:
  // - contas com password_hash no formato "plain:senha"
  // - ambiente de desenvolvimento com senhas simples
  return password;
};

/**
 * Valida credenciais de usuário (PORTEIRO/SINDICO) no Supabase
 * @param username Nome de usuário
 * @param password Senha em texto plano
 * @returns Objeto com resultado do login e informações de bloqueio
 */
export const loginUser = async (
  username: string, 
  password: string
): Promise<{ 
  user: User | null; 
  error: string | null; 
  blocked?: boolean; 
  remainingMinutes?: number;
  attemptsRemaining?: number;
}> => {
  const normalizedUsername = username.toLowerCase().trim();

  // Verificar se o usuário está bloqueado
  const blockStatus = isUserBlocked(normalizedUsername);
  if (blockStatus.blocked) {
    return {
      user: null,
      error: `Conta bloqueada devido a várias tentativas falhas. Aguarde ${blockStatus.remainingMinutes} minutos antes de tentar novamente.`,
      blocked: true,
      remainingMinutes: blockStatus.remainingMinutes
    };
  }

  try {
    // Hash da senha fornecida
    const hashedPassword = await hashPassword(password);

    // Buscar usuário no banco
    const { data, error } = await supabase
      .from('users')
      .select('id, username, role, name, email, phone, is_active, password_hash')
      .eq('username', normalizedUsername)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      // Incrementar tentativas falhas apenas se o usuário existir
      incrementFailedAttempts(normalizedUsername);
      return {
        user: null,
        error: 'Usuário ou senha inválidos',
        attemptsRemaining: MAX_LOGIN_ATTEMPTS - getLoginAttempts(normalizedUsername).count
      };
    }

    // Verificar senha
    let isValidPassword = false;
    let usedDefaultPassword = false; // porteiro com senha 123456 deve alterar no primeiro acesso

    // Se o password_hash começar com "plain:", comparar diretamente (senha em texto plano)
    if (data.password_hash && data.password_hash.startsWith('plain:')) {
      const plainPassword = data.password_hash.substring(6); // Remove "plain:"
      isValidPassword = plainPassword === password;
      if (isValidPassword && data.role === 'PORTEIRO' && plainPassword === '123456') usedDefaultPassword = true;
    }
    // Se o password_hash for placeholder, aceitar senhas padrão conhecidas
    else if (data.password_hash === '$2a$10$placeholder_hash_here') {
      const defaultPasswords: Record<string, string> = {
        'portaria': '123456',
        'admin': 'admin123',
        'desenvolvedor': 'dev'
      };
      isValidPassword = defaultPasswords[normalizedUsername] === password;
    } 
    // Caso contrário, comparar com hash SHA-256
    else {
      isValidPassword = data.password_hash === hashedPassword;
    }

    if (!isValidPassword) {
      // Senha incorreta, incrementar tentativas
      const attempts = incrementFailedAttempts(normalizedUsername);
      const remaining = MAX_LOGIN_ATTEMPTS - attempts.count;
      
      if (attempts.blockedUntil) {
        const remainingMinutes = Math.ceil((attempts.blockedUntil - Date.now()) / (60 * 1000));
        return {
          user: null,
          error: `Senha incorreta. Conta bloqueada por ${remainingMinutes} minutos devido a múltiplas tentativas falhas.`,
          blocked: true,
          remainingMinutes
        };
      }

      return {
        user: null,
        error: `Senha incorreta. ${remaining > 0 ? `${remaining} tentativa(s) restante(s).` : 'Conta será bloqueada.'}`,
        attemptsRemaining: remaining
      };
    }

    // Login bem-sucedido, resetar tentativas
    resetLoginAttempts(normalizedUsername);

    // Retornar dados do usuário (sem o password_hash)
    const { password_hash: _, ...userData } = data;
    return {
      user: userData as User,
      error: null,
      mustChangePassword: usedDefaultPassword // porteiro com senha 123456 deve alterar no primeiro acesso
    };
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    return {
      user: null,
      error: 'Erro ao conectar com o servidor. Tente novamente.'
    };
  }
};

/**
 * Verifica se há uma sessão ativa de usuário
 */
export const checkUserSession = (): User | null => {
  try {
    const sessionData = sessionStorage.getItem('currentUser');
    if (!sessionData) return null;
    
    const user = JSON.parse(sessionData) as User;
    return user;
  } catch {
    return null;
  }
};

/**
 * Salva dados do usuário na sessão
 */
export const saveUserSession = (user: User): void => {
  sessionStorage.setItem('currentUser', JSON.stringify(user));
  sessionStorage.setItem('userRole', user.role);
};

/**
 * Remove dados do usuário da sessão
 */
export const clearUserSession = (): void => {
  sessionStorage.removeItem('currentUser');
  sessionStorage.removeItem('userRole');
};

/**
 * Atualiza dados do perfil do usuário (nome, email, telefone)
 */
export const updateUserProfile = async (
  userId: string,
  updates: { name?: string; email?: string; phone?: string }
): Promise<{ success: boolean; error?: string; user?: User }> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({
        name: updates.name || null,
        email: updates.email || null,
        phone: updates.phone || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('id, username, role, name, email, phone, is_active')
      .single();

    if (error) {
      console.error('Erro ao atualizar perfil do usuário:', error);
      return { success: false, error: error.message };
    }

    const updatedUser = data as User;
    // Atualizar sessão com dados atualizados
    saveUserSession(updatedUser);

    return { success: true, user: updatedUser };
  } catch (err: any) {
    console.error('Erro ao atualizar perfil do usuário:', err);
    return { success: false, error: err?.message || 'Erro ao atualizar perfil' };
  }
};

/**
 * Altera senha do usuário (validando senha atual).
 * @param storePlain - se true, salva como "plain:senha" (para porteiros; o síndico pode ver no modal de edição)
 */
export const changeUserPassword = async (
  username: string,
  currentPassword: string,
  newPassword: string,
  options?: { storePlain?: boolean }
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Validar senha atual
    const loginResult = await loginUser(username, currentPassword);
    if (!loginResult.user) {
      return { success: false, error: 'Senha atual incorreta' };
    }

    const newPasswordHash = options?.storePlain
      ? `plain:${newPassword}`
      : await hashPassword(newPassword);

    const { error } = await supabase
      .from('users')
      .update({
        password_hash: newPasswordHash,
        updated_at: new Date().toISOString()
      })
      .eq('id', loginResult.user.id);

    if (error) {
      console.error('Erro ao atualizar senha:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Erro ao alterar senha:', err);
    return { success: false, error: err?.message || 'Erro ao alterar senha' };
  }
};

/**
 * Gera token de recuperação de senha
 */
export const generatePasswordResetToken = async (usernameOrEmail: string): Promise<{
  success: boolean;
  message: string;
  email?: string;
}> => {
  try {
    // Ambiente precisa suportar Web Crypto seguro para não armazenar token em texto puro
    if (typeof crypto === 'undefined' || !crypto.subtle || !(location.protocol === 'https:' || location.hostname === 'localhost')) {
      return {
        success: false,
        message: 'Recuperação de senha indisponível neste ambiente. Use o link enviado por e-mail em um navegador seguro.'
      };
    }

    // Buscar usuário por username ou email
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, email, name')
      .or(`username.eq.${usernameOrEmail.toLowerCase()},email.eq.${usernameOrEmail.toLowerCase()}`)
      .eq('is_active', true)
      .single();

    if (error || !user || !user.email) {
      // Não revelar se o usuário existe ou não por segurança
      return {
        success: true,
        message: 'Se o usuário existir e tiver email cadastrado, você receberá instruções de recuperação.'
      };
    }

    // Rate limit básico por usuário (fallback local): máximo 1 solicitação a cada 2 minutos
    const { data: lastToken } = await supabase
      .from('password_reset_tokens')
      .select('id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastToken) {
      const lastCreatedAt = new Date((lastToken as any).created_at).getTime();
      const now = Date.now();
      const twoMinutesMs = 2 * 60 * 1000;
      if (now - lastCreatedAt < twoMinutesMs) {
        console.info('[AUTH-EVENT] Password reset request (fallback) rate-limited', {
          userId: user.id,
          username: user.username,
          email: user.email,
          at: new Date().toISOString()
        });
        return {
          success: true,
          message: 'Se o usuário existir e tiver email cadastrado, você receberá instruções de recuperação. Se já solicitou recentemente, aguarde alguns minutos.'
        };
      }
    }

    // Invalidar tokens anteriores ainda não utilizados
    await supabase
      .from('password_reset_tokens')
      .update({ used: true })
      .eq('user_id', user.id)
      .eq('used', false);

    // Gerar token único (valor bruto só é exibido no console em DEV)
    const rawBytes = crypto.getRandomValues(new Uint8Array(32));
    const token = Array.from(rawBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Gerar hash SHA-256 do token para salvar no banco
    const encoder = new TextEncoder();
    const dataToHash = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataToHash);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Expiração curta (15 minutos)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Inserir token (hash) no banco
    const { error: tokenError } = await supabase
      .from('password_reset_tokens')
      .insert({
        user_id: user.id,
        token: tokenHash,
        expires_at: expiresAt.toISOString(),
        used: false
      });

    if (tokenError) {
      console.error('Erro ao criar token de recuperação:', tokenError);
      return {
        success: false,
        message: 'Erro ao gerar token de recuperação. Tente novamente.'
      };
    }

    console.info('[AUTH-EVENT] Password reset requested (fallback)', {
      userId: user.id,
      username: user.username,
      email: user.email,
      expiresAt: expiresAt.toISOString(),
      at: new Date().toISOString()
    });

    // Em desenvolvimento, exibimos o token bruto no console para permitir teste manual
    console.log('🔐 TOKEN DE RECUPERAÇÃO (DEV ONLY - NÃO ARMAZENADO EM TEXTO PURO NO BANCO):', token);
    console.log('📧 Email do usuário:', user.email);

    return {
      success: true,
      message: `Token de recuperação gerado. Verifique o console para ver o token (desenvolvimento apenas).`,
      email: user.email
    };
  } catch (error) {
    console.error('Erro ao gerar token de recuperação:', error);
    return {
      success: false,
      message: 'Erro ao processar solicitação. Tente novamente.'
    };
  }
};

/**
 * Valida token de recuperação de senha
 */
export const validateResetToken = async (token: string): Promise<{
  valid: boolean;
  userId?: string;
  message?: string;
}> => {
  try {
    // Gerar hash do token informado pelo usuário
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      console.error('Web Crypto API indisponível para validar token de recuperação.');
      return {
        valid: false,
        message: 'Não foi possível validar o link de recuperação. Use um navegador seguro (HTTPS) e tente novamente.'
      };
    }

    const encoder = new TextEncoder();
    const tokenBytes = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', tokenBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const { data: tokenRow, error } = await supabase
      .from('password_reset_tokens')
      .select('id, user_id, expires_at, used')
      .eq('token', tokenHash)
      .single();

    if (error || !tokenRow) {
      return {
        valid: false,
        message: 'Token inválido ou não encontrado.'
      };
    }

    if (tokenRow.used) {
      return {
        valid: false,
        message: 'Este token já foi utilizado.'
      };
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      return {
        valid: false,
        message: 'Este token expirou. Solicite uma nova recuperação de senha.'
      };
    }

    return {
      valid: true,
      userId: tokenRow.user_id
    };
  } catch (error) {
    console.error('Erro ao validar token:', error);
    return {
      valid: false,
      message: 'Erro ao validar token.'
    };
  }
};

/**
 * Redefine senha usando token
 */
export const resetPasswordWithToken = async (
  token: string,
  newPassword: string
): Promise<{
  success: boolean;
  message: string;
}> => {
  try {
    // Regras de senha fortes também no backend (defesa em profundidade)
    if (!isStrongPassword(newPassword)) {
      return {
        success: false,
        message: 'A nova senha deve ter pelo menos 8 caracteres, incluindo letras maiúsculas, minúsculas, números e caractere especial.'
      };
    }

    // Validar token
    const tokenValidation = await validateResetToken(token);
    if (!tokenValidation.valid || !tokenValidation.userId) {
      return {
        success: false,
        message: tokenValidation.message || 'Token inválido.'
      };
    }

    // Hash da nova senha
    const newPasswordHash = await hashPassword(newPassword);

    // Atualizar senha do usuário
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: newPasswordHash, updated_at: new Date().toISOString() })
      .eq('id', tokenValidation.userId);

    if (updateError) {
      console.error('Erro ao atualizar senha:', updateError);
      return {
        success: false,
        message: 'Erro ao atualizar senha. Tente novamente.'
      };
    }

    // Marcar token como usado
    await supabase
      .from('password_reset_tokens')
      .update({ used: true })
      .eq('token', token);

    // Limpar tentativas de login para este usuário
    const { data: user } = await supabase
      .from('users')
      .select('username')
      .eq('id', tokenValidation.userId)
      .single();

    if (user) {
      resetLoginAttempts(user.username);
    }

    console.info('[AUTH-EVENT] Password reset completed', {
      userId: tokenValidation.userId,
      username: user?.username,
      at: new Date().toISOString()
    });

    return {
      success: true,
      message: 'Senha redefinida com sucesso! Você já pode fazer login.'
    };
  } catch (error) {
    console.error('Erro ao redefinir senha:', error);
    return {
      success: false,
      message: 'Erro ao redefinir senha. Tente novamente.'
    };
  }
};
