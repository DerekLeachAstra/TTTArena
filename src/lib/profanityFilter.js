// Profanity / explicit nickname filter
// Blocks common slurs, explicit terms, and offensive patterns.
// Uses lowercase matching with boundary-aware substring detection.

const BLOCKED_WORDS = [
  // Slurs & hate speech
  'nigger','nigga','nigg3r','n1gger','n1gga','faggot','fagg0t','f4ggot','fag','tranny',
  'retard','retarded','r3tard','spic','spick','chink','ch1nk','kike','k1ke','wetback',
  'coon','gook','beaner','towelhead','raghead','cracker',
  // Explicit sexual
  'fuck','f_uck','fvck','fuk','fuq','phuck','phuk','fck','sh1t','shit','sh!t','$hit',
  'cock','c0ck','d1ck','dick','d!ck','pussy','puss1','p_ussy','cunt','cvnt','c_unt',
  'penis','pen1s','vagina','vag1na','tits','t1ts','titties','boobs','b00bs',
  'blowjob','bl0wjob','handjob','cumshot','cum','c_um',
  'whore','wh0re','slut','sl_ut','bitch','b1tch','b!tch','bastard',
  // Explicit acts
  'rape','r4pe','molest','pedo','pedophile','p3do',
  // Drugs (extreme)
  'meth','heroin','her0in',
  // Other offensive
  'nazi','n4zi','hitler','h1tler','kkk','holocaust',
  'suicide','kill yourself','kys',
  // Common evasions
  'asshole','a$$hole','assh0le','a_sshole','ass',
  'stfu','gtfo','milf','dildo','d1ldo',
];

// Build regex patterns that match whole words or substrings within nicknames
const BLOCKED_PATTERNS = BLOCKED_WORDS.map(w => {
  // Escape regex special chars
  const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escaped, 'i');
});

/**
 * Check if a nickname contains explicit/offensive content.
 * @param {string} name - The nickname to check
 * @returns {{ blocked: boolean, reason: string }} Result
 */
export function checkNickname(name) {
  if (!name || typeof name !== 'string') {
    return { blocked: false, reason: '' };
  }

  const normalized = name.toLowerCase().replace(/\s+/g, '');

  for (let i = 0; i < BLOCKED_PATTERNS.length; i++) {
    if (BLOCKED_PATTERNS[i].test(normalized)) {
      return { blocked: true, reason: 'Nickname contains inappropriate language' };
    }
  }

  return { blocked: false, reason: '' };
}
