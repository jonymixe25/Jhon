import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { db } from '../lib/firebase';
import { collection, doc, onSnapshot, query, orderBy, addDoc, serverTimestamp, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { Send, Video, Mic, MicOff, VideoOff, PhoneOff } from 'lucide-react';

// STUN servers for WebRTC
const servers = {
  iceServers: [
    { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }
  ]
};

export default function Room() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  
  // Call State
  const [inCall, setInCall] = useState(false);
  const [isReceivingCall, setIsReceivingCall] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    if (!roomId) return;
    const q = query(collection(db, 'rooms', roomId, 'messages'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    
    // Listen for call signaling on the room
    const roomRef = doc(db, 'rooms', roomId);
    const unsubRoom = onSnapshot(roomRef, (snap) => {
      const data = snap.data();
      if (data && data.offer && !pcRef.current) {
        setIsReceivingCall(true);
      }
    });

    return () => {
      unsub();
      unsubRoom();
    };
  }, [roomId]);

  // Set up local video stream whenever it changes
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, inCall]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, inCall]);

  const sendMessage = async () => {
    if (!text.trim() || !user || !roomId) return;
    
    // Send message
    await addDoc(collection(db, 'rooms', roomId, 'messages'), {
      authorId: user.uid,
      text: text,
      createdAt: serverTimestamp()
    });

    // Create notifications for other members
    try {
      const roomSnap = await getDoc(doc(db, 'rooms', roomId));
      const roomData = roomSnap.data();
      if (roomData && roomData.members) {
        const recipients = roomData.members.filter((m: string) => m !== user.uid);
        for (const recipientId of recipients) {
          await addDoc(collection(db, 'notifications'), {
            userId: recipientId,
            type: 'message',
            roomId: roomId,
            senderId: user.uid,
            senderName: user.displayName || 'Contacto',
            text: `te envió un mensaje en ${roomData.name || 'Chat Directo'}: "${text.slice(0, 30)}${text.length > 30 ? '...' : ''}"`,
            read: false,
            createdAt: serverTimestamp()
          });
        }
      }
    } catch (e) {
      console.error("Error creating message notification:", e);
    }

    setText('');
  };

  const startCall = async () => {
    if (!roomId) return;
    setInCall(true);
    
    const pc = new RTCPeerConnection(servers);
    pcRef.current = pc;
    
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    setLocalStream(stream);
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    const remoteSt = new MediaStream();
    setRemoteStream(remoteSt);

    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remoteSt.addTrack(track);
      });
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const roomRef = doc(db, 'rooms', roomId);
    
    // Setup ICE Candidates
    const callerCandidates = collection(db, 'rooms', roomId, 'callerCandidates');
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(callerCandidates, event.candidate.toJSON());
      }
    };

    await updateDoc(roomRef, {
      offer: { type: offer.type, sdp: offer.sdp }
    });

    onSnapshot(roomRef, (snapshot) => {
      const data = snapshot.data();
      if (!pc.currentRemoteDescription && data?.answer) {
        const rtcSessionDescription = new RTCSessionDescription(data.answer);
        pc.setRemoteDescription(rtcSessionDescription);
      }
    });

    onSnapshot(collection(db, 'rooms', roomId, 'calleeCandidates'), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          let data = change.doc.data();
          pc.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
  };

  const answerCall = async () => {
    if (!roomId) return;
    setInCall(true);
    setIsReceivingCall(false);
    
    const pc = new RTCPeerConnection(servers);
    pcRef.current = pc;

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    setLocalStream(stream);
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    const remoteSt = new MediaStream();
    setRemoteStream(remoteSt);

    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remoteSt.addTrack(track);
      });
    };

    const roomRef = doc(db, 'rooms', roomId);
    const roomSnap = await getDoc(roomRef);
    const roomData = roomSnap.data();

    if (!roomData?.offer) return;

    const calleeCandidates = collection(db, 'rooms', roomId, 'calleeCandidates');
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(calleeCandidates, event.candidate.toJSON());
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(roomData.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await updateDoc(roomRef, {
      answer: { type: answer.type, sdp: answer.sdp }
    });

    onSnapshot(collection(db, 'rooms', roomId, 'callerCandidates'), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          let data = change.doc.data();
          pc.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
  };

  const endCall = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
    }
    setLocalStream(null);
    setRemoteStream(null);
    setInCall(false);
    setIsReceivingCall(false);
  };

  if (!user) return null;

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200 relative">
      <div className="flex items-center justify-between p-4 glass rounded-b-2xl sticky top-0 z-10 mx-[-16px] mb-4">
        <h2 className="font-semibold tracking-tight text-lg">Sala de Chat</h2>
        {!inCall && (
          <button 
            onClick={startCall}
            className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-colors border border-indigo-500/30"
          >
            <Video size={20} />
          </button>
        )}
      </div>
      
      {isReceivingCall && !inCall && (
        <div className="glass p-4 m-4 rounded-xl flex items-center justify-between shadow-lg border border-indigo-500/50">
          <p className="font-medium text-indigo-400">Llamada entrante...</p>
          <button onClick={answerCall} className="bg-indigo-500 text-white px-4 py-2 rounded-full font-bold text-sm">Contestar</button>
        </div>
      )}

      {inCall ? (
        <div className="flex-1 flex flex-col space-y-4">
          <div className="flex-1 relative bg-slate-800 rounded-3xl overflow-hidden border border-slate-700 shadow-2xl">
            {/* Remote Video mostly fills */}
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            {/* Local Video PIP */}
            <div className="absolute top-4 right-4 w-24 h-36 bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-lg">
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            </div>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
               <button onClick={endCall} className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600 transition-transform active:scale-95">
                 <PhoneOff size={16} />
               </button>
               <button className="w-10 h-10 rounded-full bg-slate-700 text-white flex items-center justify-center shadow-lg border border-slate-600">
                 <VideoOff size={16} />
               </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="bento-card flex-1 p-4 overflow-y-auto space-y-4 scroll-hide">
            {messages.map(msg => (
              <div key={msg.id} className={`flex flex-col max-w-[80%] ${msg.authorId === user.uid ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                <div className={`p-3 rounded-xl text-[12px] ${msg.authorId === user.uid ? 'bg-indigo-500/20 text-indigo-100 border border-indigo-500/30' : 'glass text-slate-300'}`}>
                   {msg.authorId !== user.uid && <span className="text-indigo-400 font-bold block mb-1">Contacto</span>}
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <input 
              type="text" 
              value={text} 
              onChange={e => setText(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Escribe algo..."
              className="flex-1 bg-slate-900 border disabled:opacity-50 border-slate-700 rounded-lg py-2 px-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button onClick={sendMessage} disabled={!text.trim()} className="w-10 h-10 rounded-lg bg-indigo-500/20 disabled:opacity-50 flex flex-shrink-0 items-center justify-center text-indigo-400 border border-indigo-500/30 transition-colors">
              <Send size={16} className="ml-0.5" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
