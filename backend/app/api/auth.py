"""Cookie-based JWT access and rotating, database-backed refresh sessions."""
import hashlib
import hmac
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from jose import JWTError, jwt
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.database.models import AuthSession, Profile, User
from app.database.session import get_db

router = APIRouter(prefix="/api", tags=["accounts"])
DB = Annotated[Session, Depends(get_db)]
# Development keys survive reloads; production must configure a private key.
if not settings.debug and settings.jwt_secret_key == "change-me-in-production":
    raise RuntimeError("JWT_SECRET_KEY must be configured when DEBUG=false")


class Credentials(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Enter a valid email address")
        return value


class ProfileInput(BaseModel):
    display_name: str = Field(default="", max_length=80)
    skin_type: str | None = None
    goals: list[str] = Field(default_factory=list, max_length=10)
    consent_data_use: bool = False

    @field_validator("skin_type")
    @classmethod
    def validate_skin_type(cls, value):
        if value is not None and value not in {"dry", "oily", "combination", "normal", "sensitive"}:
            raise ValueError("Invalid skin type")
        return value

    @field_validator("goals")
    @classmethod
    def validate_goals(cls, values):
        if any(len(value) > 100 for value in values):
            raise ValueError("Goals must be at most 100 characters")
        return values


def check_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    if origin and origin not in settings.cors_origin_list:
        if not (settings.debug and re.fullmatch(r"http://(localhost|127\.0\.0\.1):\d+", origin)):
            raise HTTPException(403, "Origin not allowed")


def password_hash(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
    return f"scrypt${salt}${digest}"


_DUMMY_PASSWORD_HASH = password_hash("unused-password")


def optional_user(request: Request) -> User | None:
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        check_origin(request)
    token = request.cookies.get("skin_access")
    if not token:
        if request.cookies.get("skin_refresh") or request.headers.get("x-account-session") == "true":
            raise HTTPException(401, "Session expired; sign in again")
        return None
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        if payload.get("type") != "access" or not payload.get("sub") or not payload.get("sid"):
            raise JWTError()
    except JWTError:
        raise HTTPException(401, "Session expired; sign in again")
    # Session lookup makes logout revoke access immediately, including copied JWTs.
    db_gen = get_db()
    db = next(db_gen)
    try:
        session = db.get(AuthSession, payload["sid"])
        user = db.get(User, payload["sub"])
        if not session or session.user_id != payload["sub"] or session.expires_at <= datetime.now(timezone.utc).replace(tzinfo=None) or not user:
            raise HTTPException(401, "Session expired; sign in again")
        db.expunge(user)
        return user
    finally:
        db_gen.close()


def current_user(user: Annotated[User | None, Depends(optional_user)]) -> User:
    if user is None:
        raise HTTPException(401, "Sign in to continue")
    return user


CurrentUser = Annotated[User, Depends(current_user)]
OptionalUser = Annotated[User | None, Depends(optional_user)]


def public_user(user: User) -> dict:
    return {"id": user.id, "email": user.email}


def issue_session(response: Response, db: Session, user: User) -> dict:
    refresh = secrets.token_urlsafe(48)
    session = AuthSession(user_id=user.id, token_hash=hashlib.sha256(refresh.encode()).hexdigest(),
                          expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=settings.refresh_token_expire_days))
    db.add(session)
    db.flush()
    access = jwt.encode({"sub": user.id, "sid": session.id, "type": "access",
                         "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)},
                        settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    db.commit()
    response.set_cookie("skin_access", access, httponly=True, secure=not settings.debug, samesite="lax",
                        max_age=settings.access_token_expire_minutes * 60, path="/api")
    response.set_cookie("skin_refresh", refresh, httponly=True, secure=not settings.debug, samesite="lax",
                        max_age=settings.refresh_token_expire_days * 86400, path="/api")
    return public_user(user)


@router.post("/auth/register", status_code=201)
def register(body: Credentials, request: Request, response: Response, db: DB):
    check_origin(request)
    user = User(email=body.email, hashed_password=password_hash(body.password))
    db.add(user)
    try:
        db.flush()
        db.add(Profile(user_id=user.id))
        return issue_session(response, db, user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "An account with this email already exists")


@router.post("/auth/login")
def login(body: Credentials, request: Request, response: Response, db: DB):
    check_origin(request)
    user = db.scalar(select(User).where(User.email == body.email))
    # Do an equal-cost hash even for unknown accounts.
    stored = user.hashed_password if user else _DUMMY_PASSWORD_HASH
    _, salt, _ = stored.split("$")
    if not hmac.compare_digest(password_hash(body.password, salt), stored) or not user:
        raise HTTPException(401, "Email or password is incorrect")
    return issue_session(response, db, user)


@router.post("/auth/refresh")
def refresh(request: Request, response: Response, db: DB):
    check_origin(request)
    digest = hashlib.sha256(request.cookies.get("skin_refresh", "").encode()).hexdigest()
    session = db.scalar(select(AuthSession).where(AuthSession.token_hash == digest))
    if not session or session.expires_at <= datetime.now(timezone.utc).replace(tzinfo=None):
        raise HTTPException(401, "Session expired; sign in again")
    user = db.get(User, session.user_id)
    # Conditional deletion prevents two concurrent refreshes using one token.
    removed = db.execute(delete(AuthSession).where(AuthSession.id == session.id, AuthSession.token_hash == digest))
    if removed.rowcount != 1 or user is None:
        db.rollback()
        raise HTTPException(401, "Session expired; sign in again")
    return issue_session(response, db, user)


@router.post("/auth/logout", status_code=204)
def logout(request: Request, response: Response, db: DB):
    check_origin(request)
    digest = hashlib.sha256(request.cookies.get("skin_refresh", "").encode()).hexdigest()
    db.execute(delete(AuthSession).where(AuthSession.token_hash == digest))
    db.commit()
    response.delete_cookie("skin_access", path="/api")
    response.delete_cookie("skin_refresh", path="/api")


@router.get("/auth/me")
def me(user: CurrentUser):
    return public_user(user)


def profile_payload(profile: Profile) -> dict:
    return {"display_name": profile.display_name or "", "skin_type": profile.skin_type,
            "goals": (profile.goals or {}).get("items", []), "consent_data_use": profile.consent_data_use}


@router.get("/profile")
def get_profile(user: CurrentUser, db: DB):
    profile = db.scalar(select(Profile).where(Profile.user_id == user.id))
    return profile_payload(profile)


@router.put("/profile")
def update_profile(body: ProfileInput, user: CurrentUser, db: DB):
    profile = db.scalar(select(Profile).where(Profile.user_id == user.id))
    profile.display_name = body.display_name.strip()
    profile.skin_type = body.skin_type
    profile.goals = {"items": body.goals}
    profile.consent_data_use = body.consent_data_use
    db.commit()
    return profile_payload(profile)

