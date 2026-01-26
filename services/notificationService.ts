import { supabase } from './supabase';
import { Notification } from '../types';

// ============================================
// SERVIÇOS PARA NOTIFICAÇÕES
// ============================================

/**
 * Busca todas as notificações de um morador
 */
export const getNotifications = async (moradorId: string): Promise<{ data: Notification[]; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('morador_id', moradorId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar notificações:', error);
      return { data: [], error: error.message };
    }

    const notifications: Notification[] = (data || []).map((n) => ({
      id: n.id,
      morador_id: n.morador_id,
      title: n.title,
      message: n.message,
      type: n.type || 'package',
      related_id: n.related_id || undefined,
      read: n.read || false,
      created_at: n.created_at
    }));

    return { data: notifications };
  } catch (err: any) {
    console.error('Erro ao buscar notificações:', err);
    return { data: [], error: err?.message ?? 'Erro ao carregar notificações' };
  }
};

/**
 * Busca notificações não lidas de um morador
 */
export const getUnreadNotifications = async (moradorId: string): Promise<{ data: Notification[]; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('morador_id', moradorId)
      .eq('read', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar notificações não lidas:', error);
      return { data: [], error: error.message };
    }

    const notifications: Notification[] = (data || []).map((n) => ({
      id: n.id,
      morador_id: n.morador_id,
      title: n.title,
      message: n.message,
      type: n.type || 'package',
      related_id: n.related_id || undefined,
      read: n.read || false,
      created_at: n.created_at
    }));

    return { data: notifications };
  } catch (err: any) {
    console.error('Erro ao buscar notificações não lidas:', err);
    return { data: [], error: err?.message ?? 'Erro ao carregar notificações não lidas' };
  }
};

/**
 * Marca uma notificação como lida
 */
export const markNotificationAsRead = async (notificationId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('Erro ao marcar notificação como lida:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Erro ao marcar notificação como lida:', err);
    return { success: false, error: err?.message ?? 'Erro ao marcar notificação como lida' };
  }
};

/**
 * Marca todas as notificações de um morador como lidas
 */
export const markAllNotificationsAsRead = async (moradorId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('morador_id', moradorId)
      .eq('read', false);

    if (error) {
      console.error('Erro ao marcar todas as notificações como lidas:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Erro ao marcar todas as notificações como lidas:', err);
    return { success: false, error: err?.message ?? 'Erro ao marcar todas as notificações como lidas' };
  }
};

/**
 * Cria uma nova notificação
 */
export const createNotification = async (
  moradorId: string,
  title: string,
  message: string,
  type: Notification['type'] = 'package',
  relatedId?: string
): Promise<{ success: boolean; error?: string; id?: string }> => {
  try {
    const insertData: any = {
      morador_id: moradorId,
      title,
      message,
      type,
      read: false
    };

    if (relatedId) {
      insertData.related_id = relatedId;
    }

    const { data, error } = await supabase
      .from('notifications')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar notificação:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data.id };
  } catch (err: any) {
    console.error('Erro ao criar notificação:', err);
    return { success: false, error: err?.message ?? 'Erro ao criar notificação' };
  }
};

/**
 * Conta notificações não lidas de um morador
 */
export const countUnreadNotifications = async (moradorId: string): Promise<{ count: number; error?: string }> => {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('morador_id', moradorId)
      .eq('read', false);

    if (error) {
      console.error('Erro ao contar notificações não lidas:', error);
      return { count: 0, error: error.message };
    }

    return { count: count || 0 };
  } catch (err: any) {
    console.error('Erro ao contar notificações não lidas:', err);
    return { count: 0, error: err?.message ?? 'Erro ao contar notificações não lidas' };
  }
};
