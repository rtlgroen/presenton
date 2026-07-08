from fastapi import HTTPException
from openai import APIError as OpenAIAPIError
from google.genai.errors import APIError as GoogleAPIError
import traceback

from enums.llm_provider import LLMProvider
from llmai.shared.errors import BaseError as LLMAIBaseError
from utils.image_generation_error import openai_error_detail
from utils.llm_provider import get_llm_provider


CHATGPT_AUTH_REQUIRED_HEADER = {"X-Presenton-Auth-Action": "codex-reauth"}
CHATGPT_AUTH_REQUIRED_PREFIX = "CHATGPT_AUTH_REQUIRED:"


def _is_codex_provider() -> bool:
    try:
        return get_llm_provider() == LLMProvider.CODEX
    except Exception:
        return False


def _chatgpt_auth_required_exception(message: object) -> HTTPException:
    detail = str(message or "Your ChatGPT session expired. Please sign in again from Settings.")
    if CHATGPT_AUTH_REQUIRED_PREFIX not in detail:
        detail = f"{CHATGPT_AUTH_REQUIRED_PREFIX} {detail}"
    return HTTPException(
        status_code=401,
        detail=detail,
        headers=CHATGPT_AUTH_REQUIRED_HEADER,
    )


def handle_llm_client_exceptions(e: Exception) -> HTTPException:
    traceback.print_exc()
    if isinstance(e, HTTPException):
        if _is_codex_provider() and e.status_code in {401, 403}:
            return _chatgpt_auth_required_exception(e.detail)
        return e
    if isinstance(e, LLMAIBaseError):
        if _is_codex_provider() and e.status_code in {401, 403}:
            return _chatgpt_auth_required_exception(e.message)
        return HTTPException(status_code=e.status_code, detail=e.message)
    if isinstance(e, OpenAIAPIError):
        status_code = getattr(e, "status_code", None) or 500
        detail = openai_error_detail(e, operation="API request")
        if _is_codex_provider() and status_code in {401, 403}:
            return _chatgpt_auth_required_exception(detail)
        return HTTPException(
            status_code=status_code,
            detail=detail,
        )
    if isinstance(e, GoogleAPIError):
        return HTTPException(status_code=500, detail=f"Google API error: {e.message}")
    return HTTPException(status_code=500, detail=f"LLM API error: {e}")
