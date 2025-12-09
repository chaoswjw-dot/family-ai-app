'use client'

import { useState, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Attachment } from '@/lib/types'
import ImageUploader from '@/components/ImageUploader'

interface GeneratedImage {
  id: string
  prompt: string
  imageUrl: string
  sourceImageUrl?: string  // 原图（如果有）
  timestamp: number
}

export default function StudioPage() {
  const [prompt, setPrompt] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  const [showFullImage, setShowFullImage] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // 处理图片上传
  const handleUpload = (attachment: Attachment) => {
    setAttachments([attachment])
  }

  // 删除图片
  const handleRemove = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  // 生成/编辑图片
  const handleGenerate = async () => {
    if (!prompt.trim() || isProcessing) return

    setIsProcessing(true)
    try {
      const hasSourceImage = attachments.length > 0

      const response = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          sourceImageUrl: hasSourceImage ? attachments[0].url : undefined,
        }),
      })

      const data = await response.json()

      if (data.imageUrl) {
        const newImage: GeneratedImage = {
          id: uuidv4(),
          prompt: prompt.trim(),
          imageUrl: data.imageUrl,
          sourceImageUrl: hasSourceImage ? attachments[0].url : undefined,
          timestamp: Date.now(),
        }
        setGeneratedImages((prev) => [newImage, ...prev])
        setPrompt('')
        setAttachments([])
      } else {
        alert(data.error || '图片生成失败，请稍后重试')
      }
    } catch (error) {
      console.error('生成图片失败:', error)
      alert('生成图片失败，请稍后重试')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleGenerate()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950">
      {/* 头部 */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
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
              <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                图片工作室
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* 输入区域 */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-4 mb-6">
          {/* 图片上传区域 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              上传图片（可选，用于编辑/风格转换）
            </label>
            <ImageUploader
              onUpload={handleUpload}
              onRemove={handleRemove}
              attachments={attachments}
              disabled={isProcessing}
              onPreview={(url) => setShowFullImage(url)}
            />
          </div>

          <form onSubmit={handleSubmit}>
            <div className="flex gap-3">
              <textarea
                ref={inputRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  attachments.length > 0
                    ? '描述你想要的效果，例如：改成动漫风格、添加一只猫咪、变成油画风格...'
                    : '描述你想生成的图片，例如：一只在星空下奔跑的柴犬...'
                }
                disabled={isProcessing}
                rows={2}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700
                         bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-100
                         focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
                         resize-none disabled:opacity-50 disabled:cursor-not-allowed
                         placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
              <button
                type="submit"
                disabled={isProcessing || !prompt.trim()}
                className="px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed
                         bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
              >
                {isProcessing ? (
                  <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : attachments.length > 0 ? (
                  '编辑'
                ) : (
                  '生成'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* 生成历史 */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
            生成历史 ({generatedImages.length})
          </h2>
          {generatedImages.length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <div className="text-5xl mb-4">🎨</div>
              <p className="font-medium">AI 图片工作室</p>
              <p className="text-sm mt-2">
                直接输入描述生成新图片<br/>
                或上传图片后输入指令进行编辑
              </p>
              <div className="mt-4 text-xs space-y-1">
                <p>示例：改成动漫风格</p>
                <p>示例：添加一只可爱的小猫</p>
                <p>示例：变成梵高油画风格</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {generatedImages.map((item) => (
                <div
                  key={item.id}
                  className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-sm"
                >
                  {/* 如果有原图，显示对比 */}
                  {item.sourceImageUrl ? (
                    <div className="flex">
                      <div className="w-1/2 relative">
                        <img
                          src={item.sourceImageUrl}
                          alt="原图"
                          className="w-full aspect-square object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setShowFullImage(item.sourceImageUrl!)}
                        />
                        <span className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-2 py-0.5 rounded">
                          原图
                        </span>
                      </div>
                      <div className="w-1/2 relative">
                        <img
                          src={item.imageUrl}
                          alt={item.prompt}
                          className="w-full aspect-square object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setShowFullImage(item.imageUrl)}
                        />
                        <span className="absolute bottom-1 right-1 bg-purple-500 text-white text-xs px-2 py-0.5 rounded">
                          生成
                        </span>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={item.imageUrl}
                      alt={item.prompt}
                      className="w-full aspect-square object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setShowFullImage(item.imageUrl)}
                    />
                  )}
                  <div className="p-3">
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                      {item.prompt}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {new Date(item.timestamp).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

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
