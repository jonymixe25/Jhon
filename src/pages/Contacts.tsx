import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, doc, deleteDoc, addDoc, updateDoc, where, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../AuthContext';
import { UserPlus, UserCheck, Video, X, Clock, Check } from 'lucide-react';
import { useNavigate } from 'react-router';

interface ContactRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'pending' | 'accepted' | 'declined';
}

export default function Contacts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [sentReqs, setSentReqs] = useState<ContactRequest[]>([]);
  const [receivedReqs, setReceivedReqs] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchUsers() {
      if (!user) return;
      const q = query(collection(db, 'users'));
      const snapshot = await getDocs(q);
      const usersData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(u => u.id !== user.uid);
      setAllUsers(usersData);
    }
    fetchUsers();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsubSent = onSnapshot(query(collection(db, 'contactRequests'), where('senderId', '==', user.uid)), snap => {
      setSentReqs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContactRequest)));
    });
    const unsubReceived = onSnapshot(query(collection(db, 'contactRequests'), where('receiverId', '==', user.uid)), snap => {
      setReceivedReqs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContactRequest)));
      setLoading(false);
    });
    return () => { unsubSent(); unsubReceived(); }
  }, [user]);

  const allRequests = [...sentReqs, ...receivedReqs];

  const getReqForUser = (targetId: string) => allRequests.find(r => r.senderId === targetId || r.receiverId === targetId);

  const startVideoCall = (targetUserId: string) => {
    navigate(`/chats?startCall=true&target=${targetUserId}`);
  };

  const sendRequest = async (targetUserId: string) => {
    if (!user) return;
    await addDoc(collection(db, 'contactRequests'), {
      senderId: user.uid,
      receiverId: targetUserId,
      status: 'pending',
      createdAt: serverTimestamp()
    });
    
    // Create notification
    await addDoc(collection(db, 'notifications'), {
      userId: targetUserId,
      type: 'contact_request',
      senderId: user.uid,
      senderName: user.displayName || 'Alguien',
      text: 'te ha enviado una solicitud de contacto.',
      read: false,
      createdAt: serverTimestamp()
    });
  };

  const acceptRequest = async (reqId: string, senderId: string) => {
    await updateDoc(doc(db, 'contactRequests', reqId), { status: 'accepted' });
    
    // Create notification for the sender
    if (user) {
      await addDoc(collection(db, 'notifications'), {
        userId: senderId,
        type: 'contact_accepted',
        senderId: user.uid,
        senderName: user.displayName || 'Tu contacto',
        text: 'ha aceptado tu solicitud de contacto.',
        read: false,
        createdAt: serverTimestamp()
      });
    }
  };

  const deleteRequest = async (reqId: string) => {
    await deleteDoc(doc(db, 'contactRequests', reqId));
  };

  if (loading) {
    return <div className="p-6 text-slate-500 text-sm">Cargando contactos...</div>;
  }

  const filteredUsers = allUsers.filter(u => 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const incomingPending: any[] = [];
  const outgoingPending: any[] = [];
  const accepted: any[] = [];
  const suggestions: any[] = [];

  filteredUsers.forEach(u => {
    const req = getReqForUser(u.id);
    if (!req || req.status === 'declined') {
       suggestions.push({ user: u, req });
    } else if (req.status === 'accepted') {
       accepted.push({ user: u, req });
    } else if (req.status === 'pending') {
       if (req.senderId === user?.uid) outgoingPending.push({ user: u, req });
       else incomingPending.push({ user: u, req });
    }
  });

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Buscador */}
      <div className="glass rounded-2xl p-4 sticky top-0 z-10 mx-[-4px]">
        <input 
          type="text"
          placeholder="Buscar personas o emails..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-full py-2 px-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
        />
      </div>

      {/* Solicitudes Entrantes */}
      {incomingPending.length > 0 && (
        <div className="bento-card flex flex-col space-y-4 border-indigo-500/30">
          <h2 className="text-[10px] uppercase tracking-widest text-indigo-400 font-bold mb-2">Solicitudes Recibidas</h2>
          <div className="space-y-3">
            {incomingPending.map(item => (
              <UserRow 
                key={item.user.id} 
                user={item.user} 
                actions={
                  <div className="flex gap-2">
                    <button onClick={() => acceptRequest(item.req.id, item.user.id)} className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center hover:bg-indigo-400 transition" title="Aceptar">
                      <Check size={16} />
                    </button>
                    <button onClick={() => deleteRequest(item.req.id)} className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center hover:text-red-400 transition" title="Rechazar">
                      <X size={16} />
                    </button>
                  </div>
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Mis Contactos */}
      <div className="bento-card flex-1 flex flex-col space-y-4">
        <h2 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">Mis Contactos</h2>
        <div className="space-y-3 overflow-y-auto scroll-hide flex-1 max-h-[40vh]">
          {accepted.length === 0 ? (
            <p className="text-slate-500 text-xs italic">Aún no tienes contactos agregados.</p>
          ) : (
            accepted.map(item => (
              <UserRow 
                key={item.user.id} 
                user={item.user} 
                actions={
                  <div className="flex gap-2">
                    <button onClick={() => startVideoCall(item.user.id)} className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-indigo-400 hover:bg-slate-700 transition border border-slate-700" title="Videollamada">
                      <Video size={14} />
                    </button>
                    <button onClick={() => deleteRequest(item.req.id)} className="w-8 h-8 rounded-full bg-slate-800 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 flex items-center justify-center transition border border-slate-700" title="Eliminar Contacto">
                      <X size={14} />
                    </button>
                  </div>
                }
              />
            ))
          )}
        </div>
      </div>

      {/* Solicitudes Enviadas */}
      {outgoingPending.length > 0 && (
         <div className="bento-card flex flex-col space-y-4">
           <h2 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">Solicitudes Enviadas</h2>
           <div className="space-y-3">
             {outgoingPending.map(item => (
                <UserRow 
                  key={item.user.id} 
                  user={item.user} 
                  actions={
                    <div className="flex gap-2">
                      <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium bg-slate-800 px-2 py-1 rounded-md">
                        <Clock size={12} /> Pendiente
                      </span>
                      <button onClick={() => deleteRequest(item.req.id)} className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center hover:text-red-400 transition" title="Cancelar Solicitud">
                        <X size={14} />
                      </button>
                    </div>
                  }
                />
             ))}
           </div>
         </div>
      )}

      {/* Sugerencias */}
      <div className="bento-card flex-1 flex flex-col space-y-4">
        <h2 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">Sugerencias y Búsqueda</h2>
        <div className="space-y-3 overflow-y-auto scroll-hide flex-1">
          {suggestions.length === 0 ? (
            <p className="text-slate-500 text-xs italic">No hay más sugerencias disponibles.</p>
          ) : (
            suggestions.map(item => (
              <UserRow 
                key={item.user.id} 
                user={item.user} 
                actions={
                  <button onClick={() => sendRequest(item.user.id)} className="w-8 h-8 rounded-full bg-indigo-500/20 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500 hover:text-white flex items-center justify-center transition border" title="Agregar Contacto">
                     <UserPlus size={14} />
                  </button>
                }
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function UserRow({ user, actions }: { user: any, actions: React.ReactNode, key?: React.Key }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/10 overflow-hidden border border-slate-700">
          {user.photoURL ? (
            <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
          ) : (
            user.displayName?.charAt(0).toUpperCase() || 'U'
          )}
        </div>
        <div>
          <p className="font-bold text-sm">{user.displayName || 'Usuario'}</p>
          <p className="text-[10px] text-slate-400 truncate w-32">{user.email}</p>
        </div>
      </div>
      <div className="flex items-center">
        {actions}
      </div>
    </div>
  );
}
