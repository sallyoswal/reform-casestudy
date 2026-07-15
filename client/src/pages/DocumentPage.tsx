import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PdfHighlightViewer from '../components/PdfHighlightViewer'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4001'

interface Field<T> {
  value: T
  confidence: number
  reasoning: string
}

interface LineItem {
  quantity: Field<number>
  description: Field<string>
  value: Field<number>
  hts_code: Field<string>
}

interface ExtractionResult {
  bill_of_lading_number: Field<string>
  invoice_number: Field<string>
  shipper_name: Field<string>
  shipper_address: Field<string>
  consignee_name: Field<string>
  consignee_address: Field<string>
  line_items: LineItem[]
  total_value_of_goods: Field<number>
}

function FieldRow({ label, field }: { label: string; field: Field<string | number> }) {
  return (
    <tr>
      <th>{label}</th>
      <td>{field.value === '' ? '—' : field.value}</td>
      <td>{Math.round(field.confidence * 100)}%</td>
      <td>{field.reasoning || '—'}</td>
    </tr>
  )
}

function FieldCell({ field }: { field: Field<string | number> }) {
  return (
    <span title={field.reasoning || undefined}>
      {field.value === '' ? '—' : field.value}{' '}
      <small>({Math.round(field.confidence * 100)}%)</small>
    </span>
  )
}

function DocumentPage() {
  const { filename } = useParams<{ filename: string }>()

  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [previewError, setPreviewError] = useState('')

  const [extraction, setExtraction] = useState<ExtractionResult | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')

  const highlightTerms = useMemo(() => {
    if (!extraction) return []

    const terms = [
      extraction.bill_of_lading_number.value,
      extraction.invoice_number.value,
      extraction.shipper_name.value,
      extraction.shipper_address.value,
      extraction.consignee_name.value,
      extraction.consignee_address.value,
      String(extraction.total_value_of_goods.value),
    ]

    for (const item of extraction.line_items) {
      terms.push(
        String(item.quantity.value),
        item.description.value,
        String(item.value.value),
        item.hts_code.value,
      )
    }

    return terms.filter((term) => term && term !== '0')
  }, [extraction])

  async function handleTogglePreview() {
    if (pdfBlob) {
      setPdfBlob(null)
      return
    }

    setIsLoadingPreview(true)
    setPreviewError('')
    try {
      console.log('[preview] fetching', `${API_URL}/api/upload/${filename}`)
      const res = await fetch(`${API_URL}/api/upload/${filename}`)
      console.log('[preview] response', res.status, res.headers.get('content-type'))

      if (!res.ok) {
        const body = await res.text()
        console.error('[preview] fetch failed', res.status, body)
        setPreviewError(`Failed to load PDF (${res.status}).`)
        return
      }

      const buffer = await res.arrayBuffer()
      console.log('[preview] byte length', buffer.byteLength)

      const bytes = new Uint8Array(buffer)
      const header = new TextDecoder().decode(bytes.slice(0, 5))
      console.log('[preview] header bytes', header)

      if (!header.startsWith('%PDF-')) {
        console.error('[preview] response is not a PDF, got:', header)
        setPreviewError('Server did not return a valid PDF file.')
        return
      }

      setPdfBlob(new Blob([buffer], { type: 'application/pdf' }))
    } catch (err) {
      console.error('[preview] unexpected error', err)
      setPreviewError('Failed to load PDF.')
    } finally {
      setIsLoadingPreview(false)
    }
  }

  async function handleExtract() {
    setIsExtracting(true)
    setExtractError('')
    setExtraction(null)

    try {
      const res = await fetch(`${API_URL}/api/extract/${filename}`, { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        setExtractError(data.error ?? 'Extraction failed.')
        return
      }

      setExtraction(data)
    } catch {
      setExtractError('Extraction failed.')
    } finally {
      setIsExtracting(false)
    }
  }

  return (
    <main>
      <p>
        <Link to="/">‹ Upload another</Link>
      </p>

      <h1>{filename}</h1>

      <section>
        <button type="button" onClick={handleTogglePreview} disabled={isLoadingPreview}>
          {isLoadingPreview ? 'Loading...' : pdfBlob ? 'Hide PDF' : 'View PDF'}
        </button>

        <button type="button" onClick={handleExtract} disabled={isExtracting}>
          {isExtracting ? 'Extracting...' : 'Extract Info'}
        </button>
      </section>

      {previewError && <p className="message-error">{previewError}</p>}

      {pdfBlob && (
        <PdfHighlightViewer
          file={pdfBlob}
          highlightTerms={highlightTerms}
          onError={(message) => setPreviewError(message)}
        />
      )}

      {extractError && <p className="message-error">{extractError}</p>}

      {extraction && (
        <section>
          <h2>Extracted Information</h2>
          <table>
            <thead>
              <tr>
                <th>Field</th>
                <th>Value</th>
                <th>Confidence</th>
                <th>Reasoning</th>
              </tr>
            </thead>
            <tbody>
              <FieldRow label="Bill of lading number" field={extraction.bill_of_lading_number} />
              <FieldRow label="Invoice number" field={extraction.invoice_number} />
              <FieldRow label="Shipper name" field={extraction.shipper_name} />
              <FieldRow label="Shipper address" field={extraction.shipper_address} />
              <FieldRow label="Consignee name" field={extraction.consignee_name} />
              <FieldRow label="Consignee address" field={extraction.consignee_address} />
              <FieldRow label="Total value of goods" field={extraction.total_value_of_goods} />
            </tbody>
          </table>

          <h3>Line Items</h3>
          <table>
            <thead>
              <tr>
                <th>Quantity</th>
                <th>Description</th>
                <th>Value</th>
                <th>HTS Code</th>
              </tr>
            </thead>
            <tbody>
              {extraction.line_items.map((item, i) => (
                <tr key={i}>
                  <td>
                    <FieldCell field={item.quantity} />
                  </td>
                  <td>
                    <FieldCell field={item.description} />
                  </td>
                  <td>
                    <FieldCell field={item.value} />
                  </td>
                  <td>
                    <FieldCell field={item.hts_code} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  )
}

export default DocumentPage
