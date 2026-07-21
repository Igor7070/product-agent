'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession, signIn, signOut } from "next-auth/react";

const API_BASE = 'https://perfect-flexibility-production-2fbc.up.railway.app';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
}

interface Conversation {
  id: number;
  title: string;
  last_message: string;
  updated_at: string;
  state?: any;
}

const DEFAULT_WELCOME = 'Привет! 👋 Я Анна — твой персональный AI-стилист. Давай создадим идеальный гардероб вместе. Как тебя зовут?';

export default function AIStylist() {
  const { data: session, status } = useSession();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; convId: number } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    console.log("[FRONTEND SESSION]", session);
  }, [session]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // === ХЕДЕРЫ С АВТОРИЗАЦИЕЙ ===
  const getAuthHeaders = () => {
    const headers: Record<string, string> = {};
    if (session?.user?.id) {
      headers['Authorization'] = `Bearer ${session.user.id}`;
      console.log("[FRONTEND] Adding token for user:", session.user.id);
    } else {
      console.log("[FRONTEND] No session, sending without token");
    }
    return headers;
  };

  // Загрузка списка чатов
  useEffect(() => {
    const loadConversations = async () => {
      try {
        const res = await fetch(`${API_BASE}/conversations/`, {
          headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        setConversations(data);
      } catch (error) {
        console.error("Не удалось загрузить список чатов:", error);
      }
    };
    loadConversations();
  }, [session]);

  // Восстановление последнего чата
  useEffect(() => {
    const savedId = localStorage.getItem('activeConversationId');
    if (savedId) {
      const id = parseInt(savedId);
      loadConversation(id);
    }
  }, []);

  useEffect(() => {
    if (conversations.length > 0 && activeConversationId === null) {
      const savedId = localStorage.getItem('activeConversationId');
      if (savedId) {
        const id = parseInt(savedId);
        const exists = conversations.some(c => c.id === id);
        loadConversation(exists ? id : conversations[0].id);
      } else {
        loadConversation(conversations[0].id);
      }
    }
  }, [conversations]);

  const loadConversation = async (convId: number) => {
    try {
      setActiveConversationId(convId);
      localStorage.setItem('activeConversationId', convId.toString());

      const res = await fetch(`${API_BASE}/conversations/${convId}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();

      if (data.messages && data.messages.length > 0) {
        setMessages(data.messages.map((m: any) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
          images: m.images
        })));
      } else {
        setMessages([{ role: 'assistant', content: DEFAULT_WELCOME }]);
      }
    } catch (error) {
      console.error("Не удалось загрузить чат:", error);
      setMessages([{ role: 'assistant', content: DEFAULT_WELCOME }]);
    }
  };

  const createNewChat = async () => {
    try {
      const res = await fetch(`${API_BASE}/conversations/`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const newConv = await res.json();
      
      const newId = newConv.id;
      setActiveConversationId(newId);
      localStorage.setItem('activeConversationId', newId.toString());

      setMessages([{ role: 'assistant', content: DEFAULT_WELCOME }]);
      setInput('');
      setSelectedFiles([]);
    } catch (e) {
      console.error(e);
      alert("Не удалось создать новый чат");
    }
  };

  const handleContextMenu = (e: React.MouseEvent, convId: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, convId });
  };

  const deleteConversation = async (convId: number) => {
    if (!confirm("Удалить этот чат навсегда?")) return;

    try {
      await fetch(`${API_BASE}/conversations/${convId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      setConversations(prev => prev.filter(c => c.id !== convId));

      if (activeConversationId === convId) {
        createNewChat();
      }

      setContextMenu(null);
    } catch (error) {
      alert("Не удалось удалить чат");
    }
  };

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleSend = async () => {
    if (loading || (!input.trim() && selectedFiles.length === 0) || activeConversationId === null) return;

    const userMessage: Message = { 
      role: 'user', 
      content: input.trim() || `📸 Отправляю ${selectedFiles.length} фото` 
    };
    
    setMessages(prev => [...prev, userMessage]);

    const currentInput = input.trim();
    setInput('');
    setLoading(true);

    const formData = new FormData();
    formData.append('message', currentInput || 'Отправляю фото');
    formData.append('conversation_id', activeConversationId.toString());

    selectedFiles.forEach(file => formData.append('files', file));

    try {
      const response = await fetch(`${API_BASE}/chat/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });

      const data = await response.json();
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.content,
        images: data.images 
      }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Извини, ошибка соединения.' 
      }]);
    } finally {
      setLoading(false);
      setSelectedFiles([]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 to-zinc-900 text-white">
      <div className="max-w-6xl mx-auto flex h-screen">
        {/* Боковая панель */}
        <div className="w-96 bg-zinc-900 border-r border-zinc-800 p-8 flex flex-col">
          <div className="flex flex-col items-center text-center mb-10">
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-pink-500 mb-6 shadow-2xl">
              <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400" alt="Анна" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-3xl font-bold mb-1">Анна Смирнова</h1>
            <p className="text-pink-400 text-lg">Персональный AI-стилист</p>
            <p className="text-zinc-400 mt-4 text-sm">
              Более 8 лет опыта • 1200+ счастливых клиентов
            </p>
          </div>

          {/* === БЛОК АВТОРИЗАЦИИ === */}
          <div className="mb-6">
            {status === "loading" ? (
              <div className="text-center text-zinc-400">Загрузка...</div>
            ) : session ? (
              <div className="bg-zinc-800 rounded-2xl p-4 text-center">
                <p className="text-sm text-green-400">✅ {session.user?.name}</p>
                <button
                  onClick={() => signOut()}
                  className="mt-2 text-xs text-red-400 hover:text-red-500 underline"
                >
                  Выйти
                </button>
              </div>
            ) : (
              <button
                onClick={() => signIn("google")}
                className="w-full bg-white text-black py-3 rounded-2xl font-medium flex items-center justify-center gap-3 hover:bg-zinc-100 transition"
              >
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                Войти через Google
              </button>
            )}
          </div>

          <div className="mt-auto">
            <h3 className="uppercase text-xs tracking-widest text-zinc-500 mb-4">Что я умею</h3>
            <ul className="space-y-4 text-sm">
              <li className="flex items-center gap-3">🎨 Подобрать стиль под твою внешность</li>
              <li className="flex items-center gap-3">📸 Работать с твоими фото</li>
              <li className="flex items-center gap-3">💰 Учитывать твой бюджет</li>
              <li className="flex items-center gap-3">🛍️ Находить точные вещи на маркетплейсах</li>
              <li className="flex items-center gap-3">👗 Создавать полные образы</li>
            </ul>
          </div>

          <div className="mt-8 pt-6 border-t border-zinc-800">
            <button
              onClick={createNewChat}
              className="w-full bg-pink-600 hover:bg-pink-700 py-3 rounded-2xl font-medium mb-4 transition"
            >
              + Новый чат
            </button>

            <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3">История чатов</p>
            <div className="space-y-2 max-h-40 overflow-y-auto text-sm">
              {conversations.map(conv => (
                <div 
                  key={conv.id} 
                  onClick={() => loadConversation(conv.id)}
                  onContextMenu={(e) => handleContextMenu(e, conv.id)}
                  className={`p-3 rounded-xl cursor-pointer transition relative group ${
                    activeConversationId === conv.id 
                      ? 'bg-pink-600' 
                      : 'bg-zinc-800/50 hover:bg-zinc-800'
                  }`}
                >
                  {conv.title}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-zinc-400">⋮</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Чат */}
        <div className="flex-1 flex flex-col">
          <div className="p-6 border-b border-zinc-800 flex items-center gap-4 bg-zinc-950">
            <div className="w-10 h-10 rounded-full overflow-hidden border border-pink-500">
              <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400" alt="Anna" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="font-semibold">Анна • онлайн</p>
              <p className="text-xs text-green-400">Готова помочь с образом</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-zinc-950">
            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] rounded-3xl px-6 py-4 ${
                  msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-white'
                }`}>
                  <p>{msg.content}</p>
                  {msg.images && msg.images.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {msg.images.map((imgPath, i) => (
                        <img key={i} src={`${API_BASE}${imgPath}`} alt="" className="rounded-xl max-h-48 object-cover" />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-zinc-800 text-white px-6 py-4 rounded-3xl">Анна печатает...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-6 border-t border-zinc-800 bg-zinc-900">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Напиши сообщение Анне..."
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-2xl px-6 py-4 focus:outline-none focus:border-pink-500 transition"
                disabled={loading}
              />

              <label className="cursor-pointer bg-zinc-700 hover:bg-zinc-600 px-5 rounded-2xl flex items-center text-xl transition">
                📸
                <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileSelect} disabled={loading} />
              </label>

              <button
                onClick={handleSend}
                disabled={loading || (!input.trim() && selectedFiles.length === 0)}
                className="bg-pink-600 hover:bg-pink-700 px-10 rounded-2xl font-medium transition disabled:opacity-50"
              >
                {loading ? '...' : 'Отправить'}
              </button>
            </div>

            {selectedFiles.length > 0 && (
              <p className="text-xs text-zinc-400 mt-2">
                Выбрано файлов: {selectedFiles.length} — готово к отправке
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Контекстное меню */}
      {contextMenu && (
        <div 
          className="fixed bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl py-1 z-50 w-48 text-sm"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => deleteConversation(contextMenu.convId)}
            className="w-full text-left px-4 py-2.5 text-red-400 hover:bg-zinc-800 flex items-center gap-2"
          >
            🗑 Удалить чат
          </button>
        </div>
      )}
    </div>
  );
}