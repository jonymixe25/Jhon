import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../AuthContext';
import { Image as ImageIcon, Video, X } from 'lucide-react';

export default function Publish() {
  const { appUser } = useAuth();
  const navigate = useNavigate();
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'photo' | 'video' | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('video/')) {
      setMediaType('video');
      // For demo, we use object URL for video since converting video to Base64 is too large
      setMediaPreview(URL.createObjectURL(file));
      alert("Nota: Para videos en esta demo, se usa almacenamiento local temporal que no se sincroniza debido a límites de cuota.");
    } else if (file.type.startsWith('image/')) {
      setMediaType('photo');
      // Downscale image to a data URL
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_SIZE = 800; // Constrain to max 800px to avoid 1MB Firestore limit
          
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
          
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6); // 60% quality
          setMediaPreview(dataUrl);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePublish = async () => {
    if (!mediaPreview || !appUser) return;
    setIsPublishing(true);

    try {
      const parsedTags = tags.split(' ')
        .filter(t => t.startsWith('#'))
        .map(t => t.slice(1).toLowerCase());

      await addDoc(collection(db, 'posts'), {
        authorId: appUser.uid,
        authorName: appUser.displayName || 'Usuario',
        authorPhoto: appUser.photoURL || '',
        mediaUrl: mediaPreview, // Stored as base64 or blob URL
        mediaType: mediaType || 'photo',
        description: description,
        tags: parsedTags,
        createdAt: serverTimestamp()
      });

      navigate('/');
    } catch (error) {
      console.error("Error al publicar: ", error);
      alert("Ocurrío un error al publicar.");
    } finally {
      setIsPublishing(false);
    }
  };

  const removeMedia = () => {
    setMediaPreview(null);
    setMediaType(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="bento-card h-full flex flex-col pt-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[14px] font-semibold">Publicar Contenido</h1>
        <button 
          onClick={handlePublish}
          disabled={!mediaPreview || isPublishing}
          className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/30 hover:border-indigo-500/50 disabled:border-slate-800 disabled:bg-slate-800 disabled:text-slate-500 text-xs font-semibold px-4 py-1.5 rounded-full transition-colors"
        >
          {isPublishing ? 'Publicando...' : 'Publicar'}
        </button>
      </div>

      <div className="space-y-6 flex-1 overflow-y-auto pb-4 scroll-hide">
        {/* Media Uploader Area */}
        {!mediaPreview ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-48 bg-slate-900 border-2 border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-indigo-500 transition-colors group"
          >
            <div className="flex gap-4 mb-2">
               <ImageIcon className="text-slate-600 group-hover:text-indigo-400 transition-colors" size={28} />
               <Video className="text-slate-600 group-hover:text-indigo-400 transition-colors" size={28} />
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Toca para seleccionar archivo</p>
          </div>
        ) : (
          <div className="relative w-full rounded-xl overflow-hidden border border-slate-700 bg-slate-900 shadow-inner max-h-[40vh] flex items-center justify-center object-contain">
            {mediaType === 'video' ? (
              <video src={mediaPreview} controls className="w-full max-h-[40vh] object-contain" />
            ) : (
              <img src={mediaPreview} className="w-full max-h-[40vh] object-contain" alt="Preview" />
            )}
            <button 
              onClick={removeMedia}
              className="absolute top-2 right-2 w-8 h-8 bg-slate-900/80 rounded-lg border border-slate-700 flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50 backdrop-blur-md transition-all text-slate-400"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <input 
          type="file" 
          accept="image/*,video/*" 
          className="hidden" 
          ref={fileInputRef} 
          onChange={handleFileChange}
        />

        <div className="glass p-4 rounded-xl space-y-4">
          <textarea
            placeholder="Escribe una descripción..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-transparent text-sm resize-none disabled:bg-transparent placeholder-slate-500 focus:outline-none min-h-[80px]"
          />
          <div className="border-t border-slate-700/50 pt-3">
             <input
              type="text"
              placeholder="Etiquetas (ej: #viaje #amigos)"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full bg-transparent text-xs placeholder-slate-500 focus:outline-none text-indigo-400 font-semibold"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
