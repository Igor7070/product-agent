'use client';

import { useState, useRef, useEffect } from 'react';

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
}

export default function AIStylist() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState(Date.now().toString());

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Привет! 👋 Я Анна — твой персональный AI-стилист. Давай создадим идеальный гардероб вместе. Как тебя зовут?'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Загрузка списка чатов
  useEffect(() => {
    const loadConversations = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/conversations/');
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        setConversations(data);
      } catch (error) {
        console.error("Не удалось загрузить список чатов:", error);
      }
    };

    loadConversations();
  }, []);

  // Загрузка конкретного чата
  const loadConversation = async (convId: string) => {
    try {
      setActiveConversationId(convId);
      const res = await fetch(`http://127.0.0.1:8000/conversations/${convId}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      
      setMessages(data.messages.map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        images: m.images
      })));
    } catch (error) {
      console.error("Не удалось загрузить чат:", error);
    }
  };

  const createNewChat = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/conversations/', {
        method: 'POST',
      });
      const newConv = await res.json();
      
      const newId = newConv.id.toString();
      setActiveConversationId(newId);
      setMessages([{
        role: 'assistant',
        content: 'Привет! 👋 Я Анна — твой персональный AI-стилист. Давай создадим идеальный гардероб вместе. Как тебя зовут?'
      }]);
      setInput('');
      setSelectedFiles([]);
    } catch (e) {
      console.error(e);
      alert("Не удалось создать новый чат");
    }
  };

  const handleSend = async () => {
    if (loading || (!input.trim() && selectedFiles.length === 0)) return;

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
    formData.append('conversation_id', activeConversationId);

    selectedFiles.forEach(file => formData.append('files', file));

    try {
      const response = await fetch('http://127.0.0.1:8000/chat/', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.content,
        images: data.images 
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Извини, что-то пошло не так с соединением. Попробуй ещё раз.' 
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

          {/* Новый чат и история */}
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
                  onClick={() => loadConversation(conv.id.toString())}
                  className={`p-3 rounded-xl cursor-pointer transition ${
                    activeConversationId === conv.id.toString() 
                      ? 'bg-pink-600' 
                      : 'bg-zinc-800/50 hover:bg-zinc-800'
                  }`}
                >
                  {conv.title}
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
                        <img key={i} src={`http://127.0.0.1:8000${imgPath}`} alt="" className="rounded-xl max-h-48 object-cover" />
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
    </div>
  );
}
