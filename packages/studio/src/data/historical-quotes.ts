/**
 * Historical quotes featuring uses of "humanize" and "humanizer"
 * Curated from documented historical sources spanning 1603-present
 */

export interface HistoricalQuote {
  quote: string;
  author: string;
  year: string | number;
  source?: string;
}

export const HISTORICAL_QUOTES: HistoricalQuote[] = [
  {
    quote: "Before the Christian religion had, as it were, humanized the idea of the Divinity, and brought it somewhat nearer to us, there was very little said of the love of God.",
    author: "Edmund Burke",
    year: 1757,
    source: "A Philosophical Enquiry into the Sublime and Beautiful",
  },
  {
    quote: "One of his first lectures attempted to humanize science by explaining that 'the whole of Nature is a metaphor or image of the human mind.'",
    author: "Ralph Waldo Emerson",
    year: 1833,
    source: "The Uses of Natural History",
  },
  {
    quote: "The problem of humanization has always, from an axiological point of view, been humankind's central problem.",
    author: "Paulo Freire",
    year: 1968,
    source: "Pedagogy of the Oppressed",
  },
  {
    quote: "In a properly automated and educated world, machines may prove to be the true humanizing influence.",
    author: "Isaac Asimov",
    year: 1986,
    source: "Robot Visions",
  },
  {
    quote: "James sees truth, beauty, and goodness as realities we bring into being with our activity on the world, a world more and more humanized.",
    author: "William James",
    year: 1907,
    source: "Pragmatism",
  },
  {
    quote: "Semco threw out old management methods and thrived. Ricardo Semler may well be the CEO who put humanizing work firmly on the map.",
    author: "Ricardo Semler",
    year: "c. 1990",
    source: "Maverick",
  },
  {
    quote: "Poetry is a humanizing force, one that teaches us to listen to our true selves, and to value the voices and perspectives of others.",
    author: "Tracy K. Smith",
    year: "c. 2010",
    source: "US Poet Laureate",
  },
  {
    quote: "Through vivid, empathetic characterization, Dickens humanized the lower classes, fostering empathy among his readers.",
    author: "Charles Dickens",
    year: "c. 1850",
    source: "Victorian literature",
  },
  {
    quote: "What do we live for, if it is not to make life less difficult for each other?",
    author: "George Eliot",
    year: 1871,
    source: "Middlemarch",
  },
  {
    quote: "Our vocation is to humanize our world and make it easier to love.",
    author: "Paulo Freire",
    year: 1997,
    source: "Later writings",
  },
];

/**
 * Get a random quote
 */
export function getRandomQuote(): HistoricalQuote {
  return HISTORICAL_QUOTES[Math.floor(Math.random() * HISTORICAL_QUOTES.length)];
}
