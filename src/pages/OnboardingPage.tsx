import { useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, ArrowRight, ArrowLeft, X, Loader2, CheckCircle, SkipForward } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'

const INDUSTRIES = [
  'Technology', 'Finance', 'Healthcare', 'Consulting', 'Education',
  'Media', 'E-commerce', 'Real Estate', 'Manufacturing', 'Startups',
  'Government', 'Non-profit', 'Legal', 'Retail', 'Energy',
]

const STEP_LABELS = ['About You', 'Your Goals']

interface Step1Data {
  name: string
  title: string
  company: string
  linkedin_url: string
}

interface Step2Data {
  goal: string
  target_roles: string[]
  target_industries: string[]
}

function TagInput({
  tags,
  onAdd,
  onRemove,
  placeholder,
  suggestions,
}: {
  tags: string[]
  onAdd: (tag: string) => void
  onRemove: (tag: string) => void
  placeholder: string
  suggestions?: string[]
}) {
  const [input, setInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  const filteredSuggestions = suggestions?.filter(
    (s) => s.toLowerCase().includes(input.toLowerCase()) && !tags.includes(s)
  ) ?? []

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault()
      const tag = input.trim().replace(/,$/, '')
      if (tag && !tags.includes(tag)) {
        onAdd(tag)
        setInput('')
      }
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      onRemove(tags[tags.length - 1])
    }
  }

  return (
    <div className="relative">
      <div className="min-h-[42px] flex flex-wrap gap-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl px-3 py-2 focus-within:border-[var(--accent)] transition-colors">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 bg-[var(--accent)] bg-opacity-20 text-[var(--accent)] text-xs font-medium px-2 py-0.5 rounded-md"
          >
            {tag}
            <button
              type="button"
              onClick={() => onRemove(tag)}
              className="hover:opacity-70 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); setShowSuggestions(true) }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
        />
      </div>
      <AnimatePresence>
        {showSuggestions && filteredSuggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-10 max-h-40 overflow-y-auto"
          >
            {filteredSuggestions.map((s) => (
              <button
                key={s}
                type="button"
                onMouseDown={() => { onAdd(s); setInput('') }}
                className="w-full text-left px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
              >
                {s}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <p className="mt-1 text-xs text-[var(--text-muted)]">Press Enter or comma to add</p>
    </div>
  )
}

export function OnboardingPage() {
  const navigate = useNavigate()
  const { updateProfile, user } = useAuthStore()

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const [step1, setStep1] = useState<Step1Data>({
    name: user?.user_metadata?.full_name ?? '',
    title: '',
    company: '',
    linkedin_url: '',
  })

  const [step2, setStep2] = useState<Step2Data>({
    goal: '',
    target_roles: [],
    target_industries: [],
  })

  const handleSkip = async () => {
    // Save minimal data so profile is "complete enough" — mark goal as skipped
    setSaving(true)
    await updateProfile({
      goal: 'Explore network opportunities',
      ...step1.name ? { name: step1.name } : {},
    })
    setSaving(false)
    navigate('/', { replace: true })
  }

  const handleNext = () => {
    if (step === 0) {
      setStep(1)
      return
    }
  }

  const handleBack = () => {
    if (step > 0) setStep(step - 1)
  }

  const handleSubmit = async () => {
    setSaving(true)
    setError(null)

    const updates = {
      name: step1.name || null,
      title: step1.title || null,
      company: step1.company || null,
      linkedin_url: step1.linkedin_url || null,
      goal: step2.goal || 'Explore network opportunities',
      target_roles: step2.target_roles,
      interests: step2.target_industries,
    }

    const { error } = await updateProfile(updates)
    setSaving(false)

    if (error) {
      setError(error.message)
    } else {
      setDone(true)
      setTimeout(() => navigate('/', { replace: true }), 1500)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">You're all set!</h2>
          <p className="text-[var(--text-muted)] text-sm mt-1">Heading to your dashboard…</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--accent)] opacity-[0.04] rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent)] flex items-center justify-center shadow-lg shadow-[var(--accent-glow)]">
              <Zap className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[var(--text-primary)]">Set up your profile</h1>
              <p className="text-xs text-[var(--text-muted)]">{STEP_LABELS[step]} · Step {step + 1} of {STEP_LABELS.length}</p>
            </div>
          </div>
          <button
            onClick={handleSkip}
            disabled={saving}
            className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors disabled:opacity-50"
          >
            <SkipForward className="w-3.5 h-3.5" />
            Skip
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-[var(--border)] rounded-full mb-6 overflow-hidden">
          <motion.div
            className="h-full bg-[var(--accent)] rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${((step + 1) / STEP_LABELS.length) * 100}%` }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
          />
        </div>

        {/* Card */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 shadow-2xl">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">About you</h2>
                  <p className="text-sm text-[var(--text-muted)]">Help us personalise your experience</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                    Full name
                  </label>
                  <input
                    type="text"
                    value={step1.name}
                    onChange={(e) => setStep1((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Jane Smith"
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                    Current title
                  </label>
                  <input
                    type="text"
                    value={step1.title}
                    onChange={(e) => setStep1((p) => ({ ...p, title: e.target.value }))}
                    placeholder="MBA Candidate / Product Manager"
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                    Company / School
                  </label>
                  <input
                    type="text"
                    value={step1.company}
                    onChange={(e) => setStep1((p) => ({ ...p, company: e.target.value }))}
                    placeholder="Cambridge Judge Business School"
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                    LinkedIn URL <span className="text-[var(--text-muted)] font-normal">(optional)</span>
                  </label>
                  <input
                    type="url"
                    value={step1.linkedin_url}
                    onChange={(e) => setStep1((p) => ({ ...p, linkedin_url: e.target.value }))}
                    placeholder="https://linkedin.com/in/yourprofile"
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                  />
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Your goals</h2>
                  <p className="text-sm text-[var(--text-muted)]">We'll prioritise connections that match your ambitions</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                    What's your main goal right now?
                  </label>
                  <textarea
                    value={step2.goal}
                    onChange={(e) => setStep2((p) => ({ ...p, goal: e.target.value }))}
                    placeholder="e.g. Land a product management role at a Series B startup in fintech after my MBA"
                    rows={3}
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                    Target roles
                  </label>
                  <TagInput
                    tags={step2.target_roles}
                    onAdd={(tag) => setStep2((p) => ({ ...p, target_roles: [...p.target_roles, tag] }))}
                    onRemove={(tag) => setStep2((p) => ({ ...p, target_roles: p.target_roles.filter((t) => t !== tag) }))}
                    placeholder="Add a role and press Enter…"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                    Target industries
                  </label>
                  <TagInput
                    tags={step2.target_industries}
                    onAdd={(tag) => setStep2((p) => ({ ...p, target_industries: [...p.target_industries, tag] }))}
                    onRemove={(tag) => setStep2((p) => ({ ...p, target_industries: p.target_industries.filter((t) => t !== tag) }))}
                    placeholder="Add an industry…"
                    suggestions={INDUSTRIES}
                  />
                </div>

                {error && (
                  <p className="text-xs text-red-400">{error}</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation buttons */}
          <div className="flex items-center gap-3 mt-6">
            {step > 0 && (
              <button
                type="button"
                onClick={handleBack}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-colors disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}

            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={step < STEP_LABELS.length - 1 ? handleNext : handleSubmit}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl py-2.5 px-4 text-sm font-medium transition-colors disabled:opacity-50 shadow-lg shadow-[var(--accent-glow)]"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : step < STEP_LABELS.length - 1 ? (
                <>
                  Next
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Finish setup
                </>
              )}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
