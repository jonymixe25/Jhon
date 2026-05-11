import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, deleteDoc, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../AuthContext';
import { Bell, X, Check, MessageSquare, UserPlus, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';

export default function NotificationCenter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return unsub;
  }, [user]);

  const markAsRead = async (id: string) => {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  };

  const deleteNotification = async (id: string) => {
    await deleteDoc(doc(db, 'notifications', id));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleClick = (n: any) => {
    markAsRead(n.id);
    setIsOpen(false);
    if (n.type === 'message' && n.roomId) {
      navigate(`/room/${n.roomId}`);
    } else if (n.type === 'contact_request' || n.type === 'contact_accepted') {
      navigate('/contacts');
    }
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl glass hover:bg-slate-800 transition-colors"
      >
        <Bell size={20} className={unreadCount > 0 ? 'text-indigo-400' : 'text-slate-400'} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-slate-900">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]" 
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-80 max-h-[400px] overflow-hidden glass rounded-2xl shadow-2xl z-50 border border-slate-700/50 flex flex-col"
            >
              <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                <h3 className="text-sm font-bold text-slate-200">Notificaciones</h3>
                {notifications.length > 0 && (
                   <button 
                    onClick={() => notifications.forEach(n => !n.read && markAsRead(n.id))}
                    className="text-[10px] text-indigo-400 font-semibold hover:underline"
                   >
                     Marcar todas como leídas
                   </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto scroll-hide p-2 space-y-1">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-slate-500">
                    <p className="text-xs">No tienes notificaciones</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div 
                      key={n.id}
                      onClick={() => handleClick(n)}
                      className={`p-3 rounded-xl transition-all cursor-pointer group relative flex gap-3 ${n.read ? 'bg-transparent opacity-70' : 'bg-indigo-500/5 border border-indigo-500/10'}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${n.type === 'message' ? 'bg-blue-500/20 text-blue-400' : n.type === 'contact_request' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-green-500/20 text-green-400'}`}>
                        {n.type === 'message' ? <MessageSquare size={14} /> : n.type === 'contact_request' ? <UserPlus size={14} /> : <Check size={14} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-slate-300 leading-snug">
                          <span className="font-bold text-slate-100">{n.senderName}</span> {n.text}
                        </p>
                        <p className="text-[9px] text-slate-500 mt-1">
                          {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Reciente'}
                        </p>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
