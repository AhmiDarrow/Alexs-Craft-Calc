import { useCallback, useState } from 'react'
import {
  candleNameCollision,
  deleteCandleRecipe,
  listCandleRecipes,
  loadRecipesFromFile,
  saveCandleRecipe,
  shareCandleRecipe,
  shareLibrary,
  type SavedCandleRecipe,
  type ShareRecipesResult,
} from '../lib/storage'

export type CandleSavePayload = Omit<SavedCandleRecipe, 'id' | 'savedAt'> & { id?: string }

/**
 * Saved-library I/O for the candle calculator (list, save with name-collision
 * confirm, delete, load file, share). Keeps recipe-field state in the parent.
 */
export function useCandleRecipeIO(onToast?: (msg: string) => void) {
  const [saved, setSaved] = useState<SavedCandleRecipe[]>(() => listCandleRecipes())
  const [showSaved, setShowSaved] = useState(false)
  const [activeRecipeId, setActiveRecipeId] = useState<string | null>(null)

  const refreshSaved = useCallback(() => setSaved(listCandleRecipes()), [])

  function persistSave(payload: CandleSavePayload): SavedCandleRecipe | null {
    const name =
      (payload.name || '').trim() || `Candle ${new Date().toLocaleDateString()}`
    const collision = candleNameCollision(name, activeRecipeId)
    if (collision && collision.id !== activeRecipeId) {
      const ok = window.confirm(
        `A saved candle recipe named “${collision.name}” already exists. Overwrite it?`,
      )
      if (!ok) return null
    }
    const { recipe, write, overwritten } = saveCandleRecipe({
      ...payload,
      id: activeRecipeId || payload.id || undefined,
      name,
    })
    if (!write.ok) {
      onToast?.(write.error)
      return null
    }
    setActiveRecipeId(recipe.id)
    refreshSaved()
    onToast?.(overwritten ? `Updated “${recipe.name}”` : `Saved “${recipe.name}”`)
    return recipe
  }

  function removeSaved(id: string) {
    const write = deleteCandleRecipe(id)
    if (!write.ok) {
      onToast?.(write.error)
      return
    }
    if (activeRecipeId === id) setActiveRecipeId(null)
    refreshSaved()
    onToast?.('Recipe deleted')
  }

  async function loadFromFile(file: File | null) {
    if (!file) return null
    try {
      const result = await loadRecipesFromFile(file)
      refreshSaved()
      if (!result.ok) {
        onToast?.(result.error)
        return null
      }
      return result
    } catch (e) {
      onToast?.(e instanceof Error ? e.message : 'Load failed')
      return null
    }
  }

  async function shareOne(
    recipe: SavedCandleRecipe,
    plainText?: string,
  ): Promise<ShareRecipesResult | null> {
    const r = await shareCandleRecipe(recipe, plainText)
    if (r.mode === 'cancelled') return r
    onToast?.(r.message)
    return r
  }

  async function shareAll(): Promise<ShareRecipesResult | null> {
    const r = await shareLibrary()
    if (r.mode === 'cancelled') return r
    onToast?.(r.message)
    return r
  }

  return {
    saved,
    showSaved,
    setShowSaved,
    activeRecipeId,
    setActiveRecipeId,
    refreshSaved,
    persistSave,
    removeSaved,
    loadFromFile,
    shareOne,
    shareAll,
  }
}
