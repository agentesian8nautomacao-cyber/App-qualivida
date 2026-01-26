import React, { useState, useEffect } from 'react';
import { Bell, Package, CheckCircle2, X, Eye, Clock, Trash2 } from 'lucide-react';
import { Notification, Package as PackageType } from '../../types';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification } from '../../services/notificationService';

interface NotificationsViewProps {
  moradorId: string;
  allPackages: PackageType[];
  onViewPackage?: (pkg: PackageType) => void;
}

const NotificationsView: React.FC<NotificationsViewProps> = ({
  moradorId,
  allPackages,
  onViewPackage
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('unread');

  useEffect(() => {
    loadNotifications();
  }, [moradorId]);

  const loadNotifications = async () => {
    setLoading(true);
    const result = await getNotifications(moradorId);
    if (result.data) {
      setNotifications(result.data);
    }
    setLoading(false);
  };

  const handleMarkAsRead = async (notificationId: string) => {
    const result = await markNotificationAsRead(notificationId);
    if (result.success) {
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    }
  };

  const handleMarkAllAsRead = async () => {
    const result = await markAllNotificationsAsRead(moradorId);
    if (result.success) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  };

  const handleDeleteNotification = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Tem certeza que deseja excluir esta notificação?')) {
      const result = await deleteNotification(notificationId);
      if (result.success) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
      } else {
        alert('Erro ao excluir notificação: ' + (result.error || 'Erro desconhecido'));
      }
    }
  };

  const handleViewRelated = (notification: Notification) => {
    if (notification.type === 'package' && notification.related_id && onViewPackage) {
      const relatedPackage = allPackages.find(p => p.id === notification.related_id);
      if (relatedPackage) {
        onViewPackage(relatedPackage);
      }
    }
  };

  const filteredNotifications = filter === 'unread'
    ? notifications.filter(n => !n.read)
    : notifications;

  const unreadCount = notifications.filter(n => !n.read).length;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;
    
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'package':
        return <Package className="w-5 h-5" />;
      default:
        return <Bell className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="text-3xl font-black uppercase tracking-tighter" style={{ color: 'var(--text-primary)' }}>
            Notificações
          </h3>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mt-1" style={{ color: 'var(--text-secondary)' }}>
            {unreadCount > 0 ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}` : 'Todas lidas'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all focus:ring-2 focus:ring-[var(--text-primary)]/20"
            style={{ backgroundColor: 'var(--glass-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
          >
            Marcar todas como lidas
          </button>
        )}
      </header>

      {/* Filtros */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('unread')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
            filter === 'unread'
              ? 'bg-[var(--text-primary)] text-[var(--bg-color)]'
              : 'bg-[var(--glass-bg)] border border-[var(--border-color)]'
          }`}
          style={filter === 'unread' ? {} : { color: 'var(--text-primary)' }}
        >
          Não lidas ({unreadCount})
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
            filter === 'all'
              ? 'bg-[var(--text-primary)] text-[var(--bg-color)]'
              : 'bg-[var(--glass-bg)] border border-[var(--border-color)]'
          }`}
          style={filter === 'all' ? {} : { color: 'var(--text-primary)' }}
        >
          Todas ({notifications.length})
        </button>
      </div>

      {/* Lista de Notificações */}
      {loading ? (
        <div className="premium-glass rounded-2xl p-10 flex flex-col items-center justify-center gap-3 border border-[var(--border-color)]">
          <div className="w-8 h-8 border-4 border-[var(--text-primary)] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium opacity-60" style={{ color: 'var(--text-secondary)' }}>
            Carregando notificações...
          </p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="premium-glass rounded-2xl p-10 flex flex-col items-center justify-center gap-3 border border-[var(--border-color)]">
          <Bell className="w-12 h-12 opacity-30" style={{ color: 'var(--text-secondary)' }} />
          <p className="text-sm font-semibold opacity-60" style={{ color: 'var(--text-secondary)' }}>
            {filter === 'unread' ? 'Nenhuma notificação não lida' : 'Nenhuma notificação'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map(notification => (
            <div
              key={notification.id}
              className={`premium-glass rounded-2xl p-5 border transition-all cursor-pointer group relative ${
                notification.read
                  ? 'border-[var(--border-color)] opacity-70'
                  : 'border-[var(--text-primary)]/30 bg-[var(--border-color)]/20'
              } hover:border-[var(--text-primary)]/50 hover:bg-[var(--border-color)]/30`}
            >
              {/* Botão X para deletar */}
              <button
                onClick={(e) => handleDeleteNotification(notification.id, e)}
                className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20 hover:text-red-400"
                style={{ color: 'var(--text-secondary)' }}
                title="Excluir notificação"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-start gap-4">
                {/* Ícone */}
                <div
                  className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
                    notification.read
                      ? 'bg-[var(--glass-bg)]'
                      : 'bg-[var(--text-primary)]/20'
                  }`}
                  style={notification.read ? {} : { color: 'var(--text-primary)' }}
                >
                  {getNotificationIcon(notification.type)}
                </div>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-1 pr-8">
                    <h4
                      className={`text-sm font-bold ${
                        notification.read ? 'opacity-70' : ''
                      }`}
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {notification.title}
                    </h4>
                    {!notification.read && (
                      <span className="w-2 h-2 bg-[var(--text-primary)] rounded-full flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                  <p
                    className={`text-xs leading-relaxed mb-2 ${
                      notification.read ? 'opacity-60' : 'opacity-80'
                    }`}
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {notification.message}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] opacity-50" style={{ color: 'var(--text-secondary)' }}>
                      <Clock className="w-3 h-3" />
                      <span>{formatDate(notification.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {notification.type === 'package' && notification.related_id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewRelated(notification);
                          }}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all"
                          style={{ backgroundColor: 'var(--glass-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                        >
                          <Eye className="w-3 h-3 inline mr-1" />
                          Ver encomenda
                        </button>
                      )}
                      {!notification.read && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(notification.id);
                          }}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all"
                          style={{ backgroundColor: 'var(--glass-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                        >
                          <CheckCircle2 className="w-3 h-3 inline mr-1" />
                          Marcar como lida
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsView;
