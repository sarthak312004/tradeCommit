import { useState } from 'react'
import TradeCard from './TradeCard'
import TradeForm from './TradeForm'

function TradeJournal({ journal, onAddTrade, onUpdateTrade, onDeleteTrade }) {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTrade, setEditingTrade] = useState(null)

  const handleOpenNewTrade = () => {
    setEditingTrade(null)
    setIsFormOpen(true)
  }

  const handleOpenEditTrade = (trade) => {
    setEditingTrade(trade)
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setEditingTrade(null)
    setIsFormOpen(false)
  }

  const handleSubmitTrade = (trade) => {
    if (editingTrade) {
      onUpdateTrade(journal.id, editingTrade.id, trade)
    } else {
      onAddTrade(journal.id, {...trade, id: Date.now()})
    }

    handleCloseForm()
  }

  if (!journal) {
    return (
      <section className="rounded-2xl border border-dashed border-zinc-300 bg-white/40 p-10 text-center dark:border-zinc-700 dark:bg-zinc-900/30">
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Create or select a journal to view trades.</p>
      </section>
    )
  }

  return (
    <section>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.05em]">Recent trades</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Trades in {journal.name}</p>
        </div>
        <button
          type="button"
          onClick={isFormOpen ? handleCloseForm : handleOpenNewTrade}
          className="rounded-lg bg-sky-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-600"
        >
          {isFormOpen ? 'Close' : '+ Add trade'}
        </button>
      </div>

      {isFormOpen && (
        <TradeForm
          journalName={journal.name}
          initialTrade={editingTrade}
          onSubmit={handleSubmitTrade}
          onClose={handleCloseForm}
        />
      )}

      {journal.trades.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/40 p-10 text-center dark:border-zinc-700 dark:bg-zinc-900/30">
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">No trades in this journal yet.</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Add your first trade to start tracking this journal.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {journal.trades.map((currentTrade) => (
            <TradeCard
              key={currentTrade.id}
              trade={currentTrade}
              onSelect={handleOpenEditTrade}
              onDelete={(tradeId) => onDeleteTrade(journal.id, tradeId)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export default TradeJournal