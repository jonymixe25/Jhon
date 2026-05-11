import React from 'react';
import { Outlet, NavLink } from 'react-router';
import { Home, PlusSquare, Users, MessageCircle, User } from 'lucide-react';
import { cn } from '../lib/utils';
import NotificationCenter from './NotificationCenter';

export default function Layout() {
  return (
    <div className="flex flex-col h-[100dvh] bg-slate-900 text-slate-200 font-sans max-w-md mx-auto w-full relative overflow-hidden shadow-2xl">
      {/* Top Brand Bar */}
      <header className="flex items-center justify-between p-4 z-40 bg-slate-900/50 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 shadow-lg shadow-indigo-500/20 flex items-center justify-center">
             <span className="text-white font-black text-xs">M</span>
          </div>
          <span className="font-bold text-sm tracking-tight text-slate-200">MixeSocial</span>
        </div>
        <NotificationCenter />
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-32 p-4 scroll-hide space-y-4">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="absolute bottom-10 left-4 right-4 h-16 bento-card !p-1 flex items-center justify-around z-50 shadow-xl shadow-indigo-500/10">
        <NavItem to="/" icon={<Home size={20} />} label="Inicio" />
        <NavItem to="/publish" icon={<PlusSquare size={20} />} label="Post" />
        <NavItem to="/contacts" icon={<Users size={20} />} label="Gente" />
        <NavItem to="/chats" icon={<MessageCircle size={20} />} label="Chats" />
        <NavItem to="/profile" icon={<User size={20} />} label="Perfil" />
      </nav>

      {/* Footer */}
      <footer className="absolute bottom-2 left-0 right-0 text-center z-40">
        <p className="text-[9px] text-slate-600 font-medium tracking-tight">
          © derechos reservados Tlahuitoltepec Mixe 2026
        </p>
      </footer>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors duration-200 rounded-xl",
          isActive ? "bg-indigo-500/10 text-indigo-400 font-medium" : "text-slate-400 hover:bg-slate-800"
        )
      }
    >
      {icon}
      <span className="text-[10px] tracking-wider">{label}</span>
    </NavLink>
  );
}
