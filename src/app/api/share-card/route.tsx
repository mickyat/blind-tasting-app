import { ImageResponse } from 'next/og'
import { getTranslations } from 'next-intl/server'
import { THEME_HEX } from '@/lib/theme'
import type { EventTheme } from '@/lib/types'

// Next.js 16 deprecated the `edge` runtime in favor of the default nodejs
// runtime (which now handles this workload equally well) - ImageResponse
// works identically either way, so no `export const runtime` override here.

const WIDTH = 1080
const HEIGHT = 1920

function isTheme(value: string | null): value is EventTheme {
  return !!value && value in THEME_HEX
}

// Satori (which ImageResponse/next-og uses) does not implement the Unicode
// bidi algorithm - verified against real rendered output, not assumed: it
// gets the POSITION of RTL vs LTR runs right (a Hebrew run appears in the
// correct place relative to embedded Latin words/digits/emoji), but reverses
// the character order *within* each contiguous Hebrew run instead of
// leaving it in logical order. Pre-reversing each Hebrew run here cancels
// that out. Only Hebrew-letter runs (plus embedded spaces/punctuation/
// digits so a run like "יין 4.35%" reverses as one unit) are touched -
// pure-Latin/emoji text is left completely alone.
const HEBREW_RUN = /[֐-׿](?:[֐-׿\s.,!?:;()'"0-9%-]*[֐-׿])?/g
function rtl(text: string): string {
  return text.replace(HEBREW_RUN, (run) => [...run].reverse().join(''))
}

// Satori (which ImageResponse uses) ships no default Hebrew glyphs, so
// Hebrew text would render as empty boxes without an explicit font - and
// crucially needs a genuinely *static* TTF: a variable-font buffer (what
// most current Google Fonts families ship, including Noto Sans Hebrew)
// crashes Satori's renderer entirely ("Cannot read properties of undefined
// (reading '256')"), tested and confirmed against a real local server, not
// assumed. "Alef" is one of the few Hebrew families Google Fonts still
// distributes as real static Regular/Bold TTFs, and covers basic Latin/
// digits too, so one family works for both locales.
async function loadFonts(origin: string) {
  const [regular, bold] = await Promise.all([
    fetch(new URL('/fonts/Alef-Regular.ttf', origin)).then((r) => r.arrayBuffer()),
    fetch(new URL('/fonts/Alef-Bold.ttf', origin)).then((r) => r.arrayBuffer()),
  ])
  return { regular, bold }
}

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url)

  const type = searchParams.get('type') === 'participant' ? 'participant' : 'winner'
  const locale = searchParams.get('locale') === 'en' ? 'en' : 'he'
  const themeId = searchParams.get('theme')
  const theme = isTheme(themeId) ? THEME_HEX[themeId] : THEME_HEX.default

  const eventTitle = searchParams.get('eventTitle') ?? ''
  const itemName = searchParams.get('itemName') ?? ''
  const itemImageUrl = searchParams.get('itemImageUrl') ?? ''
  const score = searchParams.get('score') ?? ''
  const nickname = searchParams.get('nickname') ?? ''
  const participantScore = searchParams.get('participantScore') ?? ''
  const isClosest = searchParams.get('isClosest') === 'true'
  const prizeDescription = searchParams.get('prizeDescription') ?? ''

  const t = await getTranslations({ locale, namespace: 'shareCard' })
  const { regular: fontRegular, bold: fontBold } = await loadFonts(origin)

  const cardBg = `linear-gradient(160deg, ${theme.bg} 0%, #0b0b0c 100%)`

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: cardBg,
          padding: '72px 64px',
          fontFamily: 'Alef',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'flex', color: theme.accent, fontSize: 34, fontWeight: 700 }}>
            🍷 {rtl(t('brandLine'))}
          </div>
        </div>

        {type === 'winner' ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 28,
              flex: 1,
              textAlign: 'center',
            }}
          >
            <div style={{ display: 'flex', color: theme.accent, fontSize: 48, fontWeight: 700 }}>
              {rtl(t('winnerHeadline'))}
            </div>
            {itemImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={itemImageUrl}
                width={560}
                height={560}
                style={{ borderRadius: 32, objectFit: 'cover', border: '6px solid rgba(255,255,255,0.25)' }}
              />
            )}
            <div style={{ display: 'flex', color: '#ffffff', fontSize: 76, fontWeight: 700, lineHeight: 1.1 }}>
              {rtl(itemName)}
            </div>
            <div style={{ display: 'flex', color: theme.muted, fontSize: 34 }}>{rtl(eventTitle)}</div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                background: 'rgba(255,255,255,0.12)',
                borderRadius: 24,
                padding: '20px 40px',
                marginTop: 12,
              }}
            >
              <span style={{ display: 'flex', color: theme.muted, fontSize: 30 }}>
                {rtl(t('winnerScoreLabel'))}
              </span>
              <span style={{ display: 'flex', color: '#ffffff', fontSize: 48, fontWeight: 700 }}>{score}</span>
            </div>
            {prizeDescription && (
              <div
                style={{
                  display: 'flex',
                  color: '#fde68a',
                  fontSize: 28,
                  fontWeight: 700,
                  textAlign: 'center',
                  maxWidth: 880,
                  marginTop: 8,
                }}
              >
                🎁 {rtl(prizeDescription)}
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 24,
              flex: 1,
              textAlign: 'center',
            }}
          >
            <div style={{ display: 'flex', color: theme.accent, fontSize: 44, fontWeight: 700 }}>
              {rtl(t('participantHeadline'))}
            </div>
            <div style={{ display: 'flex', color: '#ffffff', fontSize: 60, fontWeight: 700 }}>{rtl(nickname)}</div>
            <div style={{ display: 'flex', gap: 24, marginTop: 8 }}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.12)',
                  borderRadius: 24,
                  padding: '24px 36px',
                  gap: 8,
                }}
              >
                <span style={{ display: 'flex', color: theme.muted, fontSize: 26 }}>
                  {rtl(t('participantScoreLabel'))}
                </span>
                <span style={{ display: 'flex', color: '#ffffff', fontSize: 52, fontWeight: 700 }}>
                  {participantScore}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: 24,
                  padding: '24px 36px',
                  gap: 8,
                }}
              >
                <span style={{ display: 'flex', color: theme.muted, fontSize: 26 }}>
                  {rtl(t('averageScoreLabel'))}
                </span>
                <span style={{ display: 'flex', color: '#ffffff', fontSize: 52, fontWeight: 700 }}>{score}</span>
              </div>
            </div>
            {isClosest && (
              <div style={{ display: 'flex', color: '#fbbf24', fontSize: 32, fontWeight: 700, marginTop: 4 }}>
                {rtl(t('closestBadge'))}
              </div>
            )}
            <div style={{ display: 'flex', color: '#ffffff', fontSize: 44, fontWeight: 700, marginTop: 16 }}>
              {rtl(itemName)}
            </div>
            <div style={{ display: 'flex', color: theme.muted, fontSize: 30 }}>{rtl(eventTitle)}</div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'flex', color: theme.muted, fontSize: 26 }}>{rtl(t('footer'))}</div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [
        { name: 'Alef', data: fontRegular, weight: 400, style: 'normal' },
        { name: 'Alef', data: fontBold, weight: 700, style: 'normal' },
      ],
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    }
  )
}
