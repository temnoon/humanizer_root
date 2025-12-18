/**
 * Project Gutenberg SIC Baseline Survey - Sample Definitions
 *
 * Curated selections from classic literature with full literary analysis.
 * Each sample includes context about its significance and expected SIC features.
 */

export interface LiteraryContext {
  position: 'opening' | 'rising_action' | 'climax' | 'falling_action' | 'resolution';
  chapterSignificance: string;
  narrativeMode: string;
  dominantTechnique: string;
  emotionalRegister: string;
  themes: string[];
  passageDescription: string;
  literarySignificance: string;
  expectedFeatures: Array<{
    feature: string;
    expectation: 'high' | 'medium' | 'low';
    rationale: string;
  }>;
}

export interface BookDefinition {
  gutenbergId: number;
  title: string;
  author: string;
  publicationYear: number;
  genre: 'narrative' | 'argument' | 'technical' | 'memoir' | 'gothic' | 'adventure';
  literaryPeriod: string;
  overallSignificance: string;
  chapters: Array<{
    chapterIndex: number;
    chapterTitle: string;
    context: LiteraryContext;
  }>;
}

export const SURVEY_BOOKS: BookDefinition[] = [
  // ============================================================
  // NARRATIVE FICTION - Comedy of Manners
  // ============================================================
  {
    gutenbergId: 1342,
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    publicationYear: 1813,
    genre: 'narrative',
    literaryPeriod: 'Regency/Romantic',
    overallSignificance: 'Masterwork of free indirect discourse and social satire. Austen\'s ironic narrator maintains distance while inhabiting character perspectives.',
    chapters: [
      {
        chapterIndex: 0,
        chapterTitle: 'Chapter 1',
        context: {
          position: 'opening',
          chapterSignificance: 'Famous opening establishes ironic tone and central theme of marriage as economic transaction',
          narrativeMode: 'Third-person omniscient with heavy ironic distance',
          dominantTechnique: 'Ironic declaration followed by domestic comedy',
          emotionalRegister: 'Satirical, witty',
          themes: ['marriage economics', 'class', 'gender roles'],
          passageDescription: 'Opening universal truth about single men and fortunes, followed by Mr. and Mrs. Bennet\'s conversation about Mr. Bingley',
          literarySignificance: 'One of literature\'s most famous openings. The ironic gap between narrator\'s statement and reality sets up entire novel\'s critical stance.',
          expectedFeatures: [
            { feature: 'anti_smoothing', expectation: 'high', rationale: 'Austen takes clear ironic position on marriage customs' },
            { feature: 'bounded_viewpoint', expectation: 'medium', rationale: 'Omniscient narrator but with positioned irony' },
            { feature: 'commitment_irreversibility', expectation: 'medium', rationale: 'Social stakes established but not yet personal' }
          ]
        }
      },
      {
        chapterIndex: 2,
        chapterTitle: 'Chapter 3',
        context: {
          position: 'rising_action',
          chapterSignificance: 'First ball scene - Darcy\'s insult overheard by Elizabeth',
          narrativeMode: 'Third-person with free indirect discourse shifting to Elizabeth',
          dominantTechnique: 'Overheard dialogue creating dramatic irony',
          emotionalRegister: 'Social comedy with undercurrent of wounded pride',
          themes: ['first impressions', 'pride', 'class prejudice'],
          passageDescription: 'Elizabeth overhears Darcy call her "tolerable, but not handsome enough to tempt me"',
          literarySignificance: 'Catalyst for entire plot. Elizabeth\'s prejudice against Darcy stems from this moment of social humiliation.',
          expectedFeatures: [
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Elizabeth cannot access Darcy\'s true feelings or later regret' },
            { feature: 'scar_tissue_specificity', expectation: 'medium', rationale: 'This wound persists through the novel' },
            { feature: 'anti_smoothing', expectation: 'high', rationale: 'Clear judgment of Darcy\'s arrogance' }
          ]
        }
      },
      {
        chapterIndex: 33,
        chapterTitle: 'Chapter 34',
        context: {
          position: 'climax',
          chapterSignificance: 'Darcy\'s first proposal and Elizabeth\'s rejection',
          narrativeMode: 'Tight third-person on Elizabeth, direct dialogue',
          dominantTechnique: 'Extended dramatic dialogue with internal reaction',
          emotionalRegister: 'High tension, indignation, wounded pride on both sides',
          themes: ['pride', 'prejudice', 'class', 'moral judgment'],
          passageDescription: 'Darcy proposes while insulting her family; Elizabeth refuses while accusing him of ruining Jane and Wickham',
          literarySignificance: 'Novel\'s turning point. Both characters reveal their flaws; the title\'s themes crystallize.',
          expectedFeatures: [
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Proposal and rejection are irreversible social acts' },
            { feature: 'epistemic_risk_uncertainty', expectation: 'high', rationale: 'Both characters are wrong about each other' },
            { feature: 'time_pressure_tradeoffs', expectation: 'medium', rationale: 'Immediate decision required' }
          ]
        }
      },
      {
        chapterIndex: 35,
        chapterTitle: 'Chapter 36',
        context: {
          position: 'falling_action',
          chapterSignificance: 'Elizabeth reads Darcy\'s letter and begins to recognize her prejudice',
          narrativeMode: 'Deep free indirect discourse - Elizabeth\'s consciousness',
          dominantTechnique: 'Interior reflection, rereading, self-recognition',
          emotionalRegister: 'Shame, self-discovery, moral reckoning',
          themes: ['self-knowledge', 'prejudice', 'truth'],
          passageDescription: 'Elizabeth rereads Darcy\'s letter, each reading revealing more of her own blindness',
          literarySignificance: 'The novel\'s great moment of anagnorisis. Elizabeth recognizes she has been "blind, partial, prejudiced, absurd."',
          expectedFeatures: [
            { feature: 'scar_tissue_specificity', expectation: 'high', rationale: 'Deep shame that will persist' },
            { feature: 'epistemic_risk_uncertainty', expectation: 'high', rationale: 'Discovery of having been fundamentally wrong' },
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Acknowledging limits of her previous knowledge' }
          ]
        }
      },
      {
        chapterIndex: 57,
        chapterTitle: 'Chapter 58',
        context: {
          position: 'resolution',
          chapterSignificance: 'Darcy\'s second proposal, accepted',
          narrativeMode: 'Third-person with emotional intimacy',
          dominantTechnique: 'Dialogue revealing transformed characters',
          emotionalRegister: 'Joy, gratitude, mutual recognition',
          themes: ['growth', 'love', 'understanding'],
          passageDescription: 'Both acknowledge their faults and how they have changed; engagement agreed',
          literarySignificance: 'Resolution demonstrates that both characters have genuinely transformed through moral self-examination.',
          expectedFeatures: [
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Marriage commitment made' },
            { feature: 'scar_tissue_specificity', expectation: 'medium', rationale: 'Past wounds acknowledged but healed' },
            { feature: 'anti_smoothing', expectation: 'medium', rationale: 'Clear resolution, not balanced hedging' }
          ]
        }
      }
    ]
  },

  // ============================================================
  // GOTHIC HORROR
  // ============================================================
  {
    gutenbergId: 84,
    title: 'Frankenstein',
    author: 'Mary Shelley',
    publicationYear: 1818,
    genre: 'gothic',
    literaryPeriod: 'Romantic/Gothic',
    overallSignificance: 'Foundational science fiction and horror. Nested narrative structure (Walton-Victor-Creature) creates multiple bounded viewpoints.',
    chapters: [
      {
        chapterIndex: 3,
        chapterTitle: 'Chapter 4',
        context: {
          position: 'rising_action',
          chapterSignificance: 'Victor describes his obsessive work creating the creature',
          narrativeMode: 'First-person retrospective confession',
          dominantTechnique: 'Retrospective narration with hindsight regret',
          emotionalRegister: 'Obsessive, fevered, warning',
          themes: ['ambition', 'creation', 'transgression', 'isolation'],
          passageDescription: 'Victor describes neglecting health, friends, family in pursuit of animating dead matter',
          literarySignificance: 'Establishes Victor\'s hubris and isolation. His present-tense warnings to Walton create dramatic irony.',
          expectedFeatures: [
            { feature: 'scar_tissue_specificity', expectation: 'high', rationale: 'Victor narrates from position of lasting trauma' },
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Cannot uncreate the creature' },
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'First-person limited, cannot see creature\'s experience' }
          ]
        }
      },
      {
        chapterIndex: 4,
        chapterTitle: 'Chapter 5',
        context: {
          position: 'climax',
          chapterSignificance: 'The creature comes to life; Victor\'s horror',
          narrativeMode: 'First-person immediate experience recalled',
          dominantTechnique: 'Sensory detail, physical revulsion, flight',
          emotionalRegister: 'Horror, revulsion, panic',
          themes: ['creation', 'responsibility', 'the uncanny', 'birth'],
          passageDescription: 'Victor watches the creature\'s eye open, flees in terror, has nightmare of Elizabeth becoming his dead mother',
          literarySignificance: 'The novel\'s central scene of transgression and its immediate psychic cost. Victor\'s abandonment is his original sin.',
          expectedFeatures: [
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Intense physical and embodied experience' },
            { feature: 'epistemic_risk_uncertainty', expectation: 'high', rationale: 'Victor discovers his creation is horrifying' },
            { feature: 'time_pressure_tradeoffs', expectation: 'high', rationale: 'Immediate decision to flee' }
          ]
        }
      },
      {
        chapterIndex: 10,
        chapterTitle: 'Chapter 11',
        context: {
          position: 'rising_action',
          chapterSignificance: 'The creature begins his own narrative',
          narrativeMode: 'First-person (creature) nested in Victor\'s narrative',
          dominantTechnique: 'Bildungsroman of consciousness, sensory awakening',
          emotionalRegister: 'Wonder, confusion, gradual suffering',
          themes: ['consciousness', 'education', 'rejection', 'nature vs nurture'],
          passageDescription: 'Creature describes first confused sensations, learning to distinguish senses, first encounters with humans who flee',
          literarySignificance: 'Shifts sympathy to creature. His eloquent narration challenges Victor\'s account and reader\'s assumptions.',
          expectedFeatures: [
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Creature cannot understand why humans flee' },
            { feature: 'scar_tissue_specificity', expectation: 'high', rationale: 'Each rejection leaves lasting wound' },
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Intense bodily confusion, social exclusion' }
          ]
        }
      },
      {
        chapterIndex: 19,
        chapterTitle: 'Chapter 20',
        context: {
          position: 'climax',
          chapterSignificance: 'Victor destroys the female creature; the creature\'s threat',
          narrativeMode: 'First-person Victor, tense present-feeling narration',
          dominantTechnique: 'Decision scene with irreversible consequence',
          emotionalRegister: 'Moral anguish, terror, defiance',
          themes: ['creation', 'responsibility', 'violence', 'consequences'],
          passageDescription: 'Victor tears apart the half-finished female creature as the creature watches; creature vows revenge',
          literarySignificance: 'Victor\'s second major moral decision. Unlike creation, this is conscious choice with known stakes.',
          expectedFeatures: [
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Cannot undo destruction or retract creature\'s enmity' },
            { feature: 'time_pressure_tradeoffs', expectation: 'high', rationale: 'Must decide now with creature watching' },
            { feature: 'anti_smoothing', expectation: 'high', rationale: 'Victor chooses, creature chooses - no middle ground' }
          ]
        }
      },
      {
        chapterIndex: 23,
        chapterTitle: 'Chapter 24',
        context: {
          position: 'falling_action',
          chapterSignificance: 'Victor pursues creature to the Arctic; final confrontation',
          narrativeMode: 'First-person Victor, exhausted, driven',
          dominantTechnique: 'Chase narrative, obsessive revenge',
          emotionalRegister: 'Obsessive, delirious, despairing',
          themes: ['revenge', 'obsession', 'death', 'justice'],
          passageDescription: 'Victor describes months of pursuit, his body failing, his single-minded need to destroy the creature',
          literarySignificance: 'Victor has become mirror of creature - isolated, obsessed, destructive. Their positions have reversed.',
          expectedFeatures: [
            { feature: 'scar_tissue_specificity', expectation: 'high', rationale: 'All losses have accumulated into this pursuit' },
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Has given everything to this chase' },
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Physical suffering described in detail' }
          ]
        }
      }
    ]
  },

  // ============================================================
  // ADVENTURE/ACTION
  // ============================================================
  {
    gutenbergId: 2701,
    title: 'Moby Dick',
    author: 'Herman Melville',
    publicationYear: 1851,
    genre: 'adventure',
    literaryPeriod: 'American Renaissance',
    overallSignificance: 'Epic of obsession and meaning-making. Ishmael\'s voice shifts between participant and philosophical observer.',
    chapters: [
      {
        chapterIndex: 0,
        chapterTitle: 'Loomings',
        context: {
          position: 'opening',
          chapterSignificance: 'Famous opening; Ishmael\'s reasons for going to sea',
          narrativeMode: 'First-person direct address, philosophical',
          dominantTechnique: 'Intimate confession, catalog of moods',
          emotionalRegister: 'Melancholic, wry, searching',
          themes: ['death', 'water', 'fate', 'depression'],
          passageDescription: '"Call me Ishmael" - narrator explains his need for sea as alternative to suicide',
          literarySignificance: 'Establishes Ishmael as unreliable but compelling narrator. His depression and search for meaning drives the telling.',
          expectedFeatures: [
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Ishmael only knows his own reasons' },
            { feature: 'scar_tissue_specificity', expectation: 'high', rationale: 'His "damp, drizzly November in my soul"' },
            { feature: 'anti_smoothing', expectation: 'medium', rationale: 'Takes position on sea vs. suicide' }
          ]
        }
      },
      {
        chapterIndex: 35,
        chapterTitle: 'The Quarter-Deck',
        context: {
          position: 'rising_action',
          chapterSignificance: 'Ahab reveals his quest for Moby Dick; crew swears oath',
          narrativeMode: 'Dramatic scene, dialogue-heavy',
          dominantTechnique: 'Theatrical revelation, collective ritual',
          emotionalRegister: 'Manic charisma, religious fervor',
          themes: ['obsession', 'fate', 'leadership', 'vengeance'],
          passageDescription: 'Ahab nails gold doubloon to mast, reveals white whale took his leg, crew drinks to vengeance',
          literarySignificance: 'Ahab conscripts the crew into his personal quest. The oath is binding - they cannot now escape his fate.',
          expectedFeatures: [
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Oath binds crew to Ahab\'s doom' },
            { feature: 'time_pressure_tradeoffs', expectation: 'medium', rationale: 'Crew must decide now' },
            { feature: 'anti_smoothing', expectation: 'high', rationale: 'Ahab\'s monomania allows no ambivalence' }
          ]
        }
      },
      {
        chapterIndex: 40,
        chapterTitle: 'Midnight, Forecastle',
        context: {
          position: 'rising_action',
          chapterSignificance: 'Crew\'s perspectives in dramatic form',
          narrativeMode: 'Dramatic dialogue, multiple voices',
          dominantTechnique: 'Theatrical polyphony, song',
          emotionalRegister: 'Raucous, diverse, anxious undercurrents',
          themes: ['community', 'fate', 'diversity', 'foreboding'],
          passageDescription: 'Sailors of many nations sing, argue, fight during midnight watch',
          literarySignificance: 'The Pequod as microcosm of humanity. Each voice bounded by its own perspective on their shared doom.',
          expectedFeatures: [
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Each sailor speaks only their view' },
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Physical ship life, national identities' },
            { feature: 'time_pressure_tradeoffs', expectation: 'low', rationale: 'Moment of pause before action' }
          ]
        }
      },
      {
        chapterIndex: 86,
        chapterTitle: 'The Grand Armada',
        context: {
          position: 'rising_action',
          chapterSignificance: 'Hunt of whale pod; glimpse of whales\' inner life',
          narrativeMode: 'Action narrative with philosophical interludes',
          dominantTechnique: 'Extended action set-piece, natural observation',
          emotionalRegister: 'Excitement, wonder, violence',
          themes: ['nature', 'violence', 'beauty', 'exploitation'],
          passageDescription: 'Boats enter circle of whale pod, witness nursing mothers, violence intrudes',
          literarySignificance: 'Moment of possible connection with whale consciousness, interrupted by human violence.',
          expectedFeatures: [
            { feature: 'time_pressure_tradeoffs', expectation: 'high', rationale: 'Hunt requires split-second decisions' },
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Physical danger of small boats among whales' },
            { feature: 'epistemic_risk_uncertainty', expectation: 'medium', rationale: 'Cannot know whale intentions' }
          ]
        }
      },
      {
        chapterIndex: 132,
        chapterTitle: 'The Symphony',
        context: {
          position: 'falling_action',
          chapterSignificance: 'Ahab\'s moment of human vulnerability before final chase',
          narrativeMode: 'First-person Ishmael observing Ahab\'s interiority',
          dominantTechnique: 'Lyrical description, soliloquy',
          emotionalRegister: 'Elegiac, tender, tragic',
          themes: ['fate', 'choice', 'humanity', 'doom'],
          passageDescription: 'Ahab sees his reflection in sea, almost weeps, speaks to Starbuck of wife and child',
          literarySignificance: 'Ahab\'s last chance to turn back. He recognizes his doom but cannot escape his nature.',
          expectedFeatures: [
            { feature: 'scar_tissue_specificity', expectation: 'high', rationale: 'Ahab reveals what he has lost' },
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'He knows he will not turn back' },
            { feature: 'bounded_viewpoint', expectation: 'medium', rationale: 'Ishmael can only guess at Ahab\'s depths' }
          ]
        }
      },
      {
        chapterIndex: 134,
        chapterTitle: 'The Chase - Third Day',
        context: {
          position: 'climax',
          chapterSignificance: 'Final confrontation with Moby Dick; destruction of Pequod',
          narrativeMode: 'Action climax, Ishmael surviving to tell',
          dominantTechnique: 'Epic action, prophetic imagery',
          emotionalRegister: 'Apocalyptic, inevitable, sublime',
          themes: ['fate', 'obsession', 'destruction', 'survival'],
          passageDescription: 'Moby Dick destroys the Pequod, Ahab dragged down by harpoon line, only Ishmael survives',
          literarySignificance: 'Culmination of Ahab\'s quest in mutual destruction. Ishmael survives to bear witness.',
          expectedFeatures: [
            { feature: 'time_pressure_tradeoffs', expectation: 'high', rationale: 'Moment-to-moment survival decisions' },
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'All choices have led here' },
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Physical destruction described' }
          ]
        }
      }
    ]
  },

  // ============================================================
  // PHILOSOPHICAL ESSAY
  // ============================================================
  {
    gutenbergId: 2680,
    title: 'Meditations',
    author: 'Marcus Aurelius',
    publicationYear: 180,
    genre: 'argument',
    literaryPeriod: 'Roman Imperial',
    overallSignificance: 'Private philosophical journal of a Roman Emperor. Not intended for publication - authentic self-examination.',
    chapters: [
      {
        chapterIndex: 1,
        chapterTitle: 'Book II',
        context: {
          position: 'opening',
          chapterSignificance: 'Morning meditation on dealing with difficult people',
          narrativeMode: 'Second-person self-address',
          dominantTechnique: 'Stoic self-counsel, anticipated challenges',
          emotionalRegister: 'Resigned wisdom, practical',
          themes: ['human nature', 'patience', 'rationality', 'duty'],
          passageDescription: '"Begin each day by telling yourself: Today I shall meet with interference, ingratitude, insolence..."',
          literarySignificance: 'Classic statement of Stoic practice. Marcus prepares himself for others\' failings.',
          expectedFeatures: [
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Marcus commits to response pattern' },
            { feature: 'anti_smoothing', expectation: 'high', rationale: 'Takes clear position on how to act' },
            { feature: 'epistemic_risk_uncertainty', expectation: 'low', rationale: 'Stoic certainty about principles' }
          ]
        }
      },
      {
        chapterIndex: 4,
        chapterTitle: 'Book V',
        context: {
          position: 'rising_action',
          chapterSignificance: 'On waking reluctantly to duty',
          narrativeMode: 'Dialogue with self',
          dominantTechnique: 'Internal argument, self-persuasion',
          emotionalRegister: 'Struggle between comfort and duty',
          themes: ['duty', 'nature', 'purpose', 'effort'],
          passageDescription: '"At dawn, when you have trouble getting out of bed, tell yourself: I have to go to work as a human being..."',
          literarySignificance: 'Shows Marcus\'s human struggle. Even the Emperor doesn\'t want to get up.',
          expectedFeatures: [
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Physical reluctance to leave bed' },
            { feature: 'commitment_irreversibility', expectation: 'medium', rationale: 'Daily choice to fulfill duty' },
            { feature: 'bounded_viewpoint', expectation: 'medium', rationale: 'Personal struggle acknowledged' }
          ]
        }
      },
      {
        chapterIndex: 10,
        chapterTitle: 'Book XI',
        context: {
          position: 'falling_action',
          chapterSignificance: 'Reflection on anger and forgiveness',
          narrativeMode: 'Philosophical meditation',
          dominantTechnique: 'Reasoning through scenarios',
          emotionalRegister: 'Measured, searching for equanimity',
          themes: ['anger', 'forgiveness', 'understanding', 'control'],
          passageDescription: 'Marcus reasons through why we should not be angry at others\' faults',
          literarySignificance: 'Shows Stoic practice of reframing. Transforms anger through understanding.',
          expectedFeatures: [
            { feature: 'anti_smoothing', expectation: 'high', rationale: 'Clear argument against anger' },
            { feature: 'epistemic_risk_uncertainty', expectation: 'medium', rationale: 'Acknowledges difficulty of practice' },
            { feature: 'scar_tissue_specificity', expectation: 'medium', rationale: 'Personal experience of struggle' }
          ]
        }
      }
    ]
  },

  // ============================================================
  // TECHNICAL/SCIENTIFIC
  // ============================================================
  {
    gutenbergId: 1228,
    title: 'On the Origin of Species',
    author: 'Charles Darwin',
    publicationYear: 1859,
    genre: 'technical',
    literaryPeriod: 'Victorian Scientific',
    overallSignificance: 'Revolutionary scientific argument. Darwin\'s rhetoric carefully manages controversial claims.',
    chapters: [
      {
        chapterIndex: 0,
        chapterTitle: 'Introduction',
        context: {
          position: 'opening',
          chapterSignificance: 'Darwin establishes his credentials and method',
          narrativeMode: 'First-person scientific, autobiographical framing',
          dominantTechnique: 'Ethos-building, methodological transparency',
          emotionalRegister: 'Careful, humble, persuasive',
          themes: ['method', 'evidence', 'humility', 'discovery'],
          passageDescription: 'Darwin explains his voyage, observations, and long deliberation before publishing',
          literarySignificance: 'Darwin\'s rhetoric is strategic: establishing credibility before controversial claims.',
          expectedFeatures: [
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Acknowledges limits of his evidence' },
            { feature: 'commitment_irreversibility', expectation: 'medium', rationale: 'Commits to theory while acknowledging gaps' },
            { feature: 'meta_contamination', expectation: 'low', rationale: 'Some framing, but purposeful' }
          ]
        }
      },
      {
        chapterIndex: 3,
        chapterTitle: 'Chapter IV: Natural Selection',
        context: {
          position: 'climax',
          chapterSignificance: 'Core argument of the theory',
          narrativeMode: 'Scientific argument with examples',
          dominantTechnique: 'Cumulative evidence, analogical reasoning',
          emotionalRegister: 'Building conviction, careful qualification',
          themes: ['selection', 'variation', 'adaptation', 'time'],
          passageDescription: 'Darwin explains mechanism of natural selection through accumulated variations',
          literarySignificance: 'The chapter that changed biology. Darwin builds case brick by brick.',
          expectedFeatures: [
            { feature: 'anti_smoothing', expectation: 'high', rationale: 'Darwin commits to his mechanism' },
            { feature: 'epistemic_risk_uncertainty', expectation: 'medium', rationale: 'Acknowledges objections' },
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Stakes reputation on theory' }
          ]
        }
      },
      {
        chapterIndex: 13,
        chapterTitle: 'Chapter XIV: Conclusion',
        context: {
          position: 'resolution',
          chapterSignificance: 'Summary and famous closing paragraph',
          narrativeMode: 'Summative, rising to poetry',
          dominantTechnique: 'Recapitulation with emotional crescendo',
          emotionalRegister: 'Wonder, grandeur, scientific sublime',
          themes: ['wonder', 'unity', 'progress', 'beauty'],
          passageDescription: '"There is grandeur in this view of life" - closing meditation on entangled bank',
          literarySignificance: 'Darwin transforms scientific theory into sublime vision. Science as source of wonder.',
          expectedFeatures: [
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Full embrace of theory\'s implications' },
            { feature: 'anti_smoothing', expectation: 'high', rationale: 'No hedging in final vision' },
            { feature: 'bounded_viewpoint', expectation: 'low', rationale: 'Reaches for universal statement' }
          ]
        }
      }
    ]
  },

  // ============================================================
  // PERSONAL MEMOIR
  // ============================================================
  {
    gutenbergId: 205,
    title: 'Walden',
    author: 'Henry David Thoreau',
    publicationYear: 1854,
    genre: 'memoir',
    literaryPeriod: 'American Transcendentalist',
    overallSignificance: 'Experiment in deliberate living. Thoreau\'s voice combines practical detail with philosophical meditation.',
    chapters: [
      {
        chapterIndex: 0,
        chapterTitle: 'Economy',
        context: {
          position: 'opening',
          chapterSignificance: 'Thoreau explains why he went to the woods and accounts for his expenses',
          narrativeMode: 'First-person direct address, polemical',
          dominantTechnique: 'Provocation, accounting, social criticism',
          emotionalRegister: 'Challenging, wry, earnest',
          themes: ['economy', 'simplicity', 'conformity', 'necessity'],
          passageDescription: '"I went to the woods because I wished to live deliberately" and detailed cost accounting',
          literarySignificance: 'Challenges fundamental assumptions about what we need. Personal experiment as social critique.',
          expectedFeatures: [
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Thoreau bet two years on this experiment' },
            { feature: 'anti_smoothing', expectation: 'high', rationale: 'Aggressive critique of conventional life' },
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Practical details of building, food, labor' }
          ]
        }
      },
      {
        chapterIndex: 1,
        chapterTitle: 'Where I Lived, and What I Lived For',
        context: {
          position: 'rising_action',
          chapterSignificance: 'Philosophy of deliberate living',
          narrativeMode: 'Lyrical first-person, philosophical',
          dominantTechnique: 'Nature description with moral commentary',
          emotionalRegister: 'Exalted, urgent, prophetic',
          themes: ['awakening', 'reality', 'time', 'consciousness'],
          passageDescription: '"I wished to live deep and suck out all the marrow of life"',
          literarySignificance: 'Thoreau\'s credo. Each moment should be fully lived and examined.',
          expectedFeatures: [
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Complete commitment to examined life' },
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Morning bathing, physical engagement' },
            { feature: 'anti_smoothing', expectation: 'high', rationale: 'Rejects "quiet desperation" of most lives' }
          ]
        }
      },
      {
        chapterIndex: 4,
        chapterTitle: 'Solitude',
        context: {
          position: 'rising_action',
          chapterSignificance: 'Defense of solitary life',
          narrativeMode: 'Contemplative first-person',
          dominantTechnique: 'Paradox, nature companionship',
          emotionalRegister: 'Peaceful, strange, mystical',
          themes: ['solitude', 'nature', 'companionship', 'society'],
          passageDescription: 'Thoreau explains why he is never lonely in the woods',
          literarySignificance: 'Redefines loneliness as something experienced in crowds, not in nature.',
          expectedFeatures: [
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Deeply personal experience others might not share' },
            { feature: 'scar_tissue_specificity', expectation: 'medium', rationale: 'Hints at dissatisfaction with society' },
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Physical experience of solitude' }
          ]
        }
      },
      {
        chapterIndex: 17,
        chapterTitle: 'Conclusion',
        context: {
          position: 'resolution',
          chapterSignificance: 'Why Thoreau left; lessons learned',
          narrativeMode: 'Summative, prophetic',
          dominantTechnique: 'Final exhortation, parable',
          emotionalRegister: 'Triumphant, challenging',
          themes: ['change', 'possibility', 'conformity', 'awakening'],
          passageDescription: '"I left the woods for as good a reason as I went there" - many lives to live',
          literarySignificance: 'The experiment was not retreat but demonstration. He returns to prove the point.',
          expectedFeatures: [
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Two years given to the experiment' },
            { feature: 'epistemic_risk_uncertainty', expectation: 'medium', rationale: 'Acknowledges others may not follow' },
            { feature: 'anti_smoothing', expectation: 'high', rationale: 'Clear call to wake up' }
          ]
        }
      }
    ]
  },

  // ============================================================
  // GOTHIC - Additional
  // ============================================================
  {
    gutenbergId: 345,
    title: 'Dracula',
    author: 'Bram Stoker',
    publicationYear: 1897,
    genre: 'gothic',
    literaryPeriod: 'Late Victorian Gothic',
    overallSignificance: 'Epistolary horror. Multiple narrators create uncertainty; no single authoritative view.',
    chapters: [
      {
        chapterIndex: 0,
        chapterTitle: 'Chapter 1 - Jonathan Harker\'s Journal',
        context: {
          position: 'opening',
          chapterSignificance: 'Jonathan travels to Castle Dracula',
          narrativeMode: 'First-person journal, real-time recording',
          dominantTechnique: 'Travel narrative with growing unease',
          emotionalRegister: 'Curiosity turning to dread',
          themes: ['East vs West', 'rationality', 'superstition', 'the uncanny'],
          passageDescription: 'Jonathan records his journey through Transylvania, locals\' warnings, arrival at castle',
          literarySignificance: 'English rationalist encountering Eastern superstition. His journal is his grip on sanity.',
          expectedFeatures: [
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Jonathan can only record what he sees' },
            { feature: 'epistemic_risk_uncertainty', expectation: 'high', rationale: 'Cannot trust his perceptions' },
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Physical journey, bodily fear' }
          ]
        }
      },
      {
        chapterIndex: 2,
        chapterTitle: 'Chapter 3',
        context: {
          position: 'rising_action',
          chapterSignificance: 'Jonathan discovers he is a prisoner; sees Dracula climb wall',
          narrativeMode: 'Journal entries with increasing terror',
          dominantTechnique: 'Discovered horror, recorded disbelief',
          emotionalRegister: 'Escalating terror, sanity questioned',
          themes: ['imprisonment', 'the monstrous', 'disbelief', 'the real'],
          passageDescription: 'Jonathan finds doors locked, then sees Count crawl down castle wall face-first',
          literarySignificance: 'The moment rationality breaks. Jonathan sees the impossible and must record it.',
          expectedFeatures: [
            { feature: 'epistemic_risk_uncertainty', expectation: 'high', rationale: 'Jonathan doubts his own senses' },
            { feature: 'scar_tissue_specificity', expectation: 'high', rationale: 'This vision will haunt him' },
            { feature: 'commitment_irreversibility', expectation: 'medium', rationale: 'Cannot unsee what he saw' }
          ]
        }
      },
      {
        chapterIndex: 20,
        chapterTitle: 'Chapter 21 - Dr. Seward\'s Diary',
        context: {
          position: 'climax',
          chapterSignificance: 'Mina describes Dracula forcing her to drink his blood',
          narrativeMode: 'Mina\'s account within Seward\'s diary',
          dominantTechnique: 'Traumatic testimony, nested narration',
          emotionalRegister: 'Violation, horror, determination',
          themes: ['violation', 'contamination', 'will', 'resistance'],
          passageDescription: 'Mina recounts Dracula making her drink from wound in his chest',
          literarySignificance: 'Inverts communion. The victim becomes linked to monster. Sexual/spiritual violation.',
          expectedFeatures: [
            { feature: 'scar_tissue_specificity', expectation: 'high', rationale: 'Permanent contamination' },
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Bodily violation described' },
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Mina can only describe her experience' }
          ]
        }
      }
    ]
  },

  // ============================================================
  // ADVENTURE - Additional
  // ============================================================
  {
    gutenbergId: 120,
    title: 'Treasure Island',
    author: 'Robert Louis Stevenson',
    publicationYear: 1883,
    genre: 'adventure',
    literaryPeriod: 'Victorian Adventure',
    overallSignificance: 'Defined pirate fiction. Jim Hawkins\' coming-of-age through violence and moral complexity.',
    chapters: [
      {
        chapterIndex: 0,
        chapterTitle: 'Part One - Chapter 1',
        context: {
          position: 'opening',
          chapterSignificance: 'Billy Bones arrives at Admiral Benbow inn',
          narrativeMode: 'First-person retrospective (Jim as adult)',
          dominantTechnique: 'Childhood memory with adult hindsight',
          emotionalRegister: 'Nostalgic terror, adventure beginning',
          themes: ['childhood', 'danger', 'secrets', 'the unknown'],
          passageDescription: 'Jim recalls the old seaman arriving, his scars, his fear of "the seafaring man with one leg"',
          literarySignificance: 'Classic adventure opening. Adult narrator recalls childhood mystery that changed everything.',
          expectedFeatures: [
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Child Jim cannot understand adult secrets' },
            { feature: 'scar_tissue_specificity', expectation: 'medium', rationale: 'Memory shaped by what followed' },
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Physical description of Bones, inn life' }
          ]
        }
      },
      {
        chapterIndex: 12,
        chapterTitle: 'Part Three - Chapter 13',
        context: {
          position: 'rising_action',
          chapterSignificance: 'Jim hides in apple barrel, overhears mutiny plot',
          narrativeMode: 'First-person hidden witness',
          dominantTechnique: 'Overheard revelation, dramatic irony',
          emotionalRegister: 'Terror, revelation, moral complexity',
          themes: ['betrayal', 'knowledge', 'danger', 'complicity'],
          passageDescription: 'Jim, hiding in barrel, hears Silver reveal mutiny plan and his murders',
          literarySignificance: 'Jim gains adult knowledge through concealment. Innocence ends with overheard evil.',
          expectedFeatures: [
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Jim can only hear, not see or act' },
            { feature: 'epistemic_risk_uncertainty', expectation: 'high', rationale: 'Everything he believed is wrong' },
            { feature: 'time_pressure_tradeoffs', expectation: 'high', rationale: 'Must not be discovered' }
          ]
        }
      },
      {
        chapterIndex: 25,
        chapterTitle: 'Part Five - Chapter 26',
        context: {
          position: 'climax',
          chapterSignificance: 'Jim faces Israel Hands in rigging',
          narrativeMode: 'Action first-person, present-tense feeling',
          dominantTechnique: 'Physical combat, survival decisions',
          emotionalRegister: 'Terror, determination, violence',
          themes: ['survival', 'killing', 'coming-of-age', 'violence'],
          passageDescription: 'Jim climbs rigging to escape Hands, must shoot him to survive',
          literarySignificance: 'Jim\'s first kill. Child becomes capable of lethal violence when necessary.',
          expectedFeatures: [
            { feature: 'time_pressure_tradeoffs', expectation: 'high', rationale: 'Kill or be killed, instantly' },
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Cannot un-kill Hands' },
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Physical struggle in rigging' }
          ]
        }
      }
    ]
  },

  // ============================================================
  // NARRATIVE FICTION - Victorian Novel
  // ============================================================
  {
    gutenbergId: 1400,
    title: 'Great Expectations',
    author: 'Charles Dickens',
    publicationYear: 1861,
    genre: 'narrative',
    literaryPeriod: 'Victorian',
    overallSignificance: 'Bildungsroman exploring class, guilt, and self-deception. First-person retrospective narration creates ironic distance.',
    chapters: [
      {
        chapterIndex: 0,
        chapterTitle: 'Chapter 1',
        context: {
          position: 'opening',
          chapterSignificance: 'Pip encounters convict Magwitch in graveyard',
          narrativeMode: 'First-person retrospective with child perspective',
          dominantTechnique: 'Terror through child eyes, comic horror',
          emotionalRegister: 'Fear, vulnerability, dark comedy',
          themes: ['childhood', 'crime', 'class', 'fear'],
          passageDescription: 'Young Pip in graveyard, confronted by terrifying escaped convict demanding food and file',
          literarySignificance: 'Opening establishes guilt and obligation that drives entire plot. Pip\'s kindness to convict will shape his life.',
          expectedFeatures: [
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Child cannot understand adult criminality' },
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Physical terror, marshes, cold' },
            { feature: 'scar_tissue_specificity', expectation: 'high', rationale: 'This encounter haunts Pip forever' }
          ]
        }
      },
      {
        chapterIndex: 7,
        chapterTitle: 'Chapter 8',
        context: {
          position: 'rising_action',
          chapterSignificance: 'Pip\'s first visit to Satis House; meets Estella',
          narrativeMode: 'First-person recall of class humiliation',
          dominantTechnique: 'Social embarrassment, awakening desire',
          emotionalRegister: 'Shame, fascination, wounded pride',
          themes: ['class', 'desire', 'shame', 'beauty'],
          passageDescription: 'Miss Havisham\'s decayed wedding feast, Estella\'s contempt for Pip\'s coarse hands',
          literarySignificance: 'Pip becomes ashamed of himself. Estella\'s cruelty creates the ambition that will ruin him.',
          expectedFeatures: [
            { feature: 'scar_tissue_specificity', expectation: 'high', rationale: 'Estella\'s contempt brands Pip permanently' },
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Pip cannot see Miss Havisham\'s manipulation' },
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Class marked on body - coarse hands' }
          ]
        }
      },
      {
        chapterIndex: 38,
        chapterTitle: 'Chapter 39',
        context: {
          position: 'climax',
          chapterSignificance: 'Magwitch reveals he is Pip\'s benefactor',
          narrativeMode: 'First-person shock and revision',
          dominantTechnique: 'Dramatic revelation, identity crisis',
          emotionalRegister: 'Horror, revulsion, shame',
          themes: ['class', 'gratitude', 'self-deception', 'crime'],
          passageDescription: 'The convict returns to claim Pip as "his gentleman" - all expectations revealed as built on criminal money',
          literarySignificance: 'The novel\'s great reversal. Pip\'s entire self-image collapses. His snobbery is exposed.',
          expectedFeatures: [
            { feature: 'epistemic_risk_uncertainty', expectation: 'high', rationale: 'Everything Pip believed was wrong' },
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Cannot return the money or the years' },
            { feature: 'scar_tissue_specificity', expectation: 'high', rationale: 'Pip\'s shame at his benefactor' }
          ]
        }
      },
      {
        chapterIndex: 48,
        chapterTitle: 'Chapter 49',
        context: {
          position: 'falling_action',
          chapterSignificance: 'Pip confronts Miss Havisham; her dress catches fire',
          narrativeMode: 'First-person action and reckoning',
          dominantTechnique: 'Dramatic confrontation, physical crisis',
          emotionalRegister: 'Accusation, forgiveness, catastrophe',
          themes: ['revenge', 'forgiveness', 'consequences', 'redemption'],
          passageDescription: 'Pip accuses Miss Havisham of ruining him; she begs forgiveness; her wedding dress ignites',
          literarySignificance: 'Miss Havisham\'s living death becomes actual. Fire as justice and purgation.',
          expectedFeatures: [
            { feature: 'time_pressure_tradeoffs', expectation: 'high', rationale: 'Must act instantly to save her' },
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Physical struggle with fire, burns' },
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Pip chooses to save his tormentor' }
          ]
        }
      },
      {
        chapterIndex: 58,
        chapterTitle: 'Chapter 59',
        context: {
          position: 'resolution',
          chapterSignificance: 'Final meeting with Estella in Satis House garden',
          narrativeMode: 'Elegiac first-person',
          dominantTechnique: 'Ambiguous resolution, transformation acknowledged',
          emotionalRegister: 'Melancholy, acceptance, muted hope',
          themes: ['time', 'suffering', 'change', 'partnership'],
          passageDescription: 'Pip and Estella meet in ruined garden; both transformed by suffering',
          literarySignificance: 'Suffering has educated both. Whether they unite is deliberately ambiguous.',
          expectedFeatures: [
            { feature: 'scar_tissue_specificity', expectation: 'high', rationale: 'Both shaped by their wounds' },
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Pip can only see surface of Estella\'s change' },
            { feature: 'commitment_irreversibility', expectation: 'medium', rationale: 'Future left open' }
          ]
        }
      }
    ]
  },

  // ============================================================
  // GOTHIC - Aestheticism and Horror
  // ============================================================
  {
    gutenbergId: 174,
    title: 'The Picture of Dorian Gray',
    author: 'Oscar Wilde',
    publicationYear: 1890,
    genre: 'gothic',
    literaryPeriod: 'Victorian Decadent',
    overallSignificance: 'Gothic Faustian tale exploring art, morality, and the split between appearance and soul.',
    chapters: [
      {
        chapterIndex: 1,
        chapterTitle: 'Chapter 2',
        context: {
          position: 'rising_action',
          chapterSignificance: 'Lord Henry corrupts Dorian; Dorian makes his fatal wish',
          narrativeMode: 'Third-person with epigrams and philosophy',
          dominantTechnique: 'Seductive dialogue, Wildean paradox',
          emotionalRegister: 'Languid, philosophical, ominous',
          themes: ['youth', 'beauty', 'influence', 'art'],
          passageDescription: 'Lord Henry philosophizes on youth; Dorian wishes the portrait would age instead of him',
          literarySignificance: 'The Faustian bargain made without knowing cost. Lord Henry as tempter.',
          expectedFeatures: [
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Wish cannot be unwished' },
            { feature: 'anti_smoothing', expectation: 'high', rationale: 'Wilde takes clear aesthetic positions' },
            { feature: 'epistemic_risk_uncertainty', expectation: 'medium', rationale: 'Dorian doesn\'t know what he\'s agreed to' }
          ]
        }
      },
      {
        chapterIndex: 7,
        chapterTitle: 'Chapter 8',
        context: {
          position: 'rising_action',
          chapterSignificance: 'Dorian rejects Sibyl Vane after her bad performance',
          narrativeMode: 'Third-person emotional scene',
          dominantTechnique: 'Cruelty revealed through dialogue',
          emotionalRegister: 'Cold cruelty, devastation',
          themes: ['art vs life', 'cruelty', 'love', 'performance'],
          passageDescription: 'Dorian tells Sibyl she has killed his love by acting badly; discovers first change in portrait',
          literarySignificance: 'First moral corruption visible. Dorian chooses art over human love.',
          expectedFeatures: [
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Cannot unsay cruel words' },
            { feature: 'scar_tissue_specificity', expectation: 'high', rationale: 'Portrait records this sin' },
            { feature: 'anti_smoothing', expectation: 'high', rationale: 'Dorian\'s cruelty unqualified' }
          ]
        }
      },
      {
        chapterIndex: 12,
        chapterTitle: 'Chapter 13',
        context: {
          position: 'climax',
          chapterSignificance: 'Dorian murders Basil Hallward',
          narrativeMode: 'Third-person horror scene',
          dominantTechnique: 'Building dread, sudden violence',
          emotionalRegister: 'Tension, horror, detached cruelty',
          themes: ['murder', 'secrets', 'corruption', 'art'],
          passageDescription: 'Basil sees the corrupted portrait; Dorian stabs him in sudden rage',
          literarySignificance: 'Dorian kills his creator. Portrait witnessed, must be destroyed.',
          expectedFeatures: [
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Murder cannot be undone' },
            { feature: 'time_pressure_tradeoffs', expectation: 'high', rationale: 'Split-second decision to kill' },
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Physical violence, blood' }
          ]
        }
      },
      {
        chapterIndex: 19,
        chapterTitle: 'Chapter 20',
        context: {
          position: 'resolution',
          chapterSignificance: 'Dorian stabs the portrait and destroys himself',
          narrativeMode: 'Third-person climax and aftermath',
          dominantTechnique: 'Gothic horror, poetic justice',
          emotionalRegister: 'Desperate, horrific, conclusive',
          themes: ['self-destruction', 'justice', 'identity', 'art'],
          passageDescription: 'Dorian stabs portrait to destroy evidence; servants find corrupted corpse beside beautiful painting',
          literarySignificance: 'Soul and body reunite in death. The portrait is restored; Dorian receives his true face.',
          expectedFeatures: [
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Final act destroys both self and art' },
            { feature: 'scar_tissue_specificity', expectation: 'high', rationale: 'All sins concentrated in corpse' },
            { feature: 'time_pressure_tradeoffs', expectation: 'high', rationale: 'Impulsive final act' }
          ]
        }
      }
    ]
  },

  // ============================================================
  // ADVENTURE - Survival Narrative
  // ============================================================
  {
    gutenbergId: 521,
    title: 'Robinson Crusoe',
    author: 'Daniel Defoe',
    publicationYear: 1719,
    genre: 'adventure',
    literaryPeriod: 'Early Modern/Enlightenment',
    overallSignificance: 'Foundational novel. Survival narrative as spiritual autobiography and colonial imagination.',
    chapters: [
      {
        chapterIndex: 2,
        chapterTitle: 'Shipwreck',
        context: {
          position: 'opening',
          chapterSignificance: 'Crusoe survives wreck, finds himself alone on island',
          narrativeMode: 'First-person journal with retrospective commentary',
          dominantTechnique: 'Survival accounting, Providence narrative',
          emotionalRegister: 'Despair turning to determination',
          themes: ['survival', 'providence', 'isolation', 'resourcefulness'],
          passageDescription: 'Crusoe wakes on beach, realizes he is sole survivor, begins to take stock',
          literarySignificance: 'The original desert island scenario. Crusoe must remake civilization alone.',
          expectedFeatures: [
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Immediate physical needs dominate' },
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Alone with only his perceptions' },
            { feature: 'time_pressure_tradeoffs', expectation: 'high', rationale: 'Must find water, shelter before dark' }
          ]
        }
      },
      {
        chapterIndex: 4,
        chapterTitle: 'First Year',
        context: {
          position: 'rising_action',
          chapterSignificance: 'Crusoe establishes routine, builds fortification',
          narrativeMode: 'Journal accounting with moral reflection',
          dominantTechnique: 'Practical detail, spiritual accounting',
          emotionalRegister: 'Methodical, reflective, resigned',
          themes: ['labor', 'order', 'time', 'self-sufficiency'],
          passageDescription: 'Detailed account of building shelter, making tools, establishing agriculture',
          literarySignificance: 'Technology and labor as redemption. Crusoe creates England from nothing.',
          expectedFeatures: [
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Cannot leave; must make do' },
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Physical labor described in detail' },
            { feature: 'scar_tissue_specificity', expectation: 'medium', rationale: 'Accumulating experience shapes method' }
          ]
        }
      },
      {
        chapterIndex: 10,
        chapterTitle: 'Footprint',
        context: {
          position: 'climax',
          chapterSignificance: 'Crusoe discovers human footprint on beach',
          narrativeMode: 'First-person terror retrospectively recalled',
          dominantTechnique: 'Psychological horror, paranoia',
          emotionalRegister: 'Terror, paranoia, destabilization',
          themes: ['other', 'fear', 'civilization', 'cannibalism'],
          passageDescription: 'Single footprint destroys Crusoe\'s sense of safety; two years of paranoid fortification follow',
          literarySignificance: 'The Other arrives. Crusoe\'s island utopia invaded by threat of human contact.',
          expectedFeatures: [
            { feature: 'epistemic_risk_uncertainty', expectation: 'high', rationale: 'Cannot know who, how many, intentions' },
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Footprint is his only evidence' },
            { feature: 'scar_tissue_specificity', expectation: 'high', rationale: 'Fear persists for years' }
          ]
        }
      },
      {
        chapterIndex: 15,
        chapterTitle: 'Friday',
        context: {
          position: 'falling_action',
          chapterSignificance: 'Crusoe rescues and "civilizes" Friday',
          narrativeMode: 'First-person colonial narrative',
          dominantTechnique: 'Master narrative, cultural instruction',
          emotionalRegister: 'Paternalistic satisfaction',
          themes: ['colonialism', 'civilization', 'slavery', 'religion'],
          passageDescription: 'Crusoe rescues man from cannibals, names him Friday, teaches him English and Christianity',
          literarySignificance: 'Colonial imagination at work. Crusoe recreates European hierarchy on island.',
          expectedFeatures: [
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Taking a companion changes everything' },
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Friday\'s interiority invisible to Crusoe' },
            { feature: 'anti_smoothing', expectation: 'medium', rationale: 'Clear hierarchy established' }
          ]
        }
      }
    ]
  },

  // ============================================================
  // PHILOSOPHICAL ESSAY - American Transcendentalism
  // ============================================================
  {
    gutenbergId: 16643,
    title: 'Essays: First Series',
    author: 'Ralph Waldo Emerson',
    publicationYear: 1841,
    genre: 'argument',
    literaryPeriod: 'American Transcendentalist',
    overallSignificance: 'Foundation of American intellectual tradition. Emerson\'s essays argue for self-reliance and individual conscience.',
    chapters: [
      {
        chapterIndex: 1,
        chapterTitle: 'Self-Reliance',
        context: {
          position: 'climax',
          chapterSignificance: 'Core statement of Emersonian individualism',
          narrativeMode: 'First-person prophetic address',
          dominantTechnique: 'Aphorism, exhortation, paradox',
          emotionalRegister: 'Challenging, inspirational, demanding',
          themes: ['individualism', 'conformity', 'genius', 'society'],
          passageDescription: '"Trust thyself" - Emerson argues against conformity and for the authority of inner voice',
          literarySignificance: 'Arguably the most influential American essay. Defines American individualism.',
          expectedFeatures: [
            { feature: 'anti_smoothing', expectation: 'high', rationale: 'Emerson attacks conformity directly' },
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Demands reader change their life' },
            { feature: 'bounded_viewpoint', expectation: 'medium', rationale: 'Personal vision offered as universal' }
          ]
        }
      },
      {
        chapterIndex: 3,
        chapterTitle: 'Compensation',
        context: {
          position: 'rising_action',
          chapterSignificance: 'Theory of moral balance in universe',
          narrativeMode: 'Philosophical meditation',
          dominantTechnique: 'Examples, analogies, natural law',
          emotionalRegister: 'Searching, reassuring, complex',
          themes: ['justice', 'balance', 'cause and effect', 'morality'],
          passageDescription: 'Every action has consequences; nothing is gained without equivalent loss',
          literarySignificance: 'Emerson\'s theodicy - explaining evil and suffering through natural law.',
          expectedFeatures: [
            { feature: 'anti_smoothing', expectation: 'high', rationale: 'Takes clear position on cosmic justice' },
            { feature: 'epistemic_risk_uncertainty', expectation: 'medium', rationale: 'Acknowledges difficulty of seeing balance' },
            { feature: 'commitment_irreversibility', expectation: 'medium', rationale: 'Intellectual position staked' }
          ]
        }
      },
      {
        chapterIndex: 6,
        chapterTitle: 'The Over-Soul',
        context: {
          position: 'climax',
          chapterSignificance: 'Mystical philosophy of universal consciousness',
          narrativeMode: 'Prophetic meditation',
          dominantTechnique: 'Mystical rhetoric, accumulated images',
          emotionalRegister: 'Elevated, mystical, rhapsodic',
          themes: ['unity', 'transcendence', 'consciousness', 'divinity'],
          passageDescription: 'Description of moments when individual soul touches universal spirit',
          literarySignificance: 'Emerson\'s most mystical writing. Attempt to describe the ineffable.',
          expectedFeatures: [
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Personal mystical experience cannot be proven' },
            { feature: 'anti_smoothing', expectation: 'high', rationale: 'Clear metaphysical claims' },
            { feature: 'situatedness_body_social', expectation: 'low', rationale: 'Transcends physical situatedness' }
          ]
        }
      },
      {
        chapterIndex: 0,
        chapterTitle: 'History',
        context: {
          position: 'opening',
          chapterSignificance: 'History as biography of the universal mind',
          narrativeMode: 'Philosophical argument',
          dominantTechnique: 'Reinterpretation, analogy',
          emotionalRegister: 'Bold, revisionary',
          themes: ['history', 'self', 'universality', 'time'],
          passageDescription: 'All history is ultimately the history of one mind; each person contains all history',
          literarySignificance: 'Radical democratization of knowledge - you can understand anything through yourself.',
          expectedFeatures: [
            { feature: 'anti_smoothing', expectation: 'high', rationale: 'Bold thesis about historical knowledge' },
            { feature: 'commitment_irreversibility', expectation: 'medium', rationale: 'Stakes intellectual position' },
            { feature: 'bounded_viewpoint', expectation: 'medium', rationale: 'Speaks from personal insight' }
          ]
        }
      }
    ]
  },

  // ============================================================
  // NARRATIVE/GOTHIC - Victorian Female Bildungsroman
  // ============================================================
  {
    gutenbergId: 1260,
    title: 'Jane Eyre',
    author: 'Charlotte Brontë',
    publicationYear: 1847,
    genre: 'gothic',
    literaryPeriod: 'Victorian',
    overallSignificance: 'Revolutionary female voice. Gothic romance combined with fierce moral independence.',
    chapters: [
      {
        chapterIndex: 0,
        chapterTitle: 'Chapter 1',
        context: {
          position: 'opening',
          chapterSignificance: 'Jane\'s childhood isolation and rebellion',
          narrativeMode: 'First-person retrospective autobiography',
          dominantTechnique: 'Interior consciousness, class critique',
          emotionalRegister: 'Defiant, wounded, intelligent',
          themes: ['class', 'gender', 'justice', 'childhood'],
          passageDescription: 'Jane excluded from family circle, reads alone, confronts cruel John Reed',
          literarySignificance: 'Establishes Jane as outsider with fierce inner life. Reader immediately aligns with her.',
          expectedFeatures: [
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Child\'s limited but acute perception' },
            { feature: 'scar_tissue_specificity', expectation: 'high', rationale: 'Childhood wounds persist through novel' },
            { feature: 'anti_smoothing', expectation: 'high', rationale: 'Clear judgment of injustice' }
          ]
        }
      },
      {
        chapterIndex: 10,
        chapterTitle: 'Chapter 11',
        context: {
          position: 'rising_action',
          chapterSignificance: 'Jane arrives at Thornfield; first impressions',
          narrativeMode: 'First-person observation, gothic hints',
          dominantTechnique: 'Atmospheric description, mystery planted',
          emotionalRegister: 'Curious, hopeful, alert',
          themes: ['home', 'mystery', 'employment', 'secrets'],
          passageDescription: 'Jane explores Thornfield, meets Mrs. Fairfax, hears strange laugh from third floor',
          literarySignificance: 'Gothic mystery established. The laugh will prove to be Bertha Mason.',
          expectedFeatures: [
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Jane cannot know what laugh means' },
            { feature: 'epistemic_risk_uncertainty', expectation: 'high', rationale: 'Mysteries she cannot solve' },
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Physical exploration of house' }
          ]
        }
      },
      {
        chapterIndex: 22,
        chapterTitle: 'Chapter 23',
        context: {
          position: 'climax',
          chapterSignificance: 'Rochester proposes; Jane accepts as equal',
          narrativeMode: 'First-person romantic dialogue',
          dominantTechnique: 'Extended dialogue, emotional revelation',
          emotionalRegister: 'Passionate, equal, joyful',
          themes: ['love', 'equality', 'class', 'independence'],
          passageDescription: '"I am no bird; and no net ensnares me" - Jane asserts equality before accepting Rochester',
          literarySignificance: 'Revolutionary romantic scene. Jane demands recognition as equal soul.',
          expectedFeatures: [
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Engagement made' },
            { feature: 'anti_smoothing', expectation: 'high', rationale: 'Jane\'s fierce assertions of equality' },
            { feature: 'situatedness_body_social', expectation: 'medium', rationale: 'Class difference explicit' }
          ]
        }
      },
      {
        chapterIndex: 25,
        chapterTitle: 'Chapter 26',
        context: {
          position: 'climax',
          chapterSignificance: 'Wedding interrupted; Bertha Mason revealed',
          narrativeMode: 'First-person catastrophe',
          dominantTechnique: 'Gothic revelation, dramatic reversal',
          emotionalRegister: 'Shock, horror, moral crisis',
          themes: ['bigamy', 'madness', 'secrets', 'marriage'],
          passageDescription: 'Stranger halts wedding; Rochester already married to madwoman in attic',
          literarySignificance: 'The novel\'s great reversal. Jane\'s happiness built on deception.',
          expectedFeatures: [
            { feature: 'epistemic_risk_uncertainty', expectation: 'high', rationale: 'Everything Jane believed was false' },
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Cannot unknow this truth' },
            { feature: 'scar_tissue_specificity', expectation: 'high', rationale: 'Trust fundamentally broken' }
          ]
        }
      },
      {
        chapterIndex: 37,
        chapterTitle: 'Chapter 38',
        context: {
          position: 'resolution',
          chapterSignificance: 'Jane returns to blinded Rochester; marriage',
          narrativeMode: 'First-person reunion',
          dominantTechnique: 'Recognition scene, role reversal',
          emotionalRegister: 'Tenderness, equality achieved',
          themes: ['equality', 'vision', 'love', 'independence'],
          passageDescription: 'Jane, now independent, returns to disabled Rochester; they marry as equals',
          literarySignificance: 'Rochester\'s disability equalizes them. Jane\'s independence enables true partnership.',
          expectedFeatures: [
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Final marriage made freely' },
            { feature: 'scar_tissue_specificity', expectation: 'high', rationale: 'Both transformed by suffering' },
            { feature: 'anti_smoothing', expectation: 'medium', rationale: 'Clear statement of achieved equality' }
          ]
        }
      }
    ]
  },

  // ============================================================
  // NARRATIVE - Detective Fiction
  // ============================================================
  {
    gutenbergId: 1661,
    title: 'The Adventures of Sherlock Holmes',
    author: 'Arthur Conan Doyle',
    publicationYear: 1892,
    genre: 'narrative',
    literaryPeriod: 'Victorian',
    overallSignificance: 'Defined detective fiction. Watson\'s narration creates bounded viewpoint that makes revelation possible.',
    chapters: [
      {
        chapterIndex: 0,
        chapterTitle: 'A Scandal in Bohemia',
        context: {
          position: 'opening',
          chapterSignificance: 'Holmes bested by Irene Adler',
          narrativeMode: 'First-person Watson, admiring',
          dominantTechnique: 'Mystery structure, revelation',
          emotionalRegister: 'Admiration, surprise, respect',
          themes: ['intelligence', 'gender', 'deduction', 'defeat'],
          passageDescription: 'Holmes attempts to retrieve compromising photo; Irene Adler outwits him',
          literarySignificance: 'Unique story where Holmes fails. "The Woman" - Adler as intellectual equal.',
          expectedFeatures: [
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Watson cannot follow Holmes\'s reasoning' },
            { feature: 'epistemic_risk_uncertainty', expectation: 'high', rationale: 'Holmes\'s deductions can be wrong' },
            { feature: 'time_pressure_tradeoffs', expectation: 'medium', rationale: 'Must act before king\'s wedding' }
          ]
        }
      },
      {
        chapterIndex: 2,
        chapterTitle: 'A Case of Identity',
        context: {
          position: 'rising_action',
          chapterSignificance: 'Domestic mystery of disappeared fiancé',
          narrativeMode: 'First-person Watson observation',
          dominantTechnique: 'Deductive display, social commentary',
          emotionalRegister: 'Clinical interest, moral judgment',
          themes: ['identity', 'deception', 'family', 'women'],
          passageDescription: 'Holmes deduces missing fiancé is stepfather in disguise',
          literarySignificance: 'Shows Holmes\'s method on domestic scale. Social critique of women\'s vulnerability.',
          expectedFeatures: [
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Watson and client both deceived' },
            { feature: 'anti_smoothing', expectation: 'medium', rationale: 'Holmes judges stepfather harshly' },
            { feature: 'epistemic_risk_uncertainty', expectation: 'medium', rationale: 'Holmes risks being wrong' }
          ]
        }
      },
      {
        chapterIndex: 4,
        chapterTitle: 'The Boscombe Valley Mystery',
        context: {
          position: 'rising_action',
          chapterSignificance: 'Murder investigation with hidden past',
          narrativeMode: 'First-person investigation narrative',
          dominantTechnique: 'Evidence analysis, revelation of past',
          emotionalRegister: 'Investigative tension, compassion',
          themes: ['justice', 'past', 'mercy', 'evidence'],
          passageDescription: 'Holmes proves accused innocent; reveals true murderer\'s justified motive',
          literarySignificance: 'Holmes as instrument of mercy rather than strict law. Justice vs. legality.',
          expectedFeatures: [
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Murder cannot be undone' },
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Past events only known through clues' },
            { feature: 'time_pressure_tradeoffs', expectation: 'high', rationale: 'Innocent man may hang' }
          ]
        }
      },
      {
        chapterIndex: 6,
        chapterTitle: 'The Man with the Twisted Lip',
        context: {
          position: 'climax',
          chapterSignificance: 'Mystery of disappeared respectable husband',
          narrativeMode: 'First-person night-journey narrative',
          dominantTechnique: 'Urban underworld, identity revelation',
          emotionalRegister: 'Suspense, surprise, social commentary',
          themes: ['identity', 'class', 'disguise', 'respectability'],
          passageDescription: 'Missing husband revealed to be professional beggar earning more than respectable work',
          literarySignificance: 'Class critique through detective form. Begging more profitable than honest work.',
          expectedFeatures: [
            { feature: 'epistemic_risk_uncertainty', expectation: 'high', rationale: 'Identity completely hidden' },
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Opium den, class markers' },
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Disguise fools everyone' }
          ]
        }
      }
    ]
  },

  // ============================================================
  // PHILOSOPHICAL - Classical
  // ============================================================
  {
    gutenbergId: 1497,
    title: 'The Republic',
    author: 'Plato',
    publicationYear: -380,
    genre: 'argument',
    literaryPeriod: 'Classical Greek',
    overallSignificance: 'Foundation of Western philosophy. Dialectical method creates dramatic philosophical investigation.',
    chapters: [
      {
        chapterIndex: 6,
        chapterTitle: 'Book VII - The Cave',
        context: {
          position: 'climax',
          chapterSignificance: 'The Allegory of the Cave',
          narrativeMode: 'Socratic dialogue with extended metaphor',
          dominantTechnique: 'Philosophical allegory, dialectic',
          emotionalRegister: 'Instructive, visionary',
          themes: ['knowledge', 'reality', 'education', 'enlightenment'],
          passageDescription: 'Prisoners in cave see only shadows; philosopher escapes to see sun (truth)',
          literarySignificance: 'Most famous philosophical image in Western tradition. Shapes all later epistemology.',
          expectedFeatures: [
            { feature: 'anti_smoothing', expectation: 'high', rationale: 'Clear distinction between shadow and reality' },
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Cannot return to shadow-belief after seeing sun' },
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Prisoners cannot know their limitation' }
          ]
        }
      },
      {
        chapterIndex: 0,
        chapterTitle: 'Book I',
        context: {
          position: 'opening',
          chapterSignificance: 'Initial debate on justice',
          narrativeMode: 'Socratic elenchus (cross-examination)',
          dominantTechnique: 'Question and refutation',
          emotionalRegister: 'Combative, ironic, searching',
          themes: ['justice', 'power', 'advantage', 'truth'],
          passageDescription: 'Socrates demolishes Thrasymachus\'s claim that justice is the advantage of the stronger',
          literarySignificance: 'Establishes dialectical method. Definitions proposed and destroyed.',
          expectedFeatures: [
            { feature: 'anti_smoothing', expectation: 'high', rationale: 'Positions taken and defended absolutely' },
            { feature: 'epistemic_risk_uncertainty', expectation: 'high', rationale: 'Each definition risks refutation' },
            { feature: 'commitment_irreversibility', expectation: 'medium', rationale: 'Intellectual positions staked' }
          ]
        }
      },
      {
        chapterIndex: 4,
        chapterTitle: 'Book V',
        context: {
          position: 'rising_action',
          chapterSignificance: 'Radical proposals: philosopher kings, women guardians',
          narrativeMode: 'Socratic construction of ideal',
          dominantTechnique: 'Utopian argument, thought experiment',
          emotionalRegister: 'Provocative, serious, paradoxical',
          themes: ['gender', 'power', 'philosophy', 'politics'],
          passageDescription: 'Socrates argues women can be guardians; philosophers should rule',
          literarySignificance: 'Shocking proposals for ancient audience. Philosophy as political qualification.',
          expectedFeatures: [
            { feature: 'anti_smoothing', expectation: 'high', rationale: 'Radical positions without compromise' },
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Socrates fully commits to ideal' },
            { feature: 'epistemic_risk_uncertainty', expectation: 'medium', rationale: 'Ideal may be impossible' }
          ]
        }
      }
    ]
  },

  // ============================================================
  // NARRATIVE - Epic Novel (Russian)
  // ============================================================
  {
    gutenbergId: 2600,
    title: 'War and Peace',
    author: 'Leo Tolstoy',
    publicationYear: 1869,
    genre: 'narrative',
    literaryPeriod: 'Realist',
    overallSignificance: 'Epic integration of history and fiction. Tolstoy\'s narration combines intimate psychology with historical philosophy.',
    chapters: [
      {
        chapterIndex: 0,
        chapterTitle: 'Book One, Part One',
        context: {
          position: 'opening',
          chapterSignificance: 'Anna Pavlovna\'s soirée introduces cast',
          narrativeMode: 'Third-person omniscient social comedy',
          dominantTechnique: 'Social panorama, ironic distance',
          emotionalRegister: 'Satirical, observant',
          themes: ['society', 'war', 'hypocrisy', 'politics'],
          passageDescription: 'St. Petersburg aristocrats discuss Napoleon while performing social rituals',
          literarySignificance: 'Opens on society\'s superficiality before war\'s reality intrudes.',
          expectedFeatures: [
            { feature: 'anti_smoothing', expectation: 'medium', rationale: 'Ironic distance from social performance' },
            { feature: 'bounded_viewpoint', expectation: 'low', rationale: 'Omniscient narrator sees all' },
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Social positioning everywhere' }
          ]
        }
      },
      {
        chapterIndex: 30,
        chapterTitle: 'Austerlitz',
        context: {
          position: 'climax',
          chapterSignificance: 'Prince Andrei wounded at Austerlitz; sky vision',
          narrativeMode: 'Third-person intense psychological focus',
          dominantTechnique: 'Interior consciousness in crisis',
          emotionalRegister: 'Transcendent, disillusioned',
          themes: ['war', 'glory', 'death', 'meaning'],
          passageDescription: 'Andrei lies wounded, sees infinite sky, Napoleon seems small',
          literarySignificance: 'Glory revealed as vanity. Near-death transforms Andrei\'s values.',
          expectedFeatures: [
            { feature: 'scar_tissue_specificity', expectation: 'high', rationale: 'Wound and vision shape rest of life' },
            { feature: 'epistemic_risk_uncertainty', expectation: 'high', rationale: 'All certainties dissolve' },
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Wounded body, battlefield' }
          ]
        }
      },
      {
        chapterIndex: 90,
        chapterTitle: 'Borodino',
        context: {
          position: 'climax',
          chapterSignificance: 'Battle of Borodino through Pierre\'s eyes',
          narrativeMode: 'Third-person civilian perspective on war',
          dominantTechnique: 'Defamiliarization, confusion as truth',
          emotionalRegister: 'Chaotic, terrifying, revelatory',
          themes: ['war', 'chaos', 'courage', 'death'],
          passageDescription: 'Pierre wanders battlefield without understanding what he sees',
          literarySignificance: 'War stripped of heroic narrative. Pierre\'s confusion is truth; generals\' plans are fantasy.',
          expectedFeatures: [
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Pierre cannot see pattern in battle' },
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Physical presence amid death' },
            { feature: 'time_pressure_tradeoffs', expectation: 'high', rationale: 'Moment to moment survival' }
          ]
        }
      },
      {
        chapterIndex: 120,
        chapterTitle: 'Epilogue',
        context: {
          position: 'resolution',
          chapterSignificance: 'Domestic happiness and philosophical conclusion',
          narrativeMode: 'Third-person domestic, then essayistic',
          dominantTechnique: 'Family scene followed by historical theory',
          emotionalRegister: 'Peaceful, searching, argumentative',
          themes: ['family', 'history', 'freedom', 'necessity'],
          passageDescription: 'Pierre and Natasha\'s family life; Tolstoy\'s theory of history',
          literarySignificance: 'Tolstoy argues against great-man theory. History moves through masses, not leaders.',
          expectedFeatures: [
            { feature: 'anti_smoothing', expectation: 'high', rationale: 'Strong philosophical position taken' },
            { feature: 'commitment_irreversibility', expectation: 'medium', rationale: 'Characters settled into lives' },
            { feature: 'bounded_viewpoint', expectation: 'low', rationale: 'Omniscient narrator philosophizes' }
          ]
        }
      }
    ]
  },

  // ============================================================
  // NARRATIVE - Epic Novel (French)
  // ============================================================
  {
    gutenbergId: 135,
    title: 'Les Misérables',
    author: 'Victor Hugo',
    publicationYear: 1862,
    genre: 'narrative',
    literaryPeriod: 'Romantic/Realist',
    overallSignificance: 'Epic of redemption and social justice. Hugo combines melodrama with social critique.',
    chapters: [
      {
        chapterIndex: 5,
        chapterTitle: 'Fantine - Book Second',
        context: {
          position: 'opening',
          chapterSignificance: 'Jean Valjean steals Bishop\'s silver; transformed by mercy',
          narrativeMode: 'Third-person moral drama',
          dominantTechnique: 'Moral crisis, grace',
          emotionalRegister: 'Tension, shame, transformation',
          themes: ['redemption', 'mercy', 'crime', 'grace'],
          passageDescription: 'Valjean steals silver, caught, Bishop says it was a gift and gives candlesticks too',
          literarySignificance: 'The act of grace that transforms Valjean. Hugo\'s thesis: mercy redeems.',
          expectedFeatures: [
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Valjean\'s life changes forever' },
            { feature: 'scar_tissue_specificity', expectation: 'high', rationale: 'This grace becomes permanent debt' },
            { feature: 'anti_smoothing', expectation: 'high', rationale: 'Clear moral position on mercy vs law' }
          ]
        }
      },
      {
        chapterIndex: 20,
        chapterTitle: 'Fantine - Book Seventh',
        context: {
          position: 'rising_action',
          chapterSignificance: 'Champmathieu affair - Valjean must reveal himself or let innocent suffer',
          narrativeMode: 'Third-person agonized deliberation',
          dominantTechnique: 'Interior moral wrestling',
          emotionalRegister: 'Anguished, torn',
          themes: ['justice', 'identity', 'sacrifice', 'conscience'],
          passageDescription: 'Valjean debates all night whether to confess and save Champmathieu',
          literarySignificance: 'Great moral crisis. Valjean chooses truth over safety.',
          expectedFeatures: [
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Confession cannot be unsaid' },
            { feature: 'time_pressure_tradeoffs', expectation: 'high', rationale: 'Trial is tomorrow' },
            { feature: 'epistemic_risk_uncertainty', expectation: 'medium', rationale: 'Cannot know consequences' }
          ]
        }
      },
      {
        chapterIndex: 80,
        chapterTitle: 'Marius - Book Eighth',
        context: {
          position: 'rising_action',
          chapterSignificance: 'Jondrette ambush; Marius discovers Thénardiers',
          narrativeMode: 'Third-person thriller',
          dominantTechnique: 'Suspense, hidden observer',
          emotionalRegister: 'Tension, horror, moral conflict',
          themes: ['poverty', 'crime', 'recognition', 'debt'],
          passageDescription: 'Marius overhears plot to rob Valjean; torn between saving target and honoring father\'s debt',
          literarySignificance: 'Layers of obligation conflict. Marius paralyzed between duties.',
          expectedFeatures: [
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Marius sees through crack, cannot act' },
            { feature: 'time_pressure_tradeoffs', expectation: 'high', rationale: 'Violence imminent' },
            { feature: 'epistemic_risk_uncertainty', expectation: 'high', rationale: 'Doesn\'t know who Valjean is' }
          ]
        }
      },
      {
        chapterIndex: 120,
        chapterTitle: 'Jean Valjean - Book Third',
        context: {
          position: 'climax',
          chapterSignificance: 'Barricades fall; Valjean carries Marius through sewers',
          narrativeMode: 'Third-person heroic action',
          dominantTechnique: 'Physical ordeal, moral determination',
          emotionalRegister: 'Desperate, determined, sacrificial',
          themes: ['sacrifice', 'love', 'sewers', 'salvation'],
          passageDescription: 'Valjean carries unconscious Marius through Paris sewers to save him for Cosette',
          literarySignificance: 'Descent into underworld. Valjean\'s redemption complete through sacrifice.',
          expectedFeatures: [
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Physical ordeal in sewers' },
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Life staked on this journey' },
            { feature: 'time_pressure_tradeoffs', expectation: 'high', rationale: 'Marius may die, pursuers follow' }
          ]
        }
      }
    ]
  },

  // ============================================================
  // MEMOIR - Drug Experience
  // ============================================================
  {
    gutenbergId: 2040,
    title: 'Confessions of an English Opium-Eater',
    author: 'Thomas De Quincey',
    publicationYear: 1821,
    genre: 'memoir',
    literaryPeriod: 'Romantic',
    overallSignificance: 'First addiction memoir. De Quincey\'s prose style influenced generations of writers.',
    chapters: [
      {
        chapterIndex: 0,
        chapterTitle: 'Preliminary Confessions',
        context: {
          position: 'opening',
          chapterSignificance: 'Childhood and youth leading to first opium use',
          narrativeMode: 'First-person confessional retrospective',
          dominantTechnique: 'Personal history as causal chain',
          emotionalRegister: 'Apologetic, self-analytical',
          themes: ['childhood', 'education', 'poverty', 'suffering'],
          passageDescription: 'De Quincey recounts running away from school, London poverty, meeting Ann the prostitute',
          literarySignificance: 'Establishes suffering that "justified" opium use. Ann becomes symbolic lost figure.',
          expectedFeatures: [
            { feature: 'scar_tissue_specificity', expectation: 'high', rationale: 'Lost Ann haunts his dreams forever' },
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Can only know his experience' },
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Physical hunger, cold, poverty' }
          ]
        }
      },
      {
        chapterIndex: 1,
        chapterTitle: 'Pleasures of Opium',
        context: {
          position: 'rising_action',
          chapterSignificance: 'First opium experience and its intellectual pleasures',
          narrativeMode: 'First-person rhapsodic',
          dominantTechnique: 'Elevated description, philosophical reverie',
          emotionalRegister: 'Ecstatic, intellectual, warning',
          themes: ['pleasure', 'consciousness', 'art', 'danger'],
          passageDescription: 'De Quincey describes opium\'s effects: enhanced music, vast mental palaces',
          literarySignificance: 'Seductive portrait of drug experience. Reader drawn into pleasure before warned of cost.',
          expectedFeatures: [
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Altered bodily states described' },
            { feature: 'anti_smoothing', expectation: 'medium', rationale: 'Defends opium against prejudice' },
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Subjective drug experience' }
          ]
        }
      },
      {
        chapterIndex: 2,
        chapterTitle: 'Pains of Opium',
        context: {
          position: 'climax',
          chapterSignificance: 'Addiction\'s nightmares and physical deterioration',
          narrativeMode: 'First-person horror testimony',
          dominantTechnique: 'Dream narration, physical suffering',
          emotionalRegister: 'Terrified, trapped, anguished',
          themes: ['addiction', 'nightmare', 'time', 'slavery'],
          passageDescription: 'Architectural dreams, crocodiles, Asian horrors, sense of endless time',
          literarySignificance: 'The dark counterweight. Dreams become prisons; pleasure becomes slavery.',
          expectedFeatures: [
            { feature: 'scar_tissue_specificity', expectation: 'high', rationale: 'Dreams persist long after' },
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Physical dependence and suffering' },
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Cannot simply stop' }
          ]
        }
      }
    ]
  },

  // ============================================================
  // GOTHIC/ADVENTURE - Heart of Darkness
  // ============================================================
  {
    gutenbergId: 219,
    title: 'Heart of Darkness',
    author: 'Joseph Conrad',
    publicationYear: 1899,
    genre: 'gothic',
    literaryPeriod: 'Modernist Precursor',
    overallSignificance: 'Critique of colonialism through gothic frame. Nested narration creates layers of uncertainty.',
    chapters: [
      {
        chapterIndex: 0,
        chapterTitle: 'Part I',
        context: {
          position: 'opening',
          chapterSignificance: 'Frame narrative; Marlow begins story',
          narrativeMode: 'Frame narration (unnamed narrator reporting Marlow)',
          dominantTechnique: 'Atmospheric framing, deferred narration',
          emotionalRegister: 'Brooding, anticipatory',
          themes: ['colonialism', 'darkness', 'civilization', 'storytelling'],
          passageDescription: 'On Thames at dusk, Marlow begins telling of his Congo journey',
          literarySignificance: 'Thames and Congo linked as sites of darkness. Civilization questioned.',
          expectedFeatures: [
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Multiple layers of narration' },
            { feature: 'anti_smoothing', expectation: 'medium', rationale: 'Critical stance emerging' },
            { feature: 'situatedness_body_social', expectation: 'medium', rationale: 'Physical Thames setting' }
          ]
        }
      },
      {
        chapterIndex: 1,
        chapterTitle: 'Part II',
        context: {
          position: 'rising_action',
          chapterSignificance: 'Journey upriver; accumulating horror',
          narrativeMode: 'Marlow\'s narration with increasing uncertainty',
          dominantTechnique: 'Impressionist description, moral confusion',
          emotionalRegister: 'Disturbed, fascinated, horrified',
          themes: ['savagery', 'civilization', 'madness', 'colonialism'],
          passageDescription: 'Marlow travels deeper into Congo, witnesses colonial atrocities, hears of Kurtz',
          literarySignificance: 'Each station reveals worse horror. Kurtz becomes mythic figure.',
          expectedFeatures: [
            { feature: 'epistemic_risk_uncertainty', expectation: 'high', rationale: 'Marlow cannot understand what he sees' },
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Impression without comprehension' },
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Physical river journey' }
          ]
        }
      },
      {
        chapterIndex: 2,
        chapterTitle: 'Part III',
        context: {
          position: 'climax',
          chapterSignificance: 'Meeting Kurtz; "The horror"',
          narrativeMode: 'Marlow\'s fragmentary account',
          dominantTechnique: 'Elliptical revelation, dying words',
          emotionalRegister: 'Horrified fascination, ambiguity',
          themes: ['evil', 'truth', 'lies', 'civilization'],
          passageDescription: 'Kurtz revealed as corrupted god-figure; his dying words "The horror!"',
          literarySignificance: 'Ambiguous climax. What did Kurtz see? His judgment or confession?',
          expectedFeatures: [
            { feature: 'epistemic_risk_uncertainty', expectation: 'high', rationale: '"The horror" resists interpretation' },
            { feature: 'scar_tissue_specificity', expectation: 'high', rationale: 'Marlow permanently marked' },
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Kurtz\'s meaning inaccessible' }
          ]
        }
      }
    ]
  },

  // ============================================================
  // GOTHIC - Psychological
  // ============================================================
  {
    gutenbergId: 43,
    title: 'The Strange Case of Dr Jekyll and Mr Hyde',
    author: 'Robert Louis Stevenson',
    publicationYear: 1886,
    genre: 'gothic',
    literaryPeriod: 'Late Victorian',
    overallSignificance: 'Psychological gothic exploring divided self. Third-person investigation delays revelation.',
    chapters: [
      {
        chapterIndex: 0,
        chapterTitle: 'Story of the Door',
        context: {
          position: 'opening',
          chapterSignificance: 'Utterson hears of Hyde trampling child',
          narrativeMode: 'Third-person limited (Utterson\'s investigation)',
          dominantTechnique: 'Mystery establishment, urban gothic',
          emotionalRegister: 'Unease, curiosity, dread',
          themes: ['duality', 'respectability', 'evil', 'secrecy'],
          passageDescription: 'Enfield tells Utterson of witnessing Hyde trample a girl; the strange door',
          literarySignificance: 'Mystery established through rumor. Hyde as embodied wrongness.',
          expectedFeatures: [
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Utterson can only gather external evidence' },
            { feature: 'epistemic_risk_uncertainty', expectation: 'high', rationale: 'Cannot know Hyde\'s nature' },
            { feature: 'anti_smoothing', expectation: 'medium', rationale: 'Hyde immediately judged evil' }
          ]
        }
      },
      {
        chapterIndex: 4,
        chapterTitle: 'The Carew Murder Case',
        context: {
          position: 'climax',
          chapterSignificance: 'Hyde murders Sir Danvers Carew',
          narrativeMode: 'Third-person crime narrative',
          dominantTechnique: 'Witnessed violence, manhunt',
          emotionalRegister: 'Horror, urgency',
          themes: ['violence', 'evil', 'exposure', 'pursuit'],
          passageDescription: 'Maid witnesses Hyde beating Carew to death with a cane',
          literarySignificance: 'Hyde\'s evil fully manifested. No longer petty cruelty but murder.',
          expectedFeatures: [
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Murder cannot be undone' },
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Physical violence witnessed' },
            { feature: 'time_pressure_tradeoffs', expectation: 'high', rationale: 'Hyde must be caught' }
          ]
        }
      },
      {
        chapterIndex: 9,
        chapterTitle: 'Henry Jekyll\'s Full Statement',
        context: {
          position: 'resolution',
          chapterSignificance: 'Jekyll\'s confession explains everything',
          narrativeMode: 'First-person confessional letter',
          dominantTechnique: 'Retrospective explanation, tragedy',
          emotionalRegister: 'Anguished, analytical, despairing',
          themes: ['duality', 'science', 'self', 'destruction'],
          passageDescription: 'Jekyll explains experiment, gradual loss of control, inevitable death',
          literarySignificance: 'The mystery solved but meaning deepened. What was released was always in Jekyll.',
          expectedFeatures: [
            { feature: 'scar_tissue_specificity', expectation: 'high', rationale: 'Each transformation damages control' },
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Cannot undo transformation' },
            { feature: 'epistemic_risk_uncertainty', expectation: 'high', rationale: 'Jekyll discovers his nature' }
          ]
        }
      }
    ]
  },

  // ============================================================
  // GOTHIC - Romantic
  // ============================================================
  {
    gutenbergId: 768,
    title: 'Wuthering Heights',
    author: 'Emily Brontë',
    publicationYear: 1847,
    genre: 'gothic',
    literaryPeriod: 'Victorian',
    overallSignificance: 'Nested narration creates interpretive uncertainty. Passion that exceeds social bounds.',
    chapters: [
      {
        chapterIndex: 2,
        chapterTitle: 'Chapter 3',
        context: {
          position: 'opening',
          chapterSignificance: 'Lockwood\'s nightmare of Catherine\'s ghost',
          narrativeMode: 'First-person (Lockwood) experiencing supernatural',
          dominantTechnique: 'Gothic nightmare, violent imagery',
          emotionalRegister: 'Terror, confusion, cruelty',
          themes: ['ghosts', 'return', 'violence', 'boundaries'],
          passageDescription: 'Lockwood dreams of ghost-child Catherine; rubs her wrist on broken glass',
          literarySignificance: 'The dead insist on return. Lockwood\'s violence shocking. Heathcliff\'s grief revealed.',
          expectedFeatures: [
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Lockwood cannot understand what he witnesses' },
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Physical horror of the dream' },
            { feature: 'epistemic_risk_uncertainty', expectation: 'high', rationale: 'Was it real? What does it mean?' }
          ]
        }
      },
      {
        chapterIndex: 8,
        chapterTitle: 'Chapter 9',
        context: {
          position: 'rising_action',
          chapterSignificance: 'Catherine\'s "I am Heathcliff" speech; Heathcliff overhears and flees',
          narrativeMode: 'Nelly\'s narration of Catherine\'s confession',
          dominantTechnique: 'Overheard declaration, tragic timing',
          emotionalRegister: 'Passionate, desperate, world-changing',
          themes: ['identity', 'love', 'class', 'self'],
          passageDescription: 'Catherine explains why she must marry Linton but loves Heathcliff: "He\'s more myself than I am"',
          literarySignificance: 'The declaration that drives the plot. Heathcliff hears "degrade" but not "I am Heathcliff."',
          expectedFeatures: [
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Choice between Heathcliff and Linton' },
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Heathcliff only hears part' },
            { feature: 'scar_tissue_specificity', expectation: 'high', rationale: 'This moment defines all that follows' }
          ]
        }
      },
      {
        chapterIndex: 15,
        chapterTitle: 'Chapter 16',
        context: {
          position: 'climax',
          chapterSignificance: 'Catherine\'s death; Heathcliff\'s curse',
          narrativeMode: 'Nelly\'s narration of death scene',
          dominantTechnique: 'Deathbed passion, curse',
          emotionalRegister: 'Anguished, violent, supernatural',
          themes: ['death', 'love', 'haunting', 'curse'],
          passageDescription: 'Catherine dies after final meeting with Heathcliff; he begs her to haunt him',
          literarySignificance: 'The curse works. Heathcliff will be haunted. Death does not end the relationship.',
          expectedFeatures: [
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Death is final' },
            { feature: 'scar_tissue_specificity', expectation: 'high', rationale: 'Heathcliff\'s grief permanent' },
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Physical illness and death' }
          ]
        }
      },
      {
        chapterIndex: 33,
        chapterTitle: 'Chapter 34',
        context: {
          position: 'resolution',
          chapterSignificance: 'Heathcliff\'s death; possible union with Catherine',
          narrativeMode: 'Nelly\'s account of Heathcliff\'s final days',
          dominantTechnique: 'Supernatural anticipation, peaceful horror',
          emotionalRegister: 'Strange peace, uncanny',
          themes: ['death', 'reunion', 'peace', 'the supernatural'],
          passageDescription: 'Heathcliff stops eating, seems to see Catherine, dies with strange smile',
          literarySignificance: 'Ambiguous ending. Has he joined Catherine? Local sightings suggest ghosts together.',
          expectedFeatures: [
            { feature: 'bounded_viewpoint', expectation: 'high', rationale: 'Nelly cannot know what Heathcliff sees' },
            { feature: 'epistemic_risk_uncertainty', expectation: 'high', rationale: 'Supernatural truth uncertain' },
            { feature: 'scar_tissue_specificity', expectation: 'high', rationale: 'Lifetime of suffering ends' }
          ]
        }
      }
    ]
  },

  // ============================================================
  // NARRATIVE - American Romance/Gothic
  // ============================================================
  {
    gutenbergId: 25,
    title: 'The Scarlet Letter',
    author: 'Nathaniel Hawthorne',
    publicationYear: 1850,
    genre: 'narrative',
    literaryPeriod: 'American Renaissance',
    overallSignificance: 'Psychological study of guilt, punishment, and American Puritanism.',
    chapters: [
      {
        chapterIndex: 1,
        chapterTitle: 'The Prison-Door',
        context: {
          position: 'opening',
          chapterSignificance: 'Establishes Puritan setting; the rose bush',
          narrativeMode: 'Third-person omniscient, symbolic',
          dominantTechnique: 'Symbolic description, historical distance',
          emotionalRegister: 'Somber, anticipatory',
          themes: ['sin', 'punishment', 'nature', 'beauty'],
          passageDescription: 'Description of prison door, cemetery, wild rose bush as possible symbol of hope',
          literarySignificance: 'Symbolic groundwork. Prison, cemetery, rose - punishment and possible redemption.',
          expectedFeatures: [
            { feature: 'anti_smoothing', expectation: 'medium', rationale: 'Symbolic reading offered' },
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Physical Puritan environment' },
            { feature: 'bounded_viewpoint', expectation: 'low', rationale: 'Omniscient narrator' }
          ]
        }
      },
      {
        chapterIndex: 2,
        chapterTitle: 'The Market-Place',
        context: {
          position: 'opening',
          chapterSignificance: 'Hester on scaffold with Pearl; first appearance of scarlet letter',
          narrativeMode: 'Third-person with interior access',
          dominantTechnique: 'Public shame, private memory',
          emotionalRegister: 'Humiliation, defiance, memory',
          themes: ['shame', 'punishment', 'identity', 'motherhood'],
          passageDescription: 'Hester stands on scaffold displaying letter A; crowd watches; she remembers past',
          literarySignificance: 'Central image: woman and letter displayed. Her memories reveal backstory.',
          expectedFeatures: [
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Public shaming, physical display' },
            { feature: 'scar_tissue_specificity', expectation: 'high', rationale: 'The letter is permanent scar' },
            { feature: 'bounded_viewpoint', expectation: 'medium', rationale: 'Access to Hester\'s consciousness' }
          ]
        }
      },
      {
        chapterIndex: 16,
        chapterTitle: 'A Forest Walk',
        context: {
          position: 'rising_action',
          chapterSignificance: 'Hester and Pearl in forest before meeting Dimmesdale',
          narrativeMode: 'Third-person symbolic description',
          dominantTechnique: 'Nature as psychological landscape',
          emotionalRegister: 'Strange, liminal, questioning',
          themes: ['nature', 'wildness', 'freedom', 'law'],
          passageDescription: 'Forest as lawless space; Pearl plays with sunlight that flees Hester',
          literarySignificance: 'Forest as anti-society space where hidden truths can emerge.',
          expectedFeatures: [
            { feature: 'situatedness_body_social', expectation: 'high', rationale: 'Physical forest environment' },
            { feature: 'bounded_viewpoint', expectation: 'medium', rationale: 'Pearl\'s strangeness observed not explained' },
            { feature: 'anti_smoothing', expectation: 'medium', rationale: 'Nature vs. Puritan law' }
          ]
        }
      },
      {
        chapterIndex: 22,
        chapterTitle: 'The Revelation of the Scarlet Letter',
        context: {
          position: 'climax',
          chapterSignificance: 'Dimmesdale\'s public confession and death',
          narrativeMode: 'Third-person dramatic climax',
          dominantTechnique: 'Public revelation, ambiguous symbol',
          emotionalRegister: 'Anguished, liberated, transcendent',
          themes: ['confession', 'truth', 'death', 'redemption'],
          passageDescription: 'Dimmesdale confesses on scaffold, reveals mark on chest, dies in Hester\'s arms',
          literarySignificance: 'The parallel scaffold scene. What marked his chest is left ambiguous.',
          expectedFeatures: [
            { feature: 'commitment_irreversibility', expectation: 'high', rationale: 'Confession cannot be unsaid' },
            { feature: 'scar_tissue_specificity', expectation: 'high', rationale: 'Years of hidden guilt marked body' },
            { feature: 'epistemic_risk_uncertainty', expectation: 'high', rationale: 'What was the mark? Supernatural?' }
          ]
        }
      }
    ]
  }
];

// Helper to get total sample count
export function getTotalSampleCount(): number {
  return SURVEY_BOOKS.reduce((sum, book) => sum + book.chapters.length, 0);
}

// Helper to get all samples flattened
export function getAllSamples(): Array<{
  book: BookDefinition;
  chapter: BookDefinition['chapters'][0];
  sampleId: string;
}> {
  const samples: Array<{
    book: BookDefinition;
    chapter: BookDefinition['chapters'][0];
    sampleId: string;
  }> = [];

  for (const book of SURVEY_BOOKS) {
    for (const chapter of book.chapters) {
      samples.push({
        book,
        chapter,
        sampleId: `${book.gutenbergId}_ch${chapter.chapterIndex}`,
      });
    }
  }

  return samples;
}

console.log(`Total samples defined: ${getTotalSampleCount()}`);
