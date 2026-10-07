import httpx
from app.config import settings
from app.services import chat


def test_external_provider_requires_explicit_consent(monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "test-key")
    def forbidden(*args, **kwargs):
        raise AssertionError("No external request is allowed without consent")
    monkeypatch.setattr(httpx, "Client", forbidden)
    assert chat.generate_reply("hello", {"scans": []}, [], False)[1] == "local"


def test_provider_payload_and_output_parsing(monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "test-key")
    class Client:
        def __init__(self, **kwargs): pass
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def post(self, url, headers, json):
            assert url == "https://api.openai.com/v1/responses"
            assert json["store"] is False
            assert json["input"][-1]["content"] == "Summarize"
            return httpx.Response(200, request=httpx.Request("POST", url), json={"output": [
                {"type": "message", "content": [{"type": "output_text", "text": "Available estimate: acne 58/100."}]}]})
    monkeypatch.setattr(httpx, "Client", Client)
    assert chat.generate_reply("Summarize", {"scans": []}, [], True) == ("Available estimate: acne 58/100.", "openai")


def test_provider_failure_is_a_labeled_local_fallback(monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "test-key")
    class Client:
        def __init__(self, **kwargs): pass
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def post(self, *args, **kwargs): raise httpx.ReadTimeout("timeout")
    monkeypatch.setattr(httpx, "Client", Client)
    assert chat.generate_reply("hello", {"scans": []}, [], True)[1] == "local_fallback"
