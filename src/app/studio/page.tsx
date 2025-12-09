'use client'

import { useState, useRef, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Attachment } from '@/lib/types'
import ImageUploader from '@/components/ImageUploader'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  imageUrl?: string
  timestamp: number
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  currentImageUrl?: string
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = 'family-ai-studio-conversations'

export default function StudioPage() {
  const [prompt, setPrompt] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [showFullImage, setShowFullImage] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 当前对话
  const currentConversation = conversations.find(c => c.id === currentConversationId)

  // 从 localStorage 加载对话
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as Conversation[]
        setConversations(parsed)
        // 自动选择最近的对话
        if (parsed.length > 0) {
          const sorted = [...parsed].sort((a, b) => b.updatedAt - a.updatedAt)
          setCurrentConversationId(sorted[0].id)
        }
      }
    } catch (e) {
      console.error('加载对话历史失败:', e)
    }
    setIsLoaded(true)
  }, [])

  // 保存对话到 localStorage
  useEffect(() => {
    if (isLoaded && conversations.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations))
      } catch (e) {
        console.error('保存对话历史失败:', e)
      }
    }
  }, [conversations, isLoaded])

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // 处理图片上传
  const handleUpload = (attachment: Attachment) => {
    setAttachments([attachment])
  }

  // 删除图片
  const handleRemove = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  // 创建新对话
  const handleNewConversation = () => {
    const newConversation: Conversation = {
      id: uuidv4(),
      title: '新对话',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setConversations(prev => [newConversation, ...prev])
    setCurrentConversationId(newConversation.id)
    setAttachments([])
    setPrompt('')
    setShowHistory(false)
  }

  // 选择对话
  const handleSelectConversation = (id: string) => {
    setCurrentConversationId(id)
    setAttachments([])
    setPrompt('')
    setShowHistory(false)
  }

  // 删除对话
  const handleDeleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('确定要删除这个对话吗？')) {
      setConversations(prev => prev.filter(c => c.id !== id))
      if (currentConversationId === id) {
        const remaining = conversations.filter(c => c.id !== id)
        setCurrentConversationId(remaining.length > 0 ? remaining[0].id : null)
      }
    }
  }

  // 清空所有对话
  const handleClearAll = () => {
    if (confirm('确定要清空所有对话历史吗？此操作不可恢复。')) {
      setConversations([])
      setCurrentConversationId(null)
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  // 更新对话
  const updateConversation = (id: string, updates: Partial<Conversation>) => {
    setConversations(prev => prev.map(c =>
      c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c
    ))
  }

  // 发送消息/生成图片
  const handleSend = async () => {
    if (!prompt.trim() || isProcessing) return

    // 如果没有当前对话，创建一个新的
    let convId = currentConversationId
    if (!convId) {
      const newConversation: Conversation = {
        id: uuidv4(),
        title: prompt.trim().slice(0, 20) + (prompt.length > 20 ? '...' : ''),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      setConversations(prev => [newConversation, ...prev])
      convId = newConversation.id
      setCurrentConversationId(convId)
    }

    const conv = conversations.find(c => c.id === convId) || {
      id: convId,
      title: prompt.trim().slice(0, 20),
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: prompt.trim(),
      imageUrl: attachments.length > 0 ? attachments[0].url : undefined,
      timestamp: Date.now(),
    }

    // 添加用户消息
    const updatedMessages = [...conv.messages, userMessage]

    // 更新标题（如果是第一条消息）
    const title = conv.messages.length === 0
      ? prompt.trim().slice(0, 20) + (prompt.length > 20 ? '...' : '')
      : conv.title

    updateConversation(convId, {
      messages: updatedMessages,
      title,
    })

    const currentPrompt = prompt.trim()
    setPrompt('')
    setIsProcessing(true)

    try {
      // 确定源图片：优先使用上传的图片，否则使用对话中最新的生成图片
      let sourceImageUrl = attachments.length > 0 ? attachments[0].url : conv.currentImageUrl

      const response = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: currentPrompt,
          sourceImageUrl,
        }),
      })

      const data = await response.json()

      if (data.imageUrl) {
        const assistantMessage: Message = {
          id: uuidv4(),
          role: 'assistant',
          content: '已完成',
          imageUrl: data.imageUrl,
          timestamp: Date.now(),
        }

        updateConversation(convId, {
          messages: [...updatedMessages, assistantMessage],
          currentImageUrl: data.imageUrl,
        })

        // 清除上传的图片
        setAttachments([])
      } else {
        const errorMessage: Message = {
          id: uuidv4(),
          role: 'assistant',
          content: data.error || '图片生成失败，请稍后重试',
          timestamp: Date.now(),
        }
        updateConversation(convId, {
          messages: [...updatedMessages, errorMessage],
        })
      }
    } catch (error) {
      console.error('生成图片失败:', error)
      const errorMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: '生成图片失败，请稍后重试',
        timestamp: Date.now(),
      }
      updateConversation(convId, {
        messages: [...updatedMessages, errorMessage],
      })
    } finally {
      setIsProcessing(false)
      setTimeout(scrollToBottom, 100)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSend()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()

    if (isToday) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex flex-col">
      {/* 头部 */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <a
                href="/"
                className="p-2 -ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                title="返回对话"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </a>
              <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                图片工作室
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors
                  ${showHistory
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                历史
                {conversations.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-white/20 rounded-full">
                    {conversations.length}
                  </span>
                )}
              </button>
              <button
                onClick={handleNewConversation}
                className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg
                         bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400
                         hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                新对话
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* 历史记录侧边栏 */}
        {showHistory && (
          <aside className="w-72 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">对话历史</span>
              {conversations.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-xs text-red-500 hover:text-red-600"
                >
                  清空全部
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-400">
                  暂无对话历史
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {[...conversations]
                    .sort((a, b) => b.updatedAt - a.updatedAt)
                    .map(conv => (
                      <div
                        key={conv.id}
                        onClick={() => handleSelectConversation(conv.id)}
                        className={`p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors
                          ${conv.id === currentConversationId ? 'bg-purple-50 dark:bg-purple-900/20' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                              {conv.title || '新对话'}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {conv.messages.length} 条消息 · {formatTime(conv.updatedAt)}
                            </p>
                          </div>
                          <button
                            onClick={(e) => handleDeleteConversation(conv.id, e)}
                            className="p-1 text-gray-400 hover:text-red-500 rounded"
                            title="删除"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                        {/* 缩略图 */}
                        {conv.currentImageUrl && (
                          <div className="mt-2">
                            <img
                              src={conv.currentImageUrl}
                              alt=""
                              className="w-full h-20 object-cover rounded"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </aside>
        )}

        {/* 主内容区 */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* 对话区域 */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4 py-4">
              {!currentConversation || currentConversation.messages.length === 0 ? (
                // 空状态
                <div className="text-center py-16 text-gray-400 dark:text-gray-500">
                  <div className="text-6xl mb-4">🎨</div>
                  <p className="text-lg font-medium">AI 图片工作室</p>
                  <p className="text-sm mt-2 max-w-md mx-auto">
                    输入描述生成新图片，或上传图片后描述你想要的修改效果。<br/>
                    生成后可以继续对话，不断调整和完善。
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs">
                    <span className="px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded-full">改成动漫风格</span>
                    <span className="px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded-full">添加一只猫咪</span>
                    <span className="px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded-full">变成油画风格</span>
                    <span className="px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded-full">让背景变成夜晚</span>
                  </div>
                </div>
              ) : (
                // 对话消息列表
                <div className="space-y-4">
                  {currentConversation.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                          msg.role === 'user'
                            ? 'bg-purple-500 text-white'
                            : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100'
                        }`}
                      >
                        {/* 用户上传的图片 */}
                        {msg.role === 'user' && msg.imageUrl && (
                          <div className="mb-2">
                            <img
                              src={msg.imageUrl}
                              alt="上传的图片"
                              className="max-w-[200px] rounded-lg cursor-pointer hover:opacity-90"
                              onClick={() => setShowFullImage(msg.imageUrl!)}
                            />
                          </div>
                        )}

                        <p className="text-sm">{msg.content}</p>

                        {/* AI 生成的图片 */}
                        {msg.role === 'assistant' && msg.imageUrl && (
                          <div className="mt-2">
                            <img
                              src={msg.imageUrl}
                              alt="生成的图片"
                              className="max-w-full rounded-lg cursor-pointer hover:opacity-90"
                              onClick={() => setShowFullImage(msg.imageUrl!)}
                            />
                          </div>
                        )}

                        <p className="text-xs mt-1 opacity-60">
                          {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* 处理中状态 */}
                  {isProcessing && (
                    <div className="flex justify-start">
                      <div className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-3">
                        <div className="flex items-center gap-2 text-gray-500">
                          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          <span className="text-sm">正在生成...</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </div>

          {/* 输入区域 */}
          <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
            <div className="max-w-3xl mx-auto px-4 py-3">
              {/* 当前编辑的图片提示 */}
              {currentConversation?.currentImageUrl && attachments.length === 0 && (
                <div className="mb-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <span>继续编辑当前图片，或上传新图片开始新的编辑</span>
                </div>
              )}

              {/* 图片上传 */}
              {attachments.length === 0 && !currentConversation?.currentImageUrl && (
                <div className="mb-3">
                  <ImageUploader
                    onUpload={handleUpload}
                    onRemove={handleRemove}
                    attachments={attachments}
                    disabled={isProcessing}
                    onPreview={(url) => setShowFullImage(url)}
                  />
                </div>
              )}

              {/* 已上传的图片预览 */}
              {attachments.length > 0 && (
                <div className="mb-3 flex items-center gap-2">
                  <div className="relative group">
                    <img
                      src={attachments[0].url}
                      alt="上传的图片"
                      className="w-16 h-16 object-cover rounded-lg cursor-pointer"
                      onDoubleClick={() => setShowFullImage(attachments[0].url)}
                    />
                    <button
                      onClick={() => handleRemove(attachments[0].id)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white text-xs"
                    >
                      ×
                    </button>
                  </div>
                  <span className="text-sm text-gray-500">将编辑这张图片</span>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="flex gap-2">
                  {/* 上传按钮 */}
                  {currentConversation?.currentImageUrl && attachments.length === 0 && (
                    <label className="flex items-center justify-center w-10 h-10 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            const formData = new FormData()
                            formData.append('file', file)
                            fetch('/api/upload', { method: 'POST', body: formData })
                              .then(res => res.json())
                              .then(data => {
                                if (data.success) {
                                  handleUpload(data.attachment)
                                }
                              })
                          }
                        }}
                      />
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </label>
                  )}

                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      currentConversation?.currentImageUrl
                        ? '继续描述你想要的修改...'
                        : attachments.length > 0
                        ? '描述你想要的效果...'
                        : '描述你想生成的图片...'
                    }
                    disabled={isProcessing}
                    rows={1}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
                             bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-100
                             focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
                             resize-none disabled:opacity-50 disabled:cursor-not-allowed
                             placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  />
                  <button
                    type="submit"
                    disabled={isProcessing || !prompt.trim()}
                    className="px-4 py-2.5 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed
                             bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                  >
                    {isProcessing ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>
      </div>

      {/* 全屏图片查看 */}
      {showFullImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setShowFullImage(null)}
        >
          <div className="relative max-w-full max-h-full">
            <img
              src={showFullImage}
              alt="查看图片"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            <button
              onClick={() => setShowFullImage(null)}
              className="absolute top-2 right-2 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white text-xl transition-colors"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
