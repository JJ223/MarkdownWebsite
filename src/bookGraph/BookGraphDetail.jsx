import { genreRgb, LAYERS } from './bookGraphConfig.js'
import './BookGraphDetail.css'

export default function DetailPanel({ point, onClose }) {
  const isGenreColored = point.layer === 'read' || point.layer === 'suggestions' || point.layer === 'corpus'
  const rgb = isGenreColored
    ? genreRgb(point.genre)
    : (LAYERS[point.layer]?.rgb ?? { r: 180, g: 160, b: 255 })

  const layerLabel = { read: 'Read', want: 'Want to read', suggestions: 'Suggestion', corpus: 'Reference' }[point.layer] ?? point.layer

  return (
    <aside className="bg-detail">
      <button className="bg-detail-close" onClick={onClose} aria-label="Close">×</button>
      <span className="bg-detail-tag" style={{ '--c': `rgb(${rgb.r},${rgb.g},${rgb.b})` }}>
        {layerLabel}
      </span>
      <h3>{point.title}</h3>
      <p className="bg-detail-author">{point.author}</p>
      {point.layer === 'read' && (
        <dl>
          {point.genre && <div><dt>Genre</dt><dd>{point.genre}</dd></div>}
          <div>
            <dt>Rating</dt>
            <dd>{point.rating ? '★'.repeat(point.rating) + '☆'.repeat(5 - point.rating) : 'unrated'}</dd>
          </div>
        </dl>
      )}
      {point.layer === 'want' && <p className="bg-detail-note">On your to-read shelf.</p>}
      {point.layer === 'corpus' && (
        <dl>
          {point.genre && <div><dt>Genre</dt><dd>{point.genre}</dd></div>}
        </dl>
      )}
      {point.layer === 'suggestions' && (
        <dl>
          {point.genre && <div><dt>Genre</dt><dd>{point.genre}</dd></div>}
          {point.score != null && (
            <div><dt>Match</dt><dd>{(point.score * 100).toFixed(0)}%</dd></div>
          )}
          {point.because_you_read && (
            <div><dt>Because you read</dt><dd><em>{point.because_you_read}</em></dd></div>
          )}
        </dl>
      )}
    </aside>
  )
}
