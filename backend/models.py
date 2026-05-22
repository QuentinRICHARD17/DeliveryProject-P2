from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    pseudo = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    score_global = Column(Integer, default=0)
    streak = Column(Integer, default=0)
    last_action_date = Column(DateTime, nullable=True)

    actions = relationship("Action", back_populates="author")
    badges = relationship("Badge", back_populates="user")
    
    # Nouvelle table d'association pour les actions vues/votées
    seen_actions = relationship("Action", secondary="votes", back_populates="voters")

class Action(Base):
    __tablename__ = "actions"

    id = Column(Integer, primary_key=True, index=True)
    author_id = Column(Integer, ForeignKey("users.id"))
    photo_url = Column(String)
    category = Column(String)
    description = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    upvotes = Column(Integer, default=0)
    downvotes = Column(Integer, default=0)
    status = Column(String, default="pending")

    author = relationship("User", back_populates="actions")
    voters = relationship("User", secondary="votes", back_populates="seen_actions")

class Vote(Base):
    __tablename__ = "votes"
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    action_id = Column(Integer, ForeignKey("actions.id"), primary_key=True)
    vote_type = Column(String) # "up", "down", or "seen"

class Friend(Base):
    __tablename__ = "friends"

    user_id_1 = Column(Integer, ForeignKey("users.id"), primary_key=True)
    user_id_2 = Column(Integer, ForeignKey("users.id"), primary_key=True)
    status = Column(String, default="pending") # "pending", "accepted"

class Badge(Base):
    __tablename__ = "badges"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    badge_name = Column(String)
    unlocked_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="badges")
