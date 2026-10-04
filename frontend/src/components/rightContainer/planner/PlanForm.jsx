import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import FormDrawer from '../../common/FormDrawer'
import PropertyRow from '../../common/PropertyRow'
import RichTextEditor from '../../common/RichTextEditor'
import { dateInputClass, ghostFooterButton, primaryFooterButton } from '../../common/formStyles'
import { CalendarIcon } from '../../../utils/Icons.jsx'
import { formatLongDate, todayKey } from '../../../utils/calendar'

const MAX_TITLE = 120

/**
 * Drawer form to write (or review) the plan for one calendar day.
 * Same layout as TradeForm: big title header, property rows, rich text body with screenshots.
 *
 * @param {string}   plannerName
 * @param {string}   plannerType
 * @param {object}   [initialEntry]  existing plan when editing
 * @param {string}   [initialDate]   date key preselected for a new plan
 * @param {Function} onSubmit        async ({ title, date, content, images }) => void
 * @param {Function} [onDelete]      async () => void   (editing only)
 * @param {Function} onClose
 * @param {Function} onUploadImage   (file) => Promise<url>
 */
function PlanForm({ plannerName, plannerType, initialEntry = null, initialDate, onSubmit, onDelete, onClose, onUploadImage }) {
  const defaultDate = initialEntry?.date ?? initialDate ?? todayKey()
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: { title: initialEntry?.title ?? '', date: defaultDate }
  })
  const drawerRef = useRef(null)
  const editorRef = useRef(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const date = watch('date')
  const isBusy = isSaving // uploads run in the background; Save just waits for them

  const handleFormSubmit = async (values) => {
    setSubmitError('')
    setIsSaving(true)
    try {
      const { html, images, removedImages } = await editorRef.current.getContent()
      await onSubmit({ title: values.title.trim(), date: values.date || todayKey(), content: html, images, removedImages })
      drawerRef.current?.close()
    } catch (error) {
      setSubmitError(error.message || 'Could not save this plan. Please try again.')
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setSubmitError('')
    setIsSaving(true)
    try {
      await onDelete()
      drawerRef.current?.close()
    } catch (error) {
      setSubmitError(error.message || 'Could not delete this plan. Please try again.')
      setIsSaving(false)
    }
  }

  const breadcrumb = (
    <>
      {plannerName}
      <span className="mx-1.5 opacity-60">/</span>
      {initialEntry ? 'Plan' : 'New plan'}
    </>
  )

  const footer = (
    <>
      <div className="flex items-center gap-2">
        {onDelete && !isConfirmingDelete && (
          <button type="button" onClick={() => setIsConfirmingDelete(true)} disabled={isBusy} className="h-9 rounded-md px-3 text-[13px] font-medium text-rose-500 transition-colors hover:bg-rose-500/10 disabled:opacity-50">
            Delete
          </button>
        )}
        {onDelete && isConfirmingDelete && (
          <>
            <span role={isSaving ? 'status' : undefined} aria-live="polite" className="text-[13px] text-zinc-600 dark:text-zinc-300">
              {isSaving ? 'Deleting plan...' : 'Delete this plan?'}
            </span>
            <button type="button" onClick={() => setIsConfirmingDelete(false)} disabled={isSaving} className={ghostFooterButton}>Keep</button>
            <button type="button" onClick={handleDelete} disabled={isSaving} className="inline-flex h-9 min-w-[100px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-rose-600 px-3 text-[13px] font-medium text-white transition-colors hover:bg-rose-700 disabled:cursor-default disabled:opacity-70 dark:bg-rose-500 dark:hover:bg-rose-600">
              {isSaving && <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/50 border-t-white" />}
              {isSaving ? 'Deleting...' : 'Delete'}
            </button>
          </>
        )}
        {submitError && <p role="alert" className="text-xs text-rose-500">{submitError}</p>}
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => drawerRef.current?.close()} className={ghostFooterButton}>Cancel</button>
        <button type="submit" disabled={isBusy} className={primaryFooterButton}>
          {isBusy ? (isUploading ? 'Uploading...' : 'Saving...') : initialEntry ? 'Save plan' : 'Create plan'}
        </button>
      </div>
    </>
  )

  return (
    <FormDrawer
      ref={drawerRef}
      ariaTitle={`${initialEntry ? 'Edit plan in' : 'New plan in'} ${plannerName}`}
      breadcrumb={breadcrumb}
      onSubmit={handleSubmit(handleFormSubmit)}
      onClose={onClose}
      footer={footer}
    >
      {/* header = plan title */}
      <input
        {...register('title', { validate: (value) => value.trim() !== '' || 'Give this plan a title' })}
        aria-label="Plan title"
        autoComplete="off"
        maxLength={MAX_TITLE}
        placeholder="e.g. Nifty breakout plan"
        className="w-full bg-transparent text-3xl font-bold tracking-tight text-zinc-900 outline-none placeholder:font-bold placeholder:text-zinc-300 sm:text-4xl sm:leading-tight dark:text-zinc-50 dark:placeholder:text-zinc-700"
      />
      {errors.title && <p className="mt-1 text-xs text-rose-500">{errors.title.message}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-1 font-medium text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
          {plannerType}
        </span>
        {date && (
          <span className="rounded-md bg-zinc-100 px-2 py-1 font-medium text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
            {formatLongDate(date)}
          </span>
        )}
      </div>

      <div className="mt-6">
        <PropertyRow Icon={CalendarIcon} label="Date" htmlFor="plan-date" error={errors.date?.message}>
          <input id="plan-date" type="date" {...register('date', { required: 'Pick a date' })} className={dateInputClass} />
        </PropertyRow>
      </div>

      <hr className="my-6 border-zinc-300 dark:border-white/[0.12]" />

      <RichTextEditor
        ref={editorRef}
        id="plan-content"
        label="Trade plan"
        initialHtml={initialEntry?.content ?? ''}
        placeholder="Levels, setups, entry & exit rules, risk, what would invalidate the idea…"
        onUploadImage={onUploadImage}
        onBusyChange={setIsUploading}
      />
    </FormDrawer>
  )
}

export default PlanForm
