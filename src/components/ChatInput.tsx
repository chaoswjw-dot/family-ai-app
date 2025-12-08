'use client'

import { useState, useRef, useEffect } from 'react'
import { Attachment } from '@/lib/types'
import ImageUploader from './ImageUploader'

interface ChatInputProps {
  onSend: (message: string, attachments?: Attachment[]) => void
  onGenerateImage: (prompt: string) => void
  onAnalyzeImage: (prompt: string, attachment: Attachment) => void
  disabled?: boolean
  isGeneratingImage?: boolean
  isAnalyzing?: boolean
}

export default function ChatInput({
  onSend,
  onGenerateImage,
  onAnalyzeImage,
  disabled,
  isGeneratingImage,
  isAnalyzing,
}: ChatInputProps) {
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<'chat' | 'generate' | 'analyze'>('chat')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 自动调整高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`
    }
  }, [input])

  // 处理图片上传
  const handleUpload = (attachment: Attachment) => {
    setAttachments([attachment]) // 只允许一张图片
    // 自动切换到分析模式
    if (mode !== 'analyze') {
      setMode('analyze')
    }
  }

  // 删除图片
  const handleRemove = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
    // 如果没有图片了，切回对话模式
    if (attachments.length <= 1) {
      setMode('chat')
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (disabled || isGeneratingImage || isAnalyzing) return

    const trimmedInput = input.trim()

    if (mode === 'generate') {
      // 生成图片模式
      if (!trimmedInput) return
      onGenerateImage(trimmedInput)
    } else if (mode === 'analyze' && attachments.length > 0) {
      // 分析图片模式
      onAnalyzeImage(trimmedInput || '请描述这张图片', attachments[0])
      setAttachments([])
    } else {
      // 普通对话模式
      if (!trimmedInput && attachments.length === 0) return
      onSend(trimmedInput, attachments.length > 0 ? attachments : undefined)
      setAttachments([])
    }

    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const isProcessing = disabled || isGeneratingImage || isAnalyzing
  const canSubmit = mode === 'analyze'
    ? attachments.length > 0
    : input.trim().length > 0

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t dark:border-gray-700 bg-white dark:bg-gray-900">
      {/* 图片上传区域 - 仅在分析模式显示 */}
      {mode === 'analyze' && (
        <div className="mb-3">
          <ImageUploader
            onUpload={handleUpload}
            onRemove={handleRemove}
            attachments={attachments}
            disabled={isProcessing}
          />
        </div>
      )}

      {/* 已上传图片预览 - 非分析模式时显示在输入框上方 */}
      {mode !== 'analyze' && attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="relative group w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"
            >
              <img
                src={attachment.url}
                alt={attachment.filename}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemove(attachment.id)}
                className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 模式切换 */}
      <div className="flex gap-2 mb-2">
        <button
          type="button"
          onClick={() => setMode('chat')}
          className={`px-3 py-1 text-sm rounded-full transition-colors ${
            mode === 'chat'
              ? 'bg-primary-500 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
          }`}
        >
          💬 对话
        </button>
        <button
          type="button"
          onClick={() => setMode('generate')}
          className={`px-3 py-1 text-sm rounded-full transition-colors ${
            mode === 'generate'
              ? 'bg-purple-500 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
          }`}
        >
          🎨 生成图片
        </button>
        <button
          type="button"
          onClick={() => setMode('analyze')}
          className={`px-3 py-1 text-sm rounded-full transition-colors ${
            mode === 'analyze'
              ? 'bg-green-500 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
          }`}
        >
          🔍 分析图片
        </button>
      </div>

      {/* 输入框 */}
      <div className="flex gap-2 items-end">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              mode === 'generate'
                ? '描述你想生成的图片...'
                : mode === 'analyze'
                ? '可选：输入问题让AI分析图片...'
                : '输入消息... (Shift+Enter换行)'
            }
            disabled={isProcessing}
            rows={1}
            className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700
                     bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-100
                     focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                     resize-none disabled:opacity-50 disabled:cursor-not-allowed
                     placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
        </div>

        <button
          type="submit"
          disabled={!canSubmit || isProcessing}
          className={`p-3 rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                   ${mode === 'generate'
                     ? 'bg-purple-500 hover:bg-purple-600'
                     : mode === 'analyze'
                     ? 'bg-green-500 hover:bg-green-600'
                     : 'bg-primary-500 hover:bg-primary-600'
                   } text-white shadow-lg hover:shadow-xl`}
        >
          {isGeneratingImage || isAnalyzing ? (
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
  )
}
