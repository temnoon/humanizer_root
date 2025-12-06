/**
 * Client-Side Encryption Service
 *
 * Zero-trust encryption: all encryption/decryption happens in browser.
 * Server never sees plaintext or encryption keys.
 *
 * Uses AES-GCM with PBKDF2 key derivation.
 */

// Key derivation parameters
const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 256;
const SALT_LENGTH = 32;
const IV_LENGTH = 12;

// Word list for passphrase generation (EFF short word list subset - common, memorable words)
const PASSPHRASE_WORDS = [
  'acid', 'acorn', 'acre', 'aged', 'agent', 'agile', 'aging', 'agony', 'agree',
  'aide', 'aimed', 'ajar', 'alarm', 'album', 'alert', 'alike', 'alive', 'aloe',
  'aloft', 'alone', 'amaze', 'amber', 'amuse', 'angel', 'anger', 'angle', 'ankle',
  'apart', 'apex', 'apple', 'april', 'apron', 'aqua', 'arena', 'argue', 'arise',
  'armor', 'army', 'aroma', 'arose', 'array', 'arrow', 'arson', 'ashen', 'aside',
  'atlas', 'atom', 'attic', 'audio', 'avert', 'avoid', 'awake', 'award', 'bacon',
  'badge', 'badly', 'bagel', 'baggy', 'baker', 'balmy', 'banjo', 'basic', 'basin',
  'batch', 'beach', 'beast', 'began', 'begin', 'being', 'belly', 'bench', 'berry',
  'birth', 'black', 'blade', 'blame', 'blank', 'blast', 'blaze', 'bleak', 'blend',
  'bless', 'blimp', 'blind', 'bliss', 'block', 'blond', 'bloom', 'blown', 'blunt',
  'blurb', 'blurt', 'blush', 'board', 'boast', 'boat', 'body', 'bogus', 'boil',
  'bold', 'bolt', 'bomb', 'bond', 'bone', 'bonus', 'book', 'booth', 'boots',
  'booze', 'boss', 'both', 'boxer', 'brain', 'brand', 'brass', 'brave', 'bread',
  'break', 'breed', 'brick', 'bride', 'brief', 'bring', 'brink', 'brisk', 'broad',
  'broil', 'broke', 'brook', 'broom', 'broth', 'brush', 'buddy', 'buggy', 'build',
  'built', 'bulge', 'bulk', 'bully', 'bunch', 'bunny', 'burst', 'cabin', 'cable',
  'cache', 'cadet', 'cage', 'cake', 'calm', 'camel', 'camp', 'canal', 'candy',
  'cane', 'cape', 'card', 'cargo', 'carol', 'carry', 'carve', 'catch', 'cause',
  'cave', 'cease', 'cedar', 'chair', 'chalk', 'champ', 'charm', 'chart', 'chase',
  'cheap', 'check', 'cheek', 'cheer', 'chess', 'chest', 'chick', 'chief', 'child',
  'chill', 'chimp', 'china', 'chirp', 'chive', 'choir', 'choke', 'chord', 'chore',
  'chose', 'chunk', 'churn', 'cider', 'cigar', 'cinch', 'city', 'civic', 'civil',
  'clad', 'claim', 'clamp', 'clap', 'clash', 'clasp', 'class', 'claw', 'clay',
  'clean', 'clear', 'clerk', 'click', 'cliff', 'climb', 'cling', 'cloak', 'clock',
  'clone', 'close', 'cloth', 'cloud', 'clout', 'clown', 'club', 'cluck', 'clue',
  'clump', 'clung', 'coach', 'coast', 'coat', 'cobra', 'cocoa', 'coil', 'coin',
  'cold', 'colon', 'color', 'comet', 'comic', 'comma', 'cone', 'coral', 'cork',
  'corn', 'couch', 'cough', 'count', 'court', 'cover', 'cozy', 'craft', 'cramp',
  'crane', 'crank', 'crash', 'crate', 'crawl', 'crazy', 'creak', 'cream', 'creek',
  'creep', 'crest', 'crisp', 'cross', 'crowd', 'crown', 'crude', 'cruel', 'crush',
  'crust', 'cubic', 'curry', 'curve', 'cycle', 'daily', 'dairy', 'daisy', 'dance',
  'dated', 'dealt', 'decay', 'decor', 'decoy', 'delta', 'denim', 'dense', 'depot',
  'depth', 'derby', 'desk', 'diary', 'diner', 'disco', 'ditch', 'diver', 'dizzy',
  'dodge', 'doing', 'doll', 'donor', 'donut', 'doubt', 'dough', 'dozen', 'draft',
  'drain', 'drama', 'drank', 'drape', 'drawl', 'drawn', 'dread', 'dream', 'dress',
  'drift', 'drill', 'drink', 'drive', 'droit', 'drown', 'drum', 'drunk', 'dryer',
  'dual', 'dude', 'dug', 'duke', 'dull', 'dummy', 'dune', 'dunce', 'dusk', 'dust',
  'duty', 'dwarf', 'dwell', 'eagle', 'early', 'earth', 'easel', 'eaten', 'eater',
  'ebony', 'edge', 'eerie', 'eight', 'elbow', 'elder', 'elect', 'elite', 'elope',
  'elude', 'elves', 'ember', 'empty', 'ended', 'enjoy', 'enter', 'entry', 'equal',
  'equip', 'erase', 'erupt', 'essay', 'ethic', 'evade', 'event', 'every', 'exact',
  'exile', 'extra', 'fable', 'facet', 'fact', 'fade', 'faint', 'fairy', 'faith',
  'false', 'fancy', 'fang', 'favor', 'feast', 'feed', 'fence', 'fern', 'ferry',
  'fest', 'fetch', 'fever', 'fiber', 'fifth', 'fifty', 'film', 'filth', 'final',
  'finch', 'first', 'fish', 'fist', 'five', 'fixed', 'fizz', 'flair', 'flak',
  'flame', 'flap', 'flash', 'flask', 'flat', 'flaw', 'flax', 'flea', 'fled',
  'fleet', 'flesh', 'flick', 'fling', 'flint', 'flip', 'flit', 'float', 'flock',
  'flood', 'floor', 'flop', 'flour', 'flown', 'fluid', 'fluke', 'flung', 'flunk',
  'flush', 'flute', 'foam', 'focal', 'focus', 'foggy', 'foil', 'folk', 'folly',
  'font', 'forge', 'form', 'fort', 'forum', 'fossil', 'found', 'fox', 'foyer',
  'frail', 'frame', 'frank', 'fraud', 'freak', 'freed', 'fresh', 'fried', 'frill',
  'frisk', 'frizz', 'frock', 'from', 'front', 'frost', 'froth', 'frown', 'froze',
  'fruit', 'fudge', 'fuel', 'fully', 'fungi', 'funky', 'funny', 'fuse', 'fussy',
  'giant', 'gift', 'giddy', 'given', 'giver', 'glad', 'gland', 'glare', 'glass',
  'glaze', 'gleam', 'glide', 'glint', 'globe', 'gloom', 'glory', 'gloss', 'glove',
  'glow', 'glue', 'goal', 'goat', 'going', 'gold', 'golf', 'gone', 'gong', 'good',
  'goofy', 'goose', 'gorge', 'gourd', 'gown', 'grace', 'grade', 'grain', 'grand',
  'grant', 'grape', 'graph', 'grasp', 'grass', 'grave', 'gravy', 'gray', 'graze',
  'great', 'greed', 'green', 'greet', 'grey', 'grief', 'grill', 'grim', 'grind',
  'grip', 'groan', 'groom', 'grope', 'gross', 'group', 'grove', 'growl', 'grown',
  'grub', 'grunt', 'guard', 'guess', 'guest', 'guide', 'guild', 'guilt', 'guise',
  'gulf', 'gulp', 'guru', 'gust', 'habit', 'hair', 'half', 'halo', 'halt', 'happy',
  'hardy', 'harm', 'harp', 'hash', 'haunt', 'haven', 'hazel', 'hazy', 'heap',
  'heart', 'heat', 'heave', 'heavy', 'hedge', 'hefty', 'hello', 'hence', 'herb',
  'herd', 'hero', 'heron', 'hinge', 'hippo', 'hitch', 'hobby', 'hoist', 'hold',
  'holly', 'holy', 'homer', 'honey', 'honor', 'hood', 'hoof', 'hook', 'hoop',
  'hope', 'horn', 'horse', 'hose', 'host', 'hotel', 'hound', 'house', 'hover',
  'howl', 'hub', 'hug', 'hull', 'human', 'humid', 'humor', 'hump', 'hunch', 'hurry',
  'hush', 'husky', 'ivory', 'jazz', 'jelly', 'jewel', 'joint', 'joker', 'jolly',
  'jolt', 'joust', 'judge', 'juice', 'juicy', 'jumbo', 'jumpy', 'junky', 'jury',
  'kayak', 'kebab', 'keep', 'kelp', 'ketch', 'kick', 'king', 'kiosk', 'kite',
  'kitty', 'kiwi', 'knack', 'knee', 'knelt', 'knife', 'knit', 'knock', 'knot',
  'known', 'koala', 'label', 'lace', 'lad', 'lake', 'lamb', 'lamp', 'lance',
  'land', 'lane', 'large', 'laser', 'lasso', 'latch', 'later', 'lathe', 'laugh',
  'lava', 'layer', 'lead', 'leaf', 'lean', 'leap', 'learn', 'lease', 'leash',
  'least', 'leave', 'ledge', 'legal', 'lemon', 'lemur', 'lend', 'lens', 'lever',
  'light', 'lilac', 'lily', 'limb', 'limit', 'limp', 'linen', 'liner', 'linger',
  'lion', 'lipid', 'liver', 'llama', 'lobby', 'local', 'locus', 'lodge', 'lofty',
  'logic', 'logo', 'lone', 'long', 'look', 'loom', 'loop', 'loose', 'lord',
  'lorry', 'lotus', 'loud', 'love', 'lover', 'lower', 'loyal', 'lucid', 'lucky',
  'lunar', 'lunch', 'lurch', 'lure', 'lurk', 'lusty', 'lyric', 'magic', 'magma',
  'maid', 'major', 'maker', 'mango', 'manor', 'maple', 'march', 'marry', 'marsh',
  'mask', 'match', 'mayor', 'melon', 'mercy', 'merge', 'merit', 'merry', 'mesh',
  'metal', 'midst', 'might', 'mince', 'minor', 'minus', 'mirth', 'miser', 'misty',
  'mixer', 'mocha', 'model', 'moist', 'molar', 'money', 'month', 'moody', 'moose',
  'moral', 'morse', 'mossy', 'motel', 'moth', 'motor', 'motto', 'mound', 'mount',
  'mouse', 'mouth', 'movie', 'mower', 'muddy', 'mummy', 'mural', 'music', 'musty',
  'muted', 'nacho', 'nasal', 'nasty', 'naval', 'navel', 'nerve', 'never', 'newer',
  'newly', 'nicer', 'nifty', 'night', 'ninja', 'ninth', 'noble', 'noise', 'north',
  'notch', 'noted', 'novel', 'nudge', 'nurse', 'nutty', 'nylon', 'oasis', 'ocean',
  'offer', 'often', 'olive', 'omega', 'onion', 'onset', 'opera', 'orbit', 'order',
  'organ', 'other', 'otter', 'ought', 'ounce', 'outer', 'outdo', 'ovary', 'overt',
  'owner', 'oxide', 'ozone', 'pagan', 'paint', 'panda', 'panic', 'pansy', 'paper',
  'park', 'party', 'pasta', 'patch', 'path', 'patio', 'pause', 'peach', 'pearl',
  'pecan', 'pedal', 'penny', 'perch', 'peril', 'perky', 'petal', 'petty', 'photo',
  'piano', 'piece', 'pilot', 'pinch', 'piney', 'pink', 'piper', 'pitch', 'pizza',
  'place', 'plaid', 'plain', 'plane', 'plank', 'plant', 'plate', 'plaza', 'plead',
  'pleat', 'pledge', 'plod', 'plop', 'plot', 'plow', 'pluck', 'plug', 'plum',
  'plumb', 'plume', 'plump', 'plunk', 'plus', 'plush', 'poach', 'poem', 'poet',
  'point', 'poise', 'poker', 'polar', 'pond', 'pony', 'poppy', 'porch', 'pork',
  'pose', 'posse', 'post', 'pouch', 'pound', 'power', 'prank', 'prawn', 'press',
  'price', 'pride', 'prime', 'print', 'prior', 'prism', 'prize', 'probe', 'prong',
  'proof', 'props', 'prose', 'proud', 'prowl', 'prune', 'psalm', 'public', 'pudgy',
  'pulp', 'pulse', 'punch', 'pupil', 'puppy', 'purge', 'purse', 'pushy', 'quack',
  'qualm', 'quart', 'queen', 'query', 'quest', 'quick', 'quiet', 'quill', 'quilt',
  'quirk', 'quota', 'quote', 'rabbi', 'racer', 'radar', 'radio', 'raft', 'rage',
  'rainy', 'raise', 'rally', 'ramp', 'ranch', 'range', 'rapid', 'rash', 'raspy',
  'ratio', 'raven', 'rayon', 'razor', 'reach', 'react', 'realm', 'rebel', 'recap',
  'regal', 'rehab', 'reign', 'relax', 'relay', 'relic', 'remix', 'repay', 'reply',
  'reset', 'resin', 'retro', 'rhino', 'rhyme', 'ridge', 'rigor', 'rinse', 'ripen',
  'risen', 'risky', 'rival', 'river', 'roast', 'robe', 'robin', 'robot', 'rocky',
  'rodeo', 'rogue', 'romp', 'roost', 'root', 'rope', 'rosy', 'rot', 'rotor',
  'rouge', 'rough', 'round', 'route', 'rover', 'rowdy', 'royal', 'ruby', 'rude',
  'rugby', 'ruin', 'ruler', 'rumor', 'rusty', 'saber', 'saint', 'salad', 'salon',
  'salsa', 'salty', 'salute', 'sandy', 'sassy', 'sauce', 'sauna', 'savor', 'scale',
  'scalp', 'scam', 'scamp', 'scant', 'scare', 'scarf', 'scary', 'scene', 'scent',
  'scold', 'scone', 'scoop', 'scope', 'score', 'scorn', 'scout', 'scowl', 'scrap',
  'scrub', 'seal', 'seam', 'sedan', 'seize', 'self', 'sense', 'serum', 'serve',
  'setup', 'seven', 'shade', 'shady', 'shaft', 'shake', 'shaky', 'shall', 'shame',
  'shank', 'shape', 'shard', 'share', 'shark', 'sharp', 'shave', 'shawl', 'sheep',
  'sheer', 'sheet', 'shelf', 'shell', 'shift', 'shimmy', 'shine', 'shiny', 'ship',
  'shirt', 'shock', 'shore', 'short', 'shout', 'shove', 'shown', 'showy', 'shred',
  'shrub', 'shrug', 'shuck', 'shy', 'siege', 'sieve', 'sigh', 'sight', 'sigma',
  'silk', 'silly', 'since', 'sinew', 'siren', 'sixth', 'sixty', 'sized', 'skate',
  'skid', 'skill', 'skimp', 'skin', 'skip', 'skirt', 'skull', 'skunk', 'slab',
  'slack', 'slain', 'slam', 'slang', 'slant', 'slap', 'slash', 'slate', 'slave',
  'sleek', 'sleep', 'sleet', 'slept', 'slice', 'slick', 'slide', 'slime', 'slimy',
  'sling', 'slip', 'slit', 'slob', 'slope', 'slosh', 'sloth', 'slump', 'slur',
  'slurp', 'smack', 'small', 'smart', 'smash', 'smear', 'smell', 'smelt', 'smile',
  'smirk', 'smith', 'smock', 'smoke', 'smoky', 'snack', 'snag', 'snail', 'snake',
  'snap', 'snare', 'snarl', 'sneak', 'sneer', 'sniff', 'snore', 'snort', 'snout',
  'snow', 'snowy', 'snub', 'snuck', 'snuff', 'soak', 'soap', 'soar', 'sob',
  'sober', 'sock', 'sofa', 'soggy', 'soil', 'solar', 'solid', 'solve', 'sonic',
  'sorry', 'sort', 'soul', 'sound', 'soup', 'south', 'space', 'spade', 'spam',
  'span', 'spare', 'spark', 'spasm', 'spawn', 'speak', 'spear', 'speck', 'speed',
  'spell', 'spend', 'spent', 'spice', 'spicy', 'spied', 'spike', 'spill', 'spine',
  'spiral', 'spite', 'splash', 'split', 'spoil', 'spoke', 'spoof', 'spoon', 'sport',
  'spot', 'spout', 'spray', 'spree', 'sprig', 'sprout', 'spud', 'spun', 'spur',
  'spurt', 'squad', 'squat', 'squid', 'stack', 'staff', 'stage', 'stain', 'stair',
  'stake', 'stale', 'stalk', 'stall', 'stamp', 'stand', 'stank', 'star', 'stare',
  'stark', 'start', 'stash', 'state', 'stave', 'stay', 'steak', 'steal', 'steam',
  'steel', 'steep', 'steer', 'stem', 'step', 'stern', 'stew', 'stick', 'stiff',
  'still', 'sting', 'stink', 'stint', 'stir', 'stock', 'stomp', 'stone', 'stony',
  'stood', 'stool', 'stoop', 'stop', 'store', 'stork', 'storm', 'story', 'stout',
  'stove', 'strap', 'straw', 'stray', 'strip', 'strut', 'stuck', 'study', 'stuff',
  'stump', 'stung', 'stunk', 'stunt', 'style', 'sugar', 'suite', 'sulky', 'sunny',
  'super', 'surge', 'sushi', 'swam', 'swamp', 'swan', 'swap', 'swarm', 'sway',
  'swear', 'sweat', 'sweep', 'sweet', 'swell', 'swept', 'swift', 'swim', 'swine',
  'swing', 'swipe', 'swirl', 'swish', 'sword', 'swore', 'sworn', 'swung', 'syrup',
  'tabby', 'table', 'tacky', 'taffy', 'taint', 'taken', 'taker', 'tally', 'talon',
  'tamer', 'tango', 'tangy', 'tape', 'tasty', 'taunt', 'thank', 'thaw', 'theft',
  'their', 'theme', 'there', 'these', 'thick', 'thief', 'thigh', 'thing', 'think',
  'third', 'thong', 'thorn', 'those', 'three', 'threw', 'thrift', 'thrill', 'thrive',
  'throat', 'throb', 'throne', 'throw', 'thrown', 'thud', 'thumb', 'thump', 'tiger',
  'tight', 'tilt', 'timer', 'timid', 'tipsy', 'titan', 'title', 'toast', 'today',
  'token', 'tonic', 'topic', 'topaz', 'torch', 'torso', 'total', 'totem', 'touch',
  'tough', 'tour', 'towel', 'tower', 'toxic', 'trace', 'track', 'trade', 'trail',
  'train', 'trait', 'tramp', 'trash', 'trawl', 'tread', 'treat', 'tree', 'trend',
  'trial', 'tribe', 'trick', 'tried', 'trill', 'trio', 'trite', 'trod', 'troll',
  'troop', 'trope', 'trout', 'trove', 'truce', 'truck', 'truly', 'trump', 'trunk',
  'trust', 'truth', 'tuber', 'tulip', 'tunic', 'turbo', 'turf', 'turn', 'tutor',
  'twang', 'tweak', 'tweed', 'tweet', 'twice', 'twine', 'twirl', 'twist', 'tycoon',
  'udder', 'ultra', 'uncle', 'uncut', 'under', 'undue', 'unfed', 'unfit', 'union',
  'unite', 'unity', 'unlit', 'unmet', 'until', 'unwed', 'upper', 'upset', 'urban',
  'usher', 'using', 'usual', 'utter', 'vague', 'valid', 'valor', 'value', 'valve',
  'vapor', 'vault', 'vegan', 'venom', 'venue', 'verge', 'verse', 'video', 'view',
  'vigor', 'villa', 'vine', 'vinyl', 'viola', 'viper', 'viral', 'virus', 'visit',
  'visor', 'vista', 'vital', 'vivid', 'vocal', 'vodka', 'vogue', 'voice', 'voila',
  'volt', 'voter', 'vouch', 'vowel', 'vying', 'wafer', 'wager', 'wagon', 'waist',
  'waive', 'waltz', 'wand', 'warp', 'wary', 'waste', 'watch', 'water', 'wavy',
  'waxed', 'weary', 'weave', 'wedge', 'weedy', 'weigh', 'weird', 'welsh', 'wench',
  'wheat', 'wheel', 'where', 'which', 'while', 'whiff', 'whine', 'whiny', 'whip',
  'whirl', 'whisk', 'white', 'whole', 'widen', 'wider', 'widow', 'width', 'wield',
  'wilt', 'wimp', 'wince', 'winch', 'wink', 'wiper', 'wiry', 'wise', 'wish',
  'wispy', 'witch', 'witty', 'woke', 'woken', 'woman', 'womb', 'wont', 'woods',
  'woody', 'woozy', 'word', 'work', 'world', 'worm', 'worry', 'worse', 'worst',
  'worth', 'would', 'wound', 'woven', 'wrack', 'wrath', 'wreath', 'wreck', 'wring',
  'wrist', 'write', 'wrong', 'wrote', 'yacht', 'yearn', 'yeast', 'yield', 'young',
  'youth', 'zebra', 'zesty', 'zippy', 'zone', 'zoom',
];

/**
 * Generate a random passphrase using crypto-safe random selection
 * @param wordCount Number of words (default: 4, minimum: 3)
 * @param separator Word separator (default: '-')
 * @returns Random passphrase like "apple-thunder-maple-river"
 */
export function generatePassphrase(wordCount: number = 4, separator: string = '-'): string {
  const count = Math.max(3, wordCount);
  const words: string[] = [];

  // Use crypto.getRandomValues for secure random selection
  const randomValues = new Uint32Array(count);
  crypto.getRandomValues(randomValues);

  for (let i = 0; i < count; i++) {
    const index = randomValues[i] % PASSPHRASE_WORDS.length;
    words.push(PASSPHRASE_WORDS[index]);
  }

  return words.join(separator);
}

/**
 * Derive an encryption key from a password and salt
 */
export async function deriveKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  // Import password as key material
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive AES-GCM key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt data with AES-GCM
 * Returns: { ciphertext, iv }
 */
export async function encrypt(
  key: CryptoKey,
  plaintext: ArrayBuffer
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );

  return { ciphertext, iv };
}

/**
 * Decrypt data with AES-GCM
 */
export async function decrypt(
  key: CryptoKey,
  ciphertext: ArrayBuffer,
  iv: Uint8Array
): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
}

/**
 * Encrypt a string (convenience wrapper)
 */
export async function encryptString(
  key: CryptoKey,
  plaintext: string
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
  const data = new TextEncoder().encode(plaintext);
  return encrypt(key, data.buffer);
}

/**
 * Decrypt to string (convenience wrapper)
 */
export async function decryptString(
  key: CryptoKey,
  ciphertext: ArrayBuffer,
  iv: Uint8Array
): Promise<string> {
  const plaintext = await decrypt(key, ciphertext, iv);
  return new TextDecoder().decode(plaintext);
}

/**
 * Encrypt a file
 */
export async function encryptFile(
  key: CryptoKey,
  file: File
): Promise<{ encryptedBlob: Blob; iv: Uint8Array }> {
  const arrayBuffer = await file.arrayBuffer();
  const { ciphertext, iv } = await encrypt(key, arrayBuffer);
  const encryptedBlob = new Blob([ciphertext], { type: 'application/octet-stream' });
  return { encryptedBlob, iv };
}

/**
 * Decrypt a file
 */
export async function decryptFile(
  key: CryptoKey,
  encryptedData: ArrayBuffer,
  iv: Uint8Array,
  originalType: string
): Promise<Blob> {
  const plaintext = await decrypt(key, encryptedData, iv);
  return new Blob([plaintext], { type: originalType });
}

/**
 * Convert Uint8Array to JSON-safe array
 */
export function ivToJson(iv: Uint8Array): number[] {
  return Array.from(iv);
}

/**
 * Convert JSON array back to Uint8Array
 */
export function jsonToIv(json: number[] | string): Uint8Array {
  if (typeof json === 'string') {
    return new Uint8Array(JSON.parse(json));
  }
  return new Uint8Array(json);
}

/**
 * Convert base64 salt to Uint8Array
 */
export function saltFromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encryption context manager
 * Caches derived key for session
 */
export class EncryptionContext {
  private key: CryptoKey | null = null;
  private salt: Uint8Array | null = null;

  async initialize(password: string, saltBase64: string): Promise<void> {
    this.salt = saltFromBase64(saltBase64);
    this.key = await deriveKey(password, this.salt);
  }

  isInitialized(): boolean {
    return this.key !== null;
  }

  async encrypt(data: ArrayBuffer): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
    if (!this.key) throw new Error('Encryption context not initialized');
    return encrypt(this.key, data);
  }

  async decrypt(ciphertext: ArrayBuffer, iv: Uint8Array): Promise<ArrayBuffer> {
    if (!this.key) throw new Error('Encryption context not initialized');
    return decrypt(this.key, ciphertext, iv);
  }

  async encryptString(plaintext: string): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
    if (!this.key) throw new Error('Encryption context not initialized');
    return encryptString(this.key, plaintext);
  }

  async decryptString(ciphertext: ArrayBuffer, iv: Uint8Array): Promise<string> {
    if (!this.key) throw new Error('Encryption context not initialized');
    return decryptString(this.key, ciphertext, iv);
  }

  async encryptFile(file: File): Promise<{ encryptedBlob: Blob; iv: Uint8Array }> {
    if (!this.key) throw new Error('Encryption context not initialized');
    return encryptFile(this.key, file);
  }

  async decryptFile(data: ArrayBuffer, iv: Uint8Array, type: string): Promise<Blob> {
    if (!this.key) throw new Error('Encryption context not initialized');
    return decryptFile(this.key, data, iv, type);
  }

  clear(): void {
    this.key = null;
    this.salt = null;
  }
}

// Singleton encryption context
export const encryptionContext = new EncryptionContext();
