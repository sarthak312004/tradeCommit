import { useEffect, useState } from "react"
import { journalContext } from "./Context"

import { DEFAULT_CURRENCY } from "../utils/currencies"
import { fetchPrefetched } from "../utils/prefetch"

const API_BASE = "/api/v1/journals"

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

const normalizeJournalForFrontend = (journal) => ({
    id: journal.id ?? journal._id,
    _id: journal._id,
    name: journal.name ?? journal.journalName ?? "Untitled journal",
    journalName: journal.journalName ?? journal.name ?? "Untitled journal",
    description: journal.description ?? "",
    currency: journal.currency ?? DEFAULT_CURRENCY,
    createdAt: journal.createdAt ?? new Date().toISOString(),
    updatedAt: journal.updatedAt ?? new Date().toISOString(),
    updated: "Just now",
    trades: (journal.trades ?? []).map((trade) => ({
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
    }))
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

    const createJournal = async (name, currency = DEFAULT_CURRENCY) => {
        const trimmed = name.trim()
        const response = await fetch(API_BASE, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: trimmed, currency })
        })

        const created = normalizeJournalForFrontend(await readJson(response))
        setJournals((current) => [...current, created])
        setSelectedJournalId((currentId) => currentId ?? created.id)
        return created
    }

    const updateJournal = async (id, name) => {
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

    const deleteJournal = async (id) => {
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

    const addTrade = async (journalId, trade) => {
        const response = await fetch(`${API_BASE}/${journalId}/trades`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(normalizeTradeForBackend(trade))
        })

        const created = await readJson(response)
        const normalizedTrade = {
            ...created,
            id: created.id ?? created._id,
            symbol: created.symbol ?? created.assetName ?? "",
            assetName: created.assetName ?? created.symbol ?? "",
            quantity: Number(created.quantity ?? created.qty ?? 0),
            qty: Number(created.quantity ?? created.qty ?? 0),
            direction: created.direction ?? created.side ?? "Long",
            side: created.side ?? created.direction ?? "Long",
            entry: created.entry ?? created.entryPrice ?? "",
            entryPrice: created.entryPrice ?? created.entry ?? "",
            exit: created.exit ?? created.exitPrice ?? "",
            exitPrice: created.exitPrice ?? created.exit ?? "",
            stopLoss: created.stopLoss ?? "",
            analysis: created.analysis ?? "",
            images: Array.isArray(created.images) ? created.images : [],
            customFields: Array.isArray(created.customFields) ? created.customFields : [],
            status: created.status ?? ((created.exit == null || created.exit === "") ? "Open" : "Closed"),
            pnl: created.pnl ?? "$0",
        }

        setJournals((current) => current.map((journal) => (
            journal.id === journalId
                ? { ...journal, trades: [...journal.trades, normalizedTrade], updated: "Just now" }
                : journal
        )))
        return normalizedTrade
    }

    const updateTrade = async (journalId, tradeId, updatedTrade) => {
        const response = await fetch(`${API_BASE}/${journalId}/trades/${tradeId}`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(normalizeTradeForBackend(updatedTrade))
        })

        const updated = await readJson(response)
        const normalizedTrade = {
            ...updated,
            id: updated.id ?? updated._id,
            symbol: updated.symbol ?? updated.assetName ?? "",
            assetName: updated.assetName ?? updated.symbol ?? "",
            quantity: Number(updated.quantity ?? updated.qty ?? 0),
            qty: Number(updated.quantity ?? updated.qty ?? 0),
            direction: updated.direction ?? updated.side ?? "Long",
            side: updated.side ?? updated.direction ?? "Long",
            entry: updated.entry ?? updated.entryPrice ?? "",
            entryPrice: updated.entryPrice ?? updated.entry ?? "",
            exit: updated.exit ?? updated.exitPrice ?? "",
            exitPrice: updated.exitPrice ?? updated.exit ?? "",
            stopLoss: updated.stopLoss ?? "",
            analysis: updated.analysis ?? "",
            images: Array.isArray(updated.images) ? updated.images : [],
            customFields: Array.isArray(updated.customFields) ? updated.customFields : [],
            status: updated.status ?? ((updated.exit == null || updated.exit === "") ? "Open" : "Closed"),
            pnl: updated.pnl ?? "$0",
        }

        setJournals((current) => current.map((journal) => (
            journal.id === journalId
                ? { ...journal, trades: journal.trades.map((trade) => trade.id === tradeId ? normalizedTrade : trade), updated: "Just now" }
                : journal
        )))
        return normalizedTrade
    }

    const deleteTrade = async (journalId, tradeId) => {
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
            deleteJournal,
            selectJournal,
            uploadTradeImage,
            addTrade,
            updateTrade,
            deleteTrade,
        }}>
            {children}
        </journalContext.Provider>
    )
}
export {JournalContextProvider}
