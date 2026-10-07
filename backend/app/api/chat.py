from fastapi import APIRouter
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import delete, select
from app.api.auth import CurrentUser, DB
from app.config import settings
from app.database.models import ChatSession, ChatMessage, SkinScan, Routine, Profile
from app.services.chat import generate_reply

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatInput(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    allow_external_ai: bool = False

    @field_validator("message")
    @classmethod
    def not_blank(cls, value):
        if not value.strip():
            raise ValueError("Message cannot be blank")
        return value.strip()


def messages_for(user_id, db):
    return list(reversed(db.scalars(select(ChatMessage).join(ChatSession)
        .where(ChatSession.user_id == user_id).order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc()).limit(100)).all()))


@router.get("/history")
def history(user: CurrentUser, db: DB):
    return {"ai_available": bool(settings.openai_api_key), "messages": [
        {"id": item.id, "role": item.role, "content": item.content, "created_at": item.created_at.isoformat() + "Z"}
        for item in messages_for(user.id, db)]}


@router.post("")
def chat(body: ChatInput, user: CurrentUser, db: DB):
    session = db.scalar(select(ChatSession).where(ChatSession.user_id == user.id).order_by(ChatSession.created_at.desc()))
    if session is None:
        session = ChatSession(user_id=user.id)
        db.add(session)
        db.flush()
    rows = db.scalars(select(SkinScan).where(SkinScan.user_id == user.id)
                      .order_by(SkinScan.created_at.desc()).limit(100))
    scans = []
    for row in rows:
        result = row.result
        if not result:
            continue
        scans.append({"created_at": row.created_at.isoformat() + "Z",
                      "metrics": {key: value for key, value in result["metrics"].items()
                                  if key not in result.get("mock_metrics", [])}})
        if len(scans) == 5:
            break
    routine = db.scalar(select(Routine).where(Routine.user_id == user.id))
    profile = db.scalar(select(Profile).where(Profile.user_id == user.id))
    context = {"scans": scans, "routine": {"morning": routine.morning, "evening": routine.evening} if routine else None,
               "self_reported_skin_type": profile.skin_type if profile else None}
    previous = [{"role": item.role, "content": item.content} for item in messages_for(user.id, db)]
    answer, provider = generate_reply(body.message, context, previous, body.allow_external_ai)
    db.add_all([ChatMessage(session_id=session.id, role="user", content=body.message),
                ChatMessage(session_id=session.id, role="assistant", content=answer)])
    db.commit()
    return {"answer": answer, "provider": provider}


@router.delete("/history", status_code=204)
def clear_history(user: CurrentUser, db: DB):
    sessions = select(ChatSession.id).where(ChatSession.user_id == user.id)
    db.execute(delete(ChatMessage).where(ChatMessage.session_id.in_(sessions)))
    db.execute(delete(ChatSession).where(ChatSession.user_id == user.id))
    db.commit()
