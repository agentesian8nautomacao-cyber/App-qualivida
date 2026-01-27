import { supabase } from './supabase';
import { Package, Resident, VisitorLog, Occurrence, Boleto, PackageItem, Note, Notice, ChatMessage, Staff } from '../types';
import { createNotification } from './notificationService';

// ============================================
// SERVIÇOS PARA PACOTES (ENCOMENDAS)
// ============================================

export const savePackage = async (pkg: Package): Promise<{ success: boolean; error?: string; id?: string }> => {
  try {
    console.log('[savePackage] Iniciando salvamento de encomenda:', {
      recipient: pkg.recipient,
      unit: pkg.unit,
      recipientId: pkg.recipientId || 'null/undefined'
    });
    
    let recipientId: string | null = pkg.recipientId ?? null;
    
    // Se não tiver recipientId, tentar buscar pelo nome e unidade
    if (!recipientId && pkg.recipient && pkg.unit) {
      console.log('[savePackage] Buscando recipientId no banco...', {
        recipient: pkg.recipient,
        unit: pkg.unit
      });
      
      const { data: resident, error: residentError } = await supabase
        .from('residents')
        .select('id, name, unit')
        .eq('name', pkg.recipient.trim())
        .eq('unit', pkg.unit.trim())
        .maybeSingle(); // Usar maybeSingle ao invés de single para não dar erro se não encontrar
      
      if (residentError) {
        console.warn('[savePackage] Erro ao buscar morador:', residentError);
      }
      
      if (resident) {
        recipientId = resident.id;
        console.log('[savePackage] ✅ recipientId encontrado:', recipientId, 'Morador:', resident.name, resident.unit);
      } else {
        console.warn('[savePackage] ⚠️ Morador não encontrado:', {
          recipient: pkg.recipient,
          unit: pkg.unit,
          message: 'A encomenda será salva, mas a notificação não será criada porque o morador não foi encontrado.'
        });
      }
    }
    
    // Log final do recipientId
    console.log('[savePackage] recipientId final:', recipientId || 'NULL - Notificação não será criada');

    // Preparar dados para inserção (apenas campos obrigatórios)
    const insertData: any = {
      recipient_id: recipientId,
      recipient_name: pkg.recipient,
      unit: pkg.unit,
      type: pkg.type,
      received_at: pkg.receivedAt,
      display_time: pkg.displayTime,
      status: pkg.status,
      deadline_minutes: pkg.deadlineMinutes || 45,
      resident_phone: pkg.residentPhone || null
    };

    // Adicionar campos opcionais se existirem
    if (pkg.qrCodeData) {
      insertData.qr_code_data = pkg.qrCodeData;
    }
    if (pkg.imageUrl) {
      insertData.image_url = pkg.imageUrl;
    }

    // Usar 'as any' para contornar cache do schema do Supabase
    // Isso permite que a inserção funcione mesmo se o cache do cliente estiver desatualizado
    let { data, error } = await supabase
      .from('packages')
      .insert(insertData as any)
      .select()
      .single();

    // Se falhar por causa de colunas opcionais não existirem ou cache do schema, tentar sem elas
    if (error && error.message) {
      const errorMsg = error.message.toLowerCase();
      const isSchemaCacheError = errorMsg.includes('schema cache') || 
                                 errorMsg.includes('could not find') ||
                                 errorMsg.includes('column') && errorMsg.includes('packages');
      
      const missingColumns: string[] = [];
      
      if (errorMsg.includes('qr_code_data') || errorMsg.includes("qr_code_data")) {
        missingColumns.push('qr_code_data');
        delete insertData.qr_code_data;
      }
      if (errorMsg.includes('image_url') || errorMsg.includes("image_url")) {
        missingColumns.push('image_url');
        delete insertData.image_url;
      }

      if (missingColumns.length > 0) {
        if (isSchemaCacheError) {
          console.warn(`⚠️ Erro de cache do schema para colunas: ${missingColumns.join(', ')}. Tentando sem elas...`);
          console.warn('💡 Dica: A coluna pode existir no banco, mas o cache do Supabase está desatualizado.');
        } else {
          console.warn(`Colunas não encontradas no schema: ${missingColumns.join(', ')}, tentando sem elas...`);
        }
        
        const retryResult = await supabase
          .from('packages')
          .insert(insertData as any)
          .select()
          .single();
        data = retryResult.data;
        error = retryResult.error;
      } else if (isSchemaCacheError) {
        // Se for erro de cache mas não identificamos colunas específicas, tentar novamente com 'as any'
        console.warn('⚠️ Erro de cache do schema detectado. Tentando novamente...');
        const retryResult = await supabase
          .from('packages')
          .insert(insertData as any)
          .select()
          .single();
        data = retryResult.data;
        error = retryResult.error;
      }
    }

    if (error) {
      console.error('Erro ao salvar pacote:', error);
      return { success: false, error: error.message };
    }

    // Salvar itens do pacote se houver
    if (pkg.items && pkg.items.length > 0 && data) {
      const itemsToInsert = pkg.items.map(item => ({
        package_id: data.id,
        name: item.name,
        description: item.description || null
      }));

      const { error: itemsError } = await supabase
        .from('package_items')
        .insert(itemsToInsert);

      if (itemsError) {
        console.error('Erro ao salvar itens do pacote:', itemsError);
        // Não falha o salvamento do pacote se os itens falharem
      }
    }

    // Criar notificação automática no app (independente do WhatsApp)
    // Isso acontece automaticamente sempre que uma encomenda é registrada
    console.log('[savePackage] Verificando condições para criar notificação:', {
      recipientId: recipientId || 'null/undefined',
      hasData: !!data,
      dataId: data?.id || 'null'
    });
    
    if (recipientId && data) {
      console.log('[Notificação] ✅ Condições OK. Criando notificação para morador:', recipientId, 'Encomenda:', data.id);
      
      try {
        const notificationResult = await createNotification(
          recipientId,
          '📦 Nova encomenda na portaria',
          'Uma encomenda foi recebida e está disponível para retirada.',
          'package',
          data.id
        );

        if (notificationResult.success) {
          console.log('[Notificação] ✅✅✅ Notificação criada com sucesso! ID:', notificationResult.id);
        } else {
          // Log detalhado do erro mas não falha o salvamento da encomenda
          const errorDetails = {
            error: notificationResult.error,
            moradorId: recipientId,
            packageId: data.id,
            message: 'A encomenda foi salva, mas a notificação não foi criada.',
            action: 'Verifique o console para mais detalhes e execute supabase_fix_notifications_rls.sql se necessário.'
          };
          
          console.error('[Notificação] ❌❌❌ ERRO ao criar notificação automática:', errorDetails);
          
          // Mostrar erro no console de forma mais visível
          console.group('%c❌ ERRO: Notificação não foi criada', 'color: red; font-weight: bold; font-size: 14px;');
          console.error('Detalhes:', errorDetails);
          console.error('Erro específico:', notificationResult.error);
          console.groupEnd();
        }
      } catch (err: any) {
        console.error('[Notificação] ❌❌❌ EXCEÇÃO ao criar notificação:', err);
        console.group('%c❌ EXCEÇÃO: Erro ao criar notificação', 'color: red; font-weight: bold; font-size: 14px;');
        console.error('Erro:', err);
        console.error('Stack:', err?.stack);
        console.groupEnd();
      }
    } else {
      const warningDetails = {
        recipientId: recipientId || 'null/undefined',
        hasData: !!data,
        dataId: data?.id || 'null',
        message: 'A encomenda foi salva, mas não há recipientId ou data.id para criar a notificação.'
      };
      
      console.warn('[Notificação] ⚠️⚠️⚠️ Não foi possível criar notificação - condições não atendidas:', warningDetails);
      
      // Mostrar warning no console de forma mais visível
      console.group('%c⚠️ AVISO: Notificação não foi criada - condições não atendidas', 'color: orange; font-weight: bold; font-size: 14px;');
      console.warn('Detalhes:', warningDetails);
      console.warn('recipientId:', recipientId);
      console.warn('data:', data);
      console.groupEnd();
    }

    return { success: true, id: data.id };
  } catch (err: any) {
    console.error('Erro ao salvar pacote:', err);
    return { success: false, error: err.message || 'Erro ao salvar pacote' };
  }
};

export const updatePackage = async (pkg: Package): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('packages')
      .update({
        recipient_name: pkg.recipient,
        unit: pkg.unit,
        type: pkg.type,
        status: pkg.status,
        delivered_at: pkg.status === 'Entregue' ? new Date().toISOString() : null
      })
      .eq('id', pkg.id);

    if (error) {
      console.error('Erro ao atualizar pacote:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Erro ao atualizar pacote:', err);
    return { success: false, error: err.message || 'Erro ao atualizar pacote' };
  }
};

export const deletePackage = async (id: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('packages')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao excluir encomenda:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Erro ao excluir encomenda:', err);
    return { success: false, error: err?.message || 'Erro ao excluir encomenda' };
  }
};

export type GetPackagesResult = { data: Package[]; error?: string };

export const getPackages = async (): Promise<GetPackagesResult> => {
  try {
    // Buscar pacotes com image_url e qr_code_data
    const { data, error } = await supabase
      .from('packages')
      .select(`
        id,
        recipient_id,
        recipient_name,
        unit,
        type,
        received_at,
        display_time,
        status,
        deadline_minutes,
        resident_phone,
        delivered_at,
        delivered_by,
        qr_code_data,
        image_url,
        created_at,
        updated_at
      `)
      .order('received_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar pacotes:', error);
      return { data: [], error: error.message };
    }

    // Buscar itens dos pacotes
    const packageIds = (data || []).map(p => p.id);
    let packageItemsMap: Record<string, PackageItem[]> = {};
    
    if (packageIds.length > 0) {
      const { data: itemsData, error: itemsError } = await supabase
        .from('package_items')
        .select('id, package_id, name, description')
        .in('package_id', packageIds);

      if (!itemsError && itemsData) {
        itemsData.forEach(item => {
          if (!packageItemsMap[item.package_id]) {
            packageItemsMap[item.package_id] = [];
          }
          packageItemsMap[item.package_id].push({
            id: item.id,
            name: item.name,
            description: item.description || ''
          });
        });
      }
    }

    // Converter para o formato Package
    const packages: Package[] = (data || []).map((p: any) => ({
      id: p.id,
      recipient: p.recipient_name,
      unit: p.unit,
      type: p.type,
      receivedAt: p.received_at,
      displayTime: p.display_time || new Date(p.received_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      status: p.status as 'Pendente' | 'Entregue',
      deadlineMinutes: p.deadline_minutes || 45,
      residentPhone: p.resident_phone || undefined,
      recipientId: p.recipient_id || undefined,
      imageUrl: p.image_url || null,
      qrCodeData: p.qr_code_data || null,
      items: packageItemsMap[p.id] || []
    }));

    return { data: packages };
  } catch (err: any) {
    console.error('Erro ao buscar pacotes:', err);
    return { data: [], error: err?.message ?? 'Erro ao carregar encomendas' };
  }
};

// ============================================
// SERVIÇOS PARA MORADORES
// ============================================

export type GetResidentsResult = { data: Resident[]; error?: string };

export const getResidents = async (): Promise<GetResidentsResult> => {
  try {
    const { data, error } = await supabase
      .from('residents')
      .select('id, name, unit, email, phone, whatsapp')
      .order('name', { ascending: true });

    if (error) {
      console.error('Erro ao buscar moradores:', error);
      return { data: [], error: error.message };
    }

    const list = (data || []).map((r) => ({
      id: r.id,
      name: r.name,
      unit: r.unit,
      email: r.email || '',
      phone: r.phone || '',
      whatsapp: r.whatsapp || ''
    }));
    return { data: list };
  } catch (err: any) {
    console.error('Erro ao buscar moradores:', err);
    return { data: [], error: err?.message ?? 'Erro ao carregar moradores' };
  }
};

export const saveResident = async (resident: Resident): Promise<{ success: boolean; error?: string; id?: string }> => {
  try {
    if (resident.id && resident.id.startsWith('temp-')) {
      // Novo morador - inserir
      const { data, error } = await supabase
        .from('residents')
        .insert({
          name: resident.name,
          unit: resident.unit,
          email: resident.email || null,
          phone: resident.phone || null,
          whatsapp: resident.whatsapp || null
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao salvar morador:', error);
        return { success: false, error: error.message };
      }

      return { success: true, id: data.id };
    } else {
      // Morador existente - atualizar
      const { error } = await supabase
        .from('residents')
        .update({
          name: resident.name,
          unit: resident.unit,
          email: resident.email || null,
          phone: resident.phone || null,
          whatsapp: resident.whatsapp || null
        })
        .eq('id', resident.id);

      if (error) {
        console.error('Erro ao atualizar morador:', error);
        return { success: false, error: error.message };
      }

      return { success: true, id: resident.id };
    }
  } catch (err: any) {
    console.error('Erro ao salvar morador:', err);
    return { success: false, error: err.message || 'Erro ao salvar morador' };
  }
};

export const deleteResident = async (id: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('residents')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar morador:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Erro ao deletar morador:', err);
    return { success: false, error: err.message || 'Erro ao deletar morador' };
  }
};

// ============================================
// SERVIÇOS PARA VISITANTES
// ============================================

export const saveVisitor = async (visitor: VisitorLog): Promise<{ success: boolean; error?: string; id?: string }> => {
  try {
    // Buscar resident_id
    let residentId: string | null = null;
    if (visitor.residentName) {
      const { data: resident } = await supabase
        .from('residents')
        .select('id')
        .eq('name', visitor.residentName)
        .eq('unit', visitor.unit)
        .single();
      residentId = resident?.id || null;
    }

    const { data, error } = await supabase
      .from('visitors')
      .insert({
        resident_id: residentId,
        resident_name: visitor.residentName,
        unit: visitor.unit,
        visitor_count: visitor.visitorCount || 1,
        visitor_names: visitor.visitorNames || null,
        type: visitor.type ?? 'Visita',
        doc: visitor.doc ?? null,
        vehicle: visitor.vehicle ?? null,
        plate: visitor.plate ?? null,
        entry_time: visitor.entryTime,
        exit_time: visitor.exitTime || null,
        status: visitor.status
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar visitante:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data.id };
  } catch (err: any) {
    console.error('Erro ao salvar visitante:', err);
    return { success: false, error: err.message || 'Erro ao salvar visitante' };
  }
};

export const updateVisitor = async (visitor: VisitorLog): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('visitors')
      .update({
        exit_time: visitor.exitTime || null,
        status: visitor.status
      })
      .eq('id', visitor.id);

    if (error) {
      console.error('Erro ao atualizar visitante:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Erro ao atualizar visitante:', err);
    return { success: false, error: err.message || 'Erro ao atualizar visitante' };
  }
};

export type GetVisitorsResult = { data: VisitorLog[]; error?: string };

export const getVisitors = async (): Promise<GetVisitorsResult> => {
  try {
    const { data, error } = await supabase
      .from('visitors')
      .select('id, resident_name, unit, visitor_count, visitor_names, type, entry_time, exit_time, status')
      .order('entry_time', { ascending: false });

    if (error) {
      console.error('Erro ao buscar visitantes:', error);
      return { data: [], error: error.message };
    }

    const list: VisitorLog[] = (data || []).map((v: any) => ({
      id: v.id,
      residentName: v.resident_name,
      unit: v.unit,
      visitorCount: v.visitor_count ?? 1,
      visitorNames: v.visitor_names ?? undefined,
      type: v.type ?? 'Visita',
      entryTime: v.entry_time,
      exitTime: v.exit_time ?? undefined,
      status: v.status as 'active' | 'completed'
    }));
    return { data: list };
  } catch (err: any) {
    console.error('Erro ao buscar visitantes:', err);
    return { data: [], error: err?.message ?? 'Erro ao carregar visitantes' };
  }
};

// ============================================
// SERVIÇOS PARA OCORRÊNCIAS
// ============================================

export const saveOccurrence = async (occurrence: Occurrence): Promise<{ success: boolean; error?: string; id?: string }> => {
  try {
    // Buscar resident_id
    let residentId: string | null = null;
    if (occurrence.residentName) {
      const { data: resident } = await supabase
        .from('residents')
        .select('id')
        .eq('name', occurrence.residentName)
        .eq('unit', occurrence.unit)
        .single();
      residentId = resident?.id || null;
    }

    const { data, error } = await supabase
      .from('occurrences')
      .insert({
        resident_id: residentId,
        resident_name: occurrence.residentName,
        unit: occurrence.unit,
        description: occurrence.description,
        status: occurrence.status,
        date: occurrence.date,
        reported_by: occurrence.reportedBy
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar ocorrência:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data.id };
  } catch (err: any) {
    console.error('Erro ao salvar ocorrência:', err);
    return { success: false, error: err.message || 'Erro ao salvar ocorrência' };
  }
};

export const updateOccurrence = async (occurrence: Occurrence): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('occurrences')
      .update({
        description: occurrence.description,
        status: occurrence.status
      })
      .eq('id', occurrence.id);

    if (error) {
      console.error('Erro ao atualizar ocorrência:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Erro ao atualizar ocorrência:', err);
    return { success: false, error: err.message || 'Erro ao atualizar ocorrência' };
  }
};

export type GetOccurrencesResult = { data: Occurrence[]; error?: string };

export const getOccurrences = async (): Promise<GetOccurrencesResult> => {
  try {
    const { data, error } = await supabase
      .from('occurrences')
      .select('id, resident_name, unit, description, status, date, reported_by')
      .order('date', { ascending: false });

    if (error) {
      console.error('Erro ao buscar ocorrências:', error);
      return { data: [], error: error.message };
    }

    const list: Occurrence[] = (data || []).map((o: any) => ({
      id: o.id,
      residentName: o.resident_name,
      unit: o.unit,
      description: o.description,
      status: o.status as 'Aberto' | 'Em Andamento' | 'Resolvido',
      date: typeof o.date === 'string' ? o.date : new Date(o.date).toISOString(),
      reportedBy: o.reported_by
    }));
    return { data: list };
  } catch (err: any) {
    console.error('Erro ao buscar ocorrências:', err);
    return { data: [], error: err?.message ?? 'Erro ao carregar ocorrências' };
  }
};

// ============================================
// SERVIÇOS PARA BOLETOS
// ============================================

export const saveBoleto = async (boleto: Boleto): Promise<{ success: boolean; error?: string; id?: string }> => {
  try {
    // Buscar resident_id
    let residentId: string | null = null;
    if (boleto.residentName) {
      const { data: resident } = await supabase
        .from('residents')
        .select('id')
        .eq('name', boleto.residentName)
        .eq('unit', boleto.unit)
        .single();
      residentId = resident?.id || null;
    }

    const { data, error } = await supabase
      .from('boletos')
      .insert({
        resident_id: residentId,
        resident_name: boleto.residentName,
        unit: boleto.unit,
        reference_month: boleto.referenceMonth,
        due_date: boleto.dueDate,
        amount: boleto.amount,
        status: boleto.status,
        barcode: boleto.barcode || null,
        pdf_url: boleto.pdfUrl || null,
        paid_date: boleto.paidDate || null,
        description: boleto.description || null
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar boleto:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data.id };
  } catch (err: any) {
    console.error('Erro ao salvar boleto:', err);
    return { success: false, error: err.message || 'Erro ao salvar boleto' };
  }
};

export const updateBoleto = async (boleto: Boleto): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('boletos')
      .update({
        status: boleto.status,
        paid_date: boleto.paidDate || null
      })
      .eq('id', boleto.id);

    if (error) {
      console.error('Erro ao atualizar boleto:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Erro ao atualizar boleto:', err);
    return { success: false, error: err.message || 'Erro ao atualizar boleto' };
  }
};

export const deleteBoleto = async (id: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('boletos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar boleto:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Erro ao deletar boleto:', err);
    return { success: false, error: err.message || 'Erro ao deletar boleto' };
  }
};

export type GetBoletosResult = { data: Boleto[]; error?: string };

export const getBoletos = async (): Promise<GetBoletosResult> => {
  try {
    const { data, error } = await supabase
      .from('boletos')
      .select('id, resident_name, unit, reference_month, due_date, amount, status, barcode, pdf_url, paid_date, description')
      .order('due_date', { ascending: false });

    if (error) {
      console.error('Erro ao buscar boletos:', error);
      return { data: [], error: error.message };
    }

    const toDateStr = (v: any) => {
      if (!v) return '';
      if (typeof v === 'string') return v;
      const d = new Date(v);
      return d.toISOString().slice(0, 10);
    };

    const list: Boleto[] = (data || []).map((b: any) => ({
      id: b.id,
      residentName: b.resident_name,
      unit: b.unit,
      referenceMonth: b.reference_month,
      dueDate: toDateStr(b.due_date),
      amount: Number(b.amount),
      status: b.status as 'Pendente' | 'Pago' | 'Vencido',
      barcode: b.barcode ?? undefined,
      pdfUrl: b.pdf_url ?? undefined,
      paidDate: b.paid_date ? toDateStr(b.paid_date) : undefined,
      description: b.description ?? undefined
    }));
    return { data: list };
  } catch (err: any) {
    console.error('Erro ao buscar boletos:', err);
    return { data: [], error: err?.message ?? 'Erro ao carregar boletos' };
  }
};

// ============================================
// SERVIÇOS PARA NOTAS
// ============================================

export type GetNotesResult = { data: Note[]; error?: string };

export const getNotes = async (): Promise<GetNotesResult> => {
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('id, content, date, completed, scheduled, category')
      .order('date', { ascending: false });

    if (error) {
      console.error('Erro ao buscar notas:', error);
      return { data: [], error: error.message };
    }

    const toIso = (v: any) => (v ? (typeof v === 'string' ? v : new Date(v).toISOString()) : '');

    const list: Note[] = (data || []).map((n: any) => ({
      id: n.id,
      content: n.content,
      date: toIso(n.date),
      completed: !!n.completed,
      scheduled: n.scheduled ? toIso(n.scheduled) : undefined,
      category: n.category ?? undefined
    }));
    return { data: list };
  } catch (err: any) {
    console.error('Erro ao buscar notas:', err);
    return { data: [], error: err?.message ?? 'Erro ao carregar notas' };
  }
};

export const saveNote = async (note: Note): Promise<{ success: boolean; error?: string; id?: string }> => {
  try {
    const { data, error } = await supabase
      .from('notes')
      .insert({
        content: note.content,
        date: note.date,
        completed: note.completed ?? false,
        scheduled: note.scheduled || null,
        category: note.category || null
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar nota:', error);
      return { success: false, error: error.message };
    }
    return { success: true, id: data.id };
  } catch (err: any) {
    console.error('Erro ao salvar nota:', err);
    return { success: false, error: err?.message ?? 'Erro ao salvar nota' };
  }
};

export const updateNote = async (note: Note): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('notes')
      .update({
        content: note.content,
        completed: note.completed ?? false,
        scheduled: note.scheduled || null,
        category: note.category || null
      })
      .eq('id', note.id);

    if (error) {
      console.error('Erro ao atualizar nota:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error('Erro ao atualizar nota:', err);
    return { success: false, error: err?.message ?? 'Erro ao atualizar nota' };
  }
};

export const deleteNote = async (id: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) {
      console.error('Erro ao deletar nota:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error('Erro ao deletar nota:', err);
    return { success: false, error: err?.message ?? 'Erro ao deletar nota' };
  }
};

// ============================================
// SERVIÇOS PARA AVISOS (NOTICES)
// ============================================

export type GetNoticesResult = { data: Notice[]; error?: string };

export const getNotices = async (): Promise<GetNoticesResult> => {
  try {
    const { data, error } = await supabase
      .from('notices')
      .select('id, title, content, author, author_role, date, category, priority, pinned')
      .order('date', { ascending: false });

    if (error) {
      console.error('Erro ao buscar avisos:', error);
      return { data: [], error: error.message };
    }

    const toIso = (v: any) => (v ? (typeof v === 'string' ? v : new Date(v).toISOString()) : '');

    const list: Notice[] = (data || []).map((n: any) => ({
      id: n.id,
      title: n.title,
      content: n.content,
      author: n.author,
      authorRole: n.author_role as 'MORADOR' | 'SINDICO' | 'PORTEIRO',
      date: toIso(n.date),
      category: n.category ?? undefined,
      priority: (n.priority as 'high' | 'normal') ?? 'normal',
      pinned: !!n.pinned,
      read: false
    }));
    return { data: list };
  } catch (err: any) {
    console.error('Erro ao buscar avisos:', err);
    return { data: [], error: err?.message ?? 'Erro ao carregar avisos' };
  }
};

export const saveNotice = async (notice: Notice): Promise<{ success: boolean; error?: string; id?: string }> => {
  try {
    const { data, error } = await supabase
      .from('notices')
      .insert({
        title: notice.title,
        content: notice.content,
        author: notice.author,
        author_role: notice.authorRole,
        date: notice.date,
        category: notice.category || null,
        priority: notice.priority ?? 'normal',
        pinned: notice.pinned ?? false
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar aviso:', error);
      return { success: false, error: error.message };
    }
    return { success: true, id: data.id };
  } catch (err: any) {
    console.error('Erro ao salvar aviso:', err);
    return { success: false, error: err?.message ?? 'Erro ao salvar aviso' };
  }
};

export const updateNotice = async (notice: Notice): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('notices')
      .update({
        title: notice.title,
        content: notice.content,
        category: notice.category || null,
        priority: notice.priority ?? 'normal',
        pinned: notice.pinned ?? false
      })
      .eq('id', notice.id);

    if (error) {
      console.error('Erro ao atualizar aviso:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error('Erro ao atualizar aviso:', err);
    return { success: false, error: err?.message ?? 'Erro ao atualizar aviso' };
  }
};

export const deleteNotice = async (id: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase.from('notices').delete().eq('id', id);
    if (error) {
      console.error('Erro ao deletar aviso:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error('Erro ao deletar aviso:', err);
    return { success: false, error: err?.message ?? 'Erro ao deletar aviso' };
  }
};

// ============================================
// SERVIÇOS PARA CHAT
// ============================================

export type GetChatMessagesResult = { data: ChatMessage[]; error?: string };

export const getChatMessages = async (): Promise<GetChatMessagesResult> => {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, text, sender_role, timestamp, read')
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('Erro ao buscar mensagens:', error);
      return { data: [], error: error.message };
    }

    const toIso = (v: any) => (v ? (typeof v === 'string' ? v : new Date(v).toISOString()) : '');

    const list: ChatMessage[] = (data || []).map((m: any) => ({
      id: m.id,
      text: m.text,
      senderRole: m.sender_role as 'MORADOR' | 'SINDICO' | 'PORTEIRO',
      timestamp: toIso(m.timestamp),
      read: !!m.read
    }));
    return { data: list };
  } catch (err: any) {
    console.error('Erro ao buscar chat:', err);
    return { data: [], error: err?.message ?? 'Erro ao carregar chat' };
  }
};

export const saveChatMessage = async (msg: ChatMessage): Promise<{ success: boolean; error?: string; id?: string }> => {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        text: msg.text,
        sender_role: msg.senderRole,
        timestamp: msg.timestamp,
        read: msg.read ?? false
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar mensagem:', error);
      return { success: false, error: error.message };
    }
    return { success: true, id: data.id };
  } catch (err: any) {
    console.error('Erro ao salvar mensagem:', err);
    return { success: false, error: err?.message ?? 'Erro ao salvar mensagem' };
  }
};

// ============================================
// SERVIÇOS PARA FUNCIONÁRIOS (STAFF)
// ============================================

export type GetStaffResult = { data: Staff[]; error?: string };

export const getStaff = async (): Promise<GetStaffResult> => {
  try {
    const { data, error } = await supabase
      .from('staff')
      .select('id, name, role, status, shift, phone, email')
      .order('name', { ascending: true });

    if (error) {
      console.error('Erro ao buscar funcionários:', error);
      return { data: [], error: error.message };
    }

    const list: Staff[] = (data || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      status: s.status as 'Ativo' | 'Férias' | 'Licença',
      shift: s.shift as 'Manhã' | 'Tarde' | 'Noite' | 'Madrugada' | 'Comercial',
      phone: s.phone ?? undefined,
      email: s.email ?? undefined
    }));
    return { data: list };
  } catch (err: any) {
    console.error('Erro ao buscar funcionários:', err);
    return { data: [], error: err?.message ?? 'Erro ao carregar funcionários' };
  }
};

export const saveStaff = async (staff: Staff): Promise<{ success: boolean; error?: string; id?: string }> => {
  try {
    if (staff.id && !staff.id.startsWith('temp-')) {
      const { error } = await supabase
        .from('staff')
        .update({
          name: staff.name,
          role: staff.role,
          status: staff.status ?? 'Ativo',
          shift: staff.shift ?? 'Comercial',
          phone: staff.phone || null,
          email: staff.email || null
        })
        .eq('id', staff.id);

      if (error) {
        console.error('Erro ao atualizar funcionário:', error);
        return { success: false, error: error.message };
      }
      return { success: true, id: staff.id };
    }

    const { data, error } = await supabase
      .from('staff')
      .insert({
        name: staff.name,
        role: staff.role,
        status: staff.status ?? 'Ativo',
        shift: staff.shift ?? 'Comercial',
        phone: staff.phone || null,
        email: staff.email || null
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar funcionário:', error);
      return { success: false, error: error.message };
    }
    return { success: true, id: data.id };
  } catch (err: any) {
    console.error('Erro ao salvar funcionário:', err);
    return { success: false, error: err?.message ?? 'Erro ao salvar funcionário' };
  }
};

export const deleteStaff = async (id: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase.from('staff').delete().eq('id', id);
    if (error) {
      console.error('Erro ao deletar funcionário:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error('Erro ao deletar funcionário:', err);
    return { success: false, error: err?.message ?? 'Erro ao deletar funcionário' };
  }
};

// ============================================
// SERVIÇOS PARA ÁREAS E RESERVAS
// ============================================

export interface AreaRow {
  id: string;
  name: string;
  capacity: number;
  rules: string | null;
}

export type GetAreasResult = { data: AreaRow[]; error?: string };

export const getAreas = async (): Promise<GetAreasResult> => {
  try {
    const { data, error } = await supabase
      .from('areas')
      .select('id, name, capacity, rules')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Erro ao buscar áreas:', error);
      return { data: [], error: error.message };
    }
    const list: AreaRow[] = (data || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      capacity: a.capacity ?? 0,
      rules: a.rules ?? null
    }));
    return { data: list };
  } catch (err: any) {
    console.error('Erro ao buscar áreas:', err);
    return { data: [], error: err?.message ?? 'Erro ao carregar áreas' };
  }
};

export interface ReservationRow {
  id: string;
  areaId: string;
  areaName: string;
  residentId: string;
  residentName: string;
  unit: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
}

export type GetReservationsResult = { data: ReservationRow[]; error?: string };

export const getReservations = async (): Promise<GetReservationsResult> => {
  try {
    const areasRes = await getAreas();
    const areaMap = Object.fromEntries(areasRes.data.map((a) => [a.id, a.name]));

    const { data, error } = await supabase
      .from('reservations')
      .select('id, area_id, resident_id, resident_name, unit, date, start_time, end_time, status')
      .order('date', { ascending: false });

    if (error) {
      console.error('Erro ao buscar reservas:', error);
      return { data: [], error: error.message };
    }

    const toDateStr = (v: any) => {
      if (!v) return '';
      if (typeof v === 'string') return v.slice(0, 10);
      return new Date(v).toISOString().slice(0, 10);
    };
    const toTimeStr = (v: any) => {
      if (!v) return '00:00';
      if (typeof v === 'string') return v.slice(0, 5);
      const d = new Date(`1970-01-01T${v}`);
      return d.toTimeString().slice(0, 5);
    };

    const list: ReservationRow[] = (data || []).map((r: any) => ({
      id: r.id,
      areaId: r.area_id,
      areaName: areaMap[r.area_id] ?? '',
      residentId: r.resident_id,
      residentName: r.resident_name,
      unit: r.unit,
      date: toDateStr(r.date),
      startTime: toTimeStr(r.start_time),
      endTime: toTimeStr(r.end_time),
      status: r.status
    }));
    return { data: list };
  } catch (err: any) {
    console.error('Erro ao buscar reservas:', err);
    return { data: [], error: err?.message ?? 'Erro ao carregar reservas' };
  }
};

export const saveReservation = async (r: {
  areaId: string;
  residentId: string;
  residentName: string;
  unit: string;
  date: string;
  startTime: string;
  endTime: string;
  status?: string;
}): Promise<{ success: boolean; error?: string; id?: string }> => {
  try {
    const { data, error } = await supabase
      .from('reservations')
      .insert({
        area_id: r.areaId,
        resident_id: r.residentId,
        resident_name: r.residentName,
        unit: r.unit,
        date: r.date,
        start_time: r.startTime,
        end_time: r.endTime,
        status: r.status ?? 'scheduled'
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar reserva:', error);
      return { success: false, error: error.message };
    }
    return { success: true, id: data.id };
  } catch (err: any) {
    console.error('Erro ao salvar reserva:', err);
    return { success: false, error: err?.message ?? 'Erro ao salvar reserva' };
  }
};

export const updateReservation = async (
  id: string,
  updates: { status?: string }
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase.from('reservations').update(updates).eq('id', id);
    if (error) {
      console.error('Erro ao atualizar reserva:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error('Erro ao atualizar reserva:', err);
    return { success: false, error: err?.message ?? 'Erro ao atualizar reserva' };
  }
};
