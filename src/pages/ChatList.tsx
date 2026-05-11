import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../AuthContext';
import { useNavigate, useSearchParams } from 'react-router';
import { Plus, Video } from 'lucide-react';

interface Room {
  id: string;
  type: string;
  members: string[];
  name?: string;
}

export default function ChatList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [rooms, setRooms] = useState<Room[]>([]);
  
  useEffect(() => {
    if (!user) return;
    
    // Auto-create room if redirected from Contacts
    const autoTarget = searchParams.get('target');
    if (autoTarget) {
      handleCreateDirectRoom(autoTarget);
    }

    const q = query(
      collection(db, 'rooms'),
      where('members', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedRooms = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Room[];
      setRooms(fetchedRooms);
    });

    return unsubscribe;
  }, [user, searchParams]);

  const handleCreateDirectRoom = async (targetUserId: string) => {
    if (!user) return;
    
    // Check if room exists
    const q = query(collection(db, 'rooms'), where('members', 'array-contains', user.uid));
    const snapshot = await getDocs(q);
    const existing = snapshot.docs.find(d => {
      const data = d.data();
      return data.type === 'direct' && data.members.includes(targetUserId);
    });

    if (existing) {
      navigate(`/room/${existing.id}?autoCall=${searchParams.get('startCall') === 'true'}`);
      return;
    }

    // Create new direct room
    const docRef = await addDoc(collection(db, 'rooms'), {
      type: 'direct',
      members: [user.uid, targetUserId],
      createdAt: serverTimestamp()
    });

    navigate(`/room/${docRef.id}?autoCall=${searchParams.get('startCall') === 'true'}`);
  };

  const handleCreateGroup = async () => {
    if (!user) return;
    const name = prompt("Nombre del grupo de chat:");
    if (!name) return;
    
    try {
      const docRef = await addDoc(collection(db, 'rooms'), {
        type: 'group',
        name: name,
        members: [user.uid], // For a real app, show a MultiSelect to add contacts
        createdAt: serverTimestamp()
      });
      navigate(`/room/${docRef.id}`);
    } catch(e) {
      alert("Error creating group.");
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[14px] font-semibold text-slate-200">Cámaras y Chats</h1>
        <button 
          onClick={handleCreateGroup}
          className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center hover:bg-indigo-400 transition shadow-lg shadow-indigo-500/20"
        >
          <Plus size={16} className="text-white" />
        </button>
      </div>

      <div className="bento-card h-full flex flex-col space-y-3 overflow-y-auto scroll-hide">
        {rooms.length === 0 ? (
          <p className="text-slate-500 text-sm text-center mt-6">No tienes chats activos.</p>
        ) : (
          rooms.map(room => (
            <div 
              key={room.id}
              onClick={() => navigate(`/room/${room.id}`)}
              className="flex items-center p-3 glass rounded-xl cursor-pointer hover:bg-slate-800 transition"
            >
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mr-3 shadow-inner border border-slate-700">
                {room.type === 'group' ? <Plus className="text-slate-500" size={16} /> : <Video className="text-indigo-400" size={16} />}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-slate-200">
                  {room.name || 'Chat Directo'}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">{room.type === 'group' ? 'Grupo' : 'Privado'}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
