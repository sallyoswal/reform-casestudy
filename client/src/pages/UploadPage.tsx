import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4001'

type Status = 'idle' | 'uploading' | 'error'

function UploadPage() {
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'error'>('checking')
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetch(`${API_URL}/api/health`)
      .then((res) => (res.ok ? setApiStatus('ok') : setApiStatus('error')))
      .catch(() => setApiStatus('error'))
  }, [])

  function selectFile(candidate: File) {
    if (candidate.type !== 'application/pdf') {
      setFile(null)
      setStatus('error')
      setMessage('Only PDF files are allowed.')
      return
    }
    setFile(candidate)
    setStatus('idle')
    setMessage('')
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) selectFile(dropped)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (selected) selectFile(selected)
  }

  async function handleUpload() {
    if (!file) return

    setStatus('uploading')
    setMessage('')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) {
        setStatus('error')
        setMessage(data.error ?? 'Upload failed.')
        return
      }

      navigate(`/documents/${data.filename}`)
    } catch {
      setStatus('error')
      setMessage('Upload failed.')
    }
  }

  return (
    <main>
      <h1>React + Express + TypeScript</h1>
      <p>API status: {apiStatus}</p>

      <section>
        <div
          className={`dropzone${isDragging ? ' dropzone-active' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <p>{file ? file.name : 'Drag & drop a PDF here, or click to choose a file'}</p>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            onChange={handleInputChange}
            hidden
          />
        </div>

        <button type="button" onClick={handleUpload} disabled={!file || status === 'uploading'}>
          {status === 'uploading' ? 'Uploading...' : 'Upload'}
        </button>

        {message && <p className="message-error">{message}</p>}
      </section>
    </main>
  )
}

export default UploadPage
