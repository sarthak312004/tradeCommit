import { useEffect, useRef, useState } from "react"
import { journalContext } from "./Context"

import { DEFAULT_CURRENCY } from "../utils/currencies"
import { fetchPrefetched } from "../utils/prefetch"

const API_BASE = "/api/v1/journals"
const TEMP_PREFIX = "pending-"
const isPending = (id) => String(id).startsWith(TEMP_PREFIX)

const extractImagesFromAnalysis = (analysis) => {
    if (typeof analysis !== "string") return []

    const matches = [...analysis.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)]
    const urls = matches.map((match) => match[1]).filter(Boolean)
    return [...new Set(urls)]
}

const normalizeTradeForBackend = (trade) => {
    const rawDirection = String((trade.direction ?? trade.side ?? "Long")).trim()
    const normalizedDirection = rawDirection.toLowerCase() === "short" ? "short" : "long"
    const assetName = String(trade.assetName ?? trade.symbol ?? "").trim()
    const quantity = Number(trade.quantity ?? trade.qty ?? 0)
    const entryPrice = Number(trade.entryPrice ?? trade.entry ?? 0)
    const exitPriceValue = trade.exitPrice ?? trade.exit ?? ""
    const exitPrice = exitPriceValue === "" || exitPriceValue === null || exitPriceValue === undefined ? "" : Number(exitPriceValue)
    const stopLoss = trade.stopLoss === "" || trade.stopLoss === null || trade.stopLoss === undefined ? "" : Number(trade.stopLoss)

    return {
        assetName,
        symbol: assetName,
        date: trade.date ?? new Date().toISOString().slice(0, 10),
        quantity,
        qty: quantity,
        direction: normalizedDirection,
        side: normalizedDirection,
        entryPrice,
        entry: entryPrice,
        exitPrice,
        exit: exitPrice,
        stopLoss,
        analysis: trade.analysis ?? "",
        images: [...new Set([
            ...(Array.isArray(trade.images) ? trade.images : []),
            ...extractImagesFromAnalysis(trade.analysis ?? ""),
        ])],
        customFields: Array.isArray(trade.customFields) ? trade.customFields : [],
        removedImages: Array.isArray(trade.removedImages) ? trade.removedImages : [],
    }
}

const normalizeContext = (context) => ({
    strategy: context?.strategy ?? "",
    attributes: Array.isArray(context?.attributes)
        ? context.attributes.map(({ key, label, type, value }) => ({ key, label, type, value }))
        : [],
})

const normalizeTradeForFrontend = (trade) => ({
    id: trade.id ?? trade._id,
    symbol: trade.symbol ?? trade.assetName ?? "",
    assetName: trade.assetName ?? trade.symbol ?? "",
    date: trade.date ?? "",
    quantity: Number(trade.quantity ?? trade.qty ?? 0),
    qty: Number(trade.quantity ?? trade.qty ?? 0),
    direction: trade.direction ?? trade.side ?? "Long",
    side: trade.side ?? trade.direction ?? "Long",
    entry: trade.entry ?? trade.entryPrice ?? "",
    entryPrice: trade.entryPrice ?? trade.entry ?? "",
    exit: trade.exit ?? trade.exitPrice ?? "",
    exitPrice: trade.exitPrice ?? trade.exit ?? "",
    stopLoss: trade.stopLoss ?? "",
    analysis: trade.analysis ?? "",
    images: Array.isArray(trade.images) ? trade.images : [],
    customFields: Array.isArray(trade.customFields) ? trade.customFields : [],
    status: trade.status ?? ((trade.exit == null || trade.exit === "") ? "Open" : "Closed"),
    pnl: trade.pnl ?? "$0",
    createdAt: trade.createdAt ?? new Date().toISOString(),
    updatedAt: trade.updatedAt ?? new Date().toISOString(),
})

const saveErrorText = (error, fallback) =>
    error instanceof TypeError ? "Can't reach the server. Check your connection and retry." : error?.message || fallback

const normalizeJournalForFrontend = (journal) => ({
    id: journal.id ?? journal._id,
    _id: journal._id,
    name: journal.name ?? journal.journalName ?? "Untitled journal",
    journalName: journal.journalName ?? journal.name ?? "Untitled journal",
    description: journal.description ?? "",
    currency: journal.currency ?? DEFAULT_CURRENCY,
    context: normalizeContext(journal.context),
    createdAt: journal.createdAt ?? new Date().toISOString(),
    updatedAt: journal.updatedAt ?? new Date().toISOString(),
    updated: "Just now",
    trades: (journal.trades ?? []).map(normalizeTradeForFrontend),
})

const readJson = async (response) => {
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
        if (response.status === 401) {
            window.dispatchEvent(new Event("auth-expired"))
        }
        throw new Error(payload?.message ?? "Request failed")
    }
    return payload?.data
}

function JournalContextProvider({children}){
    const [journals, setJournals] = useState([])
    const [selectedJournalId, setSelectedJournalId] = useState(null)
    // retry / discard handlers of trades whose save is running or failed, by trade id
    const tradeSyncRef = useRef(new Map())

    useEffect(() => {
        let latestLoad = 0

        const loadJournals = async () => {
            const loadId = ++latestLoad
            try {
                // No separate auth pre-flight: the journals request itself answers 401 when logged out.
                // On first load this reuses the request index.html started before the bundle arrived.
                const response = await fetchPrefetched("journals", API_BASE)
                if (response.status === 401) {
                    if (loadId === latestLoad) {
                        setJournals([])
                        setSelectedJournalId(null)
                    }
                    return
                }

                const rows = await readJson(response)
                const nextJournals = (rows ?? []).map(normalizeJournalForFrontend)
                if (loadId !== latestLoad) return
                setJournals(nextJournals)
                setSelectedJournalId((currentId) => currentId ?? nextJournals[0]?.id ?? null)
            } catch {
                if (loadId === latestLoad) {
                    setJournals([])
                    setSelectedJournalId(null)
                }
            }
        }

        window.addEventListener("auth-state-changed", loadJournals)
        loadJournals()

        return () => {
            latestLoad += 1
            window.removeEventListener("auth-state-changed", loadJournals)
        }
    }, [])

    const hasUnsavedTrades = journals.some((journal) => journal.trades.some((trade) => trade.syncState))
    useEffect(() => {
        if (!hasUnsavedTrades) return undefined
        const warn = (event) => event.preventDefault()
        window.addEventListener("beforeunload", warn)
        return () => window.removeEventListener("beforeunload", warn)
    }, [hasUnsavedTrades])

    // Optimistic: the journal shows up in the sidebar the moment the form closes, under a temporary id,
    // and is swapped for the saved one when the server answers. If the request fails it is removed again.
    const createJournal = async (name, currency = DEFAULT_CURRENCY) => {
        const trimmed = name.trim()
        const tempId = `${TEMP_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const placeholder = normalizeJournalForFrontend({ id: tempId, _id: tempId, name: trimmed, currency, trades: [] })

        setJournals((current) => [...current, placeholder])

        try {
            const response = await fetch(API_BASE, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: trimmed, currency })
            })

            const created = normalizeJournalForFrontend(await readJson(response))
            setJournals((current) => current.map((journal) => journal.id === tempId ? created : journal))
            setSelectedJournalId((currentId) => currentId ?? created.id)
            return created
        } catch (error) {
            setJournals((current) => current.filter((journal) => journal.id !== tempId))
            throw error
        }
    }

    const updateJournal = async (id, name) => {
        if (isPending(id)) return // still being saved; there is nothing on the server to rename yet
        const trimmed = name.trim()
        const response = await fetch(`${API_BASE}/${id}`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: trimmed })
        })

        const updated = normalizeJournalForFrontend(await readJson(response))
        setJournals((current) => current.map((journal) => journal.id === id ? updated : journal))
        return updated
    }

    // Saves the journal's strategy description and default trade properties (see JournalContextDialog).
    const updateJournalContext = async (id, context, { applyToExisting = true } = {}) => {
        if (isPending(id)) throw new Error("This journal is still being created. Try again in a moment.")
        const response = await fetch(`${API_BASE}/${id}`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ context, applyToExistingTrades: applyToExisting })
        })

        const saved = normalizeJournalForFrontend(await readJson(response))
        // When asked to, the server also applies the context to trades logged earlier, so take their refreshed
        // properties. Everything else on a trade stays as it is in memory (including trades still being saved).
        const savedFields = new Map(applyToExisting ? (saved.trades ?? []).map((trade) => [String(trade.id), trade.customFields]) : [])
        setJournals((current) => current.map((journal) => journal.id === id ? {
            ...journal,
            context: saved.context,
            trades: journal.trades.map((trade) => savedFields.has(String(trade.id)) ? { ...trade, customFields: savedFields.get(String(trade.id)) } : trade)
        } : journal))
        return saved.context
    }

    const deleteJournal = async (id) => {
        if (isPending(id)) throw new Error("This journal is still being created. Try again in a moment.")
        const response = await fetch(`${API_BASE}/${id}`, {
            method: "DELETE",
            credentials: "include",
        })
        await readJson(response)

        setJournals((current) => {
            const remaining = current.filter((journal) => journal.id !== id)
            setSelectedJournalId((currentId) => currentId === id ? remaining[0]?.id ?? null : currentId)
            return remaining
        })
    }

    const selectJournal = (id) => {
        if (isPending(id)) return // the real id (and its trades) only exist once the server has answered
        setSelectedJournalId(id)
    }

    const uploadTradeImage = async (journalId, file) => {
        const formData = new FormData()
        formData.append("image", file)

        const response = await fetch(`${API_BASE}/${journalId}/trades/images`, {
            method: "POST",
            credentials: "include",
            body: formData,
        })

        const uploadedImage = await readJson(response)
        return uploadedImage.url
    }

    const patchTrade = (journalId, tradeId, change) => {
        setJournals((current) => current.map((journal) => (
            journal.id !== journalId ? journal : {
                ...journal,
                updated: "Just now",
                trades: journal.trades.map((trade) => trade.id !== tradeId ? trade : (typeof change === "function" ? change(trade) : { ...trade, ...change })),
            }
        )))
    }

    // Optimistic: the card appears at the top the moment the form closes, marked "Saving...". `prepare` (from the
    // form) finishes any screenshot uploads in the background, then the trade is sent. When the server answers,
    // the card is swapped for the saved trade in place. If anything fails the card stays, marked with Retry / Discard.
    const addTrade = (journalId, trade, { prepare } = {}) => {
        const tempId = `${TEMP_PREFIX}trade-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const placeholder = {
            ...normalizeTradeForFrontend({ ...trade, id: tempId, createdAt: new Date().toISOString() }),
            syncState: "saving",
            syncError: "",
        }
        setJournals((current) => current.map((journal) => (
            journal.id === journalId ? { ...journal, trades: [placeholder, ...journal.trades], updated: "Just now" } : journal
        )))

        const save = async () => {
            patchTrade(journalId, tempId, { syncState: "saving", syncError: "" })
            try {
                const ready = prepare ? await prepare() : trade
                const response = await fetch(`${API_BASE}/${journalId}/trades`, {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(normalizeTradeForBackend(ready))
                })
                const created = normalizeTradeForFrontend(await readJson(response))
                tradeSyncRef.current.delete(tempId)
                patchTrade(journalId, tempId, () => created)
                return created
            } catch (error) {
                patchTrade(journalId, tempId, { syncState: "failed", syncError: saveErrorText(error, "Could not save this trade.") })
                return null
            }
        }

        tradeSyncRef.current.set(tempId, {
            retry: save,
            discard: () => setJournals((current) => current.map((journal) => (
                journal.id === journalId ? { ...journal, trades: journal.trades.filter((item) => item.id !== tempId) } : journal
            ))),
        })
        return save()
    }

    // Same idea for edits: the card shows the new values straight away; if saving fails it offers Retry,
    // or "Undo changes" to go back to the version that was last saved.
    const updateTrade = (journalId, tradeId, updatedTrade, { prepare } = {}) => {
        const previous = journals.find((journal) => journal.id === journalId)?.trades.find((trade) => trade.id === tradeId)
        patchTrade(journalId, tradeId, {
            ...normalizeTradeForFrontend({ ...updatedTrade, id: tradeId, createdAt: previous?.createdAt }),
            syncState: "saving",
            syncError: "",
        })

        const save = async () => {
            patchTrade(journalId, tradeId, { syncState: "saving", syncError: "" })
            try {
                const ready = prepare ? await prepare() : updatedTrade
                const response = await fetch(`${API_BASE}/${journalId}/trades/${tradeId}`, {
                    method: "PATCH",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(normalizeTradeForBackend(ready))
                })
                const saved = normalizeTradeForFrontend(await readJson(response))
                tradeSyncRef.current.delete(tradeId)
                patchTrade(journalId, tradeId, () => saved)
                return saved
            } catch (error) {
                patchTrade(journalId, tradeId, { syncState: "failed", syncError: saveErrorText(error, "Could not save your changes.") })
                return null
            }
        }

        tradeSyncRef.current.set(tradeId, {
            retry: save,
            discard: () => previous && patchTrade(journalId, tradeId, () => previous),
        })
        return save()
    }

    const retryTradeSave = (tradeId) => tradeSyncRef.current.get(tradeId)?.retry()

    const discardTradeSave = (tradeId) => {
        tradeSyncRef.current.get(tradeId)?.discard()
        tradeSyncRef.current.delete(tradeId)
    }

    const deleteTrade = async (journalId, tradeId) => {
        if (isPending(tradeId)) return discardTradeSave(tradeId) // never reached the server, so just drop the card
        const response = await fetch(`${API_BASE}/${journalId}/trades/${tradeId}`, {
            method: "DELETE",
            credentials: "include",
        })
        await readJson(response)

        setJournals((current) => current.map((journal) => (
            journal.id === journalId
                ? { ...journal, trades: journal.trades.filter((trade) => trade.id !== tradeId), updated: "Just now" }
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
            updateJournalContext,
            deleteJournal,
            selectJournal,
            uploadTradeImage,
            addTrade,
            updateTrade,
            retryTradeSave,
            discardTradeSave,
            deleteTrade,
        }}>
            {children}
        </journalContext.Provider>
    )
}
export {JournalContextProvider}
