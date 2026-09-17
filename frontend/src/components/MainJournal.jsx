import TradeJournal from './TradeJournal'

function MainJournal({ selectedJournal, onAddTrade, onUpdateTrade, onDeleteTrade }) {
  return (
    <div className="subtle-scrollbar flex-1 overflow-y-auto p-6 md:p-8">
      {/* <section className="mb-8 grid gap-4 md:grid-cols-3">
        {summary.map((item) => (
          <SummaryCard key={item.label} item={item} />
        ))}
      </section> */}

      <TradeJournal
        key={selectedJournal?.id ?? 'empty-journal'}
        journal={selectedJournal}
        onAddTrade={onAddTrade}
        onUpdateTrade={onUpdateTrade}
        onDeleteTrade={onDeleteTrade}
      />
    </div>
  )
}
export default MainJournal
