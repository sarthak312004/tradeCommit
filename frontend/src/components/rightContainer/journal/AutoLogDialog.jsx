import { useEffect, useMemo, useState } from 'react'
import { autoLogApi, BROKER_CATALOG, WEBHOOK_JSON_EXAMPLE } from '../../../services/autoLogApi'
import { useProfile } from '../../../hooks/useProfile'
import { openUpgrade } from '../../../utils/upgrade'
import { showToast } from '../../../utils/toastStore'
import { CheckIcon, CloseIcon, SlidersIcon, StarIcon } from '../../../utils/Icons.jsx'
import { iconButtonClass } from '../../common/formStyles'

function AutoLogDialog({ journal, onClose, onAutoLogUpdated }) {
  const { profile } = useProfile()
  const canAutoLog = profile?.entitlements?.autoLogWebhook === true
  const [brokerId, setBrokerId] = useState(journal?.autoLog?.brokerId || 'custom')
  const [enabled, setEnabled] = useState(Boolean(journal?.autoLog?.enabled))
  const [webhookUrl, setWebhookUrl] = useState('')
  const [totalLoggedCount, setTotalLoggedCount] = useState(journal?.autoLog?.totalLoggedCount ?? 0)
  const [lastReceivedAt, setLastReceivedAt] = useState(journal?.autoLog?.lastReceivedAt ?? null)
  const [lastMessage, setLastMessage] = useState(journal?.autoLog?.lastMessage ?? '')
  const [loadedJournalId, setLoadedJournalId] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [errorText, setErrorText] = useState('')
  const isLoading = canAutoLog && loadedJournalId !== journal?.id

  const selectedBroker = useMemo(
    () => BROKER_CATALOG.find((item) => item.id === brokerId) ?? BROKER_CATALOG.at(-1),
    [brokerId]
  )

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    if (!canAutoLog || !journal?.id) {
      return undefined
    }

    let active = true
    autoLogApi.getConfig(journal.id)
      .then((config) => {
        if (!active) return
        setBrokerId(config.brokerId || 'custom')
        setEnabled(Boolean(config.enabled))
        setWebhookUrl(config.webhookUrl || '')
        setTotalLoggedCount(config.totalLoggedCount ?? 0)
        setLastReceivedAt(config.lastReceivedAt ?? null)
        setLastMessage(config.lastMessage || '')
      })
      .catch((error) => {
        if (active) setErrorText(error?.message || 'Could not load auto-log settings.')
      })
      .finally(() => {
        if (active) setLoadedJournalId(journal.id)
      })

    return () => {
      active = false
    }
  }, [canAutoLog, journal?.id])

  const applyConfig = (config) => {
    if (!config) return
    setBrokerId(config.brokerId || 'custom')
    setEnabled(Boolean(config.enabled))
    setWebhookUrl(config.webhookUrl || '')
    setTotalLoggedCount(config.totalLoggedCount ?? 0)
    setLastReceivedAt(config.lastReceivedAt ?? null)
    setLastMessage(config.lastMessage || '')
    onAutoLogUpdated?.(journal.id, config)
  }

  const saveConfig = async (nextEnabled = enabled) => {
    if (!canAutoLog) {
      openUpgrade('autoLogWebhook')
      return
    }
    setIsSaving(true)
    setErrorText('')
    try {
      const config = await autoLogApi.saveConfig(journal.id, { brokerId, enabled: nextEnabled })
      applyConfig(config)
      showToast({ message: nextEnabled ? 'Trade webhook enabled' : 'Trade webhook paused', tone: 'success' })
    } catch (error) {
      setErrorText(error?.message || 'Could not save auto-log settings.')
    } finally {
      setIsSaving(false)
    }
  }

  const copyWebhookUrl = async () => {
    if (!webhookUrl) return
    try {
      await navigator.clipboard.writeText(webhookUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast({ message: 'Could not copy to clipboard', tone: 'error' })
    }
  }

  const rotateWebhookUrl = async () => {
    if (!canAutoLog) {
      openUpgrade('autoLogWebhook')
      return
    }
    if (!window.confirm('Replace this webhook URL? Existing broker alerts using it will stop working.')) return
    setErrorText('')
    try {
      const config = await autoLogApi.rotateToken(journal.id)
      applyConfig(config)
      showToast({ message: 'Webhook URL regenerated', tone: 'success' })
    } catch (error) {
      setErrorText(error?.message || 'Could not rotate the webhook URL.')
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auto-log-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.()
      }}
    >
      <div className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-zinc-300 bg-white shadow-2xl dark:border-white/[0.14] dark:bg-panel ${canAutoLog ? 'max-w-2xl' : 'max-w-md'}`}>
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-white/[0.08]">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-white/[0.1] dark:bg-white/[0.05] dark:text-zinc-300">
              <SlidersIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 id="auto-log-title" className="text-base font-semibold tracking-[-0.03em] text-zinc-900 dark:text-zinc-50">
                Auto-log trades
              </h2>
              <p className="truncate text-xs text-zinc-600 dark:text-zinc-400">
                Send executions straight into {journal?.name}.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`${iconButtonClass} cursor-pointer`}>
            <CloseIcon className="h-4 w-4" />
          </button>
        </header>

        <div className="subtle-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          {!canAutoLog ? (
            <div className="py-2 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#e8cdbf] bg-[#fbf3ee] text-[#a75b3b] dark:border-[#a75b3b]/30 dark:bg-[#a75b3b]/10 dark:text-[#e5a487]">
                <StarIcon className="h-6 w-6" />
              </span>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a75b3b] dark:text-[#e5a487]">
                TradeCommit Pro feature
              </p>
              <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-zinc-900 dark:text-zinc-50">
                Let your trades log themselves
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                Connect a broker or charting platform and send completed executions straight to this journal.
              </p>
              <ul className="mx-auto mt-5 max-w-sm space-y-2 text-left">
                {[
                  'Connect through a secure webhook',
                  'Automatically record completed executions',
                  'Skip duplicate fills'
                ].map((benefit) => (
                  <li key={benefit} className="flex items-center gap-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                    <CheckIcon className="h-3.5 w-3.5 shrink-0 text-[#a75b3b] dark:text-[#e5a487]" />
                    {benefit}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => openUpgrade('autoLogWebhook')}
                className="mt-6 h-10 w-full cursor-pointer rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                Explore Pro plans
              </button>
              <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
                You can keep using your journal without connecting a webhook.
              </p>
            </div>
          ) : (
            <>
              <div>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Choose a broker or platform</h3>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{BROKER_CATALOG.length} options</span>
                </div>
                <div role="radiogroup" aria-label="Broker or trading platform" className="grid max-h-48 grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
                  {BROKER_CATALOG.map((broker) => {
                    const selected = broker.id === brokerId
                    return (
                      <button
                        key={broker.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={isLoading || isSaving}
                        onClick={() => setBrokerId(broker.id)}
                        onKeyDown={(event) => {
                          const direction = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1
                            : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1
                              : 0
                          if (!direction) return
                          event.preventDefault()
                          const options = Array.from(event.currentTarget.parentElement.querySelectorAll('[role="radio"]'))
                          const index = options.indexOf(event.currentTarget)
                          const next = options[(index + direction + options.length) % options.length]
                          next.focus()
                          next.click()
                        }}
                        className={`flex min-h-10 cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          selected
                            ? 'border-zinc-400 bg-zinc-100 text-zinc-900 dark:border-zinc-500 dark:bg-white/[0.1] dark:text-zinc-50'
                            : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-white/[0.08] dark:text-zinc-300 dark:hover:bg-white/[0.05]'
                        }`}
                      >
                        <span className="min-w-0">{broker.name}</span>
                        {selected && <CheckIcon className="h-3.5 w-3.5 shrink-0" />}
                      </button>
                    )
                  })}
                </div>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Send {selectedBroker.name} executions to your journal webhook as JSON.
                </p>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 px-4 py-3 dark:border-white/[0.1]">
                <label htmlFor="auto-log-enabled" className="min-w-0 cursor-pointer">
                  <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">Accept incoming trades</span>
                  <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">New executions are added automatically.</span>
                </label>
                <input
                  id="auto-log-enabled"
                  type="checkbox"
                  checked={enabled}
                  disabled={isLoading || isSaving}
                  onChange={(event) => {
                    const nextEnabled = event.target.checked
                    setEnabled(nextEnabled)
                    saveConfig(nextEnabled)
                  }}
                  className="h-4 w-4 shrink-0 cursor-pointer accent-zinc-800 dark:accent-zinc-100"
                />
              </div>

              <div>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="auto-log-url" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Journal webhook URL
                  </label>
                  <button
                    type="button"
                    onClick={rotateWebhookUrl}
                    disabled={isLoading || isSaving}
                    className="cursor-pointer text-xs text-zinc-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-zinc-400"
                  >
                    Regenerate URL
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    id="auto-log-url"
                    readOnly
                    value={isLoading ? 'Loading…' : webhookUrl}
                    className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-zinc-50 px-3 font-mono text-xs text-zinc-700 dark:border-white/[0.14] dark:bg-white/[0.04] dark:text-zinc-200"
                  />
                  <button
                    type="button"
                    onClick={copyWebhookUrl}
                    disabled={!webhookUrl || isLoading}
                    className="h-9 shrink-0 cursor-pointer rounded-lg border border-zinc-300 px-3 text-xs font-medium text-zinc-700 disabled:opacity-50 dark:border-white/[0.14] dark:text-zinc-200"
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                  Treat this URL like a password. Anyone who has it can submit trades to this journal. Regenerate it if exposed.
                </p>
              </div>

              <div>
                <details className="group rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-white/[0.1]">
                  <summary className="cursor-pointer text-xs font-medium text-zinc-700 marker:text-zinc-500 dark:text-zinc-300">
                    View example execution JSON
                  </summary>
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-950 p-3 text-[11px] leading-relaxed text-zinc-100">{WEBHOOK_JSON_EXAMPLE}</pre>
                </details>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-zinc-200 pt-3 text-xs text-zinc-600 dark:border-white/[0.1] dark:text-zinc-400">
                <span>
                  {lastReceivedAt ? `Last event ${new Date(lastReceivedAt).toLocaleString()}` : 'No webhook events received yet'}
                  {lastMessage ? ` · ${lastMessage}` : ''}
                </span>
                <span className="shrink-0">{totalLoggedCount} updates</span>
              </div>
            </>
          )}

          {errorText && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">{errorText}</p>}
        </div>

        {canAutoLog && (
          <div className="flex justify-end border-t border-zinc-200 px-5 py-3 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={() => saveConfig(enabled)}
              disabled={isLoading || isSaving}
              className="cursor-pointer rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {isSaving ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default AutoLogDialog
