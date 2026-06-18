import { useState, useRef } from 'react'

export default function Dropzone({ onFile, disabled }) {
  const inputRef = useRef(null)
  const [over, setOver] = useState(false)

  const handle = (file) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      onFile(null, 'Please upload the .csv file from Goodreads.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      onFile(null, 'That file is over 5 MB — is it the right export?')
      return
    }
    onFile(file)
  }

  return (
    <div
      className={`bg-drop${over ? ' over' : ''}${disabled ? ' disabled' : ''}`}
      role="button" tabIndex={0}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !disabled) inputRef.current?.click() }}
      onDragEnter={e => { e.preventDefault(); setOver(true) }}
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={e => { e.preventDefault(); setOver(false) }}
      onDrop={e => { e.preventDefault(); setOver(false); if (!disabled) handle(e.dataTransfer.files[0]) }}
    >
      <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
        <path d="M20 16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2" />
      </svg>
      <p className="bg-drop-main">Drop your <strong>goodreads_library_export.csv</strong></p>
      <p className="bg-drop-sub">or <span className="bg-link">choose a file</span></p>
      <input ref={inputRef} type="file" accept=".csv,text/csv" hidden
             onChange={e => { handle(e.target.files[0]); e.target.value = '' }} />
    </div>
  )
}
