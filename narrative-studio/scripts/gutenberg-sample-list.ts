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
