import { useState } from 'react'
import { DownloadIcon } from '../../../utils/Icons.jsx'
import { formatMoney, formatPercent, formatR, formatRatio } from '../../../utils/tradeAnalytics'
import { focusRing } from '../../common/controlStyles'
import { distinctNextActions } from '../../../utils/reviewActions'

const nonEmpty = (value) => typeof value === 'string' && value.trim()
const FLY_COMMITMENT = { kept: 'kept', partly_kept: 'partly kept', not_kept: 'not kept', cannot_tell: "can't tell from the logs" }
const PAGE = { width: 210, height: 297, margin: 18 }

function pdfText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—−]/g, '-')
    .replace(/[·•‧∙]/g, '-')
    .replace(/…/g, '...')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/×/g, 'x')
    .replace(/\u00a0/g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/₹/g, 'INR ')
    .replace(/[^\x20-\x7E]/g, '?')
}

function createReviewPdf(PdfConstructor, review, { from, to, generatedAt, stats, currency, period }) {
  const pdf = new PdfConstructor({ unit: 'mm', format: 'a4' })
  const contentWidth = PAGE.width - PAGE.margin * 2
  let y = PAGE.margin

  const write = (value, { size = 10, bold = false, gap = 1.5, indent = 0, color = [55, 65, 81] } = {}) => {
    if (!value) return
    pdf.setFont('helvetica', bold ? 'bold' : 'normal')
    pdf.setFontSize(size)
    pdf.setTextColor(...color)
    const lines = pdf.splitTextToSize(pdfText(value), contentWidth - indent)
    const lineHeight = size * 0.42
    for (const line of lines) {
      if (y + lineHeight > PAGE.height - PAGE.margin) {
        pdf.addPage()
        y = PAGE.margin
      }
      pdf.text(line, PAGE.margin + indent, y)
      y += lineHeight
    }
    y += gap
  }

  const heading = (title) => {
    y += 2
    write(title, { size: 12, bold: true, gap: 2, color: [24, 39, 57] })
  }
  const bullet = (text) => write(`- ${text}`, { indent: 2, gap: 1.5 })

  write('AI Mentor Feedback', { size: 20, bold: true, gap: 3, color: [24, 39, 57] })
  write(`Period: ${from} - ${to}`, { size: 10, bold: true, gap: 1 })
  if (generatedAt) write(`Written: ${new Date(generatedAt).toLocaleString()}`, { size: 9, color: [107, 114, 128] })

  y += 2
  write(review.headline, { size: 15, bold: true, gap: 3, color: [24, 39, 57] })
  write(review.summary, { size: 10, gap: 2 })

  if (nonEmpty(review.discipline?.explanation)) {
    heading('About your rules')
    write(review.discipline.explanation)
  }

  if (stats) {
    heading('Period stats')
    // avgRrr is the old name of expectancyR (average R per trade); reward : risk is average winner / average loser
    const expectancyR = stats.expectancyR !== undefined ? stats.expectancyR : stats.avgRrr
    const rewardRisk = stats.rewardRisk !== undefined ? (stats.rewardRisk ?? stats.payoffRatio ?? null) : undefined
    write(`Trades: ${stats.trades ?? '-'} | Closed: ${stats.closed ?? '-'} | Net P&L: ${formatMoney(stats.closed ? stats.netPnl : null, { currency, signed: true })} | Win rate: ${formatPercent(stats.winRate)} | Expectancy: ${formatR(expectancyR)} per trade${rewardRisk === undefined ? '' : ` | Reward:risk: ${rewardRisk === null ? '-' : formatRatio(rewardRisk)}`}`)
  }

  const fly = review.flywheel
  if (fly) {
    heading('Flywheel: close the loop')
    if (fly.lastCommitment && fly.lastCommitment.status !== 'none') {
      write(`Last review's commitment: ${FLY_COMMITMENT[fly.lastCommitment.status] ?? fly.lastCommitment.status}${nonEmpty(fly.lastCommitment.evidence) ? ` - ${fly.lastCommitment.evidence}` : ''}`)
    }
    if (fly.weakestLink?.stage) write(`Weakest link in your loop: ${fly.weakestLink.stage}${nonEmpty(fly.weakestLink.detail) ? ` - ${fly.weakestLink.detail}` : ''}`)
    if (fly.leaks?.length) {
      write('Where your edge leaks', { bold: true })
      fly.leaks.forEach((item) => bullet(`${item.title}${nonEmpty(item.cost) ? ` [${item.cost}]` : ''}${nonEmpty(item.detail) ? ` - ${item.detail}` : ''}${item.trades?.length ? ` (Trades: ${item.trades.join(', ')})` : ''}`))
    }
    if (nonEmpty(fly.edgeSignal?.detail)) write(`What the data shows (${fly.edgeSignal.confidence} read): ${fly.edgeSignal.detail}`)
    if (nonEmpty(fly.carryForward?.rule)) {
      write('Carry into your next plan', { bold: true })
      bullet(`Rule: ${fly.carryForward.rule}`)
      if (nonEmpty(fly.carryForward.planLine)) bullet(`Write in your plan: ${fly.carryForward.planLine}`)
      if (nonEmpty(fly.carryForward.checkpoint)) bullet(`Next review checks: ${fly.carryForward.checkpoint}`)
    }
  }

  const nextActions = distinctNextActions(review)
  if (nextActions.length) {
    heading('Next-period actions')
    nextActions.forEach(bullet)
  }
  if (review.strengths.length) {
    heading('Went well')
    review.strengths.forEach((item) => bullet(`${item.title}${nonEmpty(item.detail) ? ` - ${item.detail}` : ''}`))
  }
  if (review.issues.length) {
    heading(fly ? 'Also worth fixing' : 'Work on')
    review.issues.forEach((item) => bullet(`${item.title}${nonEmpty(item.detail) ? ` - ${item.detail}` : ''}${item.trades?.length ? ` (Trades: ${item.trades.join(', ')})` : ''}`))
  }
  if (review.ruleChecks.length) {
    heading('Rules')
    review.ruleChecks.forEach((item) => bullet(`${item.rule} - ${item.status.replaceAll('_', ' ')}${nonEmpty(item.evidence) ? `: ${item.evidence}` : ''}${item.trades?.length ? ` (Trades: ${item.trades.join(', ')})` : ''}`))
  }

  if (review.leakReport?.items?.length) {
    heading('Where you lost money and time')
    write('Measured from your logs. Each amount is what those trades netted; it is not proof of cause and amounts can overlap.', { size: 9, color: [107, 114, 128] })
    review.leakReport.items.forEach((leak) => {
      const amount = Number.isFinite(leak.amount) ? ` [${formatMoney(leak.amount, { currency, signed: true })}]` : ''
      bullet(`${leak.title}${amount}${nonEmpty(leak.detail) ? ` - ${leak.detail}` : ''}${nonEmpty(leak.fix) ? ` How to stop it: ${leak.fix}` : ''}${leak.trades?.length ? ` (Trades: ${leak.trades.join(', ')})` : ''}`)
    })
  }

  if (review.planAlignment) {
    heading('Plan vs execution')
    if (nonEmpty(review.planAlignment.summary)) write(review.planAlignment.summary)
    const planDays = review.planAlignment.days ?? []
    planDays.forEach((day) => bullet(`${day.date} - ${day.status.replaceAll('_', ' ')}${nonEmpty(day.detail) ? `: ${day.detail}` : ''}${day.trades?.length ? ` (Trades: ${day.trades.join(', ')})` : ''}`))
  }

  if (nonEmpty(review.mentorNote)) {
    heading('Mentor note')
    write(review.mentorNote)
  }
  y += 2
  write('AI feedback from your own logs, not financial advice.', { size: 8, color: [107, 114, 128], gap: 0 })

  const pageCount = pdf.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(120, 120, 120)
    pdf.text(`Mentor feedback - ${period} | ${page} / ${pageCount}`, PAGE.width - PAGE.margin, PAGE.height - 9, { align: 'right' })
  }

  return pdf
}

function ReviewDownloadButton({ review, period, from, to, generatedAt, stats, currency }) {
  const [downloadError, setDownloadError] = useState('')

  const download = async () => {
    setDownloadError('')
    try {
      const { jsPDF } = await import('jspdf')
      const pdf = createReviewPdf(jsPDF, review, { from, to, generatedAt, stats, currency, period })
      pdf.save(`mentor-feedback-${period}-${from}-${to}.pdf`)
    } catch (error) {
      console.error('Could not download AI feedback as PDF:', error)
      setDownloadError('PDF download failed. Please try again.')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={download}
        aria-label="Download AI feedback as PDF"
        title="Download feedback as PDF"
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.08] dark:hover:text-zinc-100 ${focusRing}`}
      >
        <DownloadIcon className="h-4 w-4" />
      </button>
      {downloadError && <span role="alert" className="text-xs text-rose-600 dark:text-rose-400">{downloadError}</span>}
    </>
  )
}

export default ReviewDownloadButton
