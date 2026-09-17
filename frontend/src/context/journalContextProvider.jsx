import { useState } from "react"
import { journalContext } from "./Context"
import { journalRepository } from "../services/localStorageRepository"

const initialJournals = journalRepository.list()

function JournalContextProvider({children}){
    const [journals, setJournals] = useState(initialJournals)
    const [selectedJournalId, setSelectedJournalId] = useState(initialJournals[0]?.id ?? null)

    const createJournal = (name) => {
        const updatedJournals = journalRepository.create(name)
        const newJournal = updatedJournals[updatedJournals.length - 1]

        setJournals(updatedJournals)
        setSelectedJournalId((currentId) => currentId ?? newJournal.id)
    }

    const updateJournal = (id, name) => {
        setJournals(journalRepository.update(id, name))
    }

    // Remove only the journal that matches the id supplied by the sidebar.
    const deleteJournal = (id) => {
        const remainingJournals = journalRepository.remove(id)
        setJournals(remainingJournals)
        setSelectedJournalId((currentId) => (
            currentId === id ? remainingJournals[0]?.id ?? null : currentId
        ))
    }

    const selectJournal = (id) => {
        setSelectedJournalId(id)
    }

    const addTrade = (journalId, trade) => {
        setJournals(journalRepository.addTrade(journalId, trade))
    }

    const updateTrade = (journalId, tradeId, updatedTrade) => {
        setJournals(journalRepository.updateTrade(journalId, tradeId, updatedTrade))
    }

    const deleteTrade = (journalId, tradeId) => {
        setJournals(journalRepository.removeTrade(journalId, tradeId))
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
