// Small, decorative food illustrations on a shared 40px canvas.
export default function MealSlotArt({ slot }) {
  return <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true" focusable="false">
    {slot === 'breakfast' ? <>
      <path d="M8 22h18v4a6 6 0 0 1-6 6h-6a6 6 0 0 1-6-6z" fill="#f4a664" stroke="#754a31" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M26 23h2a3 3 0 0 1 0 6h-3" fill="none" stroke="#754a31" strokeWidth="1.5"/>
      <path d="M12 18c-2-3 2-4 0-7m6 7c-2-3 2-4 0-7" fill="none" stroke="#d2815b" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M7 33h22" stroke="#754a31" strokeWidth="1.5" strokeLinecap="round"/>
    </> : slot === 'lunch' ? <>
      <path d="M6 22h28c-.5 7-5 11-14 11S6.5 29 6 22Z" fill="#ef956c" stroke="#754a31" strokeWidth="1.5" strokeLinejoin="round"/>
      <ellipse cx="20" cy="22" rx="14" ry="4" fill="#f8cc81" stroke="#754a31" strokeWidth="1.5"/>
      <path d="M13 20c0-3 3-4 4-2m8 2c0-3-3-4-4-2" fill="none" stroke="#4c9466" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="20" cy="22" r="2" fill="#e46b52"/>
    </> : <>
      <circle cx="20" cy="21" r="14" fill="#dcefeb" stroke="#658d86" strokeWidth="1.5"/>
      <circle cx="20" cy="21" r="9.5" fill="#fffaf0" stroke="#a8c5ba" strokeWidth="1"/>
      <path d="M14 22c1-5 5-8 10-5 4 3 1 8-3 9-3 1-6 0-7-4Z" fill="#eea15f"/>
      <path d="M14 17c1-3 4-4 6-2m3 11c2-3 5-3 6-1" fill="none" stroke="#559b70" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="17" cy="21" r="1.5" fill="#df6c52"/>
    </>}
  </svg>;
}
