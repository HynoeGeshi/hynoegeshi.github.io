from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(eq=True)
class Segment:
    start: float
    end: float
    text: str


@dataclass(eq=True)
class Candidate:
    start: float
    end: float
    score: int
    category: str
    excerpt: str
    reasons: list[str]
    title: str = ""


ADMIN_PHRASES = (
    "switch over", "stop it there", "stopping point", "end the stream", "ending the stream",
    "stream first", "on stream", "discord", "chat", "what y'all say", "chapter", "part three",
    "youtube", "subscribe", "like the stream", "we might stop", "switch to minecraft",
)
SETUP_CUES = (
    "i'm gonna", "im gonna", "i'll try", "try one more", "one more time", "about to", "have to",
    "need to", "let's try", "lets try", "here we go", "watch this", "keeps", "keep rushing",
    "can i", "can we", "i gotta", "i need", "i'm trying", "im trying",
)
EVENT_CUES = (
    "boss", "big guy", "fight", "run", "get away", "got him", "killed", "died", "dead", "death",
    "shot", "shoot", "sniper", "grenade", "explode", "exploded", "hit me", "almost", "mouse",
    "glitch", "bug", "broke", "broken", "found", "rare", "legendary", "drop", "loot", "opened",
    "coming out", "enemy", "courthouse", "no no", "oh no",
)
PAYOFF_CUES = (
    "let's go", "lets go", "finally", "got him", "we did it", "i did it", "that was", "way too close",
    "thought i was", "no way", "ain't no way", "aint no way", "oh my god", "oh my gosh", "why",
    "messed up", "that worked", "i can't believe", "i cant believe", "holy",
)
STREAMER_STYLE_CUES = (
    "bro", "dude", "y'all", "yall", "oh my god", "oh my gosh", "ain't no way", "aint no way",
    "let's go", "lets go", "i'm gonna", "im gonna", "i gotta", "why am i", "come on",
)


def _count(text: str, phrases: tuple[str, ...]) -> int:
    lower = text.lower()
    return sum(1 for phrase in phrases if phrase in lower)


def _tokens(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9']+", text.lower()) if len(w) > 2}


def _window_text(segments: list[Segment], start: float, end: float) -> str:
    return " ".join(s.text.strip() for s in segments if s.end >= start and s.start <= end and s.text.strip())


def _category(text: str) -> str:
    t = text.lower()
    if "mouse" in t or any(x in t for x in ("lag", "glitch", "bug", "broken", "broke")):
        return "technical_fail"
    if any(x in t for x in ("boss", "big guy", "boss fight")):
        return "boss_combat"
    if any(x in t for x in ("way too close", "almost died", "thought i was dead", "barely", "almost")):
        return "clutch_survival"
    if any(x in t for x in ("found", "rare", "legendary", "drop", "loot")):
        return "discovery"
    if any(x in t for x in ("died", "killed me", "i'm dead", "im dead")):
        return "death_fail_rage"
    if any(x in t for x in ("holy", "no way", "oh my god", "oh my gosh")):
        return "reaction"
    return "gameplay_moment"


def _quality_score(setup: str, event: str, payoff: str, full: str, duration: float) -> tuple[int, list[str]]:
    admin = _count(full, ADMIN_PHRASES)
    action = _count(full, EVENT_CUES)
    streamer = _count(full, STREAMER_STYLE_CUES)
    if admin >= 2:
        return 0, ["stream/admin chatter"]
    if action < 2:
        return 0, ["no clear gameplay event"]
    payoff_count = _count(payoff, PAYOFF_CUES)
    if payoff_count == 0:
        return 0, ["no clear payoff/outcome"]
    if streamer == 0:
        return 0, ["no streamer reaction/payoff"]

    setup_score = min(3, _count(setup, SETUP_CUES))
    event_score = min(4, _count(event, EVENT_CUES))
    payoff_score = min(3, payoff_count)
    streamer_score = min(2, streamer)

    score = 42 + setup_score * 6 + event_score * 6 + payoff_score * 6 + streamer_score * 4
    reasons: list[str] = []
    if setup_score:
        reasons.append("clear setup")
    if event_score >= 2:
        reasons.append("real gameplay event")
    if payoff_score:
        reasons.append("reaction/payoff")
    if streamer_score:
        reasons.append("creator-led moment")
    if 18 <= duration <= 38:
        score += 6
        reasons.append("strong Shorts length")
    elif duration < 14 or duration > 45:
        score -= 8
    if admin:
        score -= 28 * admin
        reasons.append("meta chatter penalty")
    return max(0, min(100, score)), reasons


def build_candidates(segments: list[Segment], max_clips: int = 8, min_score: int = 70) -> list[Candidate]:
    if not segments:
        return []
    candidates: list[Candidate] = []
    total_end = segments[-1].end
    for i, seg in enumerate(segments):
        anchor_text = seg.text.lower()
        if _count(anchor_text, EVENT_CUES) == 0 and _count(anchor_text, PAYOFF_CUES) == 0:
            continue

        start = max(0.0, seg.start - 8.0)
        end = min(total_end, max(seg.end + 12.0, start + 18.0))
        j = i + 1
        while j < len(segments) and end - start < 36.0:
            if segments[j].start > end + 3.5:
                break
            end = min(total_end, max(end, segments[j].end + 2.0))
            if _count(segments[j].text, PAYOFF_CUES):
                end = min(total_end, max(end, segments[j].end + 3.0))
                if j + 1 < len(segments) and segments[j + 1].start <= end + 2.0:
                    end = min(total_end, max(end, segments[j + 1].end))
                break
            j += 1

        full = _window_text(segments, start, end)
        setup = _window_text(segments, start, seg.start)
        event = _window_text(segments, max(start, seg.start - 1.0), min(end, seg.end + 5.0))
        payoff = _window_text(segments, seg.end, end)
        score, reasons = _quality_score(setup, event, payoff, full, end - start)
        if score < min_score:
            continue
        c = Candidate(start, end, score, _category(full), full[:900], reasons, "")
        c.title = make_title(c, None)
        candidates.append(c)

    return select_diverse(candidates, max_clips=max_clips)


def select_diverse(candidates: list[Candidate], max_clips: int = 8) -> list[Candidate]:
    ranked = sorted(candidates, key=lambda c: c.score, reverse=True)
    selected: list[Candidate] = []
    for c in ranked:
        duplicate = False
        ct = _tokens(c.excerpt)
        for e in selected:
            if abs(c.start - e.start) < 75.0:
                duplicate = True
                break
            inter = max(0.0, min(c.end, e.end) - max(c.start, e.start))
            smaller = min(c.end - c.start, e.end - e.start)
            if smaller and inter / smaller > 0.20:
                duplicate = True
                break
            et = _tokens(e.excerpt)
            union = ct | et
            if union and len(ct & et) / len(union) >= 0.55:
                duplicate = True
                break
        if not duplicate:
            selected.append(c)
        if len(selected) >= max_clips:
            break
    return selected


def make_title(c: Candidate, topic: str | None) -> str:
    t = c.excerpt.lower()
    if "mouse" in t:
        lead = "My Mouse Betrayed Me at the Worst Time"
    elif "boss" in t and any(x in t for x in ("easy", "hard", "tough")):
        lead = "This Boss Was Way Harder Than It Looked"
    elif "boss" in t or "big guy" in t:
        lead = "I Finally Got Past This Fight"
    elif "way too close" in t or "thought i was dead" in t or "almost died" in t:
        lead = "I Should NOT Have Survived This"
    elif any(x in t for x in ("rare", "legendary", "found", "drop", "loot")):
        lead = "I Found Something I Wasn't Expecting"
    elif "died" in t or "killed me" in t:
        lead = "I Knew This Was Going to End Badly"
    elif "grenade" in t:
        lead = "This Grenade Fight Got Out of Hand"
    elif "enemy" in t and any(x in t for x in ("rush", "coming out", "fight")):
        lead = "They Wouldn't Stop Rushing Me"
    else:
        pieces = [p.strip(" .!?,-") for p in re.split(r"[.!?]+", c.excerpt) if len(p.strip().split()) >= 3]
        lead = (pieces[-1] if pieces else "This Moment Changed the Run")[:58]
        if any(vague in lead.lower() for vague in (
            "this is crazy", "nah this was crazy", "i was not ready for this", "this fight got out of control",
        )):
            lead = "This Fight Changed the Run"
        lead = " ".join(w.capitalize() if i == 0 else w for i, w in enumerate(lead.split()))
    return f"{lead} | {topic}" if topic else lead


def build_short_metadata(c: Candidate, topic: str | None, source_video_id: str | None) -> dict[str, object]:
    title = make_title(c, topic)
    topic_text = (topic or "gaming").strip()
    lower = topic_text.lower()
    if "minecraft" in lower:
        topic_tags = ["Minecraft", "HynoeSMP", "Gaming"]
    elif "gears" in lower:
        topic_tags = ["GearsOfWar", "GearsOfWarEDay", "Gaming"]
    else:
        topic_tags = [re.sub(r"[^A-Za-z0-9]", "", topic_text) or "Gaming", "Gaming"]
    hashtags = list(dict.fromkeys(["Hynoe", "Shorts", *topic_tags]))
    source_line = (
        f"Watch the full stream: https://www.youtube.com/watch?v={source_video_id}"
        if source_video_id else "More full streams on @Hynoe."
    )
    description = f"{title}\n\n{source_line}\n\n" + " ".join(f"#{tag}" for tag in hashtags)
    return {"title": title, "description": description, "hashtags": hashtags}


def caption_cues(segments: list[Segment], start: float, end: float, max_words: int = 5) -> list[tuple[float, float, str]]:
    cues: list[tuple[float, float, str]] = []
    for s in segments:
        if s.end < start or s.start > end:
            continue
        a = max(start, s.start)
        b = min(end, s.end)
        words = s.text.strip().split()
        if not words or b <= a:
            continue
        chunks = [words[i:i + max_words] for i in range(0, len(words), max_words)]
        duration = b - a
        weight = max(1, len(words))
        cursor = a
        for chunk in chunks:
            frac = len(chunk) / weight
            chunk_end = b if chunk is chunks[-1] else min(b, cursor + duration * frac)
            cues.append((cursor - start, chunk_end - start, " ".join(chunk)))
            cursor = chunk_end
    return cues
