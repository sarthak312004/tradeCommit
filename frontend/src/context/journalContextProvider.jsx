import { useState } from "react"
import { journalContext } from "./Context"

function JournalContextProvider({children}){
    const [journals, setJournals] = useState([])
    const [selectedJournalId, setSelectedJournalId] = useState(null)

    const createJournal = (name) => {
        const newJournal = {
            id: Date.now(),
            name,
            updated: 'Just now',
            trades: []
        }

        setJournals((prev) => [...prev, newJournal])
        setSelectedJournalId((currentId) => currentId ?? newJournal.id)
    }

    const updateJournal = (id, name) => {
        setJournals((prev) => prev.map((journal) => (
            journal.id === id ? {...journal, name, updated: 'Just now'} : journal
        )))
    }

    // Remove only the journal that matches the id supplied by the sidebar.
    const deleteJournal = (id) => {
        setJournals((prev) => {
            const remainingJournals = prev.filter((journal) => journal.id !== id)

            setSelectedJournalId((currentId) => (
                currentId === id ? remainingJournals[0]?.id ?? null : currentId
            ))

            return remainingJournals
        })
    }

    const selectJournal = (id) => {
        setSelectedJournalId(id)
    }

    const addTrade = (journalId, trade) => {
        setJournals((prev) => prev.map((journal) => (
            journal.id === journalId
                ? {...journal, trades: [...journal.trades, trade], updated: 'Just now'}
                : journal
        )))
    }

    const updateTrade = (journalId, tradeId, updatedTrade) => {
        setJournals((prev) => prev.map((journal) => (
            journal.id === journalId
                ? {
                    ...journal,
                    trades: journal.trades.map((trade) => (
                        trade.id === tradeId ? {...trade, ...updatedTrade} : trade
                    )),
                    updated: 'Just now'
                }
                : journal
        )))
    }

    const deleteTrade = (journalId, tradeId) => {
        setJournals((prev) => prev.map((journal) => (
            journal.id === journalId
                ? {...journal, trades: journal.trades.filter((trade) => trade.id !== tradeId), updated: 'Just now'}
                : journal
        )))
    }

    const selectedJournal = journals.find((journal) => journal.id === selectedJournalId) ?? null

    return (
        <journalContext.Provider value={{
            journals,
            selectedJournal,
            createJournal,
            updateJournal,
            deleteJournal,
            selectJournal,
            addTrade,
            updateTrade,
            deleteTrade,
        }}>
            {children}
        </journalContext.Provider>
    )
}
export {JournalContextProvider}
