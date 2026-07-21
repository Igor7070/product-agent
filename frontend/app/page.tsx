'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
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

  // Состояние для открытия/закрытия бокового меню на мобильных устройствах
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; convId: number } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // === ХЕДЕРЫ С АВТОРИЗАЦИЕЙ ===
  const getAuthHeaders = useCallback(() => {
    const headers: Record<string, string> = {};
    if (session?.user?.idToken) {
      headers['Authorization'] = `Bearer ${session.user.idToken}`;
      console.log("[FRONTEND] Sending Google ID Token:", session.user.idToken.slice(0, 15) + "...");
    } else {
      console.log("[FRONTEND] No session or idToken, sending without token");
    }
    return headers;
  }, [session]);

  // Загрузка конкретного чата
  const loadConversation = useCallback(async (convId: number) => {
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
      setIsSidebarOpen(false); // Авто-закрытие меню на мобильных после выбора чата
    } catch (error) {
      console.error("Не удалось загрузить чат:", error);
      setMessages([{ role: 'assistant', content: DEFAULT_WELCOME }]);
    }
  }, [getAuthHeaders]);

  // Создание нового чата
  const createNewChat = useCallback(async () => {
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

      setConversations(prev => [newConv, ...prev]);
      setIsSidebarOpen(false); // Авто-закрытие меню на мобильных после создания чата
      return newConv;
    } catch (e) {
      console.error(e);
      alert("Не удалось создать новый чат");
      return null;
    }
  }, [getAuthHeaders]);

  // Единая загрузка списка чатов и восстановление активного чата без гонки состояний
  useEffect(() => {
    if (status === 'loading') return;

    const initConversations = async () => {
      try {
        const res = await fetch(`${API_BASE}/conversations/`, {
          headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error('Failed');
        const data: Conversation[] = await res.json();
        setConversations(data);

        const savedId = localStorage.getItem('activeConversationId');
        let targetId: number | null = null;

        if (savedId) {
          const parsedId = parseInt(savedId);
          if (data.some(c => c.id === parsedId)) {
            targetId = parsedId;
          }
        }

        if (!targetId && data.length > 0) {
          targetId = data[0].id;
        }

        if (targetId) {
          await loadConversation(targetId);
        } else {
          // Если у пользователя вообще нет чатов — создаём первый чат автоматически
          await createNewChat();
        }
      } catch (error) {
        console.error("Не удалось загрузить список чатов:", error);
      }
    };

    initConversations();
  }, [session, status, getAuthHeaders, loadConversation, createNewChat]);

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
    if (loading || (!input.trim() && selectedFiles.length === 0)) return;

    // Если activeConversationId равен null, создаем новый чат перед отправкой
    let currentConvId = activeConversationId;
    if (currentConvId === null) {
      const newConv = await createNewChat();
      if (!newConv) return;
      currentConvId = newConv.id;
    }

    // Дополнительная проверка, чтобы TypeScript точно знал, что currentConvId — это number
    if (currentConvId === null) return;

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
    formData.append('conversation_id', currentConvId.toString());

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
    <div className="h-[100dvh] bg-gradient-to-br from-zinc-950 to-zinc-900 text-white overflow-hidden">
      <div className="max-w-6xl mx-auto flex h-full relative">
        
        {/* Затеняющий оверлей при открытии меню на мобильных */}
        {isSidebarOpen && (
          <div 
            onClick={() => setIsSidebarOpen(false)} 
            className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-sm"
          />
        )}

        {/* Боковая панель (Выезжает слева на мобильных, обычная на десктопе) */}
        <div className={`
          fixed md:relative z-40 inset-y-0 left-0
          w-[280px] sm:w-80 md:w-96 bg-zinc-900 border-r border-zinc-800 p-5 sm:p-6 md:p-8 
          flex flex-col transform transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          
          {/* Кнопка закрытия меню для мобильных */}
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden absolute top-4 right-4 text-zinc-400 hover:text-white text-xl p-2"
          >
            ✕
          </button>

          <div className="flex flex-col items-center text-center mb-6 sm:mb-8 mt-2 md:mt-0">
            <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 border-pink-500 mb-3 sm:mb-4 shadow-2xl">
              <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400" alt="Анна" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold mb-1">Анна Смирнова</h1>
            <p className="text-pink-400 text-xs sm:text-sm">Персональный AI-стилист</p>
            <p className="text-zinc-400 mt-2 text-xs hidden sm:block">
              Более 8 лет опыта • 1200+ счастливых клиентов
            </p>
          </div>

          {/* === БЛОК АВТОРИЗАЦИИ === */}
          <div className="mb-4 sm:mb-6">
            {status === "loading" ? (
              <div className="text-center text-xs text-zinc-400">Загрузка...</div>
            ) : session ? (
              <div className="bg-zinc-800 rounded-2xl p-3 text-center">
                <p className="text-xs sm:text-sm text-green-400 truncate">✅ {session.user?.name}</p>
                <button
                  onClick={() => signOut()}
                  className="mt-1 text-xs text-red-400 hover:text-red-500 underline"
                >
                  Выйти
                </button>
              </div>
            ) : (
              <button
                onClick={() => signIn("google")}
                className="w-full bg-white text-black py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm font-medium flex items-center justify-center gap-2 hover:bg-zinc-100 transition"
              >
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
                Войти через Google
              </button>
            )}
          </div>

          <div className="mt-auto pt-2 flex-1 min-h-0 flex flex-col justify-end">
            <h3 className="uppercase text-[10px] sm:text-xs tracking-widest text-zinc-500 mb-2">Что я умею</h3>
            <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
              <li className="flex items-center gap-2">🎨 Подобрать стиль под твою внешность</li>
              <li className="flex items-center gap-2">📸 Работать с твоими фото</li>
              <li className="flex items-center gap-2">💰 Учитывать твой бюджет</li>
              <li className="flex items-center gap-2">🛍️ Находить точные вещи на маркетплейсах</li>
              <li className="flex items-center gap-2">👗 Создавать полные образы</li>
            </ul>
          </div>

          <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-zinc-800 shrink-0">
            <button
              onClick={createNewChat}
              className="w-full bg-pink-600 hover:bg-pink-700 py-2.5 sm:py-3 rounded-2xl font-medium text-xs sm:text-sm mb-3 sm:mb-4 transition"
            >
              + Новый чат
            </button>

            <p className="text-[10px] sm:text-xs uppercase tracking-widest text-zinc-500 mb-2">История чатов</p>
            <div className="space-y-2 max-h-28 overflow-y-auto text-xs sm:text-sm pr-1">
              {conversations.map(conv => (
                <div 
                  key={conv.id} 
                  onClick={() => loadConversation(conv.id)}
                  onContextMenu={(e) => handleContextMenu(e, conv.id)}
                  className={`p-2.5 sm:p-3 rounded-xl cursor-pointer transition relative group ${
                    activeConversationId === conv.id 
                      ? 'bg-pink-600' 
                      : 'bg-zinc-800/50 hover:bg-zinc-800'
                  }`}
                >
                  <p className="truncate pr-4">{conv.title}</p>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-zinc-400">⋮</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Чат */}
        <div className="flex-1 flex flex-col h-full w-full">
          <div className="p-3 sm:p-4 md:p-6 border-b border-zinc-800 flex items-center gap-3 sm:gap-4 bg-zinc-950 shrink-0">
            {/* Кнопка открытия боковой панели на мобильных */}
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 text-zinc-300 hover:text-white text-xl"
            >
              ☰
            </button>

            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden border border-pink-500 shrink-0">
              <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400" alt="Anna" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="font-semibold text-xs sm:text-base">Анна • онлайн</p>
              <p className="text-[10px] sm:text-xs text-green-400">Готова помочь с образом</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6 bg-zinc-950">
            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] sm:max-w-[75%] md:max-w-[70%] rounded-2xl sm:rounded-3xl px-4 py-3 sm:px-6 sm:py-4 text-xs sm:text-base ${
                  msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-white'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.images && msg.images.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {msg.images.map((imgPath, i) => (
                        <img key={i} src={`${API_BASE}${imgPath}`} alt="" className="rounded-xl max-h-36 sm:max-h-48 object-cover w-full" />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-zinc-800 text-white px-4 py-3 sm:px-6 sm:py-4 rounded-2xl sm:rounded-3xl text-xs sm:text-base">
                  Анна печатает...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 sm:p-4 md:p-6 border-t border-zinc-800 bg-zinc-900 shrink-0">
            <div className="flex gap-2 sm:gap-3 items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Напиши сообщение Анне..."
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl sm:rounded-2xl px-3 sm:px-6 py-2.5 sm:py-4 text-xs sm:text-base focus:outline-none focus:border-pink-500 transition"
                disabled={loading}
              />

              <label className="cursor-pointer bg-zinc-700 hover:bg-zinc-600 p-2.5 sm:px-5 sm:py-4 rounded-xl sm:rounded-2xl flex items-center justify-center text-lg sm:text-xl transition shrink-0">
                📸
                <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileSelect} disabled={loading} />
              </label>

              <button
                onClick={handleSend}
                disabled={loading || (!input.trim() && selectedFiles.length === 0)}
                className="bg-pink-600 hover:bg-pink-700 px-4 sm:px-10 py-2.5 sm:py-4 rounded-xl sm:rounded-2xl font-medium text-xs sm:text-base transition disabled:opacity-50 shrink-0"
              >
                {loading ? '...' : 'Отправить'}
              </button>
            </div>

            {selectedFiles.length > 0 && (
              <p className="text-[10px] sm:text-xs text-zinc-400 mt-2">
                Выбрано файлов: {selectedFiles.length} — готово к отправке
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Контекстное меню */}
      {contextMenu && (
        <div 
          className="fixed bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl py-1 z-50 w-44 sm:w-48 text-xs sm:text-sm"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => deleteConversation(contextMenu.convId)}
            className="w-full text-left px-3 sm:px-4 py-2 sm:py-2.5 text-red-400 hover:bg-zinc-800 flex items-center gap-2"
          >
            🗑 Удалить чат
          </button>
        </div>
      )}
    </div>
  );
}