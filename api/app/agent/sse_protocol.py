import json
from enum import Enum


class SSEEventType(str, Enum):
    THINKING = "thinking"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    TOKEN = "token"
    DONE = "done"
    ERROR = "error"
    HEARTBEAT = "heartbeat"


def sse_event(
    event_type: SSEEventType,
    data: dict,
    request_id: str | None = None,
) -> dict:
    """Format an SSE event dict for sse-starlette EventSourceResponse.

    Includes request_id in data envelope when provided (enables frontend
    dedup on reconnect).
    """
    if request_id:
        data = {"request_id": request_id, **data}
    return {"event": event_type.value, "data": json.dumps(data, ensure_ascii=False)}


def sse_thinking(status: str = "analyzing", request_id: str | None = None) -> dict:
    return sse_event(SSEEventType.THINKING, {"status": status}, request_id=request_id)


def sse_tool_call(
    tool_name: str, args: dict, call_id: str, request_id: str | None = None
) -> dict:
    return sse_event(
        SSEEventType.TOOL_CALL,
        {"tool": tool_name, "args": args, "call_id": call_id},
        request_id=request_id,
    )


def sse_tool_result(
    tool_name: str,
    summary: str,
    call_id: str,
    success: bool = True,
    data: dict | None = None,
    request_id: str | None = None,
) -> dict:
    payload: dict = {
        "tool": tool_name,
        "summary": summary,
        "call_id": call_id,
        "success": success,
    }
    if data:
        payload["data"] = data
    return sse_event(SSEEventType.TOOL_RESULT, payload, request_id=request_id)


def sse_token(text: str, request_id: str | None = None) -> dict:
    return sse_event(SSEEventType.TOKEN, {"text": text}, request_id=request_id)


def sse_done(
    output: str, usage: dict | None = None, request_id: str | None = None
) -> dict:
    return sse_event(
        SSEEventType.DONE,
        {"output": output, "usage": usage or {}},
        request_id=request_id,
    )


def sse_error(
    message: str, code: str | None = None, request_id: str | None = None
) -> dict:
    return sse_event(
        SSEEventType.ERROR, {"message": message, "code": code}, request_id=request_id
    )


def sse_heartbeat() -> dict:
    return sse_event(SSEEventType.HEARTBEAT, {})
