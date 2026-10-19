import ProfileMenu from '../profile/ProfileMenu'
import HeaderBackdropPicker from './header/HeaderBackdropPicker'
import HeaderScene from './header/HeaderScene'
import { useHeaderBackdrop } from '../../hooks/useHeaderBackdrop'
import { useIsDark } from '../../hooks/useIsDark'

function TopBar({ label = 'Journal', title }) {
  const { backdrop, chooseScene, clear, uploadImage } = useHeaderBackdrop()
  const dark = useIsDark()
  const hasImage = backdrop.mode === 'image'
  const hasScene = backdrop.mode === 'scene'

  // a picture can be any colour: it gets a dark scrim and white text. Scenes are tuned for the theme's own text colours.
  const labelColor = hasImage ? 'text-white/80' : 'text-zinc-600 dark:text-zinc-400'
  const titleColor = hasImage ? 'text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.45)]' : 'text-zinc-900 dark:text-zinc-50'

  return (
    <header
      className={`relative z-30 flex min-h-[72px] items-center justify-between gap-4 border-b border-zinc-300 px-6 py-3 shadow-sm dark:border-white/[0.10] dark:shadow-none ${
        hasImage || hasScene ? 'bg-transparent dark:bg-transparent' : 'bg-white/70 dark:bg-panel'
      }`}
    >
      {/* backdrop layer: clipped on its own so the profile and picker popovers can still open below the header */}
      {(hasImage || hasScene) && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          {hasScene && <HeaderScene sceneId={backdrop.scene} dark={dark} fixedScale />}
          {hasImage && (
            <>
              {/* sized by the window (not the header) and pinned to the header's right edge: collapsing the sidebar
                  reveals more of the picture on the left instead of zooming it, and nothing shifts while the sidebar animates */}
              <img
                src={backdrop.image}
                alt=""
                draggable="false"
                className="absolute right-0 top-1/2 max-w-none -translate-y-1/2 object-cover"
                style={{ width: '100vw', minHeight: '100%' }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/25 to-black/10" />
            </>
          )}
        </div>
      )}

      <div className="relative min-w-0">
        <p className={`truncate text-[11px] font-medium uppercase leading-4 tracking-[0.14em] ${labelColor}`}>{label}</p>
        {/* fixed line-height + normal tracking: crisp glyphs, and the title baseline never shifts with font fallback */}
        <h1 className={`mt-0.5 truncate text-2xl font-semibold leading-8 tracking-tight ${titleColor}`}>{title}</h1>
      </div>

      <div className={`relative flex items-center gap-1 ${hasImage ? 'text-white' : ''}`}>
        <HeaderBackdropPicker backdrop={backdrop} onChooseScene={chooseScene} onClear={clear} onUploadImage={uploadImage} />
        <ProfileMenu />
      </div>
    </header>
  )
}

export default TopBar
