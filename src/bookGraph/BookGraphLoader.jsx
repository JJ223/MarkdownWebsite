export default function Loader({ step, pct }) {
  return (
    <div className="bg-loader">
      <div className="bg-loader-orbit"><span /><span /><span /></div>
      <p className="bg-loader-step">{step}</p>
      <div className="bg-progress"><div style={{ width: `${pct}%` }} /></div>
    </div>
  )
}
