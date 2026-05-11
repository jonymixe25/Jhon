import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { Camera, LogOut, User, Edit2, Check } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useNavigate } from 'react-router';

export default function Profile() {
  const { appUser, logOut } = useAuth();
  const navigate = useNavigate();
  
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(appUser?.displayName || '');
  const [isSaving, setIsSaving] = useState(false);

  if (!appUser) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSaving(true);
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_SIZE = 400; // Profile photos don't need to be huge
          
          if (width > height && width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7); // 70% quality is plenty
          
          try {
            const userRef = doc(db, 'users', appUser.uid);
            await updateDoc(userRef, { photoURL: dataUrl });
          } catch (err) {
            console.error("Error saving resized photo:", err);
            alert("No se pudo guardar la imagen. Error de red o permisos.");
          } finally {
            setIsSaving(false);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error updating photo:", error);
      setIsSaving(false);
      alert("Error al procesar la imagen seleccionada.");
    }
  };

  const handleSave = async () => {
    if (!displayName.trim()) return;
    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', appUser.uid);
      await updateDoc(userRef, { displayName });
      setIsEditing(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await logOut();
    navigate('/login');
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[14px] font-semibold text-slate-200">Perfil</h1>
      </div>

      <div className="bento-card flex flex-col space-y-6 items-center flex-1">
        
        {/* Avatar Section */}
        <div className="relative mt-8">
          <input 
            type="file" 
            id="profile-photo" 
            className="hidden" 
            accept="image/*"
            onChange={handleFileChange}
          />
          <div className="w-28 h-28 rounded-full bg-slate-800 flex items-center justify-center font-bold text-4xl text-white shadow-[0_0_30px_rgba(99,102,241,0.2)] overflow-hidden border-2 border-indigo-500/50">
            {appUser.photoURL ? (
              <img src={appUser.photoURL} alt={appUser.displayName} className="w-full h-full object-cover" />
            ) : (
              <User size={48} className="text-slate-500" />
            )}
            {isSaving && (
              <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          <button 
            onClick={() => document.getElementById('profile-photo')?.click()}
            className="absolute bottom-0 right-0 w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-white border border-indigo-400 shadow-lg hover:bg-indigo-400 transition" 
            title="Cambiar foto de perfil"
          >
             <Camera size={14} />
          </button>
        </div>

        {/* User Info Section */}
        <div className="w-full flex-1 flex flex-col space-y-6 px-4">
          
          <div className="glass p-4 rounded-2xl border border-slate-700/50 flex flex-col space-y-1">
             <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Email</label>
             <p className="text-sm font-medium text-slate-300">{appUser.email || 'No especificado'}</p>
          </div>

          <div className="glass p-4 rounded-2xl border border-slate-700/50 flex flex-col space-y-2">
             <div className="flex items-center justify-between">
               <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Nombre</label>
               {!isEditing ? (
                  <button onClick={() => setIsEditing(true)} className="text-indigo-400 hover:text-indigo-300">
                    <Edit2 size={14} />
                  </button>
               ) : (
                  <button onClick={handleSave} disabled={isSaving} className="text-green-400 hover:text-green-300">
                    <Check size={16} />
                  </button>
               )}
             </div>
             
             {isEditing ? (
               <input 
                 type="text" 
                 value={displayName} 
                 onChange={e => setDisplayName(e.target.value)}
                 className="w-full bg-slate-800/50 border border-indigo-500/50 rounded-lg py-2 px-3 text-sm text-slate-200 focus:outline-none transition-colors"
                 autoFocus
               />
             ) : (
               <p className="text-base font-semibold text-slate-200">{appUser.displayName}</p>
             )}
          </div>
        </div>

        <button 
          onClick={handleLogout}
          className="w-full mt-auto glass rounded-xl py-3 px-6 text-red-400 font-medium text-sm flex items-center justify-center gap-2 hover:bg-red-500/10 border border-red-500/20 transition-colors"
        >
          <LogOut size={16} />
          <span>Cerrar Sesión</span>
        </button>

      </div>
    </div>
  );
}
