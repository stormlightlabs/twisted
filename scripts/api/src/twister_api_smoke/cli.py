import argparse
import enum
import json
import os
import sys
import time
from dataclasses import dataclass
from http.client import HTTPConnection
from typing import Any, NoReturn
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urljoin, urlparse
from urllib.request import Request, urlopen


class ANSI(enum.StrEnum):
    RED = "\033[31m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    CYAN = "\033[36m"
    MAGENTA = "\033[35m"
    RESET = "\033[0m"

    def colorize(self, msg: str) -> str:
        return f"{self.value}{msg}{ANSI.RESET.value}"


def echo(msg: str) -> None:
    tag = ANSI.GREEN.colorize("[smoke]")
    print(f"{tag} {msg}")


def fail(msg: str) -> NoReturn:
    tag = ANSI.RED.colorize("[smoke] FAIL")
    print(f"{tag}: {msg}", file=sys.stderr)
    raise SystemExit(1)


@dataclass(frozen=True)
class Options:
    base_url: str
    check: str
    query: str
    document_id: str
    actor_handle: str
    repo_at_uri: str
    profile_at_uri: str
    verbose: bool


def http_get_status(url: str) -> int:
    req = Request(url, method="GET")
    try:
        with urlopen(req, timeout=10) as resp:
            return resp.status
    except HTTPError as err:
        return err.code
    except URLError as err:
        fail(f"request failed for {url}: {err}")


def http_get_json(url: str, params: dict[str, str] | None = None) -> Any:
    if params:
        query = urlencode(params)
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}{query}"

    req = Request(url, method="GET")
    try:
        with urlopen(req, timeout=15) as resp:
            payload = resp.read().decode("utf-8")
            return json.loads(payload)
    except HTTPError as err:
        body = err.read().decode("utf-8", errors="replace")
        fail(f"{url} returned {err.code}: {body}")
    except URLError as err:
        fail(f"request failed for {url}: {err}")
    except json.JSONDecodeError as err:
        fail(f"invalid JSON from {url}: {err}")


def assert_status(url: str, expected: int) -> None:
    actual = http_get_status(url)
    if actual != expected:
        fail(f"{url} returned {actual} (expected {expected})")


def at_uri_to_document_id(at_uri: str) -> str:
    if not at_uri.startswith("at://"):
        fail(f"invalid at uri: {at_uri}")
    trimmed = at_uri[len("at://") :]
    parts = trimmed.split("/", 2)
    if len(parts) != 3 or not all(parts):
        fail(f"invalid at uri: {at_uri}")
    did, collection, rkey = parts
    return f"{did}|{collection}|{rkey}"


def encode_document_id(document_id: str) -> str:
    return quote(document_id, safe="")


def colorize_json(json_str: str, indent=2) -> str:
    """Recursively colorize JSON string for terminal output, retaining indentation.

    CYAN: keys, GREEN: string values, YELLOW: numbers, MAGENTA: booleans/null
    """

    def colorize_and_indent(value: Any, level: int = 0) -> str:
        indent_str = " " * (indent * level)
        if isinstance(value, dict):
            items = []
            for k, v in value.items():
                colored_key = ANSI.CYAN.colorize(json.dumps(k))
                colored_value = colorize_and_indent(v, level + 1)
                items.append(f"{indent_str}  {colored_key}: {colored_value}")
            return "{\n" + ",\n".join(items) + f"\n{indent_str}}}"
        elif isinstance(value, list):
            items = [colorize_and_indent(v, level + 1) for v in value]
            return "[\n" + ",\n".join(f"{indent_str}  {i}" for i in items) + f"\n{indent_str}]"
        elif isinstance(value, str):
            return ANSI.GREEN.colorize(json.dumps(value))
        elif isinstance(value, (int, float)):
            return ANSI.YELLOW.colorize(str(value))
        elif isinstance(value, bool) or value is None:
            return ANSI.MAGENTA.colorize(str(value).lower())
        else:
            return json.dumps(value)

    try:
        parsed = json.loads(json_str)
        return colorize_and_indent(parsed)
    except json.JSONDecodeError:
        return json_str


def maybe_log_json(opts: Options, label: str, payload: Any) -> None:
    if not opts.verbose:
        return
    pretty = json.dumps(payload, indent=2, sort_keys=True)
    echo(f"{label} JSON:\n{colorize_json(pretty)}")


def check_healthz(opts: Options) -> None:
    echo("checking GET /healthz")
    payload = http_get_json(urljoin(opts.base_url, "/healthz"))
    maybe_log_json(opts, "healthz", payload)
    echo("healthz ok")


def check_readyz(opts: Options) -> None:
    echo("checking GET /readyz")
    payload = http_get_json(urljoin(opts.base_url, "/readyz"))
    maybe_log_json(opts, "readyz", payload)
    echo("readyz ok")


def check_search(opts: Options) -> None:
    repo_id = at_uri_to_document_id(opts.repo_at_uri)
    profile_id = at_uri_to_document_id(opts.profile_at_uri)

    echo("checking search with indexed repo fixture")
    repo_payload = http_get_json(urljoin(opts.base_url, "/search"), {"q": "twisted"})
    if not isinstance(repo_payload, dict):
        fail("search response must be a JSON object")
    repo_results = repo_payload.get("results")
    if not isinstance(repo_results, list):
        fail("search response is missing expected fields")
    repo_ids = {
        r.get("id") for r in repo_results if isinstance(r, dict) and isinstance(r.get("id"), str)
    }
    if repo_id not in repo_ids:
        fail(f"repo fixture id not found in search results: {repo_id}")
    maybe_log_json(opts, "search-repo", repo_payload)

    echo("checking search with indexed profile fixture")
    profile_payload = http_get_json(urljoin(opts.base_url, "/search"), {"q": opts.actor_handle})
    if not isinstance(profile_payload, dict):
        fail("profile search response must be a JSON object")
    profile_results = profile_payload.get("results")
    if not isinstance(profile_results, list):
        fail("profile search response is missing expected fields")
    profile_ids = {
        r.get("id") for r in profile_results if isinstance(r, dict) and isinstance(r.get("id"), str)
    }
    if profile_id not in profile_ids:
        fail(f"profile fixture id not found in search results: {profile_id}")
    maybe_log_json(opts, "search-profile", profile_payload)
    echo("search ok")


def check_documents(opts: Options) -> None:
    document_id = opts.document_id
    if not document_id:
        echo("no document id provided, deriving first result from search")
        payload = http_get_json(urljoin(opts.base_url, "/search"), {"q": opts.query})
        results = payload.get("results") if isinstance(payload, dict) else None
        if not isinstance(results, list) or not results:
            fail("document id required or search must return at least one result")
        first = results[0]
        if not isinstance(first, dict) or not isinstance(first.get("id"), str):
            fail("search result missing document id")
        document_id = first["id"]

    encoded = encode_document_id(document_id)
    echo(f"checking GET /documents/{{id}} for {document_id}")
    payload = http_get_json(urljoin(opts.base_url, f"/documents/{encoded}"))
    maybe_log_json(opts, "documents", payload)
    echo("documents ok")


def check_indexing(opts: Options) -> None:
    repo_id = at_uri_to_document_id(opts.repo_at_uri)
    profile_id = at_uri_to_document_id(opts.profile_at_uri)
    repo_encoded = encode_document_id(repo_id)
    profile_encoded = encode_document_id(profile_id)

    profile_url = urljoin(opts.base_url, f"/documents/{profile_encoded}")
    repo_url = urljoin(opts.base_url, f"/documents/{repo_encoded}")

    echo(f"triggering read-through fetch via /actors/{opts.actor_handle}")
    assert_status(urljoin(opts.base_url, f"/actors/{opts.actor_handle}"), 200)

    echo(f"triggering read-through fetch via /actors/{opts.actor_handle}/repos")
    assert_status(urljoin(opts.base_url, f"/actors/{opts.actor_handle}/repos"), 200)

    echo(f"waiting for queued indexing of profile fixture {profile_id}")
    for _ in range(30):
        if http_get_status(profile_url) == 200:
            if opts.verbose:
                payload = http_get_json(profile_url)
                maybe_log_json(opts, "indexing-profile", payload)
            break
        time.sleep(1)
    else:
        fail(f"profile fixture did not become available at /documents/{profile_encoded} within 30s")

    echo(f"waiting for queued indexing of repo fixture {repo_id}")
    for _ in range(30):
        if http_get_status(repo_url) == 200:
            if opts.verbose:
                payload = http_get_json(repo_url)
                maybe_log_json(opts, "indexing-repo", payload)
            echo("indexing ok")
            return
        time.sleep(1)

    fail(f"repo fixture did not become available at /documents/{repo_encoded} within 30s")


def check_activity(opts: Options) -> None:
    echo("checking websocket handshake on /activity/stream")
    parsed = urlparse(opts.base_url)
    if parsed.scheme not in {"http", "https"}:
        fail(f"unsupported base url scheme: {parsed.scheme}")

    host = parsed.hostname
    if host is None:
        fail(f"invalid base url: {opts.base_url}")

    port = parsed.port
    if port is None:
        port = 443 if parsed.scheme == "https" else 80

    path = parsed.path.rstrip("/") + "/activity/stream?wantedCollections=sh.tangled.repo"

    conn = HTTPConnection(host, port, timeout=10)
    try:
        conn.putrequest("GET", path)
        conn.putheader("Connection", "Upgrade")
        conn.putheader("Upgrade", "websocket")
        conn.putheader("Sec-WebSocket-Version", "13")
        conn.putheader("Sec-WebSocket-Key", "dGhlIHNhbXBsZSBub25jZQ==")
        conn.endheaders()
        resp = conn.getresponse()
        if resp.status != 101:
            fail(f"/activity/stream websocket handshake returned {resp.status} (expected 101)")
        echo("activity handshake ok")
    finally:
        conn.close()


CHECKS: dict[str, Any] = {
    "healthz": check_healthz,
    "readyz": check_readyz,
    "search": check_search,
    "documents": check_documents,
    "indexing": check_indexing,
    "activity": check_activity,
}


def parse_args(argv: list[str]) -> Options:
    parser = argparse.ArgumentParser(description="Twister API smoke checks")
    parser.add_argument(
        "--base-url",
        default=None,
        help="Twister API base URL (default env TWISTER_API_BASE_URL or http://localhost:8080)",
    )
    parser.add_argument(
        "--check",
        choices=["all", *CHECKS.keys()],
        default="all",
        help="Which check to run",
    )
    parser.add_argument(
        "--query", default="twisted", help="Search query for search/documents checks"
    )
    parser.add_argument("--document-id", default="", help="Document ID for documents check")
    parser.add_argument(
        "--actor-handle",
        default="desertthunder.dev",
        help="Actor handle used to trigger read-through indexing",
    )
    parser.add_argument(
        "--repo-at-uri",
        default="at://did:plc:xg2vq45muivyy3xwatcehspu/sh.tangled.repo/3mho6hukiei22",
        help="Repo AT URI expected to be fetched and indexed by smoke checks",
    )
    parser.add_argument(
        "--profile-at-uri",
        default="at://did:plc:xg2vq45muivyy3xwatcehspu/sh.tangled.actor.profile/self",
        help="Profile AT URI expected to be fetched and indexed by smoke checks",
    )
    parser.add_argument(
        "--verbose", action="store_true", help="Print JSON payloads returned by smoke endpoints"
    )

    ns = parser.parse_args(argv)
    base_url = ns.base_url or os.environ.get("TWISTER_API_BASE_URL", "http://localhost:8080")
    return Options(
        base_url=base_url,
        check=ns.check,
        query=ns.query,
        document_id=ns.document_id,
        actor_handle=ns.actor_handle,
        repo_at_uri=ns.repo_at_uri,
        profile_at_uri=ns.profile_at_uri,
        verbose=ns.verbose,
    )


def main(argv: list[str] | None = None) -> int:
    opts = parse_args(sys.argv[1:] if argv is None else argv)
    if opts.check == "all":
        for name in (
            "healthz",
            "readyz",
            "indexing",
            "search",
            "documents",
            "activity",
        ):
            CHECKS[name](opts)
        echo("all API smoke checks passed")
        return 0

    CHECKS[opts.check](opts)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
