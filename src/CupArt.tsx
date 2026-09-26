export function CupArt({ color = 'green', bowl = false, festival = false, small = false }: { color?: string; bowl?: boolean; festival?: boolean; small?: boolean }) {
  const colors: Record<string, [string, string]> = { green: ['#3e6351', '#294636'], orange: ['#c77852', '#a55c3c'], purple: ['#867796', '#695c78'] };
  const [body, shade] = colors[color] ?? colors.green;
  return <svg viewBox="0 0 280 310" fill="none" aria-hidden="true" className={small ? 'cup-art small' : 'cup-art'}>
    <ellipse cx="142" cy="282" rx="85" ry="11" fill="#173f35" opacity=".08" />
    {festival ? <>
      <path d="M62 71H218L199 257Q140 276 81 257Z" fill="#df744a" />
      <path d="M197 73H218L199 257L178 263Z" fill="#b94f36" opacity=".6" />
      <ellipse cx="140" cy="71" rx="78" ry="15" fill="#f69b68" />
      <ellipse cx="140" cy="72" rx="68" ry="9" fill="#954931" />
      <path d="M86 191Q109 152 136 193T192 190M88 206Q112 172 136 210T190 207" stroke="#ffe9b7" strokeWidth="7" strokeLinecap="round" />
      <path d="M147 111L128 143H143L135 166L160 131H143Z" fill="#ffe9b7" />
      <path d="M91 123L96 131M179 111L172 121M106 224L111 230M172 234L177 226" stroke="#ffe9b7" strokeWidth="6" strokeLinecap="round" />
    </> : bowl ? <>
      <path d="M38 146H242L214 252Q140 278 65 252Z" fill={body} />
      <ellipse cx="140" cy="146" rx="108" ry="25" fill={shade} />
      <ellipse cx="140" cy="137" rx="107" ry="23" fill="#c8c2b2" />
      <path d="M46 139Q140 170 233 139" stroke="#e4decc" strokeWidth="7" />
    </> : <>
      <path d="M57 84H225L205 255Q142 279 77 255Z" fill={body} />
      <path d="M199 89H225L205 255Q190 262 177 263Z" fill={shade} opacity=".5" />
      <path d="M60 94L77 252" stroke="#fff" strokeWidth="3" opacity=".13" />
      <ellipse cx="141" cy="87" rx="87" ry="20" fill={shade} />
      <path d="M48 75Q140 43 234 75V88Q139 122 48 88Z" fill="#c8c2b2" />
      <ellipse cx="141" cy="74" rx="93" ry="23" fill="#e5dfcc" />
      <ellipse cx="141" cy="70" rx="70" ry="14" stroke="#c1bba9" strokeWidth="3" />
      <rect x="166" y="61" width="31" height="7" rx="3.5" fill="#857f70" />
    </>}
    {!festival && <path d="M116 186A24 24 0 0 1 156 168M156 168V180M156 168H144M165 191A24 24 0 0 1 124 207M124 207V195M124 207H136" stroke="#f5f1df" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />}
    {!small && <text x="141" y="237" textAnchor="middle" fill="#f5f1df" fontFamily="Arial, sans-serif" fontSize="11" letterSpacing="3">PFANDLOOP</text>}
  </svg>;
}
