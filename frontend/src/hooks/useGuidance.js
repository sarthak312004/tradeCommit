import { useContext } from 'react'
import { GuidanceContext } from '../context/guidanceContext'

/** The one guidance controller (see utils/guidance.js for the rules). */
export const useGuidance = () => useContext(GuidanceContext)
