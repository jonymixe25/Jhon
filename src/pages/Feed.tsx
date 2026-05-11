import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, where, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Search, Heart, MessageCircle, Send } from 'lucide-react';
import { useAuth } from '../AuthContext';

interface Post {
  id: string;
  authorId: string;
  authorName?: string;
  authorPhoto?: string;
  mediaUrl: string;
  mediaType: string;
  tags: string[];
  description: string;
  createdAt: any;
  likes?: string[];
}

export default function Feed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    
    if (searchTerm.startsWith('#') && searchTerm.length > 1) {
      const tag = searchTerm.slice(1).toLowerCase();
      q = query(collection(db, 'posts'), where('tags', 'array-contains', tag), orderBy('createdAt', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPosts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Post[];
      
      if (searchTerm && !searchTerm.startsWith('#')) {
        const lowerTerm = searchTerm.toLowerCase();
        setPosts(fetchedPosts.filter(p => 
          (p.description && p.description.toLowerCase().includes(lowerTerm)) ||
          p.tags.some(tag => tag.toLowerCase().includes(lowerTerm))
        ));
      } else {
        setPosts(fetchedPosts);
      }
    });

    return unsubscribe;
  }, [searchTerm]);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <div className="glass rounded-2xl px-4 py-4 sticky top-0 z-10">
        <h1 className="text-xl font-bold tracking-tight mb-4 text-slate-200">Descubre</h1>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
          <input
            type="text"
            placeholder="Buscar fotos, videos o etiquetas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-full py-2 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
          />
        </div>
      </div>

      {/* Feed content */}
      <div className="flex-1 space-y-4 pb-4">
        {posts.length === 0 ? (
          <div className="bento-card flex flex-col items-center justify-center py-12 text-slate-500 text-center">
            <div className="w-12 h-12 mb-4 rounded-full bg-slate-800 flex items-center justify-center">
              <Search size={20} />
            </div>
            <p className="text-sm">No se encontraron publicaciones</p>
          </div>
        ) : (
          posts.map(post => <PostCard key={post.id} post={post} />)
        )}
      </div>
    </div>
  );
}

function PostCard({ post }: { post: Post, key?: React.Key }) {
  const { appUser } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');

  const timeStr = post.createdAt?.toMillis() 
    ? formatDistanceToNow(post.createdAt.toMillis(), { addSuffix: true, locale: es })
    : 'hace un momento';

  const isLiked = appUser && post.likes?.includes(appUser.uid);
  const likesCount = post.likes?.length || 0;

  useEffect(() => {
    if (!showComments) return;
    const q = query(collection(db, 'posts', post.id, 'comments'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [showComments, post.id]);

  const toggleLike = async () => {
    if (!appUser) return;
    const postRef = doc(db, 'posts', post.id);
    const newLikes = [...(post.likes || [])];
    const index = newLikes.indexOf(appUser.uid);
    
    if (index > -1) {
      newLikes.splice(index, 1);
    } else {
      newLikes.push(appUser.uid);
    }
    
    try {
      await updateDoc(postRef, { likes: newLikes });
    } catch(e) {
      console.error(e);
    }
  };

  const addComment = async () => {
    if (!appUser || !newComment.trim()) return;
    try {
      await addDoc(collection(db, 'posts', post.id, 'comments'), {
        authorId: appUser.uid,
        authorName: appUser.displayName || 'Usuario',
        authorPhoto: appUser.photoURL || '',
        text: newComment,
        createdAt: serverTimestamp()
      });
      setNewComment('');
    } catch(e) {
      console.error(e);
    }
  };

  return (
    <article className="bento-card !p-4 flex flex-col gap-3">
      {/* Author info */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-indigo-500/10 overflow-hidden border border-slate-700">
          {post.authorPhoto ? (
            <img src={post.authorPhoto} alt={post.authorName} className="w-full h-full object-cover" />
          ) : (
            post.authorName?.charAt(0).toUpperCase() || 'U'
          )}
        </div>
        <div>
          <p className="font-bold text-sm text-slate-200">{post.authorName || 'Usuario'}</p>
          <p className="text-[10px] text-slate-500">{timeStr}</p>
        </div>
      </div>

      {/* Media */}
      <div className="rounded-xl overflow-hidden bg-slate-800 border border-slate-700 aspect-auto shadow-inner">
        {post.mediaType === 'video' ? (
          <video src={post.mediaUrl} controls className="w-full h-full object-cover max-h-[400px]" />
        ) : (
          <img src={post.mediaUrl} alt={post.description} className="w-full h-full object-cover max-h-[400px]" />
        )}
      </div>

      {/* Content */}
      <div className="space-y-2 mt-1">
        <p className="text-[13px] text-slate-300 leading-relaxed">
          {post.description}
        </p>
        {post.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 text-indigo-400">
            {post.tags.map(tag => (
              <span key={tag} className="px-3 py-1 bg-indigo-500/10 text-[10px] font-bold rounded-full border border-indigo-500/20">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 mt-2 border-t border-slate-800 pt-3">
        <button 
          onClick={toggleLike}
          className={`flex items-center gap-2 transition-colors p-2 rounded-xl border ${isLiked ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'text-slate-400 hover:text-red-400 hover:bg-slate-800 border-transparent'}`}
        >
          <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
          <span className="text-[11px] font-bold">{likesCount} me gusta</span>
        </button>
        <button 
          onClick={() => setShowComments(!showComments)}
          className={`flex items-center gap-2 text-slate-400 hover:text-indigo-400 transition-colors p-2 rounded-xl hover:bg-slate-800 ${showComments ? 'text-indigo-400 bg-indigo-500/5' : ''}`}
        >
          <MessageCircle size={18} />
          <span className="text-[11px] font-bold">Comentar</span>
        </button>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="mt-2 pt-4 border-t border-slate-800 space-y-4">
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3">Comentarios</p>
            {comments.length === 0 ? (
               <p className="text-[11px] text-slate-500 italic py-2">Sé el primero en comentar...</p>
            ) : (
              comments.map(c => (
                <div key={c.id} className="flex gap-3 items-start group">
                  <div className="w-7 h-7 rounded-full bg-slate-800 flex-shrink-0 shadow-inner overflow-hidden border border-slate-700">
                    {c.authorPhoto ? (
                      <img src={c.authorPhoto} alt={c.authorName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="flex items-center justify-center w-full h-full text-[10px] font-black text-slate-500">
                        {c.authorName?.charAt(0).toUpperCase() || '?'}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 glass p-2 rounded-2xl rounded-tl-none border border-slate-700/50">
                    <p className="text-[10px] font-bold text-indigo-400 mb-0.5">{c.authorName || 'Usuario'}</p>
                    <p className="text-[11px] text-slate-300 leading-tight">{c.text}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2 mt-4 glass p-1 rounded-xl border border-slate-700/50">
            <input 
              type="text"
              value={newComment}
              onChange={e => setNewComment(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && addComment()}
              placeholder="Escribe un comentario..."
              className="flex-1 bg-transparent border-none py-2 px-3 text-[11px] focus:outline-none text-slate-200 placeholder-slate-500"
            />
            <button 
              onClick={addComment}
              disabled={!newComment.trim()}
              className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white disabled:opacity-30 disabled:grayscale transition-all shadow-lg shadow-indigo-500/20"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
