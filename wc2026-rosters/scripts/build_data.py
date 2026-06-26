import json
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timezone
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
PDF_PATH = ROOT.parents[0] / "SquadLists-English.pdf"

REF_PAGE = "https://www.lionmanlabs.top/WorldCup2026/teams.html"
FIFA_TEAMS_MODULE = (
    "https://cxm-api.fifa.com/fifaplusweb/api/sections/"
    "teamsModule/4v5Yng3VdGD9c1cpnOIff1?locale=en&limit=100"
)
FIFA_SQUAD = (
    "https://api.fifa.com/api/v3/teams/{team_id}/squad"
    "?idCompetition=17&idSeason=285023&language=en"
)
FIFA_PLAYER = "https://api.fifa.com/api/v3/players/{player_id}?language=en"
FIFA_SQUAD_PDF = "https://fdp.fifa.org/assetspublic/ce281/pdf/SquadLists-English.pdf"
FETCH_PLAYER_DETAILS = False
FETCH_MISSING_PLAYER_DETAILS = True

POSITION_ZH = {
    "Goalkeeper": "门将",
    "Defender": "后卫",
    "Midfielder": "中场",
    "Forward": "前锋",
}
PRIORITY_LABELS = {"S": "重点", "B": "选边", "C": "轮换", "N": "常规"}


def fetch_bytes(url, retries=3):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    last_error = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                return response.read()
        except (urllib.error.URLError, TimeoutError) as exc:
            last_error = exc
            time.sleep(0.8 * (attempt + 1))
    raise RuntimeError(f"Failed to fetch {url}: {last_error}")


def fetch_json(url):
    return json.loads(fetch_bytes(url).decode("utf-8"))


def localized(items, fallback=""):
    if not items:
        return fallback
    for item in items:
        if item.get("Locale") in ("en-GB", "en"):
            return item.get("Description") or fallback
    return items[0].get("Description") or fallback


def parse_reference_meta():
    html = fetch_bytes(REF_PAGE).decode("utf-8")
    meta_match = re.search(r"const META=(\{.*?\});\nconst GROUPS=", html, re.S)
    groups_match = re.search(r"const GROUPS=(\{.*?\});\nconst MD_DATA=", html, re.S)
    if not meta_match or not groups_match:
        raise RuntimeError("Could not find META/GROUPS in reference page.")
    return json.loads(meta_match.group(1)), json.loads(groups_match.group(1))


def ensure_pdf():
    if PDF_PATH.exists() and PDF_PATH.stat().st_size > 100_000:
        return
    PDF_PATH.write_bytes(fetch_bytes(FIFA_SQUAD_PDF))


def clean_text(value):
    return re.sub(r"\s+", " ", value.replace("\x00", "fi")).strip()


def parse_pdf_rows():
    ensure_pdf()
    reader = PdfReader(str(PDF_PATH))
    by_team = {}
    header_re = re.compile(r"^\s*([A-Za-zÀ-ÿ' .-]+)\s+\(([A-Z]{3})\)\s*$")
    coach_re = re.compile(r"^\s*Head coach\s+(.+?)\s{2,}(.+?)\s{2,}(.+?)\s{2,}(.+?)\s*$")
    player_start_re = re.compile(r"^\s*(\d{1,2})\s*([A-Z]{2})\s+")

    for page in reader.pages:
        text = page.extract_text(extraction_mode="layout") or ""
        text = text.replace("\x00", "fi")
        code = None
        for line in text.splitlines():
            header = header_re.match(line)
            if header:
                code = header.group(2)
                by_team.setdefault(code, {"pdfTeamName": clean_text(header.group(1)), "players": {}, "coach": None})
                continue
            if not code:
                continue
            start = player_start_re.match(line)
            dob = re.search(r"\d{2}/\d{2}/\d{4}", line)
            if not start or not dob:
                coach = coach_re.match(line)
                if coach:
                    by_team[code]["coach"] = {
                        "name": clean_text(coach.group(1)),
                        "firstNames": clean_text(coach.group(2)),
                        "lastNames": clean_text(coach.group(3)),
                        "nationality": clean_text(coach.group(4)),
                    }
                continue
            number = int(start.group(1))
            tail_nums = re.findall(r"\d+", line[132:])
            by_team[code]["players"][number] = {
                "number": number,
                "pdfPosition": start.group(2),
                "pdfName": clean_text(line[14:36]),
                "firstNames": clean_text(line[36:57]),
                "lastNames": clean_text(line[57:74]),
                "shirtName": clean_text(line[74:92]),
                "dob": datetime.strptime(dob.group(0), "%d/%m/%Y").date().isoformat(),
                "club": clean_text(line[dob.end():132]),
                "heightCm": int(tail_nums[0]) if len(tail_nums) >= 1 else None,
                "caps": int(tail_nums[1]) if len(tail_nums) >= 2 else None,
                "goals": int(tail_nums[2]) if len(tail_nums) >= 3 else None,
            }
    return by_team


def extract_code(team):
    flag = team.get("teamFlag", "")
    match = re.search(r"/([A-Z]{3})$", flag)
    return match.group(1) if match else None


def age_on_today(iso_date):
    if not iso_date:
        return None
    born = datetime.fromisoformat(iso_date.replace("Z", "+00:00")).date()
    today = date.today()
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))


def date_only(value):
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00")).date().isoformat()


def normalize_photo(*candidates):
    for candidate in candidates:
        if isinstance(candidate, str) and candidate:
            return candidate
        if isinstance(candidate, dict):
            url = candidate.get("PictureUrl") or candidate.get("Url")
            if url:
                return url
    return None


def fetch_player_details(players):
    details = {}
    ids = [p.get("IdPlayer") for p in players if p.get("IdPlayer")]
    with ThreadPoolExecutor(max_workers=16) as pool:
        future_map = {pool.submit(fetch_json, FIFA_PLAYER.format(player_id=pid)): pid for pid in ids}
        for future in as_completed(future_map):
            pid = future_map[future]
            try:
                details[pid] = future.result()
            except Exception as exc:
                print(f"warn: player {pid} detail fetch failed: {exc}", file=sys.stderr)
    return details


def build():
    meta, groups = parse_reference_meta()
    pdf = parse_pdf_rows()
    teams_module = fetch_json(FIFA_TEAMS_MODULE)
    module_teams = {}
    for team in teams_module.get("teams", []):
        code = extract_code(team)
        if code:
            module_teams[code] = team

    teams = []
    for code in [code for group in groups.values() for code in group]:
        ref = meta.get(code, {})
        module_team = module_teams.get(code)
        if not module_team:
            print(f"warn: no FIFA module team for {code}", file=sys.stderr)
            continue

        squad = fetch_json(FIFA_SQUAD.format(team_id=module_team["teamId"]))
        squad_players = squad.get("Players", [])
        if FETCH_PLAYER_DETAILS:
            detail_targets = squad_players
        elif FETCH_MISSING_PLAYER_DETAILS:
            detail_targets = [
                player for player in squad_players
                if not normalize_photo(player.get("PictureUrl"), player.get("ThumbnailUrl"), player.get("PlayerPicture"))
            ]
        else:
            detail_targets = []
        player_details = fetch_player_details(detail_targets) if detail_targets else {}
        pdf_team = pdf.get(code, {"players": {}})
        players = []

        for player in sorted(squad.get("Players", []), key=lambda p: p.get("JerseyNum") or 99):
            number = player.get("JerseyNum")
            detail = player_details.get(player.get("IdPlayer"), {})
            pdf_player = pdf_team.get("players", {}).get(number, {})
            position = localized(player.get("PositionLocalized"), "")
            photo = normalize_photo(
                player.get("PictureUrl"),
                player.get("ThumbnailUrl"),
                player.get("PlayerPicture"),
                detail.get("PictureUrl"),
                detail.get("ThumbnailUrl"),
                detail.get("PlayerPicture"),
            )
            players.append(
                {
                    "id": player.get("IdPlayer"),
                    "number": number,
                    "name": localized(player.get("PlayerName"), localized(detail.get("Name"), "")),
                    "shortName": localized(player.get("ShortName"), localized(detail.get("Alias"), "")),
                    "position": position,
                    "positionZh": POSITION_ZH.get(position, position),
                    "birthDate": date_only(player.get("BirthDate") or detail.get("BirthDate")),
                    "age": age_on_today(player.get("BirthDate") or detail.get("BirthDate")),
                    "birthPlace": detail.get("BirthPlace"),
                    "club": pdf_player.get("club"),
                    "heightCm": int(player.get("Height") or detail.get("Height") or pdf_player.get("heightCm") or 0) or None,
                    "weightKg": int(player.get("Weight") or detail.get("Weight") or 0) or None,
                    "caps": detail.get("InternationalCaps", pdf_player.get("caps")),
                    "goals": detail.get("Goals", pdf_player.get("goals")),
                    "nationality": code,
                    "photo": photo,
                    "photoStatus": "official" if photo else "not_public_in_fifa_api",
                    "fifaProfileApi": FIFA_PLAYER.format(player_id=player.get("IdPlayer")),
                }
            )

        colors = module_team.get("teamEnrichmentData") or {}
        teams.append(
            {
                "code": code,
                "nameZh": ref.get("n", squad.get("TeamName", [{}])[0].get("Description", code)),
                "nameEn": squad.get("TeamName", [{}])[0].get("Description") or module_team.get("teamName"),
                "group": ref.get("g"),
                "stage": module_team.get("stage"),
                "pot": ref.get("p"),
                "strength": ref.get("s"),
                "elo": ref.get("e"),
                "priority": ref.get("pr", "N"),
                "priorityLabel": PRIORITY_LABELS.get(ref.get("pr", "N"), "常规"),
                "confederation": module_team.get("confederationId"),
                "fifaTeamId": module_team.get("teamId"),
                "teamPageUrl": "https://www.fifa.com" + module_team.get("teamPageUrl", ""),
                "flag": (squad.get("PictureUrl") or module_team.get("teamFlag", "")).replace("{format}", "sq").replace("{size}", "4"),
                "colors": {
                    "primary": colors.get("primaryColor") or "#1f2937",
                    "secondary": colors.get("secondaryColor") or "#ffffff",
                    "primaryText": colors.get("primaryTextColor") or "#ffffff",
                    "secondaryText": colors.get("secondaryTextColor") or "#000000",
                },
                "coach": pdf_team.get("coach"),
                "players": players,
            }
        )
        print(f"{code}: {len(players)} players")

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "competition": "FIFA World Cup 2026",
        "seasonId": "285023",
        "competitionId": "17",
        "photoNote": "FIFA public squad/player APIs returned null for player portrait fields on 2026-06-12; photo fields are ready for official portrait URLs when available.",
        "sources": [
            {"label": "FIFA official squad PDF", "url": FIFA_SQUAD_PDF},
            {"label": "FIFA public team/squad API", "url": "https://api.fifa.com/api/v3/"},
            {"label": "Reference visual/team intelligence page", "url": REF_PAGE},
        ],
        "groups": groups,
        "teams": teams,
    }
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    (DATA_DIR / "teams.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    build()
