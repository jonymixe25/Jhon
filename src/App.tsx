import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { AuthProvider, useAuth } from './AuthContext';
import Layout from './components/Layout';
import Feed from './pages/Feed';
import Publish from './pages/Publish';
import Contacts from './pages/Contacts';
import ChatList from './pages/ChatList';
import Room from './pages/Room';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">Cargando...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Feed />} />
            <Route path="publish" element={<Publish />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="chats" element={<ChatList />} />
            <Route path="room/:roomId" element={<Room />} />
            <Route path="profile" element={<Profile />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
