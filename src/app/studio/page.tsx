'use client'

import { useState, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Attachment } from '@/lib/types'
import ImageUploader from '@/components/ImageUploader'

type StudioMode = 'generate' | 'analyze'

interface GeneratedImage {
  id: string
  prompt: string
  imageUrl: string
  timestamp: number
}

interface AnalysisResult {
  id: string
  imageUrl: string
  prompt: string
  result: string
  timestamp: number
}

export default function StudioPage() {
  const [mode, setMode] = useState<StudioMode>('generate')
  const [prompt, setPrompt] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])

  // 生成的图片历史
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  // 分析结果历史
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([])

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

  // 生成图片
  const handleGenerate = async () => {
    if (!prompt.trim() || isProcessing) return

    setIsProcessing(true)
    try {
      const response = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      })

      const data = await response.json()

      if (data.imageUrl) {
        const newImage: GeneratedImage = {
          id: uuidv4(),
          prompt: prompt.trim(),
          imageUrl: data.imageUrl,
          timestamp: Date.now(),
        }
        setGeneratedImages((prev) => [newImage, ...prev])
        setPrompt('')
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

  // 分析图片
  const handleAnalyze = async () => {
    if (attachments.length === 0 || isProcessing) return

    setIsProcessing(true)
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim() || '请用中文详细描述这张图片的内容',
          imageUrl: attachments[0].url,
        }),
      })

      const data = await response.json()

      if (data.success && data.text) {
        const newResult: AnalysisResult = {
          id: uuidv4(),
          imageUrl: attachments[0].url,
          prompt: prompt.trim() || '请描述这张图片',
          result: data.text,
          timestamp: Date.now(),
        }
        setAnalysisResults((prev) => [newResult, ...prev])
        setPrompt('')
        setAttachments([])
      } else {
        alert(data.error || '图片分析失败，请稍后重试')
      }
    } catch (error) {
      console.error('分析图片失败:', error)
      alert('分析图片失败，请稍后重试')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'generate') {
      handleGenerate()
    } else {
      handleAnalyze()
    }
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

          {/* 模式切换 */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setMode('generate')}
              className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
                mode === 'generate'
                  ? 'bg-purple-500 text-white shadow-lg'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <span className="text-xl">🎨</span>
                <span>AI 生成图片</span>
              </span>
            </button>
            <button
              onClick={() => setMode('analyze')}
              className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
                mode === 'analyze'
                  ? 'bg-green-500 text-white shadow-lg'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <span className="text-xl">🔍</span>
                <span>AI 分析图片</span>
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* 输入区域 */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-4 mb-6">
          {mode === 'analyze' && (
            <div className="mb-4">
              <ImageUploader
                onUpload={handleUpload}
                onRemove={handleRemove}
                attachments={attachments}
                disabled={isProcessing}
              />
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="flex gap-3">
              <textarea
                ref={inputRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  mode === 'generate'
                    ? '描述你想生成的图片，例如：一只在星空下奔跑的柴犬...'
                    : '可选：输入问题让AI分析图片，例如：这张图片里有什么？'
                }
                disabled={isProcessing}
                rows={2}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700
                         bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-100
                         focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                         resize-none disabled:opacity-50 disabled:cursor-not-allowed
                         placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
              <button
                type="submit"
                disabled={
                  isProcessing ||
                  (mode === 'generate' && !prompt.trim()) ||
                  (mode === 'analyze' && attachments.length === 0)
                }
                className={`px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed
                         ${mode === 'generate'
                           ? 'bg-purple-500 hover:bg-purple-600 text-white'
                           : 'bg-green-500 hover:bg-green-600 text-white'
                         }`}
              >
                {isProcessing ? (
                  <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : mode === 'generate' ? (
                  '生成'
                ) : (
                  '分析'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* 结果展示 */}
        {mode === 'generate' ? (
          // 生成图片结果
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
              生成历史 ({generatedImages.length})
            </h2>
            {generatedImages.length === 0 ? (
              <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                <div className="text-5xl mb-4">🎨</div>
                <p>输入描述，让 AI 为你生成图片</p>
                <p className="text-sm mt-2">支持中文描述，越详细效果越好</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {generatedImages.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-sm"
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.prompt}
                      className="w-full aspect-square object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setShowFullImage(item.imageUrl)}
                    />
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
        ) : (
          // 分析图片结果
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
              分析历史 ({analysisResults.length})
            </h2>
            {analysisResults.length === 0 ? (
              <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                <div className="text-5xl mb-4">🔍</div>
                <p>上传图片，让 AI 为你分析内容</p>
                <p className="text-sm mt-2">支持图片识别、文字提取、内容描述等</p>
              </div>
            ) : (
              <div className="space-y-4">
                {analysisResults.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row">
                      <img
                        src={item.imageUrl}
                        alt="分析的图片"
                        className="w-full sm:w-48 h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setShowFullImage(item.imageUrl)}
                      />
                      <div className="flex-1 p-4">
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                          问题：{item.prompt}
                        </p>
                        <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                          {item.result}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                          {new Date(item.timestamp).toLocaleString('zh-CN')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
