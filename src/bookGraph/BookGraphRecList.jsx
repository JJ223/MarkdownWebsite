export default function RecList({ title, items, accent }) {
  if (!items?.length) return null
  return (
    <div className="bg-reclist">
      <h4 style={{ '--c': accent }}>{title}</h4>
      <ol>
        {items.map((r, i) => (
          <li key={i}>
            <span className="bg-rec-rank">{i + 1}</span>
            <span className="bg-rec-body">
              <b>{r.title}</b>
              <span className="bg-rec-author">{r.author}{r.genre ? ` · ${r.genre}` : ''}</span>
              <small>because you read <em>{r.because_you_read}</em></small>
            </span>
            <span className="bg-rec-score">{(r.score * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
