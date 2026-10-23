import { useContext } from 'react'
import { useLocation, useOutletContext } from 'react-router'
import { journalContext } from '../context/Context'
import TopBar from '../components/rightContainer/TopBar.jsx'
import TradeJournal from '../components/rightContainer/journal/TradeJournal.jsx'
import ScrollFade from '../components/common/ScrollFade.jsx'

function MainJournal() {
  const { pathname } = useLocation()
  const { openCreateForm } = useOutletContext()
  const view = pathname.startsWith('/calendar') ? 'calendar' : pathname.startsWith('/analysis') ? 'analysis' : 'trades'
  const { selectedJournal, addTrade, updateTrade, deleteTrade, uploadTradeImage, updateJournalContext, retryTradeSave, discardTradeSave } = useContext(journalContext)

  return (
    <>
      <TopBar label="Journal" title={selectedJournal?.name || 'Home'} />
      <ScrollFade className="flex min-h-0 flex-1 flex-col" scrollClassName="subtle-scrollbar flex-1 overflow-y-auto p-6 md:p-8">
        <TradeJournal
          key={selectedJournal?.id ?? 'empty-journal'}
          view={view}
          journal={selectedJournal}
          onAddTrade={addTrade}
          onUpdateTrade={updateTrade}
          onDeleteTrade={deleteTrade}
          onUploadTradeImage={uploadTradeImage}
          onSaveContext={updateJournalContext}
          onRetryTrade={retryTradeSave}
          onDiscardTrade={discardTradeSave}
          onOpenCreateForm={openCreateForm}
        />
      </ScrollFade>
    </>
  )
}
export default MainJournal
