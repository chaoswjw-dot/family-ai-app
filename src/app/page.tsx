'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import ChatMessage from '@/components/ChatMessage'
import ChatInput from '@/components/ChatInput'
import Sidebar from '@/components/Sidebar'
import { Message, Conversation } from '@/lib/types'
import {
  getConversations,
  saveConversation,
  deleteConversation,
  generateTitle,
} from '@/lib/storage'

const ACCESS_PASSWORD = '668866'

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 检查登录状态
  useEffect(() => {
    const savedAuth = localStorage.getItem('family-ai-auth')
    if (savedAuth === 'authenticated') {
      setIsAuthenticated(true)
    }
  }, [])

  // 加载会话列表
  useEffect(() => {
    if (isAuthenticated) {
      const saved = getConversations()
      setConversations(saved)
    }
  }, [isAuthenticated])

  // 处理登录
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === ACCESS_PASSWORD) {
      setIsAuthenticated(true)
      localStorage.setItem('family-ai-auth', 'authenticated')
      setPasswordError('')
    } else {
      setPasswordError('密码错误，请重试')
    }
  }

  // 登出
  const handleLogout = () => {
    setIsAuthenticated(false)
    localStorage.removeItem('family-ai-auth')
  }

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentConversation?.messages, streamingContent])

  // 创建新对话
  const handleNewConversation = useCallback(() => {
    setCurrentConversation(null)
    setStreamingContent('')
  }, [])

  // 选择对话
  const handleSelectConversation = useCallback((id: string) => {
    const conv = conversations.find((c) => c.id === id)
    if (conv) {
      setCurrentConversation(conv)
    }
  }, [conversations])

  // 删除对话
  const handleDeleteConversation = useCallback((id: string) => {
    deleteConversation(id)
    setConversations((prev) => prev.filter((c) => c.id !== id))
    if (currentConversation?.id === id) {
      setCurrentConversation(null)
    }
  }, [currentConversation?.id])

  // 发送消息
  const handleSendMessage = async (content: string) => {
    if (isLoading) return

    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: Date.now(),
    }

    // 创建或更新会话
    let conversation: Conversation
    if (currentConversation) {
      conversation = {
        ...currentConversation,
        messages: [...currentConversation.messages, userMessage],
        updatedAt: Date.now(),
      }
    } else {
      conversation = {
        id: uuidv4(),
        title: '新对话',
        messages: [userMessage],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
    }

    setCurrentConversation(conversation)
    setIsLoading(true)
    setStreamingContent('')

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversation.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      if (!response.ok) {
        throw new Error('API 请求失败')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') continue

              try {
                const parsed = JSON.parse(data)
                if (parsed.text) {
                  fullContent += parsed.text
                  setStreamingContent(fullContent)
                }
              } catch {
                // 忽略解析错误
              }
            }
          }
        }
      }

      // 创建助手消息
      const assistantMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: fullContent,
        timestamp: Date.now(),
      }

      // 更新会话
      const updatedConversation: Conversation = {
        ...conversation,
        messages: [...conversation.messages, assistantMessage],
        title: conversation.title === '新对话'
          ? generateTitle([...conversation.messages, assistantMessage])
          : conversation.title,
        updatedAt: Date.now(),
      }

      setCurrentConversation(updatedConversation)
      saveConversation(updatedConversation)
      setConversations((prev) => {
        const exists = prev.find((c) => c.id === updatedConversation.id)
        if (exists) {
          return prev.map((c) =>
            c.id === updatedConversation.id ? updatedConversation : c
          )
        }
        return [updatedConversation, ...prev]
      })
    } catch (error) {
      console.error('发送消息失败:', error)
      // 添加错误消息
      const errorMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: '抱歉，发送消息时出现错误，请稍后重试。',
        timestamp: Date.now(),
      }

      const updatedConversation: Conversation = {
        ...conversation,
        messages: [...conversation.messages, errorMessage],
        updatedAt: Date.now(),
      }

      setCurrentConversation(updatedConversation)
    } finally {
      setIsLoading(false)
      setStreamingContent('')
    }
  }

  const messages = currentConversation?.messages || []

  // 登录页面
  if (!isAuthenticated) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🏠</div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">家庭AI助手</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2">请输入访问密码</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入密码"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-center text-lg tracking-widest"
                autoFocus
              />
              {passwordError && (
                <p className="text-red-500 text-sm mt-2 text-center">{passwordError}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-colors"
            >
              进入
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex bg-gray-100 dark:bg-gray-950">
      {/* 侧边栏 */}
      <Sidebar
        conversations={conversations}
        currentId={currentConversation?.id || null}
        onSelect={handleSelectConversation}
        onNew={handleNewConversation}
        onDelete={handleDeleteConversation}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* 主聊天区域 */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* 头部 */}
        <header className="h-14 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center px-4 gap-3">
          {/* 移动端菜单按钮 */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100 truncate">
            {currentConversation?.title || '家庭AI助手'}
          </h1>

          {/* 状态指示和登出 */}
          <div className="ml-auto flex items-center gap-3">
            {isLoading && (
              <span className="text-xs text-primary-500 flex items-center gap-1">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                思考中...
              </span>
            )}
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="退出登录"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !streamingContent ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
              <div className="text-6xl mb-4">👋</div>
              <h2 className="text-xl font-medium mb-2">欢迎使用家庭AI助手</h2>
              <p className="text-sm text-center max-w-md">
                我可以帮你回答问题、写作、翻译、编程等。<br />
                点击侧边栏的「图片工作室」可以生成或分析图片
              </p>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}

              {/* 流式响应 */}
              {streamingContent && (
                <ChatMessage
                  message={{
                    id: 'streaming',
                    role: 'assistant',
                    content: streamingContent,
                    timestamp: Date.now(),
                  }}
                  isStreaming
                />
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <ChatInput
          onSend={handleSendMessage}
          disabled={isLoading}
        />
      </main>
    </div>
  )
}
