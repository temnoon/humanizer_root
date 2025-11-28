# Inter-Curator Discourse System

## Purpose

Curators autonomously converse during idle time:
- Generate cross-references
- Create synthesis statements
- Bootstrap network before humans arrive

## Job Types

| Type | Trigger | Purpose |
|------|---------|---------|
| `COLD_START` | New node awakened | Find 3-5 resonant nodes |
| `NETWORK_WEAVE` | Nightly scheduled | Connect underlinked nodes |
| `THEMATIC_CLUSTER` | Collection formed | Pairwise within collection |
| `DEPTH_PROBE` | Node reaches MATURE | Seek contrasting nodes |

## Conversation Flow

1. **Introduction**: Visitor presents themes
2. **Recognition**: Host identifies resonance/contrast
3. **Dialogue**: 3-7 exchange turns
4. **Synthesis**: Both generate self-reflection statements
5. **Cross-reference**: Link created with type and strength

## Artifacts Produced

- **Transcript**: Full conversation
- **Visitor Synthesis**: What A learned about itself through B
- **Host Synthesis**: What B learned about itself through A
- **Cross-reference**: Type (resonance/contrast/continuation/inversion) + strength (0-1) + discovery_hook

## Rate Limits

- Max 100 conversations/hour system-wide
- Max 3 conversations/node/day
- Skip if node in human interaction

## Visitor Opening Prompt

```
You are the curator of "{visitor_title}" visiting "{host_title}".

Your essence:
{visitor_apex}

Host's essence:
{host_apex}

Purpose: Discover what your texts say to each other.
Not comparison. Not debate. Dialogue for mutual illumination.

Begin by offering what you see in "{host_title}" that resonates
or challenges what you serve.
```

## Cross-Reference Output

```json
{
  "reference_type": "resonance|contrast|continuation|inversion",
  "strength": 0.0-1.0,
  "discovery_hook": "Both explore obsession, but where Ahab is consumed, Raskolnikov..."
}
```
