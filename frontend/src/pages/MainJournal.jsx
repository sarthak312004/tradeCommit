import { useContext } from 'react'
import { useOutletContext } from 'react-router'
import { journalContext } from '../context/Context'
import TopBar from '../components/rightContainer/TopBar.jsx'
import TradeJournal from '../components/rightContainer/journal/TradeJournal.jsx'

function MainJournal() {
  const { selectedJournal, addTrade, updateTrade, deleteTrade, uploadTradeImage } = useContext(journalContext)
  const { isSidebarOpen } = useOutletContext()

  return (
    <>
      <TopBar label="Journal" title={selectedJournal?.name || 'Home'} />
      <div className="subtle-scrollbar flex-1 overflow-y-auto p-6 md:p-8">
        <TradeJournal
          key={selectedJournal?.id ?? 'empty-journal'}
          journal={selectedJournal}
          isSidebarOpen={isSidebarOpen}
          onAddTrade={addTrade}
          onUpdateTrade={updateTrade}
          onDeleteTrade={deleteTrade}
          onUploadTradeImage={uploadTradeImage}
        />
      </div>
    </>
  )
}
export default MainJournal
