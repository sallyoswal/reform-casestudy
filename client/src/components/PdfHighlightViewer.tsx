import { useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

interface PdfHighlightViewerProps {
  file: Blob
  highlightTerms: string[]
  onError?: (message: string) => void
}

function normalize(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

function PdfHighlightViewer({ file, highlightTerms, onError }: PdfHighlightViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [numPages, setNumPages] = useState(0)

  const normalizedTerms = highlightTerms.map(normalize).filter((term) => term.length >= 3)

  function applyHighlights() {
    const container = containerRef.current
    if (!container) return

    const spans = container.querySelectorAll<HTMLSpanElement>(
      '.react-pdf__Page__textContent span',
    )
    spans.forEach((span) => {
      const text = normalize(span.textContent ?? '')
      const isMatch =
        text.length > 0 &&
        normalizedTerms.some(
          (term) => text.includes(term) || (text.length >= 6 && term.includes(text)),
        )
      span.classList.toggle('pdf-highlight', isMatch)
    })
  }

  useEffect(() => {
    applyHighlights()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightTerms, numPages])

  return (
    <div ref={containerRef}>
      <Document
        file={file}
        onLoadSuccess={({ numPages: n }) => {
          console.log('[PdfHighlightViewer] loaded, pages:', n)
          setNumPages(n)
        }}
        onLoadError={(err) => {
          console.error('[PdfHighlightViewer] load error', err)
          onError?.(err.message || 'Failed to render PDF.')
        }}
        onSourceError={(err) => {
          console.error('[PdfHighlightViewer] source error', err)
          onError?.(err.message || 'Failed to read PDF data.')
        }}
      >
        {Array.from({ length: numPages }, (_, i) => (
          <Page
            key={i}
            pageNumber={i + 1}
            renderAnnotationLayer={false}
            onRenderTextLayerSuccess={applyHighlights}
            onRenderError={(err) => console.error('[PdfHighlightViewer] page render error', err)}
          />
        ))}
      </Document>
    </div>
  )
}

export default PdfHighlightViewer
