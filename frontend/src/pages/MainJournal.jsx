import { useContext } from 'react'
import { journalContext } from '../context/Context'
import TopBar from '../components/rightContainer/TopBar.jsx'
import TradeJournal from '../components/rightContainer/journal/TradeJournal.jsx'

function MainJournal() {
  const { selectedJournal, addTrade, updateTrade, deleteTrade, uploadTradeImage, updateJournalContext, retryTradeSave, discardTradeSave } = useContext(journalContext)

  return (
    <>
      <TopBar label="Journal" title={selectedJournal?.name || 'Home'} />
      <div className="subtle-scrollbar flex-1 overflow-y-auto p-6 md:p-8">
        <TradeJournal
          key={selectedJournal?.id ?? 'empty-journal'}
          journal={selectedJournal}
          onAddTrade={addTrade}
          onUpdateTrade={updateTrade}
          onDeleteTrade={deleteTrade}
          onUploadTradeImage={uploadTradeImage}
          onSaveContext={updateJournalContext}
          onRetryTrade={retryTradeSave}
          onDiscardTrade={discardTradeSave}
        />
      </div>
    </>
  )
}
export default MainJournal
