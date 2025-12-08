'use client'

import { useState } from 'react'
import { Message } from '@/lib/types'
import ReactMarkdown from 'react-markdown'

interface ChatMessageProps {
  message: Message
  isStreaming?: boolean
}

export default function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const [showFullImage, setShowFullImage] = useState<string | null>(null)

  // 渲染附件图片
  const renderAttachments = () => {
    if (!message.attachments || message.attachments.length === 0) return null

    return (
      <div className="flex flex-wrap gap-2 mb-2">
        {message.attachments.map((attachment) => (
          <div
            key={attachment.id}
            className="relative cursor-pointer group"
            onClick={() => setShowFullImage(attachment.url)}
          >
            <img
              src={attachment.url}
              alt={attachment.filename}
              className="rounded-lg max-w-full h-auto object-cover hover:opacity-90 transition-opacity"
              style={{ maxHeight: '200px', maxWidth: '200px' }}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors">
              <span className="text-white opacity-0 group-hover:opacity-100 text-xs">点击查看</span>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <div
        className={`message-bubble flex gap-3 ${
          isUser ? 'flex-row-reverse' : ''
        }`}
      >
        {/* 头像 */}
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
            isUser ? 'bg-primary-500' : 'bg-gradient-to-br from-purple-500 to-pink-500'
          }`}
        >
          {isUser ? '我' : 'AI'}
        </div>

        {/* 消息内容 */}
        <div
          className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 ${
            isUser
              ? 'bg-primary-500 text-white'
              : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-sm'
          }`}
        >
          {/* 显示附件图片 */}
          {renderAttachments()}

          {/* 显示生成的图片 */}
          {message.imageUrl ? (
            <div className="space-y-2">
              <img
                src={message.imageUrl}
                alt="生成的图片"
                className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                style={{ maxHeight: '300px' }}
                onClick={() => setShowFullImage(message.imageUrl!)}
              />
              {message.content && (
                <p className="text-sm opacity-80">{message.content}</p>
              )}
            </div>
          ) : message.content ? (
            <div className={`prose prose-sm max-w-none ${isUser ? 'prose-invert' : 'dark:prose-invert'}`}>
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  code: ({ className, children, ...props }) => {
                    const isInline = !className
                    if (isInline) {
                      return (
                        <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-sm" {...props}>
                          {children}
                        </code>
                      )
                    }
                    return (
                      <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto">
                        <code {...props}>{children}</code>
                      </pre>
                    )
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
              {isStreaming && <span className="typing-cursor" />}
            </div>
          ) : null}
        </div>
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
    </>
  )
}
