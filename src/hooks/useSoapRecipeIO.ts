import { useCallback, useState } from 'react'
import type { ToastFn } from '../components/Toast'
import { useI18n } from '../i18n/I18nProvider'
import { localizeRuntimeMessage } from '../i18n/runtimeMessages'
import {
  deleteSoapRecipe,
  listCandleRecipes,
  listSoapRecipes,
  loadRecipesFromFile,
  saveSoapRecipe,
  shareLibrary,
  shareSoapRecipe,
  soapNameCollision,
  type SavedSoapRecipe,
  type ShareRecipesResult,
} from '../lib/storage'

export type SoapSavePayload = Omit<SavedSoapRecipe, 'id' | 'savedAt'> & { id?: string }

/**
 * Saved-library I/O for the soap calculator (list, save with name-collision
 * confirm, delete, load file, share). Keeps recipe-field state in the parent.
 */
export function useSoapRecipeIO(onToast?: ToastFn) {
  const { t, intlLocale } = useI18n()
  const [saved, setSaved] = useState<SavedSoapRecipe[]>(() => listSoapRecipes())
  const [showSaved, setShowSaved] = useState(false)
  const [activeRecipeId, setActiveRecipeId] = useState<string | null>(null)

  const refreshSaved = useCallback(() => setSaved(listSoapRecipes()), [])

  function persistSave(payload: SoapSavePayload): SavedSoapRecipe | null {
    const name =
      (payload.name || '').trim() ||
      t('recipe.defaultSoap', { date: new Date().toLocaleDateString(intlLocale) })
    const collision = soapNameCollision(name, activeRecipeId)
    if (collision && collision.id !== activeRecipeId) {
      const ok = window.confirm(t('recipe.confirmSoap', { name: collision.name }))
      if (!ok) return null
    }
    const { recipe, write, overwritten } = saveSoapRecipe({
      ...payload,
      id: activeRecipeId || payload.id || undefined,
      name,
    })
    if (!write.ok) {
      onToast?.(localizeRuntimeMessage(write.error, t, intlLocale), 'err')
      return null
    }
    setActiveRecipeId(recipe.id)
    setSaved(listSoapRecipes())
    onToast?.(
      overwritten ? t('toast.updated', { name: recipe.name }) : t('toast.saved', { name: recipe.name }),
      'ok',
    )
    return recipe
  }

  function removeSaved(id: string) {
    const write = deleteSoapRecipe(id)
    if (!write.ok) {
      onToast?.(localizeRuntimeMessage(write.error, t, intlLocale), 'err')
      return
    }
    if (activeRecipeId === id) setActiveRecipeId(null)
    refreshSaved()
    onToast?.(t('toast.deleted'), 'ok')
  }

  async function loadFromFile(file: File | null) {
    if (!file) return null
    try {
      const result = await loadRecipesFromFile(file)
      refreshSaved()
      if (!result.ok) {
        onToast?.(localizeRuntimeMessage(result.error, t, intlLocale), 'err')
        return null
      }
      return result
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Load failed'
      onToast?.(localizeRuntimeMessage(raw, t, intlLocale), 'err')
      return null
    }
  }

  async function shareOne(
    recipe: SavedSoapRecipe,
    plainText?: string,
  ): Promise<ShareRecipesResult | null> {
    const r = await shareSoapRecipe(recipe, plainText, {
      title: t('share.titleSoap', { name: recipe.name }),
      attachNote: t('share.attachNote'),
      tooLargeNote: t('share.tooLarge'),
    })
    if (r.mode === 'cancelled') return r
    onToast?.(localizeRuntimeMessage(r.message, t, intlLocale), r.ok ? 'ok' : 'err')
    return r
  }

  async function shareAll(): Promise<ShareRecipesResult | null> {
    const n = listSoapRecipes().length + listCandleRecipes().length
    const r = await shareLibrary({
      title: t('share.titleLibrary', { n }),
      plainText: t('share.libraryPlain'),
      attachNote: t('share.attachNote'),
      tooLargeNote: t('share.tooLarge'),
    })
    if (r.mode === 'cancelled') return r
    onToast?.(localizeRuntimeMessage(r.message, t, intlLocale), r.ok ? 'ok' : 'err')
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
