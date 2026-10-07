"""
SQLAlchemy models for the core schema (spec §21). Phase 1 ships the schema
itself so Alembic migrations exist from day one; nothing here is wired to
live API routes yet — that starts in Phase 9 (auth) and Phase 3+ (scans).
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    profile: Mapped["Profile"] = relationship(back_populates="user", uselist=False)
    scans: Mapped[list["SkinScan"]] = relationship(back_populates="user")
    routines: Mapped[list["Routine"]] = relationship(back_populates="user")
    chat_sessions: Mapped[list["ChatSession"]] = relationship(back_populates="user")


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True)
    display_name: Mapped[str | None] = mapped_column(String, nullable=True)
    skin_type: Mapped[str | None] = mapped_column(String, nullable=True)
    goals: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    consent_data_use: Mapped[bool] = mapped_column(default=False)
    data_retention_days: Mapped[int | None] = mapped_column(Integer, nullable=True)

    user: Mapped[User] = relationship(back_populates="profile")


class SkinScan(Base):
    __tablename__ = "skin_scans"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    capture_mode: Mapped[str] = mapped_column(String)  # "camera" | "truedepth"
    result: Mapped[dict | None] = mapped_column(JSON(none_as_null=True), nullable=True)
    overall_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    skin_type_estimate: Mapped[str | None] = mapped_column(String, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    quality: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    user: Mapped[User] = relationship(back_populates="scans")
    images: Mapped[list["ScanImage"]] = relationship(back_populates="scan")
    metrics: Mapped[list["SkinMetric"]] = relationship(back_populates="scan")
    regions: Mapped[list["SkinRegion"]] = relationship(back_populates="scan")


class ScanImage(Base):
    __tablename__ = "scan_images"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    scan_id: Mapped[str] = mapped_column(ForeignKey("skin_scans.id"))
    angle: Mapped[str] = mapped_column(String)  # "front" | "left" | "right"
    storage_key: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    scan: Mapped[SkinScan] = relationship(back_populates="images")


class SkinMetric(Base):
    """One row per (scan, indicator) — e.g. (scan_1, 'acne', 25)."""

    __tablename__ = "skin_metrics"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    scan_id: Mapped[str] = mapped_column(ForeignKey("skin_scans.id"))
    metric_name: Mapped[str] = mapped_column(String)
    value: Mapped[float] = mapped_column(Float)

    scan: Mapped[SkinScan] = relationship(back_populates="metrics")


class SkinRegion(Base):
    """One row per (scan, face region) with that region's metric scores."""

    __tablename__ = "skin_regions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    scan_id: Mapped[str] = mapped_column(ForeignKey("skin_scans.id"))
    region_name: Mapped[str] = mapped_column(String)  # e.g. "forehead"
    metrics: Mapped[dict] = mapped_column(JSON)

    scan: Mapped[SkinScan] = relationship(back_populates="regions")


class Recommendation(Base):
    __tablename__ = "recommendations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    scan_id: Mapped[str] = mapped_column(ForeignKey("skin_scans.id"))
    goal: Mapped[str] = mapped_column(String)
    priority: Mapped[str] = mapped_column(String)  # "low" | "medium" | "high"
    payload: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)


class Routine(Base):
    __tablename__ = "routines"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    morning: Mapped[list] = mapped_column(JSON, default=list)
    evening: Mapped[list] = mapped_column(JSON, default=list)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    user: Mapped[User] = relationship(back_populates="routines")


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    user: Mapped[User] = relationship(back_populates="chat_sessions")
    messages: Mapped[list["ChatMessage"]] = relationship(back_populates="session")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(ForeignKey("chat_sessions.id"))
    role: Mapped[str] = mapped_column(String)  # "user" | "assistant"
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    session: Mapped[ChatSession] = relationship(back_populates="messages")


class AuthSession(Base):
    __tablename__ = "auth_sessions"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)

