'use client'

import { useState, useRef, useCallback } from 'react'
import { Attachment } from '@/lib/types'

interface ImageUploaderProps {
  onUpload: (attachment: Attachment) => void
  onRemove: (id: string) => void
  attachments: Attachment[]
  disabled?: boolean
  onPreview?: (url: string) => void  // 预览回调
}

export default function ImageUploader({
  onUpload,
  onRemove,
  attachments,
  disabled = false,
  onPreview
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 处理文件上传
  const handleUpload = useCallback(async (file: File) => {
    setIsUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (result.success && result.attachment) {
        onUpload(result.attachment)
      } else {
        setError(result.error || '上传失败')
      }
    } catch (err) {
      setError('上传失败，请稍后重试')
    } finally {
      setIsUploading(false)
    }
  }, [onUpload])

  // 文件选择
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleUpload(file)
    }
    // 重置 input 以允许重复选择相同文件
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [handleUpload])

  // 拖拽处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled && !isUploading) {
      setIsDragging(true)
    }
  }, [disabled, isUploading])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (disabled || isUploading) return

    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      handleUpload(file)
    } else {
      setError('请上传图片文件')
    }
  }, [disabled, isUploading, handleUpload])

  // 粘贴处理
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (disabled || isUploading) return

    const items = e.clipboardData.items
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile()
        if (file) {
          handleUpload(file)
          break
        }
      }
    }
  }, [disabled, isUploading, handleUpload])

  // 点击上传
  const handleClick = useCallback(() => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click()
    }
  }, [disabled, isUploading])

  return (
    <div className="space-y-2" onPaste={handlePaste}>
      {/* 已上传的图片预览 */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="relative group w-20 h-20 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"
            >
              <img
                src={attachment.url}
                alt={attachment.filename}
                className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                onDoubleClick={() => onPreview?.(attachment.url)}
                title="双击放大"
              />
              <button
                onClick={() => onRemove(attachment.id)}
                className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                title="删除"
              >
                ×
              </button>
              <span className="absolute bottom-0.5 left-0.5 bg-black/50 text-white text-[10px] px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                双击放大
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 上传区域 - 仅在没有图片时显示 */}
      {attachments.length === 0 && (
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all
            ${isDragging
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500'
            }
            ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled || isUploading}
          />

          {isUploading ? (
            <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm">上传中...</span>
            </div>
          ) : (
            <div className="text-gray-500 dark:text-gray-400">
              <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm">点击或拖拽图片到这里</p>
              <p className="text-xs mt-1 text-gray-400">支持 PNG, JPG, GIF, WebP (最大 10MB)</p>
            </div>
          )}
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <p className="text-sm text-red-500 text-center">{error}</p>
      )}
    </div>
  )
}
