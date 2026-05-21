import { uploadImage } from '../services/api'

let tokenCounter = 0

export async function handleImageUpload(
  file: File,
  textarea: HTMLTextAreaElement,
  onUpdate: (newContent: string) => void,
  onError?: (msg: string) => void,
): Promise<void> {
  if (!file.type.startsWith('image/')) {
    onError?.('所选文件不是图片')
    return
  }

  const token = `img:uploading:${Date.now()}:${++tokenCounter}`
  const placeholder = `![上传中...](${token})`

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const before = textarea.value.substring(0, start)
  const after = textarea.value.substring(end)
  const contentWithPlaceholder = before + placeholder + after
  onUpdate(contentWithPlaceholder)

  const newCursorPos = start + placeholder.length
  requestAnimationFrame(() => {
    textarea.setSelectionRange(newCursorPos, newCursorPos)
    textarea.focus()
  })

  try {
    const { url } = await uploadImage(file)
    const finalContent = contentWithPlaceholder.replace(placeholder, `![图片](${url})`)
    onUpdate(finalContent)
  } catch (err: any) {
    const cleanContent = contentWithPlaceholder.replace(placeholder, '')
    onUpdate(cleanContent)
    const errMsg = err?.response?.data?.detail || err?.message || '图片上传失败'
    onError?.(errMsg)
  }
}
