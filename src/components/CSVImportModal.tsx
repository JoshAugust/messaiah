import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, X, FileText, CheckCircle, AlertCircle, Loader2, ChevronDown } from 'lucide-react'
import { importLinkedInCSV, previewCSV, type ImportSummary, type ParsedContact } from '../services/csvImport'

interface CSVImportModalProps {
  userId: string
  onClose: () => void
  onComplete?: (summary: ImportSummary) => void
}

type ModalStep = 'drop' | 'preview' | 'importing' | 'done'

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 20 },
}

export function CSVImportModal({ userId, onClose, onComplete }: CSVImportModalProps) {
  const [step, setStep] = useState<ModalStep>('drop')
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ParsedContact[]>([])
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState('')
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (f: File) => {
    if (!f.name.endsWith('.csv')) {
      setError('Please select a CSV file')
      return
    }
    setFile(f)
    setError(null)

    try {
      const rows = await previewCSV(f, 5)
      setPreview(rows)
      setStep('preview')
    } catch (err) {
      setError(`Failed to read file: ${(err as Error).message}`)
    }
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const f = e.dataTransfer.files[0]
      if (f) handleFile(f)
    },
    [handleFile]
  )

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const onDragLeave = () => setIsDragging(false)

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }

  const startImport = async () => {
    if (!file) return
    setStep('importing')
    setProgress(0)
    setError(null)

    try {
      const result = await importLinkedInCSV(file, userId, (p, msg) => {
        setProgress(p)
        setProgressMessage(msg)
      })
      setSummary(result)
      setStep('done')
      onComplete?.(result)
    } catch (err) {
      setError((err as Error).message)
      setStep('preview') // let user retry
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        variants={backdropVariants}
        initial="hidden"
        animate="visible"
        exit="hidden"
        style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          className="w-full max-w-lg rounded-2xl border border-[var(--border)] overflow-hidden"
          style={{ backgroundColor: 'var(--bg-secondary)' }}
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4 border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5" style={{ color: 'var(--accent)' }} />
              <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                Import LinkedIn Connections
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5">
            <AnimatePresence mode="wait">
              {/* DROP ZONE */}
              {step === 'drop' && (
                <motion.div
                  key="drop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all"
                    style={{
                      borderColor: isDragging ? 'var(--accent)' : 'var(--border)',
                      backgroundColor: isDragging ? 'rgba(var(--accent-rgb, 99,102,241),0.05)' : 'var(--bg-card)',
                    }}
                  >
                    <motion.div
                      animate={{ y: isDragging ? -6 : 0 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                    >
                      <Upload className="w-10 h-10" style={{ color: isDragging ? 'var(--accent)' : 'var(--text-muted)' }} />
                    </motion.div>
                    <div className="text-center">
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        Drop your LinkedIn CSV here
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        or click to browse • Connections.csv from LinkedIn
                      </p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={onFileInput}
                    />
                  </div>

                  {error && (
                    <p className="mt-3 text-xs text-center" style={{ color: 'var(--error, #ef4444)' }}>
                      {error}
                    </p>
                  )}

                  <p className="mt-4 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                    Export from LinkedIn → Settings → Data Privacy → Get a copy of your data
                  </p>
                </motion.div>
              )}

              {/* PREVIEW */}
              {step === 'preview' && (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      Preview — first 5 contacts
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {file?.name}
                    </p>
                  </div>

                  <div
                    className="rounded-xl overflow-hidden border mb-4"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-card)' }}>
                          {['Name', 'Company', 'Position', 'Connected'].map((h) => (
                            <th
                              key={h}
                              className="px-3 py-2 text-left font-medium"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((row, i) => (
                          <tr
                            key={i}
                            className="border-t"
                            style={{ borderColor: 'var(--border)' }}
                          >
                            <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>
                              {[row.first_name, row.last_name].filter(Boolean).join(' ') || '—'}
                            </td>
                            <td className="px-3 py-2 truncate max-w-[100px]" style={{ color: 'var(--text-secondary)' }}>
                              {row.company || '—'}
                            </td>
                            <td className="px-3 py-2 truncate max-w-[120px]" style={{ color: 'var(--text-secondary)' }}>
                              {row.position || '—'}
                            </td>
                            <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>
                              {row.connected_on || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {error && (
                    <p className="mb-3 text-xs" style={{ color: 'var(--error, #ef4444)' }}>
                      {error}
                    </p>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => { setStep('drop'); setFile(null); setPreview([]) }}
                      className="flex-1 py-2 rounded-lg border text-sm font-medium transition-colors hover:bg-[var(--bg-hover)]"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                    >
                      Change file
                    </button>
                    <button
                      onClick={startImport}
                      className="flex-1 py-2 rounded-lg text-sm font-medium text-white transition-colors"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      Import contacts
                    </button>
                  </div>
                </motion.div>
              )}

              {/* IMPORTING */}
              {step === 'importing' && (
                <motion.div
                  key="importing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-4"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--accent)' }} />
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      Importing contacts...
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div
                    className="h-2 rounded-full overflow-hidden mb-2"
                    style={{ backgroundColor: 'var(--bg-card)' }}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: 'var(--accent)' }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {progressMessage}
                    </p>
                    <p className="text-xs font-medium" style={{ color: 'var(--accent)' }}>
                      {progress}%
                    </p>
                  </div>
                </motion.div>
              )}

              {/* DONE */}
              {step === 'done' && summary && (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-2"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
                    className="flex justify-center mb-4"
                  >
                    <CheckCircle className="w-12 h-12" style={{ color: 'var(--success, #22c55e)' }} />
                  </motion.div>

                  <h3 className="font-semibold text-base mb-1" style={{ color: 'var(--text-primary)' }}>
                    Import Complete!
                  </h3>
                  <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
                    Your LinkedIn connections have been imported
                  </p>

                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {[
                      { label: 'Imported', value: summary.imported, color: 'var(--success, #22c55e)' },
                      { label: 'Skipped', value: summary.skipped, color: 'var(--warning, #f59e0b)' },
                      { label: 'Errors', value: summary.errors, color: 'var(--error, #ef4444)' },
                    ].map(({ label, value, color }) => (
                      <div
                        key={label}
                        className="rounded-xl p-3"
                        style={{ backgroundColor: 'var(--bg-card)' }}
                      >
                        <p className="text-2xl font-bold" style={{ color }}>
                          {value}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {label}
                        </p>
                      </div>
                    ))}
                  </div>

                  {summary.errorDetails.length > 0 && (
                    <div className="mb-4 text-left">
                      <button
                        onClick={() => setShowErrors(!showErrors)}
                        className="flex items-center gap-1 text-xs mb-2"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <ChevronDown
                          className="w-3 h-3 transition-transform"
                          style={{ transform: showErrors ? 'rotate(180deg)' : 'none' }}
                        />
                        {showErrors ? 'Hide' : 'Show'} error details
                      </button>
                      {showErrors && (
                        <div
                          className="rounded-lg p-3 text-xs space-y-1 max-h-24 overflow-y-auto"
                          style={{ backgroundColor: 'var(--bg-card)', color: 'var(--error, #ef4444)' }}
                        >
                          {summary.errorDetails.map((d, i) => (
                            <p key={i}>{d}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={onClose}
                    className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition-colors"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    Done
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Error banner (for non-step-specific errors) */}
          {error && step === 'drop' && (
            <div
              className="mx-5 mb-5 p-3 rounded-xl flex items-start gap-2"
              style={{ backgroundColor: 'rgba(239,68,68,0.1)' }}
            >
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#ef4444' }} />
              <p className="text-xs" style={{ color: '#ef4444' }}>
                {error}
              </p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
